import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'dart:io';

import '../services/api_client.dart';

class VoiceTtsScreen extends StatefulWidget {
  const VoiceTtsScreen({super.key});

  @override
  State<VoiceTtsScreen> createState() => _VoiceTtsScreenState();
}

class _VoiceTtsScreenState extends State<VoiceTtsScreen> {
  final _textController = TextEditingController();
  String _provider = 'openai';
  bool _loading = false;
  String? _error;
  final AudioPlayer _player = AudioPlayer();

  @override
  void dispose() {
    _textController.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final text = _textController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter text')));
      return;
    }
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final bytes = await api.generateVoice(
        text: text,
        provider: _provider,
        voice: _provider == 'openai' ? 'coral' : null,
      );
      if (!mounted) return;
      if (bytes.isEmpty) {
        setState(() {
          _loading = false;
          _error = 'No audio returned';
        });
        return;
      }
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/tts_${DateTime.now().millisecondsSinceEpoch}.mp3');
      await file.writeAsBytes(bytes);
      await _player.play(DeviceFileSource(file.path));
      setState(() => _loading = false);
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
      appBar: AppBar(title: const Text('Text to Speech')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _textController,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Text',
                  hintText: 'Enter text to convert to speech...',
                ),
              ),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'openai', label: Text('OpenAI')),
                  ButtonSegment(value: 'magic_hour', label: Text('Magic Hour')),
                ],
                selected: {_provider},
                onSelectionChanged: (s) => setState(() => _provider = s.first),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _generate,
                child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)) : const Text('Generate & Play'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
