import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../screens/bullshit_detect_screen.dart';
import '../screens/chat_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/landing_screen.dart';
import '../screens/login_screen.dart';
import '../screens/pose_attend_screen.dart';
import '../screens/profile_edit_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/register_screen.dart';
import '../screens/support_screen.dart';
import '../screens/tutor_screen.dart';
import '../screens/voice_assistant_screen.dart';
import '../screens/voice_tts_screen.dart';

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
        final isPublic = path == '/' || path.startsWith('/login') || path.startsWith('/register') || path == '/bullshit' || path.startsWith('/pose/join');
        if (isPublic) return null;
        if (!authState.isAuthenticated) return '/login';
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (_, __) => const LandingScreen()),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
        GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
        GoRoute(path: '/chat', builder: (_, __) => const ChatScreen()),
        GoRoute(path: '/tutor', builder: (_, __) => const TutorScreen()),
        GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
        GoRoute(path: '/voice-assistant', builder: (_, __) => const VoiceAssistantScreen()),
        GoRoute(path: '/voice-tts', builder: (_, __) => const VoiceTtsScreen()),
        GoRoute(path: '/bullshit', builder: (_, __) => const BullshitDetectScreen()),
        GoRoute(path: '/pose', builder: (_, __) => const PoseAttendScreen()),
        GoRoute(path: '/pose/join', builder: (_, __) => const PoseAttendScreen(joinMode: true)),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        GoRoute(path: '/profile/edit', builder: (_, __) => const ProfileEditScreen()),
        GoRoute(path: '/profile/new', builder: (_, __) => const ProfileEditScreen(isNew: true)),
      ],
    );
  }
}
