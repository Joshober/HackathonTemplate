import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';

class TutorScreen extends StatefulWidget {
  const TutorScreen({super.key});

  @override
  State<TutorScreen> createState() => _TutorScreenState();
}

class _TutorScreenState extends State<TutorScreen> {
  final _questionController = TextEditingController();
  final List<File> _images = [];
  File? _video;
  bool _loading = false;
  String? _fun;
  List<String>? _help;
  String? _error;

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (x != null) setState(() => _images.add(File(x.path)));
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final x = await picker.pickVideo(source: ImageSource.gallery);
    if (x != null) setState(() => _video = File(x.path));
  }

  Future<void> _ask() async {
    final q = _questionController.text.trim();
    if (q.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a question')));
      return;
    }
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      _fun = null;
      _help = null;
    });
    try {
      final api = context.read<ApiClient>();
      List<String>? imagesBase64;
      if (_images.isNotEmpty) {
        imagesBase64 = [];
        for (final f in _images) {
          imagesBase64.add(base64Encode(await f.readAsBytes()));
        }
      }
      String? videoB64;
      if (_video != null) {
        videoB64 = base64Encode(await _video!.readAsBytes());
      }
      final result = await api.askTutor(
        q,
        images: imagesBase64,
        videoB64: videoB64,
        videoMime: _video != null ? 'video/mp4' : null,
      );
      if (!mounted) return;
      setState(() {
        _fun = result['fun'] as String?;
        _help = (result['help'] as List<dynamic>?)?.map((e) => e.toString()).toList();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Tutor')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _questionController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Question',
                  hintText: 'Ask the Weekend Energy Tutor...',
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.image, size: 20),
                    label: const Text('Add image'),
                    onPressed: _pickImage,
                  ),
                  if (_video != null)
                    Chip(
                      label: const Text('Video attached'),
                      onDeleted: () => setState(() => _video = null),
                    )
                  else
                    ActionChip(
                      avatar: const Icon(Icons.videocam, size: 20),
                      label: const Text('Add video'),
                      onPressed: _pickVideo,
                    ),
                ],
              ),
              if (_images.isNotEmpty)
                SizedBox(
                  height: 80,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _images.length,
                    itemBuilder: (context, i) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(_images[i], width: 72, height: 72, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: GestureDetector(
                              onTap: () => setState(() => _images.removeAt(i)),
                              child: const Icon(Icons.close),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : _ask,
                child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Ask Tutor'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              if (_fun != null) ...[
                const SizedBox(height: 24),
                Text('Fun', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(_fun!),
                if (_help != null && _help!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('Help', style: Theme.of(context).textTheme.titleMedium),
                  ..._help!.map((h) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• '),
                            Expanded(child: Text(h)),
                          ],
                        ),
                      )),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
