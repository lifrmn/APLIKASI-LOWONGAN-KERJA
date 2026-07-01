# Aturan ProGuard/R8 untuk build release.
# Menjaga class yang dibutuhkan runtime plugin Flutter.

-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# flutter_secure_storage (androidx.security.crypto)
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }

# dio / okio kadang butuh
-keep class okio.** { *; }
-dontwarn okio.**

# JSON annotation
-keep @org.json.** class *
-keep class **$$serializer { *; }
