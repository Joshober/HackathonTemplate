# Square Hole Demo Audio

The Voice Assistant and Tutor have a hidden demo mode that plays a preloaded celebrity line: **"It goes in the square hole."**

The app preloads **`square-hole-elon.mp3`** (Elon Musk). You can also generate **Donald Trump** or **Morgan Freeman** and switch the preload URL in the code if you prefer.

## Generating the audio

From the repo root with the backend running (`cd backend && python run.py`):

```bash
# Elon Musk (default, used by the app)
python backend/scripts/generate_square_hole_audio.py elon

# Donald Trump
python backend/scripts/generate_square_hole_audio.py trump

# Morgan Freeman
python backend/scripts/generate_square_hole_audio.py morgan
```

Files are written to `frontend/public/audio/` as `square-hole-elon.mp3`, `square-hole-trump.mp3`, `square-hole-morgan.mp3`. To use a different voice in the app, change the `fetch('/audio/square-hole-elon.mp3')` URL in `voice-assistant/page.tsx` and `tutor/page.tsx` to the file you want.

Requires `MAGICHOUR_API_KEY` in `backend/.env` for celebrity voices. If the file is missing, the demo still shows the text and only skips audio.
