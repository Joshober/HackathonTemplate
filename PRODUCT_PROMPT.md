# Claude Home™ — Product & Features Prompt

Usa este texto como prompt o descripción del producto para documentación, presentaciones, onboarding o para que una IA entienda qué hace la web.

---

## Qué es Claude Home™

**Claude Home™** es una plataforma web de automatización e IA con tono irónico (“when automation goes just a little too far”). Ofrece un **centro de control** (dashboard) con múltiples módulos: chat con pipeline de voz e imagen, tutor educativo, asistente de voz siempre activo, detección de contenido poco fiable (“Reality Check”), asistencia técnica con tickets y email, asistencia por pose (Pose Attendance) y TTS/voice (OpenAI y Magic Hour). Incluye **autenticación** (email/contraseña y Auth0/Google), **perfiles de usuario** y **landing** con secciones de capacidades, casos de uso y CTA.

---

## Páginas y rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing + Chatbot flotante + login (email o Auth0). |
| `/dashboard` | Overview del centro de control con cards a todas las features (requiere login). |
| `/profile` | Ver y editar perfil (nombre, bio, imagen). |
| `/chat` | Chat Pipeline: texto, voz (STT), imágenes, video → modelo → respuesta opcional en TTS. Modos: assistant, roast, support. |
| `/tutor` | AI Tutor (“Weekend Energy Tutor”): chat por texto o voz, con imágenes/video; respuestas en texto y opcional TTS. |
| `/voice-assistant` | Asistente de voz: wake phrase (“hey assistant”), sleep phrase (“goodbye”), mic siempre activa, respuestas habladas (TTS). Usa ubicación y library count cuando el backend los expone. |
| `/voice` | Text-to-Speech: escribir texto y generar audio con voces OpenAI o Magic Hour (celebridades). |
| `/bullshit-detect` | Reality Check: texto, voz, imágenes y/o video → análisis de fiabilidad + resumen “read aloud” y TTS opcional. |
| `/support` | Soporte técnico por chat (texto/voz/imágenes/video); el asistente puede enviar emails y crear tickets. |
| `/pose-attendance` | Asistencia por pose: el profesor captura una pose de referencia; los alumnos la imitan por cámara; se compara con MediaPipe y umbral de similitud. Enlaces compartibles con la pose. |

---

## Features por área

### Autenticación y usuario
- Login con **email + contraseña** (registro incluido).
- Login con **Google (Auth0)** si está configurado.
- Sesión con cookies; token para llamadas API autenticadas.
- **Perfil**: displayName, bio, imagen; crear/editar; subida de imagen.

### Chat y pipeline de conversación
- **Chat Pipeline** (`/chat`, `/api/chat/pipeline`): entrada por **texto**, **audio (STT/Whisper)**, **imágenes** y **video** (video limitado en duración, p. ej. 20 s). Respuesta del modelo y opcional **TTS** (OpenAI o Magic Hour). Modos: `assistant`, `roast`, `support`. Personalidad/configuración por modo.
- **Chatbot en landing**: mismo pipeline desde un widget flotante; texto + imágenes + video; modelos GPT-3.5/4o-mini/4o.
- **Voice Assistant** (`/voice-assistant`): escucha continua; frase de despertar (“hey assistant”) y de dormir (“goodbye”); envía transcripción al pipeline y reproduce TTS; contexto de ubicación y “library count” cuando el backend los ofrece.
- **AI Tutor** (`/tutor`): personalidad “Weekend Energy Tutor”; chat por texto o voz; adjuntar imágenes/video; TTS opcional con voces OpenAI.
- **Tech Support** (`/support`): mismo tipo de chat; el modelo puede **enviar email** (`/api/email/send`) y **crear tickets** (`/api/tickets`); listado de tickets.

### Voz y audio
- **TTS**: OpenAI (varias voces y modelos tts-1/tts-1-hd/gpt-4o-mini-tts) y Magic Hour (voces de celebridades).
- **STT**: Whisper vía pipeline (transcripción de audio antes del modelo).
- **Voice** (`/voice`): página dedicada a “escribir texto → generar y reproducir audio” con OpenAI o Magic Hour.

### Reality Check (Bullshit detection)
- Entrada: **texto**, **audio**, **imágenes** y/o **video**.
- Salida: análisis de fiabilidad + resumen “read aloud” + TTS opcional (OpenAI o Magic Hour).
- Endpoints: texto solo (`/api/chat/bullshit-detect`) y pipeline multimodal (`/api/chat/bullshit-detect-pipeline`).

### Pose Attendance
- **Modo profesor**: captura de pose con la cámara; se extraen keypoints (MediaPipe); se genera enlace para compartir (solo pose, sin imagen).
- **Modo alumno**: abrir enlace, encender cámara, imitar la pose; comparación de poses y feedback (éxito/fallo) con mensajes humorísticos; presets (T-Rex, AI malfunction, academic despair).

### Datos y backend
- **Items**: CRUD de “items” (título, descripción, imágenes, videos); API bajo auth.
- **Library count**: endpoint público `/api/librarycount` para aforo; el Voice Assistant puede usarlo en contexto.
- **Ubicación**: el frontend puede enviar lat/lon al pipeline para preguntas tipo “restaurants near me”.

### Roast / multiverse
- Análisis de imagen con “truth” (caption, objetos, escena, OCR) y “roast” generado; integrado en el pipeline de chat en modo `roast` y en la API de analyze.

---

## Stack técnico (frontend)

- **Next.js** (App Router), **React**, **TypeScript**.
- **Tailwind CSS** (incl. variables y temas).
- **Motion** (animaciones).
- **Lucide** (iconos).
- Fuentes: **Syne** (títulos), **Outfit** (cuerpo).
- Colores: fondo oscuro `#08050c`, primario naranja `#ff6b35`, acento teal `#00e5c0`.
- Fondo decorativo: dot grid; secciones con franjas naranja/teal.

---

## Resumen one-liner para prompts

**Claude Home™ es una web app con landing, login (email + Auth0), dashboard, perfil de usuario, Chat Pipeline (texto/voz/imágenes/video → modelo → TTS), Voice Assistant con wake/sleep phrase, AI Tutor, Tech Support con email y tickets, Reality Check (bullshit detection) multimodal con TTS, Pose Attendance por cámara, y página de TTS (OpenAI/Magic Hour); todo con personalidad irónica y diseño oscuro naranja/teal.**
