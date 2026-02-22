import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';

class AuthProvider with ChangeNotifier {
  AuthProvider({required ApiClient apiClient, required AuthStorage authStorage})
      : _api = apiClient,
        _storage = authStorage;

  final ApiClient _api;
  final AuthStorage _storage;

  User? _user;
  bool _loading = true;
  String? _error;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> init() async {
    _loading = true;
    _error = null;
    notifyListeners();
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      _user = null;
      _loading = false;
      notifyListeners();
      return;
    }
    try {
      _user = await _api.getCurrentUser();
    } catch (e) {
      await _storage.deleteToken();
      _user = null;
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _error = null;
    notifyListeners();
    try {
      final data = await _api.loginEmailPassword(email, password);
      final token = data['accessToken'] as String?;
      if (token == null || token.isEmpty) {
        _error = 'No token received from server';
        notifyListeners();
        return false;
      }
      await _storage.saveToken(token);
      _user = User.fromJson(data['user'] as Map<String, dynamic>);
      _error = null;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({required String email, required String password, String? name}) async {
    _error = null;
    notifyListeners();
    try {
      await _api.register(email: email, password: password, name: name);
      return await login(email, password);
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _api.logout();
    _user = null;
    _error = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
