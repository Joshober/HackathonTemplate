import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class PoseAttendScreen extends StatefulWidget {
  const PoseAttendScreen({super.key, this.joinMode = false});

  final bool joinMode;

  @override
  State<PoseAttendScreen> createState() => _PoseAttendScreenState();
}

class _PoseAttendScreenState extends State<PoseAttendScreen> {
  final _passwordController = TextEditingController();
  String? _sessionPassword;
  List<Map<String, dynamic>>? _poses;
  bool _loading = false;
  String? _error;
  final List<File?> _poseImages = [null, null, null];

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _pickPoseImage(int index) async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 512, imageQuality: 80);
    if (x != null) {
      setState(() => _poseImages[index] = File(x.path));
    }
  }

  Future<void> _createSession() async {
    if (_loading) return;
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Login required to create session')));
      return;
    }
    // Backend expects poses: [{ pose: number[] (33*3 keypoints), image: string | null }]
    final posePlaceholder = List<num>.filled(33 * 3, 0);
    final poses = <Map<String, dynamic>>[];
    for (var i = 0; i < 3; i++) {
      final file = _poseImages[i];
      String? imageB64;
      if (file != null) {
        imageB64 = base64Encode(await file.readAsBytes());
      }
      poses.add({'pose': posePlaceholder, 'image': imageB64});
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final result = await api.createPoseSession(poses);
      if (!mounted) return;
      setState(() {
        _sessionPassword = result['password'] as String?;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _joinSession() async {
    final password = _passwordController.text.trim();
    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter session password')));
      return;
    }
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final result = await api.getPoseSession(password);
      if (!mounted) return;
      setState(() {
        _poses = (result['poses'] as List<dynamic>?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.joinMode) {
      return Scaffold(
        appBar: AppBar(title: const Text('Join Pose Session')),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _passwordController,
                  decoration: const InputDecoration(labelText: 'Session password'),
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loading ? null : _joinSession,
                  child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Join'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                if (_poses != null) ...[
                  const SizedBox(height: 24),
                  Text('Poses (${_poses!.length})', style: Theme.of(context).textTheme.titleMedium),
                  ..._poses!.asMap().entries.map((e) => ListTile(
                        title: Text('Pose ${e.key + 1}'),
                        subtitle: e.value['image'] != null ? const Text('Image set') : null,
                      )),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pose Attendance'),
        actions: [
          TextButton(
            onPressed: () => context.push('/pose/join'),
            child: const Text('Join'),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_sessionPassword != null) ...[
                Text('Session created. Share this password:', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                SelectableText(_sessionPassword!, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 24),
              ],
              Text('Capture 3 poses (optional images for reference)', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(3, (i) => GestureDetector(
                      onTap: () => _pickPoseImage(i),
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          border: Border.all(),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: _poseImages[i] != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.file(_poseImages[i]!, fit: BoxFit.cover),
                              )
                            : const Icon(Icons.add_a_photo),
                      ),
                    )),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _createSession,
                child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create Session'),
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
