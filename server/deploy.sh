#!/usr/bin/env bash
set -euo pipefail

# Configuración
# Configuración (se puede sobrescribir con variables de entorno)
SERVICE_NAME="${SERVICE_NAME:-rockchain-socket}"
REGION="${REGION:-europe-west1}"
PROJECT_ID="${FIREBASE_PROJECT_ID:?Define FIREBASE_PROJECT_ID con el id de tu proyecto Firebase}"
CORS_ORIGINS="${CORS_ORIGINS:-}"

echo "🚀 Desplegando RockChain Socket Server..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: Ejecutar desde directorio server/"
  exit 1
fi

# Verificar que gcloud está configurado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "❌ Error: gcloud no está autenticado"
  echo "Ejecuta: gcloud auth login"
  exit 1
fi

# Verificar que el proyecto está configurado
CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo "⚠️  Proyecto actual: $CURRENT_PROJECT"
  echo "⚠️  Proyecto esperado: $PROJECT_ID"
  echo "¿Continuar? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Despliegue cancelado"
    exit 1
  fi
fi

echo "📦 Instalando dependencias..."
npm ci --omit=dev

echo "🐳 Construyendo imagen Docker..."
# Cloud Run construye automáticamente, pero podemos verificar localmente
if command -v docker &> /dev/null; then
  echo "🔍 Verificando Dockerfile..."
  docker build -t rockchain-socket-test . --no-cache
  echo "✅ Dockerfile válido"
else
  echo "⚠️  Docker no disponible, saltando verificación local"
fi

echo "☁️  Desplegando en Cloud Run..."

# Desplegar
# Nota: el servicio es público a nivel de Cloud Run porque lo usa una app móvil,
# pero cada conexión Socket.IO exige un ID token de Firebase válido (verifyIdToken).
# El estado de las partidas está en memoria: se limita a una instancia.
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID,CORS_ORIGINS=$CORS_ORIGINS" \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 300s \
  --concurrency 1000 \
  --platform managed

# Obtener URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')

echo "✅ Despliegue completado!"
echo "🌐 URL del servicio: $SERVICE_URL"
echo "🔍 Health check: $SERVICE_URL/healthz"
echo "📊 Info del servicio: $SERVICE_URL/info"

# Verificar health check
echo "🔍 Verificando health check..."
if curl -f -s "$SERVICE_URL/healthz" > /dev/null; then
  echo "✅ Health check OK"
else
  echo "❌ Health check falló - el servicio puede estar iniciando"
  echo "⏳ Esperando 30 segundos..."
  sleep 30
  if curl -f -s "$SERVICE_URL/healthz" > /dev/null; then
    echo "✅ Health check OK (después de esperar)"
  else
    echo "❌ Health check sigue fallando"
    echo "🔍 Revisar logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit 50"
  fi
fi

echo ""
echo "📝 Próximos pasos:"
echo "1. Configurar cliente RN con URL: $SERVICE_URL"
echo "2. (Opcional) Mapear dominio personalizado:"
echo "   gcloud run domain-mappings create --service $SERVICE_NAME --domain <tu-dominio> --region $REGION"
echo ""
echo "🔧 Comandos útiles:"
echo "• Ver logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit 100"
echo "• Ver métricas: gcloud run services describe $SERVICE_NAME --region $REGION"
echo "• Actualizar: ./deploy.sh"
echo "• Eliminar: gcloud run services delete $SERVICE_NAME --region $REGION"
