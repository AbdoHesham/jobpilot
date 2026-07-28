import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/supabase.dart';
import '../../models/models.dart';

final profileProvider = FutureProvider<Profile>((ref) async {
  final row = await db.from('profiles').select().eq('id', db.auth.currentUser!.id).single();
  return Profile.fromJson(row);
});

final cvsProvider = FutureProvider<List<Cv>>((ref) async {
  final rows = await db.from('cvs').select().order('created_at', ascending: false);
  return rows.map(Cv.fromJson).toList();
});

final cvRepositoryProvider = Provider((ref) => CvRepository(ref));

class CvRepository {
  CvRepository(this._ref);

  final Ref _ref;

  /// Uploads to `cvs/<user_id>/…` (the storage policy keys off that first segment),
  /// inserts the row, then kicks off parsing. Returns once parsed_json is saved.
  Future<void> upload({
    required String label,
    required String fileName,
    required Uint8List bytes,
  }) async {
    final userId = db.auth.currentUser!.id;
    final ext = fileName.split('.').last.toLowerCase();
    final path = '$userId/${DateTime.now().microsecondsSinceEpoch}.$ext';
    final mimeType = ext == 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    await db.storage.from('cvs').uploadBinary(path, bytes);

    final row = await db.from('cvs').insert({
      'user_id': userId,
      'label': label,
      'storage_path': path,
      'file_name': fileName,
      'mime_type': mimeType,
    }).select('id').single();

    _ref.invalidate(cvsProvider);
    await parse(row['id'] as String);
  }

  /// Also used to retry a CV whose parse failed (parsed_json still null).
  Future<void> parse(String cvId) async {
    final res = await db.functions.invoke('parse-cv', body: {'cv_id': cvId});
    _ref.invalidate(cvsProvider);
    final error = (res.data is Map) ? (res.data as Map)['error'] : null;
    if (error != null) throw Exception(error['message'] ?? 'Parsing failed');
  }

  Future<void> delete(Cv cv) async {
    await db.storage.from('cvs').remove([cv.storagePath]);
    await db.from('cvs').delete().eq('id', cv.id);
    _ref.invalidate(cvsProvider);
  }

  Future<void> setDailySendCap(int cap) async {
    await db.from('profiles').update({'daily_send_cap': cap}).eq('id', db.auth.currentUser!.id);
    _ref.invalidate(profileProvider);
  }
}
