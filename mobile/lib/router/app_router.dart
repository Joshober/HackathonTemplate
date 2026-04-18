import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../screens/landing_screen.dart';
import '../screens/login_screen.dart';
import '../screens/profile_edit_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/register_screen.dart';
import '../screens/travel_companion_screen.dart';

class AppRouter {
  static GoRouter createRouter(BuildContext context) {
    final auth = context.read<AuthProvider>();
    return GoRouter(
      initialLocation: '/',
      refreshListenable: auth,
      redirect: (context, state) {
        final authState = context.read<AuthProvider>();
        if (authState.loading) return null;
        final path = state.matchedLocation;
        final isPublic = path == '/' || path.startsWith('/login') || path.startsWith('/register');
        if (isPublic) return null;
        if (!authState.isAuthenticated) return '/login';
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (_, __) => const LandingScreen()),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
        GoRoute(path: '/travel', builder: (_, __) => const TravelCompanionScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        GoRoute(path: '/profile/edit', builder: (_, __) => const ProfileEditScreen()),
        GoRoute(path: '/profile/new', builder: (_, __) => const ProfileEditScreen(isNew: true)),
      ],
    );
  }
}
