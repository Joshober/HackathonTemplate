#!/usr/bin/env bash
# Run Flask backend (:5001) + Next.js frontend (:3000) locally in one terminal (no Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "run-local: repo $ROOT"
echo "run-local: http://localhost:3000 (frontend) — http://localhost:5001 (API)"
echo "run-local: Ctrl+C detiene ambos procesos"
echo ""

cd "$ROOT/backend"
if [ ! -d venv ]; then
  echo "run-local: creando venv en backend/venv"
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt
deactivate

cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "run-local: npm ci (primera vez, puede tardar)…"
  npm ci
fi

cd "$ROOT/backend"
# shellcheck disable=SC1091
source venv/bin/activate
FLASK_ENV=development python run.py &
BACK_PID=$!

cd "$ROOT/frontend"
npm run dev &
FRONT_PID=$!

cleanup() {
  echo ""
  echo "run-local: deteniendo procesos…"
  kill "$BACK_PID" 2>/dev/null || true
  kill "$FRONT_PID" 2>/dev/null || true
  wait "$BACK_PID" 2>/dev/null || true
  wait "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Bloquea hasta Ctrl+C o hasta que ambos procesos terminen
wait
