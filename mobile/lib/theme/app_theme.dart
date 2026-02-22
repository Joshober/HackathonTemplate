import 'package:flutter/material.dart';

/// Claude Home™ theme – primary green #70ffa9, dark background.
class AppTheme {
  static const Color primary = Color(0xFF70FFA9);
  static const Color accentPink = Color(0xFFFF69B4);
  static const Color surfaceDark = Color(0xFF1A1A1A);
  static const Color backgroundDark = Color(0xFF0D0D0D);

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(primary: primary, surface: Colors.white),
      appBarTheme: const AppBarTheme(backgroundColor: primary, foregroundColor: Colors.black),
    );
  }

  static ThemeData get dark {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: primary,
        surface: surfaceDark,
        background: backgroundDark,
        onPrimary: Colors.black,
        onSurface: Colors.white,
        onBackground: Colors.white,
      ),
      scaffoldBackgroundColor: backgroundDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceDark,
        foregroundColor: primary,
        elevation: 0,
      ),
      cardTheme: CardTheme(
        color: surfaceDark,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        fillColor: surfaceDark,
        focusColor: primary,
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: primary, width: 2)),
      ),
    );
  }
}
