import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/signup_screen.dart';
import '../features/profile/profile_screen.dart';
import 'supabase.dart';

/// Re-runs the redirect whenever the session appears or disappears.
class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier() {
    _sub = db.auth.onAuthStateChange.listen((_) => notifyListeners());
  }

  late final StreamSubscription<AuthState> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final router = GoRouter(
  initialLocation: '/profile',
  refreshListenable: _AuthNotifier(),
  redirect: (context, state) {
    final signedIn = db.auth.currentSession != null;
    final atAuthScreen = state.matchedLocation == '/login' || state.matchedLocation == '/signup';
    if (!signedIn && !atAuthScreen) return '/login';
    if (signedIn && atAuthScreen) return '/profile';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
  ],
);
