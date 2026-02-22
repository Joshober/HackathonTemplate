import 'dart:convert';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';

import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final List<Map<String, String>> _messages = [];
  final List<File> _attachments = [];
  String _mode = 'assistant';
  bool _loading = false;
  String? _error;
  final AudioPlayer _audioPlayer = AudioPlayer();

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (x != null) setState(() => _attachments.add(File(x.path)));
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final x = await picker.pickVideo(source: ImageSource.gallery);
    if (x != null) setState(() => _attachments.add(File(x.path)));
  }

  void _removeAttachment(int i) {
    setState(() => _attachments.removeAt(i));
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty && _attachments.isEmpty) return;
    if (_loading) return;

    _textController.clear();
    final userContent = text.isEmpty ? '(attachment)' : text;
    setState(() {
      _messages.add({'role': 'user', 'content': userContent});
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiClient>();
      final auth = context.read<AuthProvider>();
      List<String>? imagesBase64;
      File? video;
      List<File> images = [];
      for (final f in _attachments) {
        final ext = f.path.toLowerCase();
        if (ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm')) {
          video = f;
        } else {
          images.add(f);
        }
      }
      if (images.isNotEmpty) {
        imagesBase64 = [];
        for (final f in images) {
          final bytes = await f.readAsBytes();
          imagesBase64.add(base64Encode(bytes));
        }
      }
      String? videoB64;
      String? videoMime;
      if (video != null) {
        final bytes = await video.readAsBytes();
        videoB64 = base64Encode(bytes);
        videoMime = 'video/mp4';
      }

      Map<String, dynamic> result;
      if (images.isEmpty && video == null) {
        result = await api.sendChatMessage(
          messages: [..._messages.map((m) => Map<String, String>.from(m))],
          mode: _mode,
          userEmail: auth.user?.email,
          userId: auth.user?.sub,
        );
      } else {
        result = await api.chatPipeline(
          text: text.isEmpty ? null : text,
          messages: _messages.map((m) => Map<String, String>.from(m)).toList(),
          mode: _mode,
          userEmail: auth.user?.email,
          userId: auth.user?.sub,
          images: images.isEmpty ? null : images,
          video: video,
        );
      }

      if (!mounted) return;
      final reply = result['message'] as String? ?? '';
      setState(() {
        _messages.add({'role': 'assistant', 'content': reply});
        _attachments.clear();
        _loading = false;
      });

      final audioB64 = result['audio_base64'] as String?;
      if (audioB64 != null && mounted) {
        final dir = await getTemporaryDirectory();
        final file = File('${dir.path}/tts_${DateTime.now().millisecondsSinceEpoch}.mp3');
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
      appBar: AppBar(
        title: const Text('Chaos Logs'),
        actions: [
          PopupMenuButton<String>(
            initialValue: _mode,
            tooltip: 'Mode',
            onSelected: (v) => setState(() => _mode = v),
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'assistant', child: Text('Assistant')),
              const PopupMenuItem(value: 'roast', child: Text('Roast')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_mode == 'roast' ? 'Roast' : 'Assistant'),
                  const Icon(Icons.arrow_drop_down),
                ],
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(8),
              itemCount: _messages.length + (_error != null ? 1 : 0),
              itemBuilder: (context, i) {
                if (_error != null && i == _messages.length) {
                  return Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  );
                }
                final m = _messages[i];
                final isUser = m['role'] == 'user';
                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isUser ? AppTheme.primary.withOpacity(0.3) : Theme.of(context).cardTheme.color,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(m['content'] ?? '', style: TextStyle(color: isUser ? Colors.black : null)),
                  ),
                );
              },
            ),
          ),
          if (_attachments.isNotEmpty)
            SizedBox(
              height: 80,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: _attachments.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(_attachments[i], width: 72, height: 72, fit: BoxFit.cover),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: IconButton(
                          icon: const Icon(Icons.close, size: 20),
                          onPressed: () => _removeAttachment(i),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                IconButton(icon: const Icon(Icons.image), onPressed: _pickImage),
                IconButton(icon: const Icon(Icons.videocam), onPressed: _pickVideo),
                Expanded(
                  child: TextField(
                    controller: _textController,
                    decoration: const InputDecoration(hintText: 'Message...'),
                    maxLines: 2,
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(
                  icon: _loading ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send),
                  onPressed: _loading ? null : _send,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
