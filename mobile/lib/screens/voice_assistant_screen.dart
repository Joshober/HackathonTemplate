import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'dart:convert';

import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class VoiceAssistantScreen extends StatefulWidget {
  const VoiceAssistantScreen({super.key});

  @override
  State<VoiceAssistantScreen> createState() => _VoiceAssistantScreenState();
}

class _VoiceAssistantScreenState extends State<VoiceAssistantScreen> {
  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();
  bool _recording = false;
  bool _loading = false;
  String? _lastReply;
  String? _error;

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggleRecord() async {
    if (_loading) return;
    if (_recording) {
      final path = await _recorder.stop();
      if (path == null || !mounted) return;
      setState(() {
        _recording = false;
        _loading = true;
        _error = null;
      });
      try {
        final api = context.read<ApiClient>();
        final auth = context.read<AuthProvider>();
        final result = await api.chatPipeline(
          audio: File(path),
          source: 'voice-assistant',
          userEmail: auth.user?.email,
          userId: auth.user?.sub,
          tts: true,
        );
        if (!mounted) return;
        final reply = result['message'] as String? ?? '';
        setState(() {
          _lastReply = reply;
          _loading = false;
        });
        final audioB64 = result['audio_base64'] as String?;
        if (audioB64 != null && mounted) {
          final dir = await getTemporaryDirectory();
          final file = File('${dir.path}/va_${DateTime.now().millisecondsSinceEpoch}.mp3');
          await file.writeAsBytes(base64Decode(audioB64));
          await _player.play(DeviceFileSource(file.path));
        }
      } catch (e) {
        if (mounted) setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
      return;
    }
    if (await _recorder.hasPermission()) {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 44100, numChannels: 1), path: path);
      setState(() => _recording = true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Microphone permission required')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice Assistant')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Hold to talk – Claude Home™',
                style: TextStyle(fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              Center(
                child: GestureDetector(
                  onTap: _loading ? null : _toggleRecord,
                  onLongPress: _recording ? null : () async => await _toggleRecord(),
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _recording ? Colors.red : (_loading ? Colors.grey : AppTheme.primary),
                    ),
                    child: Icon(
                      _recording ? Icons.stop : Icons.mic,
                      size: 48,
                      color: _recording || _loading ? Colors.white : Colors.black,
                    ),
                  ),
                ),
              ),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.only(top: 24),
                  child: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
                ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              if (_lastReply != null) ...[
                const SizedBox(height: 24),
                Text('Response', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardTheme.color,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(_lastReply!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
