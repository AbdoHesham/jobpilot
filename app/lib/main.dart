import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router.dart';
import 'core/supabase.dart';
import 'core/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  runApp(const ProviderScope(child: JobPilotApp()));
}

class JobPilotApp extends StatelessWidget {
  const JobPilotApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'JobPilot',
        theme: lightTheme,
        darkTheme: darkTheme,
        routerConfig: router,
      );
}
