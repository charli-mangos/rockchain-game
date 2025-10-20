// SocketAdapter - Mapea Cloud Run a interfaz legacy
import { io } from 'socket.io-client';

// Función para determinar si usar autodiscovery
const shouldUseAutodiscovery = () => {
  // Si EXPO_PUBLIC_WEBSOCKET_URL está definido, usar Cloud Run
  if (process.env.EXPO_PUBLIC_WEBSOCKET_URL) {
    return false;
  }
  // Si no, usar autodiscovery local
  return true;
};

class SocketAdapter {
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
    this.currentGameId = null;
    this.currentUserId = null;
  }

  // Conectar al servidor Cloud Run
  async connect() {
    if (this.isConnecting) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this._doConnect();
    
    try {
      await this.connectionPromise;
    } catch (error) {
      console.error('🔌 [SocketAdapter] Error en conexión:', error);
      // Intentar reconectar automáticamente
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('🔌 [SocketAdapter] Intentando reconectar...');
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
      // Determinar si usar Cloud Run o servidor local
      const wsUrl = shouldUseAutodiscovery() 
        ? 'ws://localhost:3001' 
        : process.env.EXPO_PUBLIC_WEBSOCKET_URL || 'wss://your-socket-server.example.com';
      
      const serverType = wsUrl.includes('localhost') ? 'Servidor Local' : 'Cloud Run';
      console.log(`🔌 [ADAPTER] connecting to <${wsUrl}>`);
      console.log(`🔌 [ADAPTER] server type: ${serverType}`);
      
      // Crear socket
      this.socket = io(wsUrl, {
        transports: ['websocket'],
        autoConnect: true,
      });

      // Configurar eventos
      this._setupEventListeners();
      
      // Esperar conexión
      await this._waitForConnection();
      
      console.log(`🔌 [ADAPTER] connection_success socketId=${this.socket.id}`);
      return true;
      
    } catch (error) {
      console.error('🔌 [ADAPTER] Error de conexión:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // Configurar listeners de eventos Cloud Run
  _setupEventListeners() {
    this.socket.on('connect', () => {
      const wsUrl = this.socket.io.uri;
      const serverType = wsUrl.includes('localhost') ? 'Servidor Local' : 'Cloud Run';
      console.log(`🔌 [SocketAdapter] Conectado al ${serverType}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._emit('connection_success', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 [SocketAdapter] Desconectado:', reason);
      this.isConnected = false;
      this._emit('connection_lost', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 [SocketAdapter] Error de conexión:', error);
      this.isConnected = false;
      this.reconnectAttempts++;
      this._emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 [SocketAdapter] Reconectado después de', attemptNumber, 'intentos');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._emit('connection_success', { socketId: this.socket.id, reconnected: true });
      
      // Re-enviar auth automáticamente en reconexión
      if (this.currentUserId) {
        console.log('🔐 [ADAPTER] Re-enviando auth en reconexión:', { userId: this.currentUserId });
        this.emit('auth', { userId: this.currentUserId, userName: 'Player' });
        
        // Re-enviar join_game si tenemos gameId
        if (this.currentGameId) {
          setTimeout(() => {
            console.log('🎮 [ADAPTER] Re-enviando join_game en reconexión:', { gameId: this.currentGameId, userId: this.currentUserId });
            this.emit('join_game', { gameId: this.currentGameId, userId: this.currentUserId, userName: 'Player' });
          }, 200);
        }
      }
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔌 [SocketAdapter] Error de reconexión:', error);
      this._emit('connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔌 [SocketAdapter] Falló la reconexión después de', this.maxReconnectAttempts, 'intentos');
      this._emit('connection_lost', { reason: 'reconnect_failed' });
    });

    // ✅ MAPEAR EVENTOS CLOUD RUN A LEGACY
    this._setupCloudRunEventMapping();
  }

  // Mapear eventos de Cloud Run a eventos legacy
  _setupCloudRunEventMapping() {
    // auth_success (Cloud Run) -> connection_success (legacy)
    this.socket.on('auth_success', (data) => {
      console.log('🔌 [SocketAdapter] auth_success Cloud Run -> connection_success legacy:', data);
      this._emit('connection_success', { socketId: data.socketId });
    });

    // game_status (Cloud Run) -> game_status (legacy)
    this.socket.on('game_status', (data) => {
      console.log('🔌 [SocketAdapter] game_status Cloud Run -> legacy:', data);
      this._emit('game_status', data);
    });

    // start_round (Cloud Run) -> start_round (legacy)
    this.socket.on('start_round', (data) => {
      console.log('🔌 [SocketAdapter] start_round Cloud Run -> legacy:', data);
      this._emit('start_round', data);
    });

    // new_round (Cloud Run) -> new_round (legacy)
    this.socket.on('new_round', (data) => {
      console.log('🔌 [SocketAdapter] new_round Cloud Run -> legacy:', data);
      this._emit('new_round', data);
    });

    // ROUND_CALCULATING (Cloud Run) -> ROUND_CALCULATING (legacy)
    this.socket.on('ROUND_CALCULATING', (data) => {
      console.log('🔌 [SocketAdapter] ROUND_CALCULATING Cloud Run -> legacy:', data);
      this._emit('ROUND_CALCULATING', data);
    });

    // ROUND_END (Cloud Run) -> ROUND_END (legacy)
    this.socket.on('ROUND_END', (data) => {
      console.log('🔌 [SocketAdapter] ROUND_END Cloud Run -> legacy:', data);
      this._emit('ROUND_END', data);
    });

    // round_ended (Cloud Run) -> round_ended (legacy)
    this.socket.on('round_ended', (data) => {
      console.log('🔌 [SocketAdapter] round_ended Cloud Run -> legacy:', data);
      this._emit('round_ended', data);
    });

    // game_completed (Cloud Run) -> game_completed (legacy)
    this.socket.on('game_completed', (data) => {
      console.log('🔌 [SocketAdapter] game_completed Cloud Run -> legacy:', data);
      this._emit('game_completed', data);
    });

    // rewards_assigned (Cloud Run) -> rewards_assigned (legacy)
    this.socket.on('rewards_assigned', (data) => {
      console.log('🔌 [SocketAdapter] rewards_assigned Cloud Run -> legacy:', data);
      this._emit('rewards_assigned', data);
    });

    // new_mining_problem (Cloud Run) -> new_mining_problem (legacy)
    this.socket.on('new_mining_problem', (data) => {
      console.log('🔌 [SocketAdapter] new_mining_problem Cloud Run -> legacy:', data);
      this._emit('new_mining_problem', data);
    });

    // transaction_success (Cloud Run) -> transaction_success (legacy)
    this.socket.on('transaction_success', (data) => {
      console.log('🔌 [SocketAdapter] transaction_success Cloud Run -> legacy:', data);
      this._emit('transaction_success', data);
    });

    // inventory_data (Cloud Run) -> inventory_data (legacy)
    this.socket.on('inventory_data', (data) => {
      console.log('🔌 [SocketAdapter] inventory_data Cloud Run -> legacy:', data);
      this._emit('inventory_data', data);
    });

    // mined_blocks_data (Cloud Run) -> mined_blocks_data (legacy)
    this.socket.on('mined_blocks_data', (data) => {
      console.log('🔌 [SocketAdapter] mined_blocks_data Cloud Run -> legacy:', data);
      this._emit('mined_blocks_data', data);
    });

    // player_rankings_data (Cloud Run) -> player_rankings_data (legacy)
    this.socket.on('player_rankings_data', (data) => {
      console.log('🔌 [SocketAdapter] player_rankings_data Cloud Run -> legacy:', data);
      this._emit('player_rankings_data', data);
    });

    // product_list_updated (Cloud Run) -> product_list_updated (legacy)
    this.socket.on('product_list_updated', (data) => {
      console.log('🔌 [SocketAdapter] product_list_updated Cloud Run -> legacy:', data);
      this._emit('product_list_updated', data);
    });

    // mining_problems_data (Cloud Run) -> mining_problems_data (legacy)
    this.socket.on('mining_problems_data', (data) => {
      console.log('🔌 [SocketAdapter] mining_problems_data Cloud Run -> legacy:', data);
      this._emit('mining_problems_data', data);
    });

    // mining_response_update (Cloud Run) -> mining_response_update (legacy)
    this.socket.on('mining_response_update', (data) => {
      console.log('🔌 [SocketAdapter] mining_response_update Cloud Run -> legacy:', data);
      this._emit('mining_response_update', data);
    });

    // NUEVOS EVENTOS PARA FINAL DE RONDA
    // round:ready:progress (Cloud Run) -> round:ready:progress (legacy)
    this.socket.on('round:ready:progress', (data) => {
      console.log('🔌 [SocketAdapter] round:ready:progress Cloud Run -> legacy:', data);
      this._emit('round:ready:progress', data);
    });

    // round:ready:error (Cloud Run) -> round:ready:error (legacy)
    this.socket.on('round:ready:error', (data) => {
      console.log('🔌 [SocketAdapter] round:ready:error Cloud Run -> legacy:', data);
      this._emit('round:ready:error', data);
    });

    // economy:state (Cloud Run) -> economy:state (legacy)
    this.socket.on('economy:state', (data) => {
      console.log('🔌 [SocketAdapter] economy:state Cloud Run -> legacy:', data);
      this._emit('economy:state', data);
    });

    // ELIMINADO: Listener duplicado de game_status

    // round_ended (Cloud Run) -> round_ended (legacy) - NUEVO PARA FINAL DE RONDA
    this.socket.on('round_ended', (data) => {
      console.log('🔌 [SocketAdapter] round_ended Cloud Run -> legacy:', data);
      this._emit('round_ended', data);
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
      console.warn('🔌 [SocketAdapter] Socket no conectado, no se puede emitir:', event);
      return false;
    }

    console.log('🔌 [SocketAdapter] Emitiendo:', event, data);
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
          console.error('🔌 [SocketAdapter] Error en callback:', error);
        }
      });
    }
  }

  // Desconectar
  disconnect() {
    if (this.socket) {
      console.log('🔌 [SocketAdapter] Desconectando...');
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
    console.log('🔌 [SocketAdapter] assignRoundRewards llamado');
    return this.emit('assign_round_rewards', {});
  }

  endRound() {
    console.log('🔌 [SocketAdapter] endRound llamado');
    return this.emit('round_ended', {});
  }

  joinGame(gameId, userId, userName) {
    console.log('🔌 [SocketAdapter] joinGame llamado:', { gameId, userId, userName });
    this.currentGameId = gameId;
    this.currentUserId = userId;
    
    // Enviar autenticación automáticamente
    console.log('🔐 [ADAPTER] auth sent { userId:', userId, ', hasToken: true }');
    this.emit('auth', { userId, userName });
    
    // Esperar un poco para que el auth se procese antes de join_game
    setTimeout(() => {
      console.log('🎮 [ADAPTER] join_game sent:', { gameId, userId, userName });
      this.emit('join_game', { gameId, userId, userName });
    }, 100);
  }

  startGame() {
    console.log('🔌 [SocketAdapter] startGame llamado');
    return this.emit('start_game', { gameId: this.currentGameId });
  }

  readyToPlay() {
    console.log('🔌 [SocketAdapter] readyToPlay llamado');
    return this.emit('ready_to_play', { gameId: this.currentGameId, userId: this.currentUserId });
  }

  readyForNextRound() {
    console.log('🔌 [SocketAdapter] readyForNextRound llamado');
    return this.emit('ready_for_next_round', { gameId: this.currentGameId, userId: this.currentUserId });
  }

  // NUEVO: Emitir round:ready para transición entre rondas
  roundReady(gameId, userId, round) {
    console.log('🔌 [SocketAdapter] roundReady llamado:', { gameId, userId, round });
    return this.emit('round:ready', { gameId, userId, round });
  }

  authenticate(userId, userName) {
    console.log('🔌 [SocketAdapter] authenticate llamado:', { userId, userName });
    return this.emit('auth', { userId, userName });
  }
}

// Instancia singleton global
let socketAdapterInstance = null;

// Función para obtener la instancia singleton
export const getWebSocketService = () => {
  if (!socketAdapterInstance) {
    socketAdapterInstance = new SocketAdapter();
  }
  return socketAdapterInstance;
};

// Export por defecto
export default getWebSocketService();
