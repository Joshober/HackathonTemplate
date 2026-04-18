import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Full trip workflow (plan, approve, explorer, team chat) ships in the Next.js web app.
class TravelCompanionScreen extends StatelessWidget {
  const TravelCompanionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Travel Companion'),
        backgroundColor: AppTheme.surfaceDark,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.flight_takeoff, size: 56, color: AppTheme.primary),
                  const SizedBox(height: 24),
                  Text(
                    'Lockton Travel Companion',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Plan, approvals, live pricing, team chat, and the AI copilot run in the mobile web app. '
                    'Open the same URL you use for the hackathon frontend (for example http://localhost:3000) in your device browser.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey,
                          height: 1.4,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
