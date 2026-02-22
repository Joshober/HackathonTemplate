/// Base URL for the backend API. Use your machine IP (e.g. http://192.168.1.x:5001)
/// when running on a physical device; localhost works for simulators/emulators.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:5001',
);
