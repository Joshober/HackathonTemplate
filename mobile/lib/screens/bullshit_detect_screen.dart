import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:convert';

import '../theme/app_theme.dart';
import '../services/api_client.dart';

class BullshitDetectScreen extends StatefulWidget {
  const BullshitDetectScreen({super.key});

  @override
  State<BullshitDetectScreen> createState() => _BullshitDetectScreenState();
}

class _BullshitDetectScreenState extends State<BullshitDetectScreen> {
  final _textController = TextEditingController();
  final List<File> _images = [];
  File? _audio;
  File? _video;
  bool _tts = false;
  bool _loading = false;
  String? _readAloud;
  String? _analysis;
  String? _error;
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void dispose() {
    _textController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (x != null) setState(() => _images.add(File(x.path)));
  }

  Future<void> _pickAudio() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.audio, allowMultiple: false);
    if (result != null && result.files.single.path != null) {
      setState(() => _audio = File(result.files.single.path!));
    }
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final x = await picker.pickVideo(source: ImageSource.gallery);
    if (x != null) setState(() => _video = File(x.path));
  }

  Future<void> _analyze() async {
    final text = _textController.text.trim();
    if (text.isEmpty && _images.isEmpty && _audio == null && _video == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add text, image, audio, or video')));
      return;
    }
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      _readAloud = null;
      _analysis = null;
    });
    try {
      final api = context.read<ApiClient>();
      final result = await api.bullshitDetectPipeline(
        text: text.isEmpty ? null : text,
        images: _images.isEmpty ? null : _images,
        audio: _audio,
        video: _video,
        tts: _tts,
      );
      if (!mounted) return;
      setState(() {
        _readAloud = result['read_aloud'] as String?;
        _analysis = result['analysis'] as String?;
        _loading = false;
      });
      final audioB64 = result['audio_base64'] as String?;
      if (audioB64 != null && mounted) {
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/bs_${DateTime.now().millisecondsSinceEpoch}.mp3');
        await file.writeAsBytes(base64Decode(audioB64));
        await _audioPlayer.play(DeviceFileSource(file.path));
      }
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reality Check')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _textController,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Document or text to check',
                  hintText: 'Paste text or add images/audio/video below',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('TTS (read aloud):'),
                  Switch(value: _tts, onChanged: (v) => setState(() => _tts = v)),
                ],
              ),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(avatar: const Icon(Icons.image, size: 20), label: const Text('Add image'), onPressed: _pickImage),
                  ActionChip(avatar: const Icon(Icons.audiotrack, size: 20), label: const Text('Add audio'), onPressed: _pickAudio),
                  ActionChip(avatar: const Icon(Icons.videocam, size: 20), label: const Text('Add video'), onPressed: _pickVideo),
                ],
              ),
              if (_audio != null) Chip(label: const Text('Audio attached'), onDeleted: () => setState(() => _audio = null)),
              if (_images.isNotEmpty)
                SizedBox(
                  height: 80,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _images.length,
                    itemBuilder: (context, i) => Stack(
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(_images[i], width: 72, height: 72, fit: BoxFit.cover),
                          ),
                        ),
                        Positioned(
                          top: 0,
                          right: 8,
                          child: IconButton(
                            icon: const Icon(Icons.close, size: 20),
                            onPressed: () => setState(() => _images.removeAt(i)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_video != null)
                Chip(
                  label: const Text('Video attached'),
                  onDeleted: () => setState(() => _video = null),
                ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : _analyze,
                child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)) : const Text('Analyze'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              if (_readAloud != null) ...[
                const SizedBox(height: 24),
                Text('Read aloud', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppTheme.primary)),
                const SizedBox(height: 4),
                Text(_readAloud!),
              ],
              if (_analysis != null) ...[
                const SizedBox(height: 16),
                Text('Analysis', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(_analysis!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
