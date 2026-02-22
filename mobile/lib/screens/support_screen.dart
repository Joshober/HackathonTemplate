import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _textController = TextEditingController();
  final List<File> _attachments = [];
  final List<Map<String, String>> _messages = [];
  bool _loading = false;
  String? _error;
  String? _lastReply;

  @override
  void dispose() {
    _textController.dispose();
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

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty && _attachments.isEmpty) return;
    if (_loading) return;

    _textController.clear();
    setState(() {
      _messages.add({'role': 'user', 'content': text.isEmpty ? '(attachment)' : text});
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiClient>();
      final auth = context.read<AuthProvider>();
      List<File> images = [];
      File? video;
      for (final f in _attachments) {
        final p = f.path.toLowerCase();
        if (p.endsWith('.mp4') || p.endsWith('.mov') || p.endsWith('.webm')) {
          video = f;
        } else {
          images.add(f);
        }
      }

      final result = await api.chatPipeline(
        text: text.isEmpty ? null : text,
        messages: _messages.map((m) => Map<String, String>.from(m)).toList(),
        mode: 'support',
        userEmail: auth.user?.email,
        userId: auth.user?.sub,
        images: images.isEmpty ? null : images,
        video: video,
      );

      if (!mounted) return;
      final reply = result['message'] as String? ?? '';
      setState(() {
        _messages.add({'role': 'assistant', 'content': reply});
        _attachments.clear();
        _lastReply = reply;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _createTicket() async {
    final title = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final c = TextEditingController();
        return AlertDialog(
          title: const Text('Create ticket'),
          content: TextField(
            controller: c,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
    if (title == null || title.isEmpty) return;
    try {
      final api = context.read<ApiClient>();
      final auth = context.read<AuthProvider>();
      await api.createTicket(
        title: title,
        description: _lastReply ?? 'Support conversation',
        userEmail: auth.user?.email,
        conversationSummary: _lastReply,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket created')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tech Support'),
        actions: [
          if (_lastReply != null)
            IconButton(
              icon: const Icon(Icons.confirmation_number),
              onPressed: _createTicket,
              tooltip: 'Create ticket',
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
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
                      color: isUser ? AppTheme.primary.withOpacity(0.3) : null,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(m['content'] ?? ''),
                  ),
                );
              },
            ),
          ),
          if (_attachments.isNotEmpty)
            SizedBox(
              height: 72,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _attachments.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(_attachments[i], width: 64, height: 64, fit: BoxFit.cover),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => setState(() => _attachments.removeAt(i)),
                        ),
                      ),
                    ],
                  ),
                ),
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
                    decoration: const InputDecoration(hintText: 'Describe your issue...'),
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
