#!/usr/bin/env bash
# Arranca el entorno de desarrollo de RockChain.
#   ./dev-start.sh           -> app Expo contra el servidor definido en EXPO_PUBLIC_WEBSOCKET_URL
#   ./dev-start.sh --local   -> además arranca el servidor Socket.IO local (puerto 3001)
# La configuración se lee de .env (copia .env.example).
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
else
  echo "⚠️  No existe .env: copia .env.example y rellena tu configuración de Firebase"
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

if [ "${1:-}" = "--local" ]; then
  # Credenciales de Firebase Admin: ADC (`gcloud auth application-default login`)
  # o GOOGLE_APPLICATION_CREDENTIALS apuntando a un fichero FUERA del repositorio.
  export FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-${EXPO_PUBLIC_FIREBASE_PROJECT_ID:-}}"
  export PORT="${PORT:-3001}"
  (cd server && [ -d node_modules ] || npm ci --ignore-scripts)
  (cd server && node server-simple.js) &
  SERVER_PID=$!
  # En un dispositivo físico, usa la IP de tu ordenador en EXPO_PUBLIC_WEBSOCKET_URL.
  export EXPO_PUBLIC_WEBSOCKET_URL="${EXPO_PUBLIC_WEBSOCKET_URL:-ws://localhost:$PORT}"
  echo "🔌 Servidor local en puerto $PORT (pid $SERVER_PID)"
fi

echo "🌐 WebSocket URL: ${EXPO_PUBLIC_WEBSOCKET_URL:-ws://localhost:3001 (por defecto)}"
npx expo start --clear
