import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/profile.dart';
import '../services/api_client.dart';

class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key, this.isNew = false});

  final bool isNew;

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  final _nameController = TextEditingController();
  final _bioController = TextEditingController();
  File? _image;
  bool _loading = false;
  Profile? _existing;

  @override
  void initState() {
    super.initState();
    if (!widget.isNew) _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<ApiClient>();
      final p = await api.getProfile();
      if (mounted) {
        setState(() {
          _existing = p;
          _nameController.text = p.displayName;
          _bioController.text = p.bio;
        });
      }
    } catch (_) {
      if (mounted) context.go('/profile/new');
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 85);
    if (x != null) setState(() => _image = File(x.path));
  }

  Future<void> _submit() async {
    if (_loading) return;
    final name = _nameController.text.trim();
    final bio = _bioController.text;
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Display name required')));
      return;
    }
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      if (widget.isNew || _existing == null) {
        await api.createProfile(displayName: name, bio: bio, image: _image);
      } else {
        await api.updateProfile(displayName: name, bio: bio, image: _image);
      }
      if (!mounted) return;
      context.go('/profile');
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.isNew ? 'Create Profile' : 'Edit Profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GestureDetector(
                onTap: _pickImage,
                child: Center(
                  child: _image != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(48),
                          child: Image.file(_image!, width: 96, height: 96, fit: BoxFit.cover),
                        )
                      : CircleAvatar(
                          radius: 48,
                          child: Icon(Icons.add_a_photo, size: 40),
                        ),
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _bioController,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Bio'),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
