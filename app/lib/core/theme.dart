import 'package:flutter/material.dart';

const _seed = Color(0xFF3D5AFE);

ThemeData _theme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(seedColor: _seed, brightness: brightness);
  return ThemeData(
    colorScheme: scheme,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    cardTheme: const CardThemeData(margin: EdgeInsets.symmetric(vertical: 6)),
  );
}

final lightTheme = _theme(Brightness.light);
final darkTheme = _theme(Brightness.dark);
