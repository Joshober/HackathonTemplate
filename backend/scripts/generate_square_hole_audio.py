"""
Generate square-hole demo audio per frontend/public/audio/README.md.
Run from repo root:
  python backend/scripts/generate_square_hole_audio.py              # default: Elon Musk
  python backend/scripts/generate_square_hole_audio.py elon        # Elon Musk -> square-hole-elon.mp3
  python backend/scripts/generate_square_hole_audio.py trump       # Donald Trump -> square-hole-trump.mp3
Requires backend .env with MAGICHOUR_API_KEY (or OPENAI_API_KEY for fallback).
"""
import os
import sys
from pathlib import Path

# Load .env from backend
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
from dotenv import load_dotenv
load_dotenv(backend_dir / '.env')

import requests

API_BASE = os.getenv('BACKEND_URL', 'http://localhost:5001')
OUT_DIR = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'public' / 'audio'
TEXT = 'It goes in the square hole.'

# Loop phrases: played in order, then repeat (q1 -> q2 -> q1 -> q2 ...). Text as written, not "I am saying..."
LOOP_PHRASES = (
    'What are the answer to 1',
    "What's the answer 2",
)

# Voice name -> output filename (used by frontend as preload)
VOICES = {
    'elon': ('Elon Musk', 'square-hole-elon.mp3'),
    'trump': ('Donald Trump', 'square-hole-trump.mp3'),
    'morgan': ('Morgan Freeman', 'square-hole-morgan.mp3'),
}
use_magic_hour = bool(os.getenv('MAGICHOUR_API_KEY'))


def generate_one(voice_name: str, text: str, out_basename: str) -> Path:
    out_path = OUT_DIR / out_basename
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    url = f'{API_BASE.rstrip("/")}/api/voice/generate'

    if use_magic_hour:
        payload = {
            'text': text,
            'provider': 'magic_hour',
            'voice_name': voice_name,
            'name': f'Square Hole Demo ({voice_name})',
        }
        timeout = 200
    else:
        payload = {
            'text': text,
            'provider': 'openai',
            'voice': 'onyx',
        }
        timeout = 60

    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    content = r.content
    content_type = (r.headers.get('Content-Type') or '').lower()
    if 'wav' in content_type and use_magic_hour:
        out_path = out_path.with_suffix('.wav')
    out_path.write_bytes(content)
    print(f'Saved to {out_path} ({len(content)} bytes)')
    return out_path


def generate(voice_key: str = 'elon'):
    voice_name, out_basename = VOICES.get(voice_key.lower(), VOICES['elon'])
    url = f'{API_BASE.rstrip("/")}/api/voice/generate'
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if use_magic_hour:
        print(f'Using Magic Hour ({voice_name}). This may take 1–3 minutes...')
    else:
        print('Using OpenAI TTS (onyx). Generating...')

    try:
        return generate_one(voice_name, TEXT, out_basename)
    except requests.exceptions.ConnectionError:
        print('Could not connect to backend. Start it first: cd backend && python run.py')
        sys.exit(1)
    except requests.exceptions.Timeout:
        print('Request timed out.')
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print('API error:', e.response.status_code, e.response.text[:200])
        sys.exit(1)


def generate_loop(voice_key: str = 'elon'):
    voice_name, _ = VOICES.get(voice_key.lower(), VOICES['elon'])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if use_magic_hour:
        print(f'Using Magic Hour ({voice_name}). Generating 2 clips (may take 2–6 minutes)...')
    else:
        print('Using OpenAI TTS. Generating 2 clips...')
    try:
        for i, phrase in enumerate(LOOP_PHRASES):
            basename = f'square-hole-q{i + 1}-{voice_key.lower()}.mp3'
            print(f'  [{i + 1}/2] "{phrase[:45]}..."')
            generate_one(voice_name, phrase, basename)
    except requests.exceptions.ConnectionError:
        print('Could not connect to backend. Start it first: cd backend && python run.py')
        sys.exit(1)
    except requests.exceptions.Timeout:
        print('Request timed out.')
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print('API error:', e.response.status_code, e.response.text[:200])
        sys.exit(1)


if __name__ == '__main__':
    arg1 = (sys.argv[1] or '').lower()
    arg2 = (sys.argv[2] or '').lower() if len(sys.argv) > 2 else ''
    if arg1 == 'loop':
        voice = arg2 or 'elon'
        if voice not in VOICES:
            voice = 'elon'
        generate_loop(voice)
    elif arg1 in VOICES:
        generate(arg1)
    else:
        print('Usage: python generate_square_hole_audio.py [elon|trump|morgan]')
        print('       python generate_square_hole_audio.py loop [elon|trump|morgan]  # q1 + q2 loop clips')
        sys.exit(1)
