import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'router/app_router.dart';
import 'services/api_client.dart';
import 'services/auth_storage.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const HackathonApp());
}

class HackathonApp extends StatelessWidget {
  const HackathonApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authStorage = AuthStorage();
    final apiClient = ApiClient(authStorage: authStorage);
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(apiClient: apiClient, authStorage: authStorage)..init(),
        ),
        Provider<ApiClient>.value(value: apiClient),
      ],
      child: MaterialApp.router(
        title: 'Claude Home™',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        routerConfig: AppRouter.createRouter(context),
      ),
    );
  }
}
