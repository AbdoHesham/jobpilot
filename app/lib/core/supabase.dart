import 'package:supabase_flutter/supabase_flutter.dart';

/// Passed at build time: `flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...`
/// The anon key is public by design; every table is guarded by RLS.
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

/// Deep link registered in AndroidManifest.xml / Info.plist for OAuth returns.
const oauthRedirect = 'io.jobpilot://login-callback/';

SupabaseClient get db => Supabase.instance.client;

Future<void> initSupabase() async {
  if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
    throw StateError(
      'Missing --dart-define=SUPABASE_URL / SUPABASE_ANON_KEY. See README.',
    );
  }
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
}
