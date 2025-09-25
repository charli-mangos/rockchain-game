// Servicio WebSocket Universal - Funciona siempre
import { io } from 'socket.io-client';
import { getWebSocketConfig, getWebSocketUrl } from '../config/websocket';
import { Platform } from 'react-native';

class WebSocketServiceUniversal {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 5000;
    this.isConnecting = false;
    this.connectionPromise = null;
  }

  // Conectar al servidor
  async connect() {
    if (this.isConnecting) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this._doConnect();
    
    try {
      await this.connectionPromise;
    } catch (error) {
      console.error('🔌 [WebSocketUniversal] Error en conexión:', error);
      // Intentar reconectar automáticamente
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('🔌 [WebSocketUniversal] Intentando reconectar...');
          this.connect();
        }
      }, 2000);
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  async _doConnect() {
    try {
      console.log('🔌 [WebSocketUniversal] Iniciando conexión...');
      
      // Obtener configuración
      const config = await getWebSocketConfig();
      console.log('🔌 [WebSocketUniversal] Configuración:', config);
      
      // Crear socket
      this.socket = io(config.SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: config.CONNECTION_TIMEOUT,
        reconnection: true,
        reconnectionAttempts: config.RECONNECTION_ATTEMPTS,
        reconnectionDelay: config.RECONNECTION_DELAY,
        reconnectionDelayMax: config.RECONNECTION_DELAY_MAX,
        pingInterval: config.PING_INTERVAL,
        pingTimeout: config.PING_TIMEOUT,
        forceNew: true,
        autoConnect: true,
        upgrade: true,
        rememberUpgrade: false,
      });

      // Configurar eventos
      this._setupEventListeners();
      
      // Esperar conexión
      await this._waitForConnection();
      
      console.log('🔌 [WebSocketUniversal] Conectado exitosamente');
      return true;
      
    } catch (error) {
      console.error('🔌 [WebSocketUniversal] Error de conexión:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // Configurar listeners de eventos
  _setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('🔌 [WebSocketUniversal] Conectado al servidor');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._emit('connection_success', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [WebSocketUniversal] Desconectado:', reason);
      this.isConnected = false;
      this._emit('connection_lost', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 [WebSocketUniversal] Error de conexión:', error);
      this.isConnected = false;
      this.reconnectAttempts++;
      this._emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 [WebSocketUniversal] Reconectado después de', attemptNumber, 'intentos');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._emit('connection_success', { socketId: this.socket.id, reconnected: true });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔌 [WebSocketUniversal] Error de reconexión:', error);
      this._emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 [WebSocketUniversal] Falló la reconexión después de', this.maxReconnectAttempts, 'intentos');
      this._emit('connection_lost', { reason: 'reconnect_failed' });
    });
  }

  // Esperar conexión
  _waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout de conexión'));
      }, 10000);

      const onConnect = () => {
        clearTimeout(timeout);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
        resolve();
      };

      const onError = (error) => {
        clearTimeout(timeout);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
        reject(error);
      };

      if (this.socket.connected) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.socket.on('connect', onConnect);
        this.socket.on('connect_error', onError);
      }
    });
  }

  // Emitir evento
  emit(event, data) {
    if (!this.socket || !this.isConnected) {
      console.warn('🔌 [WebSocketUniversal] Socket no conectado, no se puede emitir:', event);
      return false;
    }

    console.log('🔌 [WebSocketUniversal] Emitiendo:', event, data);
    this.socket.emit(event, data);
    return true;
  }

  // Escuchar evento
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Configurar listener en el socket si existe
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Dejar de escuchar evento
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    // Remover listener del socket si existe
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Emitir evento interno
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('🔌 [WebSocketUniversal] Error en callback:', error);
        }
      });
    }
  }

  // Desconectar
  disconnect() {
    if (this.socket) {
      console.log('🔌 [WebSocketUniversal] Desconectando...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  // Obtener estado de conexión
  getConnectionState() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Verificar si está conectado
  get connected() {
    return this.isConnected && this.socket?.connected;
  }

  // Obtener estado de conexión (compatible con el servicio original)
  getConnectionStatus() {
    return this.getConnectionState();
  }

  // Método para verificar conexión de manera robusta
  isWebSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  // Métodos de compatibilidad con el servicio original
  getConnectionState() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Métodos adicionales para compatibilidad
  assignRoundRewards() {
    console.log('🔌 [WebSocketUniversal] assignRoundRewards llamado');
    return this.emit('assign_round_rewards', {});
  }

  endRound() {
    console.log('🔌 [WebSocketUniversal] endRound llamado');
    return this.emit('round_ended', {});
  }

  joinGame(gameId, userId, userName) {
    console.log('🔌 [WebSocketUniversal] joinGame llamado:', { gameId, userId, userName });
    return this.emit('join_game', { gameId, userId, userName });
  }

  startGame() {
    console.log('🔌 [WebSocketUniversal] startGame llamado');
    return this.emit('start_game', { gameId: this.currentGameId });
  }

  readyToPlay() {
    console.log('🔌 [WebSocketUniversal] readyToPlay llamado');
    return this.emit('ready_to_play', { gameId: this.currentGameId, userId: this.currentUserId });
  }

  readyForNextRound() {
    console.log('🔌 [WebSocketUniversal] readyForNextRound llamado');
    return this.emit('ready_for_next_round', { gameId: this.currentGameId, userId: this.currentUserId });
  }

  authenticate(userId, userName) {
    console.log('🔌 [WebSocketUniversal] authenticate llamado:', { userId, userName });
    return this.emit('auth', { userId, userName });
  }
}

// Instancia singleton global
let webSocketServiceUniversal = null;

// Función para obtener la instancia singleton
export const getWebSocketService = () => {
  if (!webSocketServiceUniversal) {
    webSocketServiceUniversal = new WebSocketServiceUniversal();
  }
  return webSocketServiceUniversal;
};

// Export por defecto
export default getWebSocketService();
