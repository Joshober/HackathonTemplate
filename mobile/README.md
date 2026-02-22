# Claude Home™ – Flutter mobile app

Mobile clone of the Next.js frontend, connected to the same Flask backend.

## Requirements

- Flutter SDK (stable)
- Backend running (see repo root / `backend/`)

## Setup

1. **Install Flutter** and ensure `flutter doctor` passes.

2. **Create platform folders** (if you created the project manually):
   ```bash
   cd mobile
   flutter create . --project-name hackathon_mobile --org com.hackathon --platforms=android,ios
   ```

3. **Install dependencies**:
   ```bash
   flutter pub get
   ```

4. **Configure API URL**  
   The app uses `http://localhost:5001` by default. On a physical device, use your machine’s IP:
   ```bash
   flutter run --dart-define=API_BASE_URL=http://192.168.1.x:5001
   ```
   Or set it in code: `lib/config/api_config.dart`.

## Run

- Start the backend (from repo root):
  ```bash
  cd backend && python -m flask run -p 5001
  ```
- Run the app:
  ```bash
  cd mobile && flutter run
  ```

## Features (aligned with web)

- **Auth:** Email/password login and register (token in response for mobile).
- **Dashboard:** Grid to Chat, AI Tutor, Tech Support, Voice Assistant, Reality Check, Pose Attendance, Voice TTS, Profile.
- **Chaos Logs (Chat):** Text + images/video, modes assistant/roast, optional TTS.
- **AI Tutor:** Question + optional images/video.
- **Tech Support:** Chat in support mode; create tickets.
- **Voice Assistant:** Record voice → pipeline → TTS response.
- **Reality Check (Bullshit Detect):** Text/audio/images/video → analysis, optional TTS.
- **Pose Attendance:** Create session (3 poses) or join by password (simplified v1: placeholder poses).
- **Profile:** View / create / edit (name, bio, image).
- **Voice TTS:** Text → speech (OpenAI / Magic Hour).

## Differences from web

- Auth: email/password only in v1 (no Auth0/Google in-app).
- Pose: create session uses placeholder pose data; full MediaPipe comparison can be added later.

## Project structure

- `lib/config/` – API base URL.
- `lib/models/` – User, Profile.
- `lib/providers/` – AuthProvider.
- `lib/router/` – go_router routes and redirect (protected routes require login).
- `lib/screens/` – All screens.
- `lib/services/` – ApiClient (Dio), AuthStorage (secure storage).
- `lib/theme/` – Claude Home™ theme (primary green, dark mode).
