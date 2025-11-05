#!/bin/bash

echo "🚀 Iniciando RockChain en modo desarrollo..."
echo "📋 Arquitectura limpia: WebSocket Server + Firebase Functions + Frontend"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Verificar si se pasó el flag --local
MODE="CLOUD"
if [ "$1" = "--local" ]; then
    MODE="LOCAL"
fi

# Función para configurar credenciales de Firebase
setup_firebase_credentials() {
    log "🔧 Configurando credenciales de Firebase..."
    
    if [ -f "rockchain-83a7f-firebase-adminsdk.json" ]; then
        export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/rockchain-83a7f-firebase-adminsdk.json"
        success "✅ Credenciales de Firebase configuradas correctamente"
        log "📁 Archivo: $(pwd)/rockchain-83a7f-firebase-adminsdk.json"
        return 0
    else
        warning "❌ Archivo de credenciales no encontrado"
        echo ""
        log "📋 INSTRUCCIONES PARA CONFIGURAR FIREBASE:"
        echo ""
        echo "1️⃣  Ve a Firebase Console: https://console.firebase.google.com/"
        echo "2️⃣  Selecciona tu proyecto: rockchain-83a7f"
        echo "3️⃣  Ve a Project Settings (⚙️ icono)"
        echo "4️⃣  Pestaña 'Service Accounts'"
        echo "5️⃣  Click 'Generate New Private Key'"
        echo "6️⃣  Descarga el archivo JSON"
        echo "7️⃣  Guárdalo como: rockchain-83a7f-firebase-adminsdk.json"
        echo "8️⃣  Colócalo en: $(pwd)/"
        echo ""
        warning "⚠️  WebSocket funcionará en modo offline hasta que configures las credenciales"
        echo ""
        read -p "¿Quieres continuar en modo offline? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            warning "🔄 Continuando en modo offline..."
            return 1
        else
            error "❌ Configuración cancelada"
            exit 1
        fi
    fi
}

