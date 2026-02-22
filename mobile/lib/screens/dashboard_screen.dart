import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Claude Home™'),
        actions: [
          IconButton(icon: const Icon(Icons.person), onPressed: () => context.push('/profile')),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await auth.logout();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (user != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Text('Hi, ${user.name.isNotEmpty ? user.name : user.email}!', style: Theme.of(context).textTheme.titleLarge),
                ),
              _GridItem(
                title: 'Chaos Logs',
                subtitle: 'Chat',
                icon: Icons.chat,
                onTap: () => context.push('/chat'),
              ),
              _GridItem(
                title: 'AI Tutor',
                subtitle: 'Weekend Energy Tutor',
                icon: Icons.school,
                onTap: () => context.push('/tutor'),
              ),
              _GridItem(
                title: 'Tech Support',
                subtitle: 'Help & tickets',
                icon: Icons.support_agent,
                onTap: () => context.push('/support'),
              ),
              _GridItem(
                title: 'Voice Assistant',
                subtitle: 'Hey assistant',
                icon: Icons.mic,
                onTap: () => context.push('/voice-assistant'),
              ),
              _GridItem(
                title: 'Reality Check',
                subtitle: 'Bullshit Detect',
                icon: Icons.fact_check,
                onTap: () => context.push('/bullshit'),
              ),
              _GridItem(
                title: 'Pose Attendance',
                subtitle: 'Create or join session',
                icon: Icons.accessibility_new,
                onTap: () => context.push('/pose'),
              ),
              _GridItem(
                title: 'Voice TTS',
                subtitle: 'Text to speech',
                icon: Icons.record_voice_over,
                onTap: () => context.push('/voice-tts'),
              ),
              _GridItem(
                title: 'Profile',
                subtitle: 'Settings',
                icon: Icons.person,
                onTap: () => context.push('/profile'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GridItem extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _GridItem({required this.title, required this.subtitle, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: AppTheme.primary, child: Icon(icon, color: Colors.black)),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
