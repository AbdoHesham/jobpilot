import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase.dart';

final authProvider = Provider((ref) => AuthService());

class AuthService {
  Future<void> signIn(String email, String password) =>
      db.auth.signInWithPassword(email: email, password: password);

  Future<void> signUp(String email, String password, String fullName) => db.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );

  /// LinkedIn is used for profile import only (name, headline, photo, email).
  Future<void> signInWithLinkedIn() => db.auth.signInWithOAuth(
        OAuthProvider.linkedinOidc,
        redirectTo: oauthRedirect,
      );

  Future<void> signOut() => db.auth.signOut();
}
