import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';
import '../providers/auth_provider.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Claude Home™',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: AppTheme.primary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your sarcastic domestic assistant',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.grey),
                ),
                const SizedBox(height: 48),
                if (auth.loading)
                  const CircularProgressIndicator(color: AppTheme.primary)
                else if (auth.isAuthenticated) ...[
                  ElevatedButton(
                    onPressed: () => context.go('/dashboard'),
                    child: const Text('Dashboard'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => context.go('/bullshit'),
                    child: const Text('Reality Check (public)'),
                  ),
                ] else ...[
                  ElevatedButton(
                    onPressed: () => context.push('/login'),
                    child: const Text("Let's Get Weird – Login"),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => context.push('/register'),
                    child: const Text('Register'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => context.go('/bullshit'),
                    child: const Text('Reality Check (no login)'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
