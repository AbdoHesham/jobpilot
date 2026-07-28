import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
class Profile with _$Profile {
  const factory Profile({
    required String id,
    String? fullName,
    String? headline,
    String? photoUrl,
    @Default(false) bool linkedinConnected,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);
}

/// `cvs.parsed_json`, written by the parse-cv Edge Function. Null until parsing finishes.
@freezed
class ParsedCv with _$ParsedCv {
  const factory ParsedCv({
    @Default([]) List<String> skills,
    @Default(0) num yearsExperience,
    @Default([]) List<String> roles,
    @Default([]) List<String> education,
    @Default('') String summary,
  }) = _ParsedCv;

  factory ParsedCv.fromJson(Map<String, dynamic> json) => _$ParsedCvFromJson(json);
}

@freezed
class Cv with _$Cv {
  const factory Cv({
    required String id,
    required String userId,
    required String label,
    required String storagePath,
    required String fileName,
    required String mimeType,
    ParsedCv? parsedJson,
    required DateTime createdAt,
  }) = _Cv;

  factory Cv.fromJson(Map<String, dynamic> json) => _$CvFromJson(json);
}
