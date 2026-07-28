import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:supabase_flutter/supabase_flutter.dart';

/// Passed at build time: `flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`
/// The anon key is public by design; every table is guarded by RLS.
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

/// Where the OAuth provider returns the user.
///
/// A custom scheme is meaningless in a browser, so on web this is null and
/// Supabase falls back to the project's Site URL — keep that in sync with the
/// port you serve on (`--web-port=3000` → `http://localhost:3000`).
/// On mobile it's the deep link registered in AndroidManifest.xml / Info.plist.
const String? oauthRedirect = kIsWeb ? null : 'io.jobpilot://login-callback/';

SupabaseClient get db => Supabase.instance.client;

Future<void> initSupabase() async {
  if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing --dart-define=SUPABASE_URL / SUPABASE_ANON_KEY. See README.',
    );
  }
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
}