# Configurar modo de desarrollo
if [ "$MODE" = "LOCAL" ]; then
    echo ""
    info "🔧 Modo LOCAL - Servidor WebSocket local"
    info "🌐 WebSocket: ws://localhost:3001"
    info "🔥 Firebase Functions: Emulador local"
    echo ""
    
    # Configurar credenciales de Firebase
    setup_firebase_credentials
    CREDENTIALS_OK=$?
    
    # Detectar IP automáticamente
    log "🔍 Detectando IP del servidor..."
    LOCAL_IP=$(ifconfig | grep -E "inet (192\.168|10\.|172\.)" | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
    fi
    if [ -z "$LOCAL_IP" ]; then
        warning "No se pudo detectar IP automáticamente, usando localhost"
        LOCAL_IP="localhost"
    fi
    log "📍 IP detectada: $LOCAL_IP"
    
else
    echo ""
    info "🌐 Modo CLOUD - Servidor WebSocket en Cloud Run"
    info "🌐 WebSocket: wss://your-socket-server.example.com"
    info "🔥 Firebase Functions: Producción"
    echo ""
    
    # Configurar credenciales de Firebase (opcional para Cloud Run)
    setup_firebase_credentials
    CREDENTIALS_OK=$?
fi

# Función para iniciar WebSocket Server local
start_websocket_server() {
    log "🚀 Iniciando servidor WebSocket local..."
    
    # Verificar si el servidor ya está ejecutándose
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
        warning "Servidor ya está ejecutándose en puerto 3001"
        log "🔌 URL del servidor: ws://$LOCAL_IP:3001"
        return 0
    fi
    
    # Verificar que existe el directorio server
    if [ ! -d "server" ]; then
        error "Directorio 'server' no encontrado"
        exit 1
    fi
    
    # Iniciar servidor
    cd server
    log "📦 Instalando dependencias del servidor..."
    npm install --silent
    
    log "🚀 Ejecutando server-simple.js..."
    NODE_ENV=development node server-simple.js &
    SERVER_PID=$!
    cd ..
    
    # Esperar a que el servidor esté listo
    log "⏳ Esperando a que el servidor esté listo..."
    sleep 3
    
    # Verificar que el servidor esté funcionando
    if curl -s http://localhost:3001/healthz > /dev/null 2>&1; then
        success "Servidor WebSocket iniciado correctamente"
        log "🔌 URL del servidor: ws://$LOCAL_IP:3001"
        
        if [ $CREDENTIALS_OK -eq 0 ]; then
            success "✅ Firebase conectado - Persistencia completa habilitada"
            log "🔥 Todas las operaciones se guardarán en Firebase"
        else
            warning "⚠️  Firebase offline - Solo memoria local"
            log "💾 Los datos se perderán al reiniciar el servidor"
        fi
        return 0
    else
        error "No se pudo iniciar el servidor WebSocket"
        return 1
    fi
}

# Función para iniciar Firebase Functions emulador
start_firebase_emulator() {
    log "🔥 Iniciando emulador de Firebase Functions..."
    
    # Verificar que existe el directorio functions
    if [ ! -d "functions" ]; then
        error "Directorio 'functions' no encontrado"
        exit 1
    fi
    
    # Verificar que Firebase CLI está instalado
    if ! command -v firebase &> /dev/null; then
        error "Firebase CLI no está instalado"
        log "📦 Instala con: npm install -g firebase-tools"
        exit 1
    fi
    
    # Iniciar emulador en background
    cd functions
    log "📦 Instalando dependencias de Firebase Functions..."
    npm install --silent
    
    log "🔥 Ejecutando emulador de Firebase Functions..."
    firebase emulators:start --only functions --quiet &
    EMULATOR_PID=$!
    cd ..
    
    # Esperar a que el emulador esté listo
    log "⏳ Esperando a que el emulador esté listo..."
    sleep 5
    
    success "Firebase Functions emulador iniciado"
    log "🔥 URL del emulador: http://localhost:5001"
    return 0
}

# Función para iniciar Expo
start_expo() {
    log "📱 Iniciando Expo..."
    
    # Verificar que Expo CLI está instalado
    if ! command -v npx &> /dev/null; then
        error "npx no está disponible"
        exit 1
    fi
    
    if [ "$MODE" = "LOCAL" ]; then
        # Modo local - usar servidor local
        log "🔧 Configurando variables de entorno para modo local..."
        export EXPO_PUBLIC_WEBSOCKET_URL="ws://$LOCAL_IP:3001"
        export EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL="http://localhost:5001"
        
        info "🌐 WebSocket URL: ws://$LOCAL_IP:3001"
        info "🔥 Firebase Functions URL: http://localhost:5001"
        
        npx expo start --clear
    else
        # Modo cloud - usar Cloud Run
        log "🌐 Configurando variables de entorno para modo cloud..."
        export EXPO_PUBLIC_WEBSOCKET_URL="wss://your-socket-server.example.com"
        
        info "🌐 WebSocket URL: wss://your-socket-server.example.com"
        info "🔥 Firebase Functions URL: Producción"
        
        npx expo start --clear
    fi
}

# Función de limpieza
cleanup() {
    log "🛑 Terminando procesos..."
    
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        log "🔌 Servidor WebSocket terminado"
    fi
    
    if [ ! -z "$EMULATOR_PID" ]; then
        kill $EMULATOR_PID 2>/dev/null
        log "🔥 Emulador de Firebase Functions terminado"
    fi
    
    # Limpiar procesos relacionados
    pkill -f "node server-simple.js" 2>/dev/null
    pkill -f "firebase emulators" 2>/dev/null
    
    success "✅ Limpieza completada"
    exit 0
}

# Capturar señales de terminación
trap cleanup SIGINT SIGTERM

# Iniciar servicios según el modo
if [ "$MODE" = "LOCAL" ]; then
    # Modo local - iniciar WebSocket Server y Firebase Emulator
    start_websocket_server
    if [ $? -ne 0 ]; then
        error "No se pudo iniciar el servidor WebSocket"
        exit 1
    fi
    
    start_firebase_emulator
    if [ $? -ne 0 ]; then
        error "No se pudo iniciar el emulador de Firebase"
        exit 1
    fi
    
    echo ""
    success "🎉 Servicios locales iniciados correctamente"
    echo ""
    info "📋 RESUMEN:"
    info "🔌 WebSocket Server: ws://$LOCAL_IP:3001"
    info "🔥 Firebase Functions: http://localhost:5001"
    info "📱 Frontend: Se iniciará con Expo"
    echo ""
    
else
    # Modo cloud - solo iniciar Expo
    echo ""
    success "🎉 Modo cloud configurado correctamente"
    echo ""
    info "📋 RESUMEN:"
    info "🔌 WebSocket Server: Cloud Run (producción)"
    info "🔥 Firebase Functions: Producción"
    info "📱 Frontend: Se iniciará con Expo"
    echo ""
fi

# Iniciar Expo
start_expo

# Esperar
wait
