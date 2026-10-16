FROM node:22-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache dumb-init

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S rockchain -u 1001 -G nodejs

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código fuente
COPY . .

# Cambiar propietario de los archivos
RUN chown -R rockchain:nodejs /app
USER rockchain

# Variables de entorno
ENV PORT=8080
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Usar dumb-init para manejo de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicio
CMD ["npm", "start"]
