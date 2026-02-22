import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import '../config/api_config.dart';
import '../models/profile.dart';
import '../models/user.dart';
import 'auth_storage.dart';

class ApiClient {
  ApiClient({required AuthStorage authStorage})
      : _authStorage = authStorage,
        _dio = Dio(BaseOptions(
          baseUrl: apiBaseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 60),
          sendTimeout: const Duration(seconds: 60),
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authStorage.getToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await _authStorage.deleteToken();
        }
        handler.next(error);
      },
    ));
  }

  final AuthStorage _authStorage;
  final Dio _dio;

  // ---- Auth ----

  Future<Map<String, dynamic>> loginEmailPassword(String email, String password) async {
    final res = await _dio.post(
      '/api/auth/login',
      data: {'email': email, 'password': password},
      options: Options(
        contentType: Headers.jsonContentType,
        extra: {'useAuth': false},
      ),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    String? name,
  }) async {
    final res = await _dio.post(
      '/api/auth/register',
      data: {'email': email, 'password': password, 'name': name ?? ''},
      options: Options(contentType: Headers.jsonContentType),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<void> logout() async {
    try {
      await _dio.post('/api/auth/logout');
    } catch (_) {}
    await _authStorage.deleteToken();
  }

  Future<User> getCurrentUser() async {
    final res = await _dio.get('/api/auth/me');
    return User.fromJson(res.data as Map<String, dynamic>);
  }

  // ---- Profiles ----

  Future<Profile> getProfile() async {
    final res = await _dio.get('/api/profiles');
    return Profile.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Profile> createProfile({
    required String displayName,
    required String bio,
    File? image,
  }) async {
    final formData = FormData.fromMap({
      'displayName': displayName,
      'bio': bio,
      if (image != null) 'image': await MultipartFile.fromFile(image.path, filename: 'image.jpg'),
    });
    final res = await _dio.post('/api/profiles', data: formData);
    return Profile.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Profile> updateProfile({
    String? displayName,
    String? bio,
    File? image,
  }) async {
    final formData = FormData.fromMap({
      if (displayName != null) 'displayName': displayName,
      if (bio != null) 'bio': bio,
      if (image != null) 'image': await MultipartFile.fromFile(image.path, filename: 'image.jpg'),
    });
    final res = await _dio.put('/api/profiles', data: formData);
    return Profile.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> uploadProfileImage(File image) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(image.path, filename: 'image.jpg'),
    });
    final res = await _dio.post('/api/profiles/image', data: formData);
    return res.data as Map<String, dynamic>;
  }

  // ---- Chat ----

  Future<Map<String, dynamic>> sendChatMessage({
    required List<Map<String, String>> messages,
    String? model,
    List<String>? imagesBase64,
    String? mode,
    String? videoBase64,
    String? videoMime,
    String? userEmail,
    String? userId,
  }) async {
    final body = <String, dynamic>{
      'messages': messages,
      'model': model ?? 'openai/gpt-3.5-turbo',
      if (imagesBase64 != null && imagesBase64.isNotEmpty) 'images': imagesBase64,
      if (mode != null) 'mode': mode,
      if (videoBase64 != null) 'video_b64': videoBase64,
      if (videoMime != null) 'video_mime': videoMime,
      if (userEmail != null && userEmail.isNotEmpty) 'user_email': userEmail,
      if (userId != null && userId.isNotEmpty) 'user_id': userId,
    };
    final res = await _dio.post(
      '/api/chat',
      data: body,
      options: Options(contentType: Headers.jsonContentType, extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> chatPipeline({
    File? audio,
    String? text,
    List<File>? images,
    File? video,
    List<Map<String, String>>? messages,
    bool tts = false,
    String? voice,
    String? ttsProvider,
    String? mode,
    String? model,
    String? personality,
    double? latitude,
    double? longitude,
    int? libraryCount,
    String? source,
    String? userEmail,
    String? userId,
  }) async {
    final formData = FormData.fromMap({
      if (text != null && text.isNotEmpty) 'text': text,
      if (messages != null && messages.isNotEmpty) 'messages': jsonEncode(messages),
      'tts': tts.toString(),
      if (voice != null) 'voice': voice,
      if (ttsProvider != null) 'tts_provider': ttsProvider,
      if (mode != null) 'mode': mode,
      if (source != null) 'source': source,
      if (userEmail != null && userEmail.isNotEmpty) 'user_email': userEmail,
      if (userId != null && userId.isNotEmpty) 'user_id': userId,
      if (model != null) 'model': model,
      if (personality != null && personality.isNotEmpty) 'personality': personality,
      if (latitude != null && longitude != null) ...{
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
      },
      if (libraryCount != null && libraryCount >= 0) 'library_count': libraryCount.toString(),
      if (audio != null) 'audio': await MultipartFile.fromFile(audio.path, filename: 'audio.webm'),
      if (video != null) 'video': await MultipartFile.fromFile(video.path, filename: 'video.mp4'),
    });
    if (images != null && images.isNotEmpty) {
      for (var i = 0; i < images.length; i++) {
        formData.files.add(MapEntry('images', await MultipartFile.fromFile(images[i].path, filename: 'image$i.jpg')));
      }
    }
    final res = await _dio.post(
      '/api/chat/pipeline',
      data: formData,
      options: Options(extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  // ---- Tutor ----

  Future<Map<String, dynamic>> askTutor(
    String question, {
    String? weekday,
    String? time,
    String? month,
    List<String>? images,
    String? videoB64,
    String? videoMime,
  }) async {
    final now = DateTime.now();
    final body = <String, dynamic>{
      'question': question,
      'weekday': weekday ?? _weekday(now),
      'time': time ?? _time(now),
      'month': month ?? _month(now),
      if (images != null && images.isNotEmpty) 'images': images,
      if (videoB64 != null) 'video_b64': videoB64,
      if (videoMime != null) 'video_mime': videoMime,
    };
    final res = await _dio.post('/api/tutor', data: body, options: Options(contentType: Headers.jsonContentType));
    return res.data as Map<String, dynamic>;
  }

  static String _weekday(DateTime d) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[d.weekday - 1];
  }

  static String _time(DateTime d) {
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final m = d.minute.toString().padLeft(2, '0');
    final am = d.hour < 12 ? 'AM' : 'PM';
    return '$h:$m $am';
  }

  static String _month(DateTime d) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[d.month - 1];
  }

  // ---- Bullshit Detect ----

  Future<Map<String, dynamic>> bullshitDetect(String document, {String? model}) async {
    final res = await _dio.post(
      '/api/chat/bullshit-detect',
      data: {'document': document, if (model != null) 'model': model},
      options: Options(contentType: Headers.jsonContentType, extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> bullshitDetectPipeline({
    File? audio,
    String? text,
    List<File>? images,
    File? video,
    bool tts = false,
    String? voice,
    String? ttsProvider,
    String? model,
  }) async {
    final formData = FormData.fromMap({
      if (text != null && text.isNotEmpty) 'text': text,
      'tts': tts.toString(),
      if (voice != null) 'voice': voice,
      if (ttsProvider != null) 'tts_provider': ttsProvider,
      if (model != null) 'model': model,
      if (audio != null) 'audio': await MultipartFile.fromFile(audio.path, filename: 'audio.webm'),
      if (video != null) 'video': await MultipartFile.fromFile(video.path, filename: 'video.mp4'),
    });
    if (images != null && images.isNotEmpty) {
      for (var i = 0; i < images.length; i++) {
        formData.files.add(MapEntry('images', await MultipartFile.fromFile(images[i].path, filename: 'image$i.jpg')));
      }
    }
    final res = await _dio.post(
      '/api/chat/bullshit-detect-pipeline',
      data: formData,
      options: Options(extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  // ---- Voice / TTS ----

  Future<Map<String, dynamic>> transcribe(File file, {String? language, String? model}) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: 'audio.webm'),
      if (language != null) 'language': language,
      if (model != null) 'model': model,
    });
    final res = await _dio.post('/api/transcribe', data: formData, options: Options(extra: {'useAuth': false}));
    return res.data as Map<String, dynamic>;
  }

  Future<List<int>> textToSpeech(String text, {String? voice, String? model}) async {
    final res = await _dio.post<List<int>>(
      '/api/speech',
      data: {'text': text, 'voice': voice ?? 'coral', 'model': model ?? 'tts-1-hd'},
      options: Options(
        contentType: Headers.jsonContentType,
        responseType: ResponseType.bytes,
        extra: {'useAuth': false},
      ),
    );
    return res.data ?? [];
  }

  Future<List<int>> generateVoice({
    required String text,
    required String provider,
    String? voice,
    String? model,
    double? speed,
    String? voiceName,
    String? name,
  }) async {
    final body = <String, dynamic>{
      'text': text,
      'provider': provider,
      if (provider == 'openai') ...{
        if (voice != null) 'voice': voice,
        if (model != null) 'model': model,
        if (speed != null) 'speed': speed,
      },
      if (provider == 'magic_hour') ...{
        if (voiceName != null) 'voice_name': voiceName,
        if (name != null) 'name': name,
      },
    };
    final res = await _dio.post<List<int>>(
      '/api/voice/generate',
      data: body,
      options: Options(
        contentType: Headers.jsonContentType,
        responseType: ResponseType.bytes,
        extra: {'useAuth': false},
      ),
    );
    return res.data ?? [];
  }

  // ---- Roast ----

  Future<Map<String, dynamic>> analyzeRoast(File image) async {
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(image.path, filename: 'image.jpg'),
    });
    final res = await _dio.post('/api/multiverse/analyze', data: formData, options: Options(extra: {'useAuth': false}));
    return res.data as Map<String, dynamic>;
  }

  // ---- Email & Tickets ----

  Future<Map<String, dynamic>> getEmailStatus() async {
    final res = await _dio.get('/api/email/status', options: Options(extra: {'useAuth': false}));
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendEmail({required String to, required String subject, required String body, String? bodyHtml, String? replyTo}) async {
    final res = await _dio.post(
      '/api/email/send',
      data: {'to': to, 'subject': subject, 'body': body, if (bodyHtml != null) 'body_html': bodyHtml, if (replyTo != null) 'reply_to': replyTo},
      options: Options(contentType: Headers.jsonContentType, extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createTicket({
    required String title,
    required String description,
    String? userEmail,
    String? conversationSummary,
    String? status,
  }) async {
    final res = await _dio.post(
      '/api/tickets',
      data: {
        'title': title,
        'description': description,
        if (userEmail != null) 'user_email': userEmail,
        if (conversationSummary != null) 'conversation_summary': conversationSummary,
        if (status != null) 'status': status,
      },
      options: Options(contentType: Headers.jsonContentType, extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> listTickets({int? limit}) async {
    final q = limit != null ? '?limit=$limit' : '';
    final res = await _dio.get('/api/tickets$q', options: Options(extra: {'useAuth': false}));
    return res.data as Map<String, dynamic>;
  }

  // ---- Pose ----

  Future<Map<String, dynamic>> createPoseSession(List<Map<String, dynamic>> poses) async {
    final res = await _dio.post(
      '/api/pose-sessions',
      data: {'poses': poses},
      options: Options(contentType: Headers.jsonContentType),
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getPoseSession(String password) async {
    final res = await _dio.get(
      '/api/pose-sessions/${Uri.encodeComponent(password.trim())}',
      options: Options(extra: {'useAuth': false}),
    );
    return res.data as Map<String, dynamic>;
  }

  // ---- Library count ----

  Future<Map<String, dynamic>> getLibraryCount() async {
    final res = await _dio.get('/api/librarycount', options: Options(extra: {'useAuth': false}));
    return res.data as Map<String, dynamic>;
  }
}
