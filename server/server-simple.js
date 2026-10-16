const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// Configuración (ver server/.env.example)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

// Inicializar Firebase Admin (credenciales por defecto de la aplicación / ADC)
if (!admin.apps.length) {
  try {
    admin.initializeApp(FIREBASE_PROJECT_ID ? { projectId: FIREBASE_PROJECT_ID } : undefined);
    console.log('✅ Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    console.log('⚠️ Continuando sin Firebase Admin (modo offline)');
  }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket']
});

// Log de conexiones
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
    trackDisconnection(socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint para Cloud Run
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Info endpoint
app.get('/info', (req, res) => {
  res.status(200).json({
    service: 'rockchain-socket',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    activeGames: gameRooms.size,
    activeConnections: io.sockets.sockets.size
  });
});

// Almacenamiento en memoria para el estado del juego
const gameRooms = new Map(); // gameId -> { players: [], status, round, etc. }
const playerSockets = new Map(); // userId -> socketId
const miningResponses = new Map(); // blockId -> { responses: [], isCompleted: false }
const playerInventories = new Map(); // gameId -> { userId -> { products: [], rockCoins: 600, waste: 0 } }
const minedBlocks = new Map(); // gameId -> [block1, block2, ...]
const playerRankings = new Map(); // gameId -> { userId -> { blocksMined: 0, totalRewards: 0 } }
const miningProblems = new Map(); // blockId -> problemData

// SISTEMA AUTORITATIVO DE COORDINACIÓN EN TIEMPO REAL
const gameAuthorities = new Map(); // gameId -> { roundId, version, roundStartAtMs, roundEndsAtMs, serverNowMs }
const roundVersions = new Map(); // gameId -> version counter
const appliedOperations = new Map(); // gameId -> Set<operationId> para idempotencia

// MÁQUINA DE ESTADOS ROBUSTA
const gameStates = new Map(); // gameId -> { state, round, lock, operationsApplied }
const roundLocks = new Map(); // gameId:round -> lock status
const operationsApplied = new Map(); // gameId -> Set<operationId>
const rewardsCommitted = new Map(); // gameId:round -> boolean (idempotencia)

// Estados de la máquina
const GAME_STATES = {
  PLAYING: 'PLAYING',
  ROUND_CALCULATING: 'ROUND_CALCULATING', 
  ROUND_END: 'ROUND_END',
  WAITING_FOR_NEXT_ROUND: 'WAITING_FOR_NEXT_ROUND'
};

// Función helper para obtener información de la sala
const getGameRoom = (gameId) => {
  if (!gameRooms.has(gameId)) {
    gameRooms.set(gameId, {
      players: [],
      status: 'waiting',
      round: 1,
      readyPlayers: new Set(),
      hostId: null,
      roundTime: null,
      winningIndustry: null,
      roundTransitioning: false // PROTECCIÓN DE IDEMPOTENCIA
    });
  }
  return gameRooms.get(gameId);
};

// FUNCIONES DEL SISTEMA AUTORITATIVO
const getGameAuthority = (gameId) => {
  if (!gameAuthorities.has(gameId)) {
    gameAuthorities.set(gameId, {
      roundId: null,
      version: 0,
      roundStartAtMs: null,
      roundEndsAtMs: null,
      serverNowMs: Date.now()
    });
  }
  return gameAuthorities.get(gameId);
};

const incrementRoundVersion = (gameId) => {
  if (!roundVersions.has(gameId)) {
    roundVersions.set(gameId, 0);
  }
  const newVersion = roundVersions.get(gameId) + 1;
  roundVersions.set(gameId, newVersion);
  return newVersion;
};

const generateRoundId = (gameId, round) => {
  return `${gameId}:${round}:${Date.now()}`;
};

const getServerTimestamp = () => {
  return Date.now();
};

// SISTEMA DE OBSERVABILIDAD
const metrics = {
  connections: new Map(), // socketId -> { connectedAt, lastPing, gameId, userId }
  gameMetrics: new Map(), // gameId -> { startTime, roundCount, playerCount, avgPing }
  roundMetrics: new Map(), // gameId:round -> { startTime, endTime, duration, playerCount }
  resyncCount: new Map(), // gameId -> count
  errorCount: new Map() // gameId -> count
};

const logMetric = (type, gameId, data = {}) => {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    type,
    gameId,
    ...data
  };
  console.log(`📊 [METRIC] ${JSON.stringify(logData)}`);
};

const trackConnection = (socketId, gameId, userId) => {
  metrics.connections.set(socketId, {
    connectedAt: Date.now(),
    lastPing: Date.now(),
    gameId,
    userId
  });
  logMetric('connection', gameId, { socketId, userId, action: 'connected' });
};

const trackDisconnection = (socketId) => {
  const connection = metrics.connections.get(socketId);
  if (connection) {
    const duration = Date.now() - connection.connectedAt;
    logMetric('connection', connection.gameId, { 
      socketId, 
      userId: connection.userId, 
      action: 'disconnected',
      duration 
    });
    metrics.connections.delete(socketId);
  }
};

const trackRoundStart = (gameId, round) => {
  const roundKey = `${gameId}:${round}`;
  metrics.roundMetrics.set(roundKey, {
    startTime: Date.now(),
    endTime: null,
    duration: null,
    playerCount: getGameRoom(gameId)?.players?.length || 0
  });
  logMetric('round_start', gameId, { round, playerCount: getGameRoom(gameId)?.players?.length || 0 });
};

const trackRoundEnd = (gameId, round) => {
  const roundKey = `${gameId}:${round}`;
  const roundMetric = metrics.roundMetrics.get(roundKey);
  if (roundMetric) {
    roundMetric.endTime = Date.now();
    roundMetric.duration = roundMetric.endTime - roundMetric.startTime;
    logMetric('round_end', gameId, { 
      round, 
      duration: roundMetric.duration,
      playerCount: roundMetric.playerCount 
    });
  }
};

const trackResync = (gameId, userId) => {
  const currentCount = metrics.resyncCount.get(gameId) || 0;
  metrics.resyncCount.set(gameId, currentCount + 1);
  logMetric('resync', gameId, { userId, count: currentCount + 1 });
};

const trackError = (gameId, error, context = {}) => {
  const currentCount = metrics.errorCount.get(gameId) || 0;
  metrics.errorCount.set(gameId, currentCount + 1);
  logMetric('error', gameId, { 
    error: error.message || error, 
    count: currentCount + 1,
    ...context 
  });
};

const createAuthoritativeRoundData = (gameId, round, durationMs = 120000) => {
  const serverNow = getServerTimestamp();
  const roundId = generateRoundId(gameId, round);
  const version = incrementRoundVersion(gameId);
  const roundStartAtMs = serverNow;
  const roundEndsAtMs = serverNow + durationMs;
  
  const authority = {
    roundId,
    version,
    round,
    roundStartAtMs,
    roundEndsAtMs,
    serverNowMs: serverNow
  };
  
  gameAuthorities.set(gameId, authority);
  
  console.log(`🎯 [AUTHORITY] Creado estado autoritativo para ${gameId}:`, authority);
  return authority;
};

const emitAuthoritativeState = (gameId, eventName, additionalData = {}) => {
  const authority = getGameAuthority(gameId);
  const serverNow = getServerTimestamp();
  
  // CRÍTICO: additionalData debe sobrescribir authority para asegurar que los valores más recientes se usen
  // Especialmente importante para roundEndsAtMs cuando se emite start_round después de countdown_start
  const authoritativePayload = {
    ...authority,
    serverNowMs: serverNow,
    ...additionalData // additionalData sobrescribe authority (incluyendo roundEndsAtMs si está presente)
  };
  
  // CRÍTICO: Si additionalData incluye roundEndsAtMs, actualizar el authority en memoria
  // para que futuras llamadas a getGameAuthority devuelvan el valor correcto
  // IMPORTANTE: Solo actualizar si NO es countdown_start (countdown es temporal)
  // Solo start_round debe actualizar el authority permanente
  if (additionalData.roundEndsAtMs !== undefined && eventName !== 'countdown_start') {
    const updatedAuthority = {
      ...authority,
      roundEndsAtMs: additionalData.roundEndsAtMs,
      round: additionalData.round !== undefined ? additionalData.round : authority.round,
      roundId: additionalData.roundId !== undefined ? additionalData.roundId : authority.roundId,
      version: additionalData.version !== undefined ? additionalData.version : authority.version
    };
    gameAuthorities.set(gameId, updatedAuthority);
    console.log(`🔄 [AUTHORITY] Authority actualizado en memoria con roundEndsAtMs=${additionalData.roundEndsAtMs} para ${eventName}`);
  } else if (eventName === 'countdown_start') {
    console.log(`⏸️ [AUTHORITY] countdown_start NO actualiza authority permanente (es temporal)`);
  }
  
  console.log(`📡 [AUTHORITY] Emitiendo ${eventName} con estado autoritativo:`, authoritativePayload);
  console.log(`📡 [AUTHORITY] Payload incluye roundEndsAtMs:`, !!authoritativePayload.roundEndsAtMs);
  console.log(`📡 [AUTHORITY] Payload incluye roundTime:`, !!authoritativePayload.roundTime);
  if (authoritativePayload.roundEndsAtMs) {
    console.log(`📡 [AUTHORITY] roundEndsAtMs valor:`, authoritativePayload.roundEndsAtMs, `(${new Date(authoritativePayload.roundEndsAtMs).toISOString()})`);
  }
  
  emitToGame(gameId, eventName, authoritativePayload);
  
  console.log(`✅ [AUTHORITY] ${eventName} emitido exitosamente a sala ${gameId}`);
  
  return authoritativePayload;
};

// FUNCIONES DE IDEMPOTENCIA
const isOperationApplied = (gameId, operationId) => {
  if (!appliedOperations.has(gameId)) {
    appliedOperations.set(gameId, new Set());
  }
  return appliedOperations.get(gameId).has(operationId);
};

const markOperationApplied = (gameId, operationId) => {
  if (!appliedOperations.has(gameId)) {
    appliedOperations.set(gameId, new Set());
  }
  appliedOperations.get(gameId).add(operationId);
  console.log(`🔄 [IDEMPOTENCY] Operación ${operationId} marcada como aplicada para ${gameId}`);
};

const createOperationId = (gameId, operationType, roundId, version) => {
  return `${gameId}:${operationType}:${roundId}:${version}`;
};

// FUNCIONES PARA OPERACIONES ATÓMICAS
const atomicRewardOperations = new Map(); // gameId -> Set<operationId> para tracking de recompensas atómicas

const createRewardOperationId = (gameId, roundId, userId, blockId) => {
  return `reward:${gameId}:${roundId}:${userId}:${blockId}`;
};

const isRewardOperationApplied = (gameId, operationId) => {
  if (!atomicRewardOperations.has(gameId)) {
    atomicRewardOperations.set(gameId, new Set());
  }
  return atomicRewardOperations.get(gameId).has(operationId);
};

const markRewardOperationApplied = (gameId, operationId) => {
  if (!atomicRewardOperations.has(gameId)) {
    atomicRewardOperations.set(gameId, new Set());
  }
  atomicRewardOperations.get(gameId).add(operationId);
  console.log(`💰 [ATOMIC] Recompensa ${operationId} marcada como aplicada`);
};

const applyAtomicReward = async (gameId, userId, rewardAmount, operationId) => {
  if (isRewardOperationApplied(gameId, operationId)) {
    console.log(`💰 [ATOMIC] Recompensa ${operationId} ya aplicada, omitiendo`);
    return false;
  }

  try {
    // Obtener inventario actual
    const gameInventory = playerInventories.get(gameId) || new Map();
    const userInventory = gameInventory.get(userId) || { products: [], rockCoins: 600, waste: 0 };
    
    // Validar valores antes de aplicar
    const currentRockCoins = typeof userInventory.rockCoins === 'number' && !isNaN(userInventory.rockCoins) 
      ? userInventory.rockCoins 
      : 600;
    
    // Aplicar recompensa
    const newRockCoins = currentRockCoins + rewardAmount;
    userInventory.rockCoins = newRockCoins;
    
    // Asegurar que products es un array válido
    if (!Array.isArray(userInventory.products)) {
      userInventory.products = [];
    }
    
    // Actualizar inventario en memoria
    gameInventory.set(userId, userInventory);
    playerInventories.set(gameId, gameInventory);
    
    // CRÍTICO: Persistir inmediatamente en Firestore
    if (admin.apps.length) {
      try {
        const userRef = admin.firestore().collection('users').doc(userId);
        await userRef.update({
          [`games.${gameId}.rockCoins`]: newRockCoins,
          [`games.${gameId}.waste`]: typeof userInventory.waste === 'number' && !isNaN(userInventory.waste) 
            ? userInventory.waste 
            : 0,
          [`games.${gameId}.products`]: userInventory.products,
          [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`💾 [ATOMIC] Inventario persistido en Firestore para ${userId}: rockCoins=${newRockCoins}`);
      } catch (firestoreError) {
        console.error(`❌ [ATOMIC] Error persistiendo en Firestore para ${userId}:`, firestoreError);
        // Continuar aunque falle la persistencia (se persistirá más tarde)
      }
    }
    
    // Marcar operación como aplicada
    markRewardOperationApplied(gameId, operationId);
    
    console.log(`💰 [ATOMIC] Recompensa aplicada y persistida: ${userId} +${rewardAmount} = ${newRockCoins} rockCoins`);
    return true;
  } catch (error) {
    console.error(`❌ [ATOMIC] Error aplicando recompensa ${operationId}:`, error);
    return false;
  }
};

// FUNCIONES DE LA MÁQUINA DE ESTADOS
const getGameState = (gameId) => {
  if (!gameStates.has(gameId)) {
    gameStates.set(gameId, {
      state: GAME_STATES.WAITING_FOR_NEXT_ROUND,
      round: 1,
      lock: false,
      operationsApplied: new Set()
    });
  }
  return gameStates.get(gameId);
};

const acquireRoundLock = (gameId, round) => {
  const lockKey = `${gameId}:${round}`;
  if (roundLocks.has(lockKey)) {
    console.log(`🔒 [ROUND][LOCK] Lock ya existe para ${lockKey}`);
    return false;
  }
  
  roundLocks.set(lockKey, { acquired: true, timestamp: Date.now() });
  console.log(`🔒 [ROUND][LOCK] acquired para ${lockKey}`);
  return true;
};

const releaseRoundLock = (gameId, round) => {
  const lockKey = `${gameId}:${round}`;
  roundLocks.delete(lockKey);
  console.log(`🔒 [ROUND][LOCK] released para ${lockKey}`);
};

const setGameState = (gameId, newState, round = null) => {
  const state = getGameState(gameId);
  const oldState = state.state;
  state.state = newState;
  if (round !== null) state.round = round;
  console.log(`🔄 [ROUND][STATE] ${gameId} ${oldState} → ${newState} (round: ${state.round})`);
};


// FUNCIÓN PRINCIPAL: CÁLCULO AUTORITATIVO DE RECOMPENSAS
const calculateRoundRewards = async (gameId, round) => {
  console.log(`💰 [ROUND][CALC] Iniciando cálculo autoritativo para ${gameId} ronda ${round}`);
  
  const room = getGameRoom(gameId);
  const gameState = getGameState(gameId);
  
  try {
    // 0. CERRAR BLOQUES NO RESPONDIDOS Y ASIGNARLOS A EXTERNAL MINER
    console.log(`🔍 [ROUND][CALC] Cerrando bloques no respondidos de la ronda ${round}...`);
    closeUnansweredBlocks(gameId, round);
    
    // 1. Cerrar bloques de minado y recopilar respuestas
    console.log(`🔍 [ROUND][CALC] Cerrando bloques de minado...`);
    const allMinedBlocks = getMinedBlocks(gameId).filter(block => block.round === round);
    console.log(`🔍 [ROUND][CALC] ${allMinedBlocks.length} bloques encontrados para ronda ${round}`);
    
    // 2. Determinar ganadores de minado
    const miningWinners = [];
    for (const block of allMinedBlocks) {
      if (block.winner && block.winner.isCorrect) {
        const operationId = `rc:mining:${round}:${block.id}:${block.winner.userId}`;
        
        if (!isOperationApplied(gameId, operationId)) {
          miningWinners.push({
            blockId: block.id,
            winnerUserId: block.winner.userId,
            winnerName: block.winner.userName,
            operationId
          });
          console.log(`⛏️ [ROUND][MINING] winner block=${block.id} user=${block.winner.userName} reward=50 opId=${operationId}`);
        } else {
          console.log(`⛏️ [ROUND][MINING] winner block=${block.id} user=${block.winner.userName} reward=50 opId=${operationId} (duplicate)`);
        }
      }
    }
    
    // 3. Elegir y persistir winningIndustry (SIEMPRE se resetea para cada ronda)
    // CRÍTICO: Reseteamos winningIndustry para cada ronda para que sea diferente
      const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
      room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
    console.log(`🏭 [ROUND][WASTE] winningIndustry seleccionado para ronda ${round}: ${room.winningIndustry}`);
    
    // Definir eficiencias de las industrias para economía circular
    const industryEfficiencies = {
      'Construction': 85,
      'Technology': 60,
      'Healthcare': 40,
      'Energy': 70
    };
    
    // 4. Calcular recompensas de waste basadas en eficiencia real
    const wasteWinners = [];
    
    for (const player of room.players) {
      let selectedIndustry = null;
      let didPlayerGuessCorrectly = false;
      
      // Leer selectedIndustry desde Firestore
      if (admin.apps.length) {
        try {
          const userRef = admin.firestore().collection('users').doc(player.userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const gameUserData = userData.games?.[gameId] || {};
            selectedIndustry = gameUserData.selectedIndustry;
            didPlayerGuessCorrectly = selectedIndustry === room.winningIndustry;
          }
        } catch (firebaseError) {
          console.log(`⚠️ [ROUND][WASTE] Error leyendo selectedIndustry para ${player.userName}:`, firebaseError.message);
        }
      }
      
      const operationId = `rc:waste:${round}:${player.userId}`;
      
      if (didPlayerGuessCorrectly && !isOperationApplied(gameId, operationId)) {
        // Calcular recompensa basada en eficiencia de la industria
        const industryEfficiency = industryEfficiencies[selectedIndustry] || 50;
        const baseWasteReduction = 30; // Base de 30
        const efficiencyBonus = Math.floor(industryEfficiency * 0.5); // Bonus basado en eficiencia
        const wasteReduction = baseWasteReduction + efficiencyBonus;
        
        wasteWinners.push({
          userId: player.userId,
          userName: player.userName,
          operationId,
          wasteReduction,
          industryEfficiency,
          selectedIndustry,
          educationalMessage: `Great choice! The ${selectedIndustry} industry has ${industryEfficiency}% efficiency in reusing stone waste, promoting circular economy.`
        });
        console.log(`🗑️ [ROUND][WASTE] user=${player.userName} hit=true reward=${wasteReduction} efficiency=${industryEfficiency}% opId=${operationId}`);
      } else if (didPlayerGuessCorrectly) {
        console.log(`🗑️ [ROUND][WASTE] user=${player.userName} hit=true opId=${operationId} (duplicate)`);
      } else {
        console.log(`🗑️ [ROUND][WASTE] user=${player.userName} hit=false (seleccionó: ${selectedIndustry})`);
      }
    }
    
    // 5. Aplicar recompensas con operaciones atómicas
    console.log(`💰 [ROUND][CALC] Aplicando recompensas con operaciones atómicas...`);
    
    // Aplicar recompensas de minado con explicación educativa
    for (const winner of miningWinners) {
      const rewardOperationId = createRewardOperationId(gameId, round, winner.winnerUserId, winner.blockId);
      const miningReward = 50; // Base reward for mining
      const applied = await applyAtomicReward(gameId, winner.winnerUserId, miningReward, rewardOperationId);
      if (applied) {
        markOperationApplied(gameId, winner.operationId);
        
        // Emitir feedback educativo para minado
        emitToGame(gameId, 'educational_feedback', {
          type: 'mining_success',
          userId: winner.winnerUserId,
          userName: winner.winnerName,
          reward: miningReward,
          message: `Great job! You successfully mined a block by solving the mathematical problem. In real blockchain, this validates transactions and secures the network.`,
          explanation: 'Mining rewards are given to players who solve computational problems to validate transactions and maintain blockchain security.'
        });
        
        console.log(`✅ [ROUND][MINING] Aplicado +${miningReward} RockCoins a ${winner.winnerName}`);
      }
    }
    
    // Aplicar recompensas de waste con explicación educativa
    for (const winner of wasteWinners) {
      const rewardOperationId = createRewardOperationId(gameId, round, winner.userId, `waste-${round}`);
      const applied = await applyAtomicReward(gameId, winner.userId, winner.wasteReduction, rewardOperationId);
      if (applied) {
        // También reducir waste
        const inventory = getPlayerInventory(gameId, winner.userId);
        const currentWaste = typeof inventory.waste === 'number' && !isNaN(inventory.waste) ? inventory.waste : 0;
        const newWaste = Math.max(0, currentWaste - winner.wasteReduction);
        inventory.waste = newWaste;
        
        // CRÍTICO: Actualizar inventario en memoria
        const gameInventory = playerInventories.get(gameId) || new Map();
        gameInventory.set(winner.userId, inventory);
        playerInventories.set(gameId, gameInventory);
        
        // CRÍTICO: Persistir inmediatamente en Firestore
        if (admin.apps.length) {
          try {
            const userRef = admin.firestore().collection('users').doc(winner.userId);
            await userRef.update({
              [`games.${gameId}.waste`]: newWaste,
              [`games.${gameId}.rockCoins`]: typeof inventory.rockCoins === 'number' && !isNaN(inventory.rockCoins) 
                ? inventory.rockCoins 
                : 600,
              [`games.${gameId}.products`]: Array.isArray(inventory.products) ? inventory.products : [],
              [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`💾 [ROUND][WASTE] Waste persistido en Firestore para ${winner.userId}: waste=${newWaste}`);
          } catch (firestoreError) {
            console.error(`❌ [ROUND][WASTE] Error persistiendo waste en Firestore para ${winner.userId}:`, firestoreError);
          }
        }
        
        markOperationApplied(gameId, winner.operationId);
        
        // Emitir feedback educativo para waste reduction
        emitToGame(gameId, 'educational_feedback', {
          type: 'waste_reduction_success',
          userId: winner.userId,
          userName: winner.userName,
          reward: winner.wasteReduction,
          industryEfficiency: winner.industryEfficiency,
          selectedIndustry: winner.selectedIndustry,
          wasteReduced: winner.wasteReduction,
          message: winner.educationalMessage,
          explanation: `You chose the ${winner.selectedIndustry} industry which has ${winner.industryEfficiency}% efficiency in reusing stone waste. This promotes circular economy by turning waste into valuable resources.`
        });
        
        console.log(`✅ [ROUND][WASTE] Aplicado -${winner.wasteReduction} waste a ${winner.userName} (${currentWaste} → ${newWaste})`);
      }
    }
    
    // 6. Calcular balances finales
    const finalBalances = {};
    for (const player of room.players) {
      const inventory = getPlayerInventory(gameId, player.userId);
      finalBalances[player.userId] = {
        rockCoins: inventory.rockCoins,
        waste: inventory.waste
      };
    }
    
    // 6.5. CRÍTICO: Verificar y normalizar valores antes de persistir
    console.log(`🔍 [ROUND][CALC] Verificando y normalizando inventarios después de aplicar todos los rewards...`);
    const normalizedInventories = new Map();
    for (const player of room.players) {
      const inventory = getPlayerInventory(gameId, player.userId);
      
      // Normalizar y validar valores
      const rockCoins = typeof inventory.rockCoins === 'number' && !isNaN(inventory.rockCoins) && isFinite(inventory.rockCoins)
        ? Math.max(0, Math.round(inventory.rockCoins))
        : 600;
      const waste = typeof inventory.waste === 'number' && !isNaN(inventory.waste) && isFinite(inventory.waste)
        ? Math.max(0, Math.round(inventory.waste))
        : 0;
      const products = Array.isArray(inventory.products) ? inventory.products : [];
      
      // Actualizar inventario en memoria con valores normalizados
      inventory.rockCoins = rockCoins;
      inventory.waste = waste;
      inventory.products = products;
      
      const gameInventory = playerInventories.get(gameId) || new Map();
      gameInventory.set(player.userId, inventory);
      playerInventories.set(gameId, gameInventory);
      
      normalizedInventories.set(player.userId, { rockCoins, waste, products });
      
      console.log(`🔍 [ROUND][CALC] Inventario normalizado para ${player.userName} (${player.userId}):`, {
        rockCoins: rockCoins,
        waste: waste,
        productsCount: products.length
      });
    }
    
    // 6.5.1. CRÍTICO: Persistir inventarios normalizados en Firestore en batch
    console.log(`💾 [ROUND][CALC] Persistiendo inventarios normalizados en Firestore en batch...`);
    if (admin.apps.length) {
      try {
        const db = admin.firestore();
        const batch = db.batch();
        
        for (const player of room.players) {
          const normalized = normalizedInventories.get(player.userId);
          if (!normalized) {
            console.warn(`⚠️ [ROUND][CALC] No se encontró inventario normalizado para ${player.userId}`);
            continue;
          }
          
          const userRef = db.collection('users').doc(player.userId);
          
          console.log(`💾 [ROUND][CALC] Agregando a batch para ${player.userName} (${player.userId}):`, {
            rockCoins: normalized.rockCoins,
            waste: normalized.waste,
            productsCount: normalized.products.length
          });
          
          batch.update(userRef, {
            [`games.${gameId}.rockCoins`]: normalized.rockCoins,
            [`games.${gameId}.waste`]: normalized.waste,
            [`games.${gameId}.products`]: normalized.products,
            [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        await batch.commit();
        console.log(`✅ [ROUND][CALC] Batch de inventarios persistido en Firestore exitosamente`);
        
        // Verificar que los valores se guardaron correctamente
        console.log(`🔍 [ROUND][CALC] Verificando valores guardados en Firestore...`);
        for (const player of room.players) {
          try {
            const normalized = normalizedInventories.get(player.userId);
            const userRef = db.collection('users').doc(player.userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
              const gameData = userDoc.data()?.games?.[gameId];
              console.log(`🔍 [ROUND][CALC] Verificación para ${player.userName}:`, {
                enMemoria: {
                  rockCoins: normalized.rockCoins,
                  waste: normalized.waste
                },
                enFirestore: {
                  rockCoins: gameData?.rockCoins,
                  waste: gameData?.waste
                },
                coinciden: normalized.rockCoins === gameData?.rockCoins && normalized.waste === gameData?.waste
              });
              
              // Si no coinciden, corregir
              if (normalized.rockCoins !== gameData?.rockCoins || normalized.waste !== gameData?.waste) {
                console.warn(`⚠️ [ROUND][CALC] Valores no coinciden, corrigiendo Firestore para ${player.userId}...`);
                await userRef.update({
                  [`games.${gameId}.rockCoins`]: normalized.rockCoins,
                  [`games.${gameId}.waste`]: normalized.waste,
                  [`games.${gameId}.products`]: normalized.products,
                  [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ [ROUND][CALC] Valores corregidos en Firestore para ${player.userId}`);
              }
            }
          } catch (verifyError) {
            console.error(`❌ [ROUND][CALC] Error verificando Firestore para ${player.userId}:`, verifyError);
          }
        }
      } catch (error) {
        console.error(`❌ [ROUND][CALC] Error persistiendo batch en Firestore:`, error);
        // Fallback: persistir individualmente
        console.log(`🔄 [ROUND][CALC] Intentando persistir individualmente como fallback...`);
        for (const player of room.players) {
          try {
            const normalized = normalizedInventories.get(player.userId);
            if (!normalized) continue;
            
            const userRef = admin.firestore().collection('users').doc(player.userId);
            await userRef.update({
              [`games.${gameId}.rockCoins`]: normalized.rockCoins,
              [`games.${gameId}.waste`]: normalized.waste,
              [`games.${gameId}.products`]: normalized.products,
              [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ [ROUND][CALC] Inventario persistido individualmente para ${player.userId}`);
          } catch (individualError) {
            console.error(`❌ [ROUND][CALC] Error persistiendo individualmente para ${player.userId}:`, individualError);
          }
        }
      }
    } else {
      console.warn(`⚠️ [ROUND][CALC] Firebase Admin no disponible, saltando persistencia`);
    }
    
    // 6.6. CRÍTICO: Enviar inventarios normalizados a todos los jugadores vía WebSocket
    console.log(`📦 [ROUND][CALC] Enviando inventarios normalizados a todos los jugadores vía WebSocket...`);
    for (const player of room.players) {
      const normalized = normalizedInventories.get(player.userId);
      if (!normalized) {
        console.warn(`⚠️ [ROUND][CALC] No se encontró inventario normalizado para enviar a ${player.userId}`);
        continue;
      }
      
      const playerSocketId = playerSockets.get(player.userId);
      
      if (playerSocketId) {
        const inventoryData = {
          gameId,
          userId: player.userId,
          inventory: {
            rockCoins: normalized.rockCoins,
            waste: normalized.waste,
            products: normalized.products,
            miningQueue: (getPlayerInventory(gameId, player.userId).miningQueue || 0)
          }
        };
        
        console.log(`📦 [ROUND][CALC] Enviando inventory_data a ${player.userName} (${player.userId}):`, {
          rockCoins: inventoryData.inventory.rockCoins,
          waste: inventoryData.inventory.waste,
          productsCount: inventoryData.inventory.products.length,
          socketId: playerSocketId
        });
        
        // Enviar a través del socket específico del jugador
        io.to(playerSocketId).emit('inventory_data', inventoryData);
        
        // También enviar a través de la sala del juego para asegurar que llegue
        io.to(gameId).emit('inventory_data', inventoryData);
        
        console.log(`✅ [ROUND][CALC] inventory_data enviado a ${player.userName} (${player.userId})`);
      } else {
        console.warn(`⚠️ [ROUND][CALC] No se encontró socketId para ${player.userId}, enviando a sala del juego...`);
        // Enviar a la sala del juego como fallback
        io.to(gameId).emit('inventory_data', {
          gameId,
          userId: player.userId,
          inventory: {
            rockCoins: normalized.rockCoins,
            waste: normalized.waste,
            products: normalized.products,
            miningQueue: 0
          }
        });
      }
    }
    
    // Actualizar ranking después de aplicar rewards
    updateAndEmitPlayerRankings(gameId);
    
    // 7. Montar payload de salida con información educativa
    const payload = {
      round: round,
      winningIndustry: room.winningIndustry,
      mining: {
        winners: miningWinners.map(w => ({
        blockId: w.blockId,
        winnerUserId: w.winnerUserId,
        winnerName: w.winnerName,
          rewardApplied: 50,
          explanation: 'Mining rewards are earned by solving mathematical problems to validate blockchain transactions'
      })),
        totalRewards: miningWinners.length * 50,
        educationalMessage: 'Mining is the process of validating transactions and securing the blockchain network through computational work.'
      },
      waste: {
        winningIndustry: room.winningIndustry,
        winners: wasteWinners.map(w => ({
          userId: w.userId,
          userName: w.userName,
          wasteReduction: w.wasteReduction,
          industryEfficiency: w.industryEfficiency,
          selectedIndustry: w.selectedIndustry,
          educationalMessage: w.educationalMessage
        })),
        industryEfficiencies: industryEfficiencies,
        totalWasteReduced: wasteWinners.reduce((sum, w) => sum + w.wasteReduction, 0),
        educationalMessage: 'Circular economy rewards are earned by choosing industries that efficiently reuse stone waste, reducing environmental impact.'
      },
      balances: finalBalances,
      operationsApplied: Array.from(gameState.operationsApplied),
      educationalSummary: {
        round: round,
        totalMiningRewards: miningWinners.length * 50,
        totalWasteReduction: wasteWinners.reduce((sum, w) => sum + w.wasteReduction, 0),
        playersWhoMined: miningWinners.length,
        playersWhoReducedWaste: wasteWinners.length,
        message: `Round ${round} completed! ${miningWinners.length} players mined blocks and ${wasteWinners.length} players contributed to circular economy.`
      }
    };
    
    console.log(`📊 [ROUND][END] Payload generado:`, {
      round: payload.round,
      winningIndustry: payload.winningIndustry,
      miningWinners: payload.mining.winners.length,
      wasteWinners: payload.waste.winners.length,
      totalOperations: payload.operationsApplied.length,
      educationalSummary: payload.educationalSummary
    });
    
    return payload;
    
  } catch (error) {
    console.error(`❌ [ROUND][CALC] Error en cálculo autoritativo:`, error);
    throw error;
  }
};

// Función helper para obtener problemas de minado (no se usa, eliminada)

// Función para generar problema de minado
const generateMiningProblem = (gameId, transactionDetails) => {
  // Generar ID más corto: gameId + timestamp corto (últimos 6 dígitos)
  const shortTimestamp = Date.now().toString().slice(-6);
  const blockId = `${gameId}-${shortTimestamp}`;
  
  // Generar problema matemático
  const operations = ['+', '-', '*'];
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const problem = `${num1} ${operation} ${num2}`;
  const solution = eval(`${num1} ${operation} ${num2}`);
  
  const miningProblem = {
    id: blockId,
    activeProblem: {
      problem: problem,
      mathProblem: problem,
      solution: solution,
      blockId: blockId,
      transactionDetails: transactionDetails,
      miningStartTime: Date.now() // Timestamp global cuando se genera el problema
    },
    timestamp: Date.now(),
    responses: [],
    isCompleted: false
  };
  
  // Añadir al nuevo sistema de minado
  miningProblems.set(blockId, miningProblem);
  
  console.log(`⛏️ Problema de minado generado en WebSocket:`, {
    gameId,
    blockId,
    problem,
    solution,
    transactionDetails
  });
  
  return miningProblem;
};

// Función para sincronizar el estado del juego con Firestore
const syncGameToFirestore = async (gameId, room) => {
  try {
    // Verificar si Firebase Admin está disponible
    if (!admin.apps.length) {
      console.log(`⚠️ Firebase Admin no disponible, saltando sincronización para juego ${gameId}`);
      return;
    }

    console.log(`📡 WebSocket: Sincronizando estado del juego ${gameId} con Firestore`);
  console.log(`📡 WebSocket: Estado actual - ${room.status}, Jugadores: ${room.players.length}`);
    
    const gameRef = admin.firestore().collection('games').doc(gameId);
    
    // Sincronizar estado del juego
    await gameRef.update({
      status: room.status,
      round: Math.max(1, room.round || 1),
      roundTime: room.roundTime ? admin.firestore.Timestamp.fromMillis(room.roundTime) : null,
      winningIndustry: room.winningIndustry,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // NOTA: Los inventarios ya fueron persistidos en calculateRoundRewards después de aplicar rewards
    // No es necesario sincronizarlos aquí nuevamente para evitar conflictos
    // Solo sincronizar si no se ha hecho antes (por seguridad, pero no debería ser necesario)
    console.log(`📦 [SYNC] Inventarios ya persistidos en calculateRoundRewards, saltando sincronización duplicada`);
    
    console.log(`✅ Estado del juego ${gameId} sincronizado con Firestore: ${room.status}`);
  } catch (error) {
    console.error(`❌ Error sincronizando juego ${gameId} con Firestore:`, error);
  }
};

// Función helper para emitir a todos en una sala
const emitToGame = (gameId, event, data) => {
  const room = io.sockets.adapter.rooms.get(gameId);
  const clientCount = room ? room.size : 0;
  console.log(`📡 Emitiendo ${event} a sala ${gameId} (${clientCount} clientes conectados):`, data);
  io.to(gameId).emit(event, data);
  console.log(`✅ [EMIT] ${event} emitido a sala ${gameId}`);
};

// NUEVA FUNCIÓN: Persistir datos de la ronda en Firestore (ATÓMICO)
const persistRoundDataAtomic = async (gameId, room, round) => {
  console.log(`💾 [PERSIST] Persistiendo datos de ronda ${round} para juego ${gameId} (ATÓMICO)`);
  
  if (!admin.apps.length) {
    console.log(`⚠️ [PERSIST] Firebase Admin no disponible, saltando persistencia`);
    return;
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();
    
    // 1. Crear documento de ronda con snapshot completo
    const roundRef = db.collection('games').doc(gameId).collection('rounds').doc(round.toString());
    const roundData = {
      round: round,
      completed: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      winningIndustry: room.winningIndustry,
      results: {
        mining: getMinedBlocks(gameId).filter(block => block.round === round),
        waste: {
          winningIndustry: room.winningIndustry,
          // TODO: Agregar datos de waste si es necesario
        },
        balances: {},
        players: room.players.map(player => ({
          userId: player.userId,
          userName: player.userName,
          readyForNextRound: player.readyForNextRound
        }))
      }
    };
    
    // CRÍTICO: Obtener inventarios DESPUÉS de aplicar rewards (deben estar ya actualizados)
    // Los rewards ya fueron aplicados en calculateRoundRewards, así que estos valores deben incluir los rewards
    const inventoriesSnapshot = new Map();
    for (const player of room.players) {
      const inventory = getPlayerInventory(gameId, player.userId);
      const rockCoins = typeof inventory.rockCoins === 'number' && !isNaN(inventory.rockCoins) ? inventory.rockCoins : 600;
      const waste = typeof inventory.waste === 'number' && !isNaN(inventory.waste) ? inventory.waste : 0;
      const products = Array.isArray(inventory.products) ? inventory.products : [];
      
      inventoriesSnapshot.set(player.userId, {
        rockCoins: rockCoins,
        waste: waste,
        products: products
      });
      
      console.log(`💾 [PERSIST] Inventario snapshot para ${player.userId} (DESPUÉS de rewards):`, {
        rockCoins: rockCoins,
        waste: waste,
        productsCount: products.length,
        inventory: inventory
      });
    }
    
    // Agregar balances finales de todos los jugadores desde snapshot
    for (const player of room.players) {
      const inventorySnapshot = inventoriesSnapshot.get(player.userId);
      roundData.results.balances[player.userId] = {
        rockCoins: inventorySnapshot.rockCoins,
        waste: inventorySnapshot.waste,
        products: inventorySnapshot.products?.length || 0
      };
    }
    
    batch.set(roundRef, roundData);
    
    // 2. Actualizar estado del juego para la siguiente ronda
    const gameRef = db.collection('games').doc(gameId);
    const nextRound = round + 1;
    batch.update(gameRef, {
      round: nextRound,
      status: 'starting',
      roundTime: admin.firestore.Timestamp.fromMillis(Date.now() + 3000),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 3. Resetear flags de ready para la nueva ronda
    const readyFlagsRef = db.collection('games').doc(gameId).collection('readyFlags').doc(nextRound.toString());
    batch.set(readyFlagsRef, {
      round: nextRound,
      allReady: false,
      readyPlayers: [],
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 4. Actualizar inventarios de todos los jugadores
    // CRÍTICO: Los inventarios YA fueron persistidos en calculateRoundRewards después de aplicar rewards
    // Aquí solo los actualizamos si hay diferencias (por seguridad, pero no debería ser necesario)
    for (const player of room.players) {
      const currentInventory = getPlayerInventory(gameId, player.userId);
      const inventorySnapshot = inventoriesSnapshot.get(player.userId);
      
      // Usar los valores actuales en memoria (que ya incluyen rewards) como autoritativos
      const finalRockCoins = currentInventory.rockCoins;
      const finalWaste = currentInventory.waste;
      const finalProducts = Array.isArray(currentInventory.products) ? currentInventory.products : [];
      
      console.log(`💾 [PERSIST] Actualizando inventario en Firestore para ${player.userId}:`, {
        rockCoins: finalRockCoins,
        waste: finalWaste,
        productsCount: finalProducts.length,
        note: 'Valores desde memoria (ya incluyen rewards aplicados)'
      });
      
      const userRef = db.collection('users').doc(player.userId);
      batch.update(userRef, {
        [`games.${gameId}.products`]: finalProducts,
        [`games.${gameId}.rockCoins`]: finalRockCoins,
        [`games.${gameId}.waste`]: finalWaste,
        [`games.${gameId}.readyForNextRound`]: false,
        [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Ejecutar batch atómico
    await batch.commit();
    console.log(`✅ [PERSIST] Datos de ronda ${round} persistidos exitosamente (ATÓMICO)`);
    
  } catch (error) {
    console.error(`❌ [PERSIST] Error persistiendo datos de ronda:`, error);
    throw error;
  }
};

// FUNCIÓN AUXILIAR: Validar que todos los productos son válidos
const validateProducts = (products, expectedCount = 20) => {
  if (!Array.isArray(products)) {
    return { valid: false, error: 'products no es un array' };
  }
  
  if (products.length !== expectedCount) {
    return { valid: false, error: `Se esperaban ${expectedCount} productos, se generaron ${products.length}` };
  }
  
  const invalidProducts = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    // Validar campos requeridos
    if (!p.marbleType || !p.type || !p.quality) {
      invalidProducts.push({ index: i, error: 'Campos requeridos faltantes', product: p });
      continue;
    }
    
    // Validar tipos de campos (orden alineado con generateProductsWithSeed)
    const validMarbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
    const validTypes = ['Block', 'Slab'];
    const validQualities = ['A', 'B', 'C'];
    
    if (!validMarbleTypes.includes(p.marbleType)) {
      invalidProducts.push({ index: i, error: `marbleType inválido: ${p.marbleType}`, product: p });
      continue;
    }
    
    if (!validTypes.includes(p.type)) {
      invalidProducts.push({ index: i, error: `type inválido: ${p.type}`, product: p });
      continue;
    }
    
    if (!validQualities.includes(p.quality)) {
      invalidProducts.push({ index: i, error: `quality inválido: ${p.quality}`, product: p });
      continue;
    }
    
    // Validar valores numéricos
    if (typeof p.currentPrice !== 'number' || isNaN(p.currentPrice) || !isFinite(p.currentPrice) || p.currentPrice <= 0) {
      invalidProducts.push({ index: i, error: `currentPrice inválido: ${p.currentPrice}`, product: p });
      continue;
    }
    
    if (typeof p.waste !== 'number' || isNaN(p.waste) || !isFinite(p.waste) || p.waste <= 0) {
      invalidProducts.push({ index: i, error: `waste inválido: ${p.waste}`, product: p });
      continue;
    }
    
    // Validar rangos
    const minPrice = 80;
    const maxPrice = 200;
    const minWaste = 30;
    const maxWaste = 80; // Actualizado: waste entre 30-80
    
    if (p.currentPrice < minPrice || p.currentPrice > maxPrice) {
      invalidProducts.push({ index: i, error: `currentPrice fuera de rango: ${p.currentPrice} (debe estar entre ${minPrice} y ${maxPrice})`, product: p });
      continue;
    }
    
    if (p.waste < minWaste || p.waste > maxWaste) {
      invalidProducts.push({ index: i, error: `waste fuera de rango: ${p.waste} (debe estar entre ${minWaste} y ${maxWaste})`, product: p });
      continue;
    }
  }
  
  if (invalidProducts.length > 0) {
    return { 
      valid: false, 
      error: `${invalidProducts.length} productos inválidos`, 
      details: invalidProducts 
    };
  }
  
  return { valid: true };
};

// FUNCIÓN AUXILIAR: Validar consistencia entre products y legacy
const validateMarketConsistency = (products, legacy) => {
  const inconsistencies = [];
  
  // Crear mapa de productos por combinación
  const productMap = new Map();
  for (const p of products) {
    const key = `${p.marbleType}:${p.type}:${p.quality}`;
    if (!productMap.has(key)) {
      productMap.set(key, []);
    }
    productMap.get(key).push(p);
  }
  
  // Verificar que cada combinación en legacy tiene al menos un producto correspondiente
  for (const marbleType in legacy) {
    for (const type in legacy[marbleType]) {
      for (const quality in legacy[marbleType][type]) {
        const key = `${marbleType}:${type}:${quality}`;
        if (!productMap.has(key)) {
          inconsistencies.push({
            type: 'missing_product',
            combination: key,
            legacy: legacy[marbleType][type][quality]
          });
        } else {
          // Verificar que los valores coinciden
          const legacyPrice = legacy[marbleType][type][quality].price;
          const legacyWaste = legacy[marbleType][type][quality].waste;
          const matchingProducts = productMap.get(key);
          
          // Al menos un producto debe coincidir con legacy
          const hasMatch = matchingProducts.some(p => 
            p.currentPrice === legacyPrice && p.waste === legacyWaste
          );
          
          if (!hasMatch) {
            inconsistencies.push({
              type: 'value_mismatch',
              combination: key,
              legacy: { price: legacyPrice, waste: legacyWaste },
              products: matchingProducts.map(p => ({ price: p.currentPrice, waste: p.waste }))
            });
          }
        }
      }
    }
  }
  
  if (inconsistencies.length > 0) {
    return { valid: false, inconsistencies };
  }
  
  return { valid: true };
};

// NUEVA FUNCIÓN: Generar mercado determinista para una ronda (VERSIÓN MEJORADA)
const generateMarketForRound = async (gameId, round, maxRetries = 3) => {
  console.log(`🏪 [MARKET] Generando mercado para ronda ${round} del juego ${gameId}`);
  
  // Semilla determinista basada en gameId + round (SIN timestamp para reproducibilidad)
  const seed = `${gameId}:${round}`;
  console.log(`🌱 [MARKET] Semilla determinista: ${seed}`);
  
  let products = null;
  let legacyRound = {};
  let attempt = 0;
  let lastError = null;
  
  // PASO 1: Calcular valores base para esta ronda
  const baseValues = calculateBaseValuesForRound(seed, round);
  console.log(`💰 [MARKET] Valores base calculados para ronda ${round}:`, baseValues);
  
  // PASO 2: Generar TODA la estructura de mercado (todas las combinaciones)
  console.log(`📊 [MARKET] Generando estructura completa de mercado...`);
  const completeMarketData = generateCompleteMarketData(baseValues, seed);
  console.log(`✅ [MARKET] Estructura completa generada: ${Object.keys(completeMarketData).length} mármoles`);
  
  // Log de ejemplo para verificar valores y jerarquías
  const exampleMarble = 'Red';
  if (completeMarketData[exampleMarble]) {
    const example = {
      'Block A': completeMarketData[exampleMarble].Block?.A,
      'Block B': completeMarketData[exampleMarble].Block?.B,
      'Block C': completeMarketData[exampleMarble].Block?.C,
      'Slab A': completeMarketData[exampleMarble].Slab?.A,
      'Slab B': completeMarketData[exampleMarble].Slab?.B,
      'Slab C': completeMarketData[exampleMarble].Slab?.C,
    };
    console.log(`📊 [MARKET] Ejemplo ${exampleMarble}:`, JSON.stringify(example, null, 2));
    
    // Verificar jerarquías en el ejemplo
    const blockA = example['Block A'];
    const slabA = example['Slab A'];
    if (blockA && slabA) {
      if (slabA.price <= blockA.price) {
        console.warn(`⚠️ [MARKET] ERROR: Slab A (${slabA.price}) <= Block A (${blockA.price})`);
      } else {
        console.log(`✅ [MARKET] Jerarquía correcta: Slab A (${slabA.price}) > Block A (${blockA.price})`);
      }
    }
  }
  
  // PASO 3: Usar la estructura completa como legacy (ya está validada y corregida)
  legacyRound = completeMarketData;
  
  // PASO 4: Generar productos aleatorios que usen los valores de mercado
  while (attempt < maxRetries) {
    attempt++;
    console.log(`🔄 [MARKET] Intento ${attempt}/${maxRetries} de generación de productos...`);
    
    try {
      // Generar productos usando valores de mercado ya calculados
      products = generateProductsWithSeed(seed, round, completeMarketData);
      
      // VALIDACIÓN CRÍTICA: Verificar que todos los productos son válidos
      const validation = validateProducts(products, 20);
      if (!validation.valid) {
        lastError = new Error(`Validación de productos falló: ${validation.error}`);
        if (validation.details) {
          console.error(`❌ [MARKET] Detalles de productos inválidos:`, validation.details);
        }
        console.error(`❌ [MARKET] ${lastError.message}, reintentando...`);
        continue; // Reintentar
      }
      
      console.log(`✅ [MARKET] Validación de productos exitosa: ${products.length} productos válidos`);
      
      // Los productos ya usan valores de completeMarketData, así que son consistentes
      console.log(`✅ [MARKET] Productos generados desde estructura de mercado completa`);
      
      // Si llegamos aquí, los productos son válidos y consistentes
      break;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ [MARKET] Error en intento ${attempt}:`, error);
      if (attempt < maxRetries) {
        console.log(`🔄 [MARKET] Reintentando generación...`);
        continue;
      }
    }
  }
  
  // Si después de todos los reintentos no tenemos productos válidos
  if (!products || !validateProducts(products, 20).valid) {
    const error = lastError || new Error('No se pudieron generar productos válidos después de todos los reintentos');
    console.error(`❌ [MARKET] ${error.message}`);
    
    // Si tenemos productos aunque no pasen validación estricta, usarlos de todos modos
    if (products && products.length > 0) {
      console.warn(`⚠️ [MARKET] Usando productos generados aunque no pasen validación estricta (${products.length} productos)`);
      const basicValidProducts = products.filter(p => 
        p && 
        p.marbleType && p.type && p.quality &&
        typeof p.currentPrice === 'number' && !isNaN(p.currentPrice) && p.currentPrice > 0 &&
        typeof p.waste === 'number' && !isNaN(p.waste) && p.waste > 0
      );
      
      if (basicValidProducts.length > 0) {
        console.warn(`⚠️ [MARKET] Usando ${basicValidProducts.length} productos con validación básica`);
        products = basicValidProducts;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
  
  // Persistir mercado en Firestore si está disponible
  if (admin.apps.length) {
    try {
      const db = admin.firestore();
      const marketRef = db.collection('games').doc(gameId).collection('market').doc(round.toString());
      
      await marketRef.set({
        round: round,
        products: products,
        seed: seed,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        validated: true, // Marcar como validado
        validationTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ [MARKET] Mercado persistido en Firestore para ronda ${round}`);

      // Además: actualizar documento agregado legacy para ChatScreen
      const legacyRef = db.collection('market').doc(gameId);
      
      // Primero obtener el documento existente para preservar rondas anteriores
      const legacyDoc = await legacyRef.get();
      const existingRounds = legacyDoc.exists ? (legacyDoc.data().rounds || {}) : {};

      // Agregar la nueva ronda a las existentes
      existingRounds[round] = legacyRound;
      
      await legacyRef.set({
        rounds: existingRounds,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ [MARKET] Legacy market agregado/actualizado para ronda ${round}`);
    } catch (error) {
      console.error(`❌ [MARKET] Error persistiendo mercado:`, error);
      // NO lanzar error aquí - los productos ya están validados y generados
      // El cliente puede recibirlos vía WebSocket aunque Firestore falle
    }
  } else {
    console.warn(`⚠️ [MARKET] Firestore no disponible, productos generados pero no persistidos`);
  }
  
  console.log(`✅ [MARKET] Mercado generado exitosamente para ronda ${round}: ${products.length} productos válidos y consistentes`);
  
  return {
    products: products,
    round: round,
    seed: seed,
    legacy: legacyRound,
    validated: true
  };
};

// Función auxiliar para transformar productos a estructura legacy
const transformProductsToLegacy = (products, round) => {
  const legacyRound = {};
  let validProductsCount = 0;
  let skippedProductsCount = 0;
  
  for (const p of products) {
    // Validar que el producto tenga todos los campos necesarios y valores válidos
    if (!p.marbleType || !p.type || !p.quality) {
      console.warn(`⚠️ [MARKET] Producto sin campos requeridos:`, p);
      skippedProductsCount++;
      continue;
    }
    
    const price = typeof p.currentPrice === 'number' && !isNaN(p.currentPrice) ? p.currentPrice : 0;
    const waste = typeof p.waste === 'number' && !isNaN(p.waste) ? p.waste : 0;
    
    if (price <= 0 || waste <= 0) {
      console.warn(`⚠️ [MARKET] Producto con valores inválidos (price=${price}, waste=${waste}):`, p);
      skippedProductsCount++;
      continue;
    }
    
    // Inicializar estructura si no existe
    if (!legacyRound[p.marbleType]) {
      legacyRound[p.marbleType] = {};
    }
    if (!legacyRound[p.marbleType][p.type]) {
      legacyRound[p.marbleType][p.type] = {};
    }
    
    // USAR VALOR EXACTO - NO PROMEDIAR para garantizar consistencia con MarketScreen
    // Si ya existe una entrada, usar el primer valor encontrado (no promedio)
    // Esto garantiza que legacy tenga los mismos valores que aparecen en productList
    if (!legacyRound[p.marbleType][p.type][p.quality]) {
      legacyRound[p.marbleType][p.type][p.quality] = {
        price: price,
        waste: waste
      };
    }
    // Si ya existe, mantener el primero (ya fue asignado antes)
    // NO promediar para mantener consistencia
    
    validProductsCount++;
  }
  
  // Log de depuración: mostrar algunos ejemplos de la estructura creada
  if (validProductsCount > 0) {
    const sampleEntries = Object.entries(legacyRound).slice(0, 3);
    console.log(`🔍 [MARKET] Estructura legacy creada para ronda ${round}:`, JSON.stringify(sampleEntries, null, 2).substring(0, 500));
    console.log(`✅ [MARKET] ${validProductsCount} productos válidos transformados, ${skippedProductsCount} saltados`);
  } else {
    console.error(`❌ [MARKET] No se generó estructura legacy válida para ronda ${round}`);
  }
  
  // NO RELLENAR combinaciones faltantes - SOLO usar valores exactos de productos generados
  // Según ANALISIS_FLUJO_MERCADO.md: "NO rellenar: solo incluir combinaciones que realmente existen en products"
  // Si falta una combinación, NO se crea (ChatScreen mostrará 0, que es correcto)
  // Esto garantiza que los valores en legacy coincidan exactamente con los valores en products
  console.log(`✅ [MARKET] Solo se incluyen combinaciones que realmente existen en los productos generados (no se rellenan valores faltantes)`);
  
  // Clamp valores existentes a rangos válidos
  const minPrice = 80;
  const maxPrice = 200;
  const minWaste = 30;
  const maxWaste = 80; // Actualizado: waste entre 30-80
  
  for (const marble in legacyRound) {
    for (const pType in legacyRound[marble]) {
      for (const q in legacyRound[marble][pType]) {
        if (legacyRound[marble][pType][q]) {
          legacyRound[marble][pType][q].price = Math.min(maxPrice, Math.max(minPrice, legacyRound[marble][pType][q].price));
          legacyRound[marble][pType][q].waste = Math.min(maxWaste, Math.max(minWaste, legacyRound[marble][pType][q].waste));
        }
      }
    }
  }
  
  return legacyRound;
};

// FUNCIÓN AUXILIAR: Generar productos con semilla determinista
// Estructura compatible con el frontend: type: 'Block'|'Slab', quality: 'A'|'B'|'C'
// ============================================================================
// SISTEMA DE VALORES BASADO EN REGLAS CLARAS Y DETERMINISTAS
// ============================================================================
//
// REGLAS DEL SISTEMA:
// 1. VALOR BASE: Se calcula una vez por ronda para cada mármol (bloque calidad A)
//    - Este valor base varía cada ronda con ±10% (no ±15%)
//    - Es el punto de referencia para todos los demás valores
//
// 2. MULTIPLICADORES FIJOS (sin aleatoriedad):
//    TIPO DE PRODUCTO:
//    - Block: precio × 1.0, waste × 1.0 (base)
//    - Slab:  precio × 1.3, waste × 1.1 (30% más cara, 10% más residuo)
//
//    CALIDAD:
//    - A: precio × 1.0, waste × 1.0 (base - más cara, menos residuo)
//    - B: precio × 0.75, waste × 1.2 (25% más barata, 20% más residuo)
//    - C: precio × 0.5, waste × 1.5 (50% más barata, 50% más residuo)
//
// 3. ALEATORIEDAD MÍNIMA: Solo ±1% para evitar valores idénticos
//    - Se aplica solo al final, después de todos los cálculos
//    - Garantiza que productos iguales tengan el mismo precio
//
// 4. GARANTÍAS ABSOLUTAS:
//    - Tabla > Bloque (mismo mármol, misma calidad) - SIEMPRE
//    - Calidad A > B > C (mismo mármol, mismo tipo) - SIEMPRE
//    - Mismo mármol + tipo + calidad = mismo precio - SIEMPRE
//
// ============================================================================

// Calcula valores base para bloques de calidad A de cada mármol (se actualiza cada ronda)
const calculateBaseValuesForRound = (seed, round) => {
  // Crear generador determinista para valores base
    let hash = 0;
  const baseSeed = `${seed}:base:${round}`;
  for (let i = 0; i < baseSeed.length; i++) {
    const char = baseSeed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  hash = Math.abs(hash) || 1;
  
  const random = () => {
    hash = (hash * 9301 + 49297) % 233280;
    if (hash < 0) hash = hash + 233280;
    if (hash === 0) hash = 1;
    return hash / 233280;
  };
  
  const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
  
  // LÍMITES ABSOLUTOS (después de multiplicadores)
  const MIN_PRICE = 80;   // Precio mínimo final
  const MAX_PRICE = 200;  // Precio máximo final
  const MIN_WASTE = 30;   // Waste mínimo final
  const MAX_WASTE = 80;   // Waste máximo final
  
  // Multiplicadores que se aplicarán después
  // Slab C: precio × 1.3 × 0.5 = 0.65 (el más bajo)
  // Slab A: precio × 1.3 × 1.0 = 1.3 (el más alto)
  // Block C waste: waste × 1.5 (el más alto)
  // Block A waste: waste × 1.0 (el más bajo)
  
  // VALORES BASE REALISTAS Y VARIADOS
  // Cada mármol tiene un rango diferente para hacer el sistema más realista
  // Los rangos están diseñados para que después de multiplicadores queden en 80-200 (precio) y 30-80 (waste)
  const marbleRanges = {
    Red: { priceMin: 123, priceMax: 153, wasteMin: 30, wasteMax: 48 },
    White: { priceMin: 125, priceMax: 153, wasteMin: 30, wasteMax: 48 },
    Gray: { priceMin: 123, priceMax: 150, wasteMin: 30, wasteMax: 48 },
    Black: { priceMin: 130, priceMax: 153, wasteMin: 30, wasteMax: 48 },
    Cream: { priceMin: 123, priceMax: 153, wasteMin: 30, wasteMax: 48 }
  };
  
  // Calcular valores base para esta ronda con variación significativa
  const baseValues = {};
  marbleTypes.forEach(marbleType => {
    const range = marbleRanges[marbleType];
    
    // Variación más amplia para precio base (dentro del rango del mármol)
    const priceVariation = range.priceMin + (random() * (range.priceMax - range.priceMin));
    let blockPriceA = Math.round(priceVariation);
    
    // Variación más amplia para waste base (dentro del rango del mármol)
    const wasteVariation = range.wasteMin + (random() * (range.wasteMax - range.wasteMin));
    let blockWasteA = Math.round(wasteVariation);
    
    // Asegurar que después de multiplicadores estén en límites
    // Precio: Slab C (×0.65) debe ser >= 80, Slab A (×1.3) debe ser <= 200
    const minPriceBase = Math.ceil(MIN_PRICE / 0.65); // 123
    const maxPriceBase = Math.floor(MAX_PRICE / 1.3);  // 153
    blockPriceA = Math.max(minPriceBase, Math.min(maxPriceBase, blockPriceA));
    
    // Waste: Block A (×1.0) debe ser >= 30, Slab C (×1.65) debe ser <= 80
    const minWasteBase = Math.ceil(MIN_WASTE / 1.0);   // 30
    const maxWasteBase = Math.floor(MAX_WASTE / 1.65); // 48
    blockWasteA = Math.max(minWasteBase, Math.min(maxWasteBase, blockWasteA));
    
    baseValues[marbleType] = {
      blockPriceA: blockPriceA,
      blockWasteA: blockWasteA
    };
  });
  
  return baseValues;
};

// Genera TODA la estructura de mercado (todas las combinaciones posibles)
// Retorna estructura anidada: marbleType → type → quality → { price, waste }
const generateCompleteMarketData = (baseValues, seed) => {
  const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
  const productTypes = ['Block', 'Slab'];
  const qualities = ['A', 'B', 'C'];
  
  const marketData = {};
  
  // Generar TODAS las combinaciones posibles
  marbleTypes.forEach(marbleType => {
    marketData[marbleType] = {};
    productTypes.forEach(productType => {
      marketData[marbleType][productType] = {};
      qualities.forEach(quality => {
        const value = calculateProductValue(baseValues, marbleType, productType, quality);
        marketData[marbleType][productType][quality] = {
          price: value.price,
          waste: value.waste
        };
      });
    });
  });
  
  // Validar y corregir reglas en la estructura completa
  validateAndFixMarketData(marketData);
  
  return marketData;
};

// Calcula valores derivados desde valores base usando multiplicadores FIJOS
// IMPORTANTE: Esta función garantiza que productos iguales tengan el mismo precio
const calculateProductValue = (baseValues, marbleType, productType, quality) => {
  const base = baseValues[marbleType];
  if (!base) {
    throw new Error(`No hay valores base para mármol ${marbleType}`);
  }
  
  // MULTIPLICADORES FIJOS - Sin aleatoriedad aquí
  const qualityMultipliers = {
    A: { price: 1.0, waste: 1.0 },   // Base (calidad A) - más cara, menos residuo
    B: { price: 0.75, waste: 1.2 },   // 25% más barata, 20% más residuo
    C: { price: 0.5, waste: 1.5 }     // 50% más barata, 50% más residuo
  };
  
  const productMultipliers = {
    Block: { price: 1.0, waste: 1.0 },   // Base (bloque)
    Slab: { price: 1.3, waste: 1.1 }      // Tabla: 30% más cara, 10% más residuo
  };
  
  const qualityMult = qualityMultipliers[quality];
  const productMult = productMultipliers[productType];
  
  // FÓRMULA CLARA: precio = base × tipo × calidad
  let price = base.blockPriceA * productMult.price * qualityMult.price;
  let waste = base.blockWasteA * productMult.waste * qualityMult.waste;
  
  // VARIACIÓN REALISTA: ±3% para hacer el sistema más variado y natural
  // Esta aleatoriedad es determinista basada en la combinación, así que productos iguales
  // siempre tendrán el mismo precio
  let hash = 0;
  const variationSeed = `${marbleType}:${productType}:${quality}`;
  for (let i = 0; i < variationSeed.length; i++) {
    const char = variationSeed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  hash = Math.abs(hash) || 1;
  hash = (hash * 9301 + 49297) % 233280;
  if (hash < 0) hash = hash + 233280;
  if (hash === 0) hash = 1;
  const randomValue = hash / 233280;
  const randomVariation = 0.97 + (randomValue * 0.06); // 0.97 a 1.03 (±3%)
  
  price = price * randomVariation;
  waste = waste * randomVariation;
  
  // Redondear después de la variación
  let finalPrice = Math.round(price);
  let finalWaste = Math.round(waste);
  
  // NO hacer clamp aquí - se hará después de validar jerarquías
  // Las jerarquías deben aplicarse ANTES del clamp para evitar forzar valores incorrectos
  
  return {
    price: finalPrice,
    waste: finalWaste
  };
};

// Valida y corrige la estructura completa de mercado para garantizar reglas
const validateAndFixMarketData = (marketData) => {
  const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
  const qualities = ['A', 'B', 'C'];
  
  // PASO 1: Verificar regla: Tabla > Bloque en PRECIO (mismo mármol, misma calidad)
  marbleTypes.forEach(marbleType => {
    qualities.forEach(quality => {
      const blockData = marketData[marbleType]?.Block?.[quality];
      const slabData = marketData[marbleType]?.Slab?.[quality];
      
      if (blockData && slabData && slabData.price <= blockData.price) {
        console.warn(`⚠️ [MARKET] Tabla ${marbleType} ${quality} (${slabData.price}) no vale más que bloque ${marbleType} ${quality} (${blockData.price}), corrigiendo...`);
        slabData.price = blockData.price + 1;
        console.log(`✅ [MARKET] Corregido: Tabla ${marbleType} ${quality} ahora vale ${slabData.price}`);
      }
      
      // Verificar regla: Tabla > Bloque en WASTE (mismo mármol, misma calidad)
      // Slab debe generar MÁS waste que Block (tiene procesamiento adicional)
      if (blockData && slabData && slabData.waste <= blockData.waste) {
        console.warn(`⚠️ [MARKET] Tabla ${marbleType} ${quality} waste (${slabData.waste}) no es mayor que bloque ${marbleType} ${quality} waste (${blockData.waste}), corrigiendo...`);
        slabData.waste = blockData.waste + 1;
        console.log(`✅ [MARKET] Corregido: Tabla ${marbleType} ${quality} waste ahora es ${slabData.waste}`);
      }
    });
  });
  
  // PASO 2: Verificar regla: Calidad A > B > C en PRECIO (mismo mármol, mismo tipo)
  marbleTypes.forEach(marbleType => {
    ['Block', 'Slab'].forEach(type => {
      const qualityPrices = {};
      const qualityWastes = {};
      qualities.forEach(quality => {
        const data = marketData[marbleType]?.[type]?.[quality];
        if (data) {
          qualityPrices[quality] = data.price;
          qualityWastes[quality] = data.waste;
        }
      });
      
      // Verificar orden de precios: A > B > C
      if (qualityPrices.A && qualityPrices.B && qualityPrices.A <= qualityPrices.B) {
        console.warn(`⚠️ [MARKET] Calidad A precio (${qualityPrices.A}) no es mayor que B (${qualityPrices.B}) para ${marbleType} ${type}`);
        marketData[marbleType][type].B.price = qualityPrices.A - 1;
        qualityPrices.B = qualityPrices.A - 1;
        console.log(`✅ [MARKET] Corregido: Calidad B precio ahora vale ${qualityPrices.B}`);
      }
      
      if (qualityPrices.B && qualityPrices.C && qualityPrices.B <= qualityPrices.C) {
        console.warn(`⚠️ [MARKET] Calidad B precio (${qualityPrices.B}) no es mayor que C (${qualityPrices.C}) para ${marbleType} ${type}`);
        marketData[marbleType][type].C.price = qualityPrices.B - 1;
        console.log(`✅ [MARKET] Corregido: Calidad C precio ahora vale ${qualityPrices.B - 1}`);
      }
      
      // Verificar orden de waste: A < B < C (calidad A genera MENOS waste)
      if (qualityWastes.A && qualityWastes.B && qualityWastes.A >= qualityWastes.B) {
        console.warn(`⚠️ [MARKET] Calidad A waste (${qualityWastes.A}) no es menor que B (${qualityWastes.B}) para ${marbleType} ${type}`);
        marketData[marbleType][type].B.waste = qualityWastes.A + 1;
        qualityWastes.B = qualityWastes.A + 1;
        console.log(`✅ [MARKET] Corregido: Calidad B waste ahora es ${qualityWastes.B}`);
      }
      
      if (qualityWastes.B && qualityWastes.C && qualityWastes.B >= qualityWastes.C) {
        console.warn(`⚠️ [MARKET] Calidad B waste (${qualityWastes.B}) no es menor que C (${qualityWastes.C}) para ${marbleType} ${type}`);
        marketData[marbleType][type].C.waste = qualityWastes.B + 1;
        console.log(`✅ [MARKET] Corregido: Calidad C waste ahora es ${qualityWastes.B + 1}`);
      }
    });
  });
  
  // PASO 3: Aplicar clamp final DESPUÉS de validar jerarquías
  // IMPORTANTE: Clamp de manera inteligente que respete las jerarquías
  marbleTypes.forEach(marbleType => {
    ['Block', 'Slab'].forEach(type => {
      qualities.forEach(quality => {
        const data = marketData[marbleType]?.[type]?.[quality];
        if (data) {
          // Clamp final para mantener valores dentro de límites absolutos
          data.price = Math.max(80, Math.min(200, data.price));
          data.waste = Math.max(30, Math.min(80, data.waste));
        }
      });
    });
  });
  
  // PASO 4: Re-validar jerarquías DESPUÉS del clamp de manera inteligente
  // Ajustar valores para mantener jerarquías sin forzar al límite
  marbleTypes.forEach(marbleType => {
    qualities.forEach(quality => {
      const blockData = marketData[marbleType]?.Block?.[quality];
      const slabData = marketData[marbleType]?.Slab?.[quality];
      
      // Re-verificar: Slab price > Block price (mínimo diferencia de 2 para más realismo)
      if (blockData && slabData) {
        const minSlabPrice = blockData.price + 2; // Diferencia mínima de 2
        if (slabData.price <= blockData.price) {
          slabData.price = minSlabPrice;
          // Si excede el límite, ajustar ambos
          if (slabData.price > 200) {
            slabData.price = 200;
            blockData.price = Math.max(80, 198);
          }
        } else if (slabData.price < minSlabPrice) {
          // Asegurar diferencia mínima
          slabData.price = minSlabPrice;
          if (slabData.price > 200) {
            slabData.price = 200;
            blockData.price = Math.max(80, 198);
          }
        }
      }
      
      // Re-verificar: Slab waste > Block waste (mínimo diferencia de 1)
      if (blockData && slabData) {
        const minSlabWaste = blockData.waste + 1;
        if (slabData.waste <= blockData.waste) {
          slabData.waste = minSlabWaste;
          // Si excede el límite, ajustar ambos
          if (slabData.waste > 80) {
            slabData.waste = 80;
            blockData.waste = Math.max(30, 79);
          }
        }
      }
    });
    
    // Re-verificar orden de calidades con diferencias mínimas
    ['Block', 'Slab'].forEach(type => {
      const qualityPrices = {};
      const qualityWastes = {};
      qualities.forEach(quality => {
        const data = marketData[marbleType]?.[type]?.[quality];
        if (data) {
          qualityPrices[quality] = data.price;
          qualityWastes[quality] = data.waste;
        }
      });
      
      // Re-verificar: A > B > C en precio (mínimo diferencia de 3 entre calidades)
      if (qualityPrices.A && qualityPrices.B) {
        const minBPrice = qualityPrices.A - 3;
        if (qualityPrices.B >= qualityPrices.A || qualityPrices.B < minBPrice) {
          marketData[marbleType][type].B.price = Math.max(80, minBPrice);
          qualityPrices.B = marketData[marbleType][type].B.price;
        }
      }
      if (qualityPrices.B && qualityPrices.C) {
        const minCPrice = qualityPrices.B - 3;
        if (qualityPrices.C >= qualityPrices.B || qualityPrices.C < minCPrice) {
          marketData[marbleType][type].C.price = Math.max(80, minCPrice);
        }
      }
      
      // Re-verificar: A < B < C en waste (mínimo diferencia de 2 entre calidades)
      if (qualityWastes.A && qualityWastes.B) {
        const minBWaste = qualityWastes.A + 2;
        if (qualityWastes.B <= qualityWastes.A || qualityWastes.B < minBWaste) {
          marketData[marbleType][type].B.waste = Math.min(80, minBWaste);
          qualityWastes.B = marketData[marbleType][type].B.waste;
        }
      }
      if (qualityWastes.B && qualityWastes.C) {
        const minCWaste = qualityWastes.B + 2;
        if (qualityWastes.C <= qualityWastes.B || qualityWastes.C < minCWaste) {
          marketData[marbleType][type].C.waste = Math.min(80, minCWaste);
        }
      }
    });
  });
};

const generateProductsWithSeed = (seed, round, marketData) => {
  console.log(`🔍 [GENERATE] Iniciando generación de productos para seed=${seed}, round=${round}`);
  console.log(`🔍 [GENERATE] Usando valores de mercado ya calculados`);
  
  // Crear generador pseudoaleatorio con semilla
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  hash = Math.abs(hash);
    if (hash === 0) {
    hash = 1;
  }
  
  const random = () => {
    hash = (hash * 9301 + 49297) % 233280;
    if (hash < 0) hash = hash + 233280;
    if (hash === 0) hash = 1;
    return hash / 233280;
  };
  
  const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
  const productTypes = ['Block', 'Slab'];
  const qualities = ['A', 'B', 'C'];
  
  const products = [];
  const numProducts = 20; // 20 productos por ronda
  
  console.log(`🔍 [GENERATE] Generando ${numProducts} productos desde valores de mercado...`);
  
  // Offsets derivados de la semilla
  const marbleOffset = Math.abs(Math.floor(random() * marbleTypes.length)) % marbleTypes.length;
  const typeOffset = Math.abs(Math.floor(random() * productTypes.length)) % productTypes.length;
  const qualityOffset = Math.abs(Math.floor(random() * qualities.length)) % qualities.length;
  
  for (let i = 0; i < numProducts; i++) {
    const marbleIndex = ((i + marbleOffset) % marbleTypes.length + marbleTypes.length) % marbleTypes.length;
    const typeIndex = ((Math.floor(i / marbleTypes.length) + typeOffset) % productTypes.length + productTypes.length) % productTypes.length;
    const qualityIndex = ((i + qualityOffset) % qualities.length + qualities.length) % qualities.length;
    
    const marble = marbleTypes[marbleIndex];
    const pType = productTypes[typeIndex];
    const quality = qualities[qualityIndex];
    
    // OBTENER VALORES DESDE marketData (ya calculados)
    const marketValue = marketData[marble]?.[pType]?.[quality];
    if (!marketValue) {
      throw new Error(`No se encontró valor de mercado para ${marble} ${pType} ${quality}`);
    }
    
    const product = {
      id: `product-${seed}-${i}`,
      type: pType,
      quality,
      marbleType: marble,
      currentPrice: marketValue.price,  // Usar valor de marketData
      waste: marketValue.waste,          // Usar valor de marketData
      round
    };
    
    products.push(product);
  }
  
  console.log(`✅ [GENERATE] Generados ${products.length} productos desde valores de mercado`);
  return products;
};

// Función helper para obtener número de productos en inventario de cada jugador
const getProductsCountByPlayer = (gameId) => {
  const gameInventory = playerInventories.get(gameId);
  const productsCountByPlayer = new Map();
  
  console.log(`📦 [PRODUCTS_COUNT] Obteniendo conteo de productos para juego ${gameId}`);
  
  if (gameInventory) {
    // Contar productos en inventario de cada jugador
    gameInventory.forEach((inventory, userId) => {
      const productsCount = Array.isArray(inventory.products) ? inventory.products.length : 0;
      console.log(`📦 [PRODUCTS_COUNT] Jugador ${userId}: ${productsCount} productos`, {
        products: inventory.products,
        productsArray: Array.isArray(inventory.products)
      });
      productsCountByPlayer.set(userId, productsCount);
    });
  } else {
    console.log(`⚠️ [PRODUCTS_COUNT] No hay inventario para juego ${gameId}`);
  }
  
  return productsCountByPlayer;
};

// Función para actualizar y emitir el ranking de jugadores
const updateAndEmitPlayerRankings = (gameId) => {
  const room = getGameRoom(gameId);
  const gameRanking = playerRankings.get(gameId) || new Map();
  
  console.log(`🏆 Actualizando ranking para juego ${gameId}`);
  console.log(`🏆 Jugadores en la sala:`, room.players.map(p => ({ userId: p.userId, userName: p.userName })));
  
  // Obtener número de productos en inventario de cada jugador
  const productsCountByPlayer = getProductsCountByPlayer(gameId);
  
  // Crear lista completa de jugadores con sus datos actualizados
  const playerData = room.players.map(player => {
    const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
    const inventory = getPlayerInventory(gameId, player.userId);
    
    // Usar el número de productos en inventario
    const productsCount = productsCountByPlayer.get(player.userId) || 0;
    
    const playerInfo = {
      userId: player.userId,
      userName: player.userName,
      rockCoins: inventory.rockCoins,
      waste: inventory.waste,
      blocksMined: productsCount, // Número de productos en inventario
      totalRewards: ranking.totalRewards,
      readyForNextRound: player.readyForNextRound || false
    };
    
    console.log(`🏆 Datos del jugador ${player.userName}:`, {
      rockCoins: playerInfo.rockCoins,
      waste: playerInfo.waste,
      blocksMined: playerInfo.blocksMined,
      balance: playerInfo.rockCoins - playerInfo.waste
    });
    
    return playerInfo;
  });
  
  // Ordenar por balance (mayor a menor) y por nombre si empatan
  playerData.sort((a, b) => {
    const balanceA = a.rockCoins - a.waste;
    const balanceB = b.rockCoins - b.waste;
    if (balanceA !== balanceB) {
      return balanceB - balanceA; // Mayor balance primero
    }
    return a.userName.localeCompare(b.userName); // Orden alfabético si empatan
  });
  
  console.log(`📡 [RANKING] Emitiendo player_rankings_data actualizado a ${gameId}`);
  console.log(`📡 [RANKING] Resumen de blocksMined por jugador:`, playerData.map(p => ({
    userName: p.userName,
    userId: p.userId,
    blocksMined: p.blocksMined,
    rockCoins: p.rockCoins,
    waste: p.waste
  })));
  emitToGame(gameId, 'player_rankings_data', { gameId, playerData });
};

// Función helper para verificar si todos los jugadores están listos
const areAllPlayersReady = (gameId) => {
  const room = getGameRoom(gameId);
  return room.players.length > 0 && room.readyPlayers.size === room.players.length;
};

// Función helper para obtener el inventario de un jugador
const getPlayerInventory = (gameId, userId) => {
  if (!playerInventories.has(gameId)) {
    playerInventories.set(gameId, new Map());
  }
  const gameInventory = playerInventories.get(gameId);
  if (!gameInventory.has(userId)) {
    gameInventory.set(userId, {
      products: [],
      rockCoins: 600,
      waste: 0
    });
  }
  return gameInventory.get(userId);
};

// Función helper para actualizar el inventario de un jugador
const updatePlayerInventory = (gameId, userId, updates) => {
  const inventory = getPlayerInventory(gameId, userId);
  
  // Asegurar que products siempre sea un array
  if (updates.products !== undefined) {
    updates.products = Array.isArray(updates.products) ? updates.products : [];
  }
  
  Object.assign(inventory, updates);
  
  // Asegurar que el inventario actualizado esté guardado en el Map
  const gameInventory = playerInventories.get(gameId);
  if (gameInventory) {
    gameInventory.set(userId, inventory);
  }
  
  console.log(`📦 [INVENTORY] Inventario actualizado para ${userId} en ${gameId}:`, {
    productsCount: inventory.products?.length || 0,
    products: inventory.products,
    rockCoins: inventory.rockCoins,
    waste: inventory.waste
  });
  
  return inventory;
};

// NUEVO SISTEMA DE MINADO - ALMACENAMIENTO DE VIEWSTART POR USUARIO Y BLOQUE
const viewStartTimes = new Map(); // Map<blockId, Map<userId, timestamp>>

// Función para registrar cuando un usuario abre un problema
const handleMiningProblemOpen = (blockId, userId) => {
  console.log(`[MINING][OPEN] blockId=${blockId} user=${userId}`);
  
  if (!viewStartTimes.has(blockId)) {
    viewStartTimes.set(blockId, new Map());
  }
  
  const blockViewTimes = viewStartTimes.get(blockId);
  const now = Date.now();
  
  // Solo registrar si es la primera vez que este usuario abre este problema
  if (!blockViewTimes.has(userId)) {
    blockViewTimes.set(userId, now);
    console.log(`[MINING][OPEN] blockId=${blockId} user=${userId} viewStart=${now} (first)`);
    return { blockId, viewStart: now, isFirst: true };
  } else {
    const existingViewStart = blockViewTimes.get(userId);
    console.log(`[MINING][OPEN] blockId=${blockId} user=${userId} viewStart=${existingViewStart} (ignored)`);
    return { blockId, viewStart: existingViewStart, isFirst: false };
  }
};

// Función para manejar respuestas de minado con tiempo del cliente
const handleMiningSubmit = (blockId, userId, response, userName, clientResponseTime) => {
  console.log(`[MINING][SUBMIT] blockId=${blockId} user=${userId} response=${response} clientResponseTime=${clientResponseTime}`);
  
  // Definir timestamp actual al inicio de la función
  const now = Date.now();
  
  // Usar el tiempo del cliente si está disponible, sino calcular del servidor
  let elapsed;
  if (clientResponseTime !== undefined && clientResponseTime > 0) {
    elapsed = clientResponseTime;
    console.log(`[MINING][SUBMIT] Usando tiempo del cliente: ${elapsed}ms`);
  } else {
    // Fallback: calcular del servidor
    const blockViewTimes = viewStartTimes.get(blockId);
    if (!blockViewTimes || !blockViewTimes.has(userId)) {
      // Si no existe viewStart, crearlo ahora (caso edge)
      if (!viewStartTimes.has(blockId)) {
        viewStartTimes.set(blockId, new Map());
      }
      viewStartTimes.get(blockId).set(userId, now);
      console.log(`[MINING][SUBMIT] blockId=${blockId} user=${userId} viewStart creado ahora=${now} (edge case)`);
    }
    
    const viewStart = viewStartTimes.get(blockId).get(userId);
    elapsed = now - viewStart;
    console.log(`[MINING][SUBMIT] Calculando del servidor: viewStart=${viewStart} now=${now} elapsed=${elapsed}ms`);
  }
  
  // Obtener el problema para verificar la respuesta correcta
  const problemData = miningProblems.get(blockId);
  if (!problemData) {
    console.log(`❌ Problema ${blockId} no encontrado`);
    return { success: false, message: 'Problema no encontrado' };
  }
  
  const correctAnswer = parseFloat(problemData.activeProblem.solution);
  const userAnswer = parseFloat(response);
  const isCorrect = userAnswer === correctAnswer;
  
  console.log(`[MINING][SUBMIT] blockId=${blockId} user=${userId} isCorrect=${isCorrect} elapsed=${elapsed}ms`);
  
  // Inicializar o actualizar respuestas del bloque
  if (!miningResponses.has(blockId)) {
    miningResponses.set(blockId, {
      responses: [],
      isCompleted: false,
      completedAt: null,
      state: 'active'
    });
  }
  
  const blockData = miningResponses.get(blockId);
  
  // Verificar si el usuario ya respondió
  const existingResponseIndex = blockData.responses.findIndex(r => r.userId === userId);
  if (existingResponseIndex !== -1) {
    console.log(`⚠️ Usuario ${userId} ya respondió al bloque ${blockId}, actualizando respuesta`);
    // Actualizar respuesta existente
    blockData.responses[existingResponseIndex] = {
      userId,
      userName: userName || "Unknown",
      response,
      elapsed,
      isCorrect,
      timestamp: now
    };
  } else {
    // Añadir nueva respuesta
  const newResponse = {
    userId,
    userName: userName || "Unknown",
    response,
      elapsed,
    isCorrect,
      timestamp: now
  };
  blockData.responses.push(newResponse);
  }
  
  // Determinar ganador y estado de completado
  const correctResponses = blockData.responses.filter(r => r.isCorrect);
  let winner = null;
  let isCompleted = false;
  
  if (correctResponses.length > 0) {
    // Ordenar respuestas correctas por tiempo (más rápida primero)
    correctResponses.sort((a, b) => a.elapsed - b.elapsed);
    winner = correctResponses[0];
    
    // CAMBIO SIMPLE: Solo completar cuando hay respuesta correcta, pero mantener ganador actualizado
    isCompleted = true;
    blockData.state = 'completed';
    blockData.completedAt = now;
    console.log(`[MINING][COMPLETED] blockId=${blockId} completado con respuesta correcta`);
    
    console.log(`[MINING][WINNER] blockId=${blockId} winner=${winner.userName} elapsed=${winner.elapsed}ms (final)`);
  }
  
  // Emitir actualización del bloque con standings
  const gameId = blockId.split('-')[0];
  const gameRoom = getGameRoom(gameId);
  const allPlayers = gameRoom.players || [];
  
  // Crear standings ordenados: correctos por tiempo, luego incorrectos
  const standings = allPlayers.map(player => {
    const existingResponse = blockData.responses.find(r => r.userId === player.userId);
    if (existingResponse) {
      return {
        userId: existingResponse.userId,
        userName: existingResponse.userName,
        isCorrect: existingResponse.isCorrect,
        elapsed: existingResponse.elapsed,
        response: existingResponse.response
      };
    } else {
      return {
        userId: player.userId,
        userName: player.userName || "Unknown",
        isCorrect: false,
        elapsed: null,
        response: null
      };
    }
  });
  
  // Ordenar standings: correctos por tiempo, luego incorrectos
  standings.sort((a, b) => {
    if (a.isCorrect && !b.isCorrect) return -1;
    if (!a.isCorrect && b.isCorrect) return 1;
    if (a.isCorrect && b.isCorrect) return a.elapsed - b.elapsed;
    return 0;
  });
  
  console.log(`📡 Emitiendo mining:block-update a juego ${gameId}:`, {
    blockId,
    standings,
    winner,
    state: blockData.state
  });
  
  emitToGame(gameId, 'mining:block-update', {
    blockId,
    standings,
    winner,
    state: blockData.state
  });
  
  return { 
    success: true, 
    standings,
    winner,
    state: blockData.state,
    isCompleted
  };
};

// Función para obtener problemas pendientes de un usuario
const getPendingCountForUser = (userId) => {
  let pendingCount = 0;
  
  // Contar problemas activos que el usuario no ha respondido
  for (const [blockId, blockData] of miningResponses.entries()) {
    if (blockData.state === 'active') {
      const hasResponded = blockData.responses.some(r => r.userId === userId);
      if (!hasResponded) {
        pendingCount++;
      }
    }
  }
  
  console.log(`[MINING][PENDING] user=${userId} count=${pendingCount}`);
  return pendingCount;
};

// Función para cerrar bloques no respondidos y asignarlos a external miner
const closeUnansweredBlocks = (gameId, round) => {
  console.log(`🔒 [ROUND][CLEANUP] Cerrando bloques no respondidos de ronda ${round} para juego ${gameId}`);
  
  const room = getGameRoom(gameId);
  const blocksToClose = [];
  
  // Buscar todos los problemas activos de este juego que no tienen ganador
  for (const [blockId, blockData] of miningResponses.entries()) {
    // Verificar que el bloque pertenece a este juego
    if (!blockId.startsWith(gameId + '-')) continue;
    
    // Verificar que el bloque está activo y no completado
    if (blockData.state === 'active' || (!blockData.isCompleted && blockData.responses.length === 0)) {
      // Obtener el problema
      const problemData = miningProblems.get(blockId);
      if (problemData) {
        // Verificar si el bloque pertenece a esta ronda
        const block = getMinedBlocks(gameId).find(b => b.id === blockId);
        const blockRound = block?.round;
        
        // Si no existe en minedBlocks (problema pendiente sin minar), pertenece a la ronda actual
        // Si existe y pertenece a esta ronda, también cerrarlo
        if (!block || blockRound === round) {
          blocksToClose.push({ blockId, blockData, problemData });
        }
      }
    }
  }
  
  console.log(`🔒 [ROUND][CLEANUP] ${blocksToClose.length} bloques no respondidos encontrados`);
  
  // Cerrar cada bloque y asignarlo a external miner
  for (const { blockId, blockData, problemData } of blocksToClose) {
    console.log(`🔒 [ROUND][CLEANUP] Cerrando bloque ${blockId} y asignándolo a external miner`);
    
    // Verificar si el bloque ya existe en minedBlocks
    const existingBlock = getMinedBlocks(gameId).find(b => b.id === blockId);
    
    if (!existingBlock) {
      // Crear bloque minado por external miner
      const externalMinerBlock = {
        id: blockId,
        winner: {
          userId: 'external_miner',
          userName: 'External Miner',
          response: null,
          isCorrect: true, // External miner siempre tiene razón
          elapsed: null,
          responseTime: null,
          timestamp: Date.now()
        },
        round: round, // Usar la ronda actual
        timestamp: Date.now(),
        responses: [],
        isExternalMiner: true
      };
      
      addMinedBlock(gameId, externalMinerBlock);
      console.log(`✅ [ROUND][CLEANUP] Bloque ${blockId} añadido como external miner para ronda ${round}`);
    }
    
    // Marcar como completado en miningResponses
    blockData.state = 'completed';
    blockData.isCompleted = true;
    blockData.completedAt = Date.now();
    
    // Limpiar de miningProblems y miningResponses (no se acumulan para siguiente ronda)
    miningProblems.delete(blockId);
    miningResponses.delete(blockId);
    
    console.log(`🧹 [ROUND][CLEANUP] Bloque ${blockId} limpiado de miningProblems y miningResponses`);
  }
  
  // Limpiar problemas activos de la ronda anterior que puedan quedar
  cleanupOldRoundProblems(gameId, round);
};

// Función para limpiar problemas de rondas anteriores
const cleanupOldRoundProblems = (gameId, currentRound) => {
  console.log(`🧹 [ROUND][CLEANUP] Limpiando problemas de rondas anteriores a ${currentRound}`);
  
  const blocksToRemove = [];
  
  // Buscar todos los problemas que pertenecen a rondas anteriores
  for (const [blockId, problemData] of miningProblems.entries()) {
    if (!blockId.startsWith(gameId + '-')) continue;
    
    const block = getMinedBlocks(gameId).find(b => b.id === blockId);
    const blockData = miningResponses.get(blockId);
    
    if (block && block.round < currentRound) {
      // Bloque de ronda anterior, eliminarlo
      blocksToRemove.push(blockId);
    } else if (!block && blockData) {
      // Si no existe en minedBlocks y está activo, es un problema pendiente viejo, limpiarlo
      if (blockData.state === 'active' || !blockData.isCompleted) {
        blocksToRemove.push(blockId);
      }
    }
  }
  
  // También limpiar problemas en miningResponses que no tienen problema asociado
  for (const [blockId, blockData] of miningResponses.entries()) {
    if (!blockId.startsWith(gameId + '-')) continue;
    
    const problemData = miningProblems.get(blockId);
    const block = getMinedBlocks(gameId).find(b => b.id === blockId);
    
    // Si no tiene problema asociado y no está en minedBlocks, eliminarlo
    if (!problemData && !block && (blockData.state === 'active' || !blockData.isCompleted)) {
      if (!blocksToRemove.includes(blockId)) {
        blocksToRemove.push(blockId);
      }
    }
  }
  
  // Eliminar problemas de rondas anteriores
  for (const blockId of blocksToRemove) {
    miningProblems.delete(blockId);
    miningResponses.delete(blockId);
    console.log(`🧹 [ROUND][CLEANUP] Problema ${blockId} eliminado (ronda anterior)`);
  }
  
  console.log(`🧹 [ROUND][CLEANUP] ${blocksToRemove.length} problemas de rondas anteriores eliminados`);
};

// Función helper para obtener bloques minados
const getMinedBlocks = (gameId) => {
  if (!minedBlocks.has(gameId)) {
    minedBlocks.set(gameId, []);
  }
  return minedBlocks.get(gameId);
};

// Función helper para añadir un bloque minado
const addMinedBlock = (gameId, block) => {
  const blocks = getMinedBlocks(gameId);
  blocks.push(block);
  console.log(`⛓️ [ADDMINEDBLOCK] Bloque añadido al juego ${gameId}:`, block);
  console.log(`⛓️ [ADDMINEDBLOCK] Total de bloques en el juego:`, blocks.length);
  console.log(`⛓️ [ADDMINEDBLOCK] minedBlocks Map actual:`, Array.from(minedBlocks.entries()));
};

// Función helper para obtener el ranking de un jugador
const getPlayerRanking = (gameId, userId) => {
  if (!playerRankings.has(gameId)) {
    playerRankings.set(gameId, new Map());
  }
  const gameRanking = playerRankings.get(gameId);
  if (!gameRanking.has(userId)) {
    gameRanking.set(userId, {
      blocksMined: 0,
      totalRewards: 0
    });
  }
  return gameRanking.get(userId);
};

// Función helper para actualizar el ranking de un jugador
const updatePlayerRanking = (gameId, userId, updates) => {
  const ranking = getPlayerRanking(gameId, userId);
  const updatedRanking = { ...ranking, ...updates };
  playerRankings.get(gameId).set(userId, updatedRanking);
  return updatedRanking;
};

// Manejo de conexiones
io.on('connection', (socket) => {
  console.log(`🔌 Nuevo cliente conectado: ${socket.id}`);

  // Manejo de errores del socket
  socket.on('error', (error) => {
    console.error(`❌ Error en socket ${socket.id}:`, error);
  });

  // Unirse a una sala de juego
  socket.on('join_game', ({ gameId, userId, userName }) => {
    console.log(`🎮 Usuario ${userId} (${userName}) uniéndose a juego ${gameId}`);
    console.log(`🔌 Socket ID: ${socket.id}`);
    console.log(`🎯 Estado actual del juego ${gameId}:`, gameRooms.get(gameId)?.status || 'no existe');
    
    // Obtener o crear sala
    const room = getGameRoom(gameId);
    
    // Verificar si el juego ya está lleno (máximo 5 jugadores)
    if (room.players.length >= 5) {
      console.log(`❌ Juego ${gameId} lleno: ${room.players.length}/5 jugadores`);
      socket.emit('error', { message: 'No caben más jugadores en esta sala. La sala está llena.' });
      return;
    }
    
    // Verificar si el juego ya ha comenzado
    if (room.status !== 'waiting') {
      console.log(`❌ Juego ${gameId} ya ha comenzado. Estado: ${room.status}`);
      socket.emit('error', { message: 'El juego ya ha comenzado. No se pueden unir más jugadores.' });
      return;
    }
    
    // Unirse a la sala
    socket.join(gameId);
    
    // Guardar referencia del socket
    playerSockets.set(userId, socket.id);
    
    // Agregar jugador si no existe
    const existingPlayer = room.players.find(p => p.userId === userId);
    if (!existingPlayer) {
      room.players.push({
        userId,
        userName,
        socketId: socket.id,
        readyForNextRound: false
      });
      
      // Si es el primer jugador, asignar como host
      if (room.players.length === 1) {
        room.hostId = userId;
      }
    }
    
    // Enviar estado actual del juego
    socket.emit('game_state', {
      status: room.status,
      round: room.round,
      players: room.players,
      hostId: room.hostId,
      roundTime: room.roundTime,
      winningIndustry: room.winningIndustry
    });
    
    // Si el juego ya está en estado 'starting', enviar inmediatamente el evento game_status
    if (room.status === 'starting') {
      console.log(`🔄 Juego ${gameId} ya en estado 'starting', enviando evento game_status a nuevo jugador`);
      console.log(`📡 Enviando game_status a socket ${socket.id} para usuario ${userId}`);
      socket.emit('game_status', {
        status: 'starting',
        round: room.round,
        message: 'Game starting in 3 seconds...'
      });
      console.log(`✅ Evento game_status enviado a ${userId}`);
    }
    
    // Si el juego ya está en estado 'in_progress', enviar inmediatamente el evento start_round
    if (room.status === 'in_progress') {
      console.log(`🔄 Juego ${gameId} ya en estado 'in_progress', enviando evento start_round a nuevo jugador`);
      console.log(`📡 Enviando start_round a socket ${socket.id} para usuario ${userId}`);
      socket.emit('start_round', {
        roundTime: room.roundTime,
        round: room.round,
        winningIndustry: room.winningIndustry,
        status: 'in_progress'
      });
      console.log(`✅ Evento start_round enviado a ${userId}`);
    }
    
    // Sincronizar con Firestore
    syncGameToFirestore(gameId, room);
    
    // Notificar a otros jugadores
    socket.to(gameId).emit('player_joined', {
      userId,
      userName,
      totalPlayers: room.players.length
    });
    
    console.log(`✅ Usuario ${userId} unido a juego ${gameId}. Total jugadores: ${room.players.length}`);
    console.log(`🎯 Estado final del juego ${gameId}: ${room.status}`);
  });

  // Inicio de partida (solo host)
  socket.on('start_game', ({ gameId, userId }) => {
    console.log(`🚀 [SERVER-SIMPLE] Host ${userId} iniciando juego ${gameId}`);
    console.log(`🔌 [SERVER-SIMPLE] Socket ID del host: ${socket.id}`);
    
    const room = getGameRoom(gameId);
    
    // Verificar que es el host
    if (room.hostId !== userId) {
      socket.emit('error', { message: 'Solo el host puede iniciar el juego' });
      return;
    }
    
    // Verificar que hay al menos 2 jugadores para iniciar
    if (room.players.length < 2) {
      console.log(`❌ No se puede iniciar el juego con menos de 2 jugadores. Jugadores actuales: ${room.players.length}`);
      socket.emit('error', { message: 'Se necesitan al menos 2 jugadores para iniciar el juego.' });
      return;
    }
    
    // Cambiar estado a 'starting'
    room.status = 'starting';
    room.round = 1;
    room.readyPlayers.clear();
    
    // Generar productos para la Ronda 1
    console.log(`🏪 [START_GAME] Generando productos para Ronda 1...`);
    generateMarketForRound(gameId, 1).then(async (marketData) => {
      if (!marketData) {
        console.error(`❌ [START_GAME] marketData es null/undefined - NO INICIAR PARTIDA`);
        room.status = 'waiting'; // Revertir estado
        socket.emit('error', { 
          message: 'No se pudieron generar productos. Por favor, intenta de nuevo.',
          type: 'market_generation_error'
        });
        syncGameToFirestore(gameId, room);
        return;
      }
      
      if (!marketData.products || !Array.isArray(marketData.products)) {
        console.error(`❌ [START_GAME] marketData.products no es válido:`, marketData, '- NO INICIAR PARTIDA');
        room.status = 'waiting'; // Revertir estado
        socket.emit('error', { 
          message: 'Productos inválidos generados. Por favor, intenta de nuevo.',
          type: 'market_validation_error'
        });
        syncGameToFirestore(gameId, room);
        return;
      }
      
      // CRÍTICO: Validar que hay productos válidos antes de continuar
      const validProducts = (marketData.products || []).filter(p => 
        p && 
        typeof p.currentPrice === 'number' && !isNaN(p.currentPrice) && p.currentPrice > 0 &&
        typeof p.waste === 'number' && !isNaN(p.waste) && p.waste > 0 &&
        p.marbleType && p.type && p.quality
      );
      
      if (validProducts.length === 0) {
        console.error(`❌ [START_GAME] No hay productos válidos (${marketData.products.length} productos generados, 0 válidos) - NO INICIAR PARTIDA`);
        room.status = 'waiting'; // Revertir estado
        socket.emit('error', { 
          message: 'No se pudieron generar productos válidos. Por favor, intenta de nuevo.',
          type: 'market_validation_error'
        });
        syncGameToFirestore(gameId, room);
        return;
      }
      
      if (!marketData.legacy) {
        console.error(`❌ [START_GAME] marketData.legacy no está disponible:`, marketData);
      }
      
      console.log(`✅ [START_GAME] Productos generados para Ronda 1: ${validProducts.length}/${marketData.products.length} productos válidos`);
      console.log(`✅ [START_GAME] Legacy disponible:`, !!marketData.legacy);
      
      // PRIMERO: Enviar inventario actualizado a todos los jugadores
      console.log(`📦 [START_GAME] Enviando inventarios actualizados a todos los jugadores...`);
      for (const player of room.players) {
        const inventory = getPlayerInventory(gameId, player.userId);
        const playerSocketId = playerSockets.get(player.userId);
        
        if (playerSocketId) {
          console.log(`📦 [START_GAME] Enviando inventario a ${player.userName} (${player.userId}):`, {
            rockCoins: inventory.rockCoins,
            waste: inventory.waste,
            products: inventory.products?.length || 0
          });
          io.to(playerSocketId).emit('inventory_data', {
            gameId,
            userId: player.userId,
            inventory: {
              rockCoins: inventory.rockCoins,
              waste: inventory.waste,
              products: inventory.products || []
            }
          });
        }
      }
      console.log(`✅ [START_GAME] Inventarios enviados a todos los jugadores`);
      
      // Pequeña pausa para asegurar que el frontend recibe el inventario
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // DESPUÉS: Emitir economy:state para que el cliente reciba los productos
      console.log(`📡 [START_GAME] Emitiendo economy:state para Ronda 1...`);
      const roundId = `${gameId}:1:${Date.now()}`;
      const version = 1;
      
      // MISMA ESTRUCTURA QUE RONDA 2+ - SIN campos extra (round, seed)
      // Usar solo productos válidos (ya validados arriba)
      emitToGame(gameId, 'economy:state', {
        roundId: roundId,
        version: version,
        round: 1,
        market: {
          products: validProducts, // Solo productos válidos
          legacy: marketData.legacy || {} // Incluir legacy (vacío si no está disponible)
        }
      });
      console.log(`✅ [START_GAME] economy:state emitido para Ronda 1 con ${validProducts.length} productos válidos`);
      
      // EMITIR game_status DESPUÉS de que economy:state se haya enviado
      console.log(`📡 [START_GAME] Emitiendo game_status después de economy:state...`);
    emitToGame(gameId, 'game_status', {
      status: 'starting',
      round: 1,
      message: 'Game starting in 3 seconds...'
      });
      console.log(`✅ [START_GAME] game_status emitido`);
    }).catch(error => {
      console.error(`❌ [START_GAME] Error generando productos para Ronda 1:`, error);
      console.error(`❌ [START_GAME] Stack trace:`, error.stack);
      // CRÍTICO: NO iniciar partida si hay error - revertir estado
      room.status = 'waiting';
      socket.emit('error', { 
        message: `Error generando productos: ${error.message}. Por favor, intenta de nuevo.`,
        type: 'market_generation_error'
      });
      syncGameToFirestore(gameId, room);
      console.error(`❌ [START_GAME] Partida NO iniciada debido a error en generación de productos`);
    });
    
    // Sincronizar con Firestore
    syncGameToFirestore(gameId, room);
    
    console.log(`📡 [START_GAME] Sincronizado con Firestore`);
    console.log(`👥 Jugadores en la sala:`, room.players.map(p => ({ userId: p.userId, socketId: p.socketId })));
    
    // NOTA: game_status se emite dentro del .then() de generateMarketForRound
    // para asegurar que se envía después de economy:state
    
    console.log(`✅ [START_GAME] Handler completado para juego ${gameId} iniciado por host ${userId}`);
  });

  // Jugador listo para jugar (después del countdown de 3s)
  socket.on('ready_to_play', async ({ gameId, userId }) => {
    console.log(`✅ Jugador ${userId} listo para jugar en juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    
    // Agregar a la lista de jugadores listos
    room.readyPlayers.add(userId);
    
    // Verificar si todos están listos
    if (areAllPlayersReady(gameId)) {
      console.log(`🎮 Todos los jugadores listos para juego ${gameId}`);
      
      // CRÍTICO: Verificar que hay productos antes de iniciar la ronda
      if (room.round === 1) {
        try {
          if (admin.apps.length) {
            const db = admin.firestore();
            const marketRef = db.collection('games').doc(gameId).collection('market').doc('1');
            const marketDoc = await marketRef.get();
            
            if (!marketDoc.exists || !marketDoc.data().products || marketDoc.data().products.length === 0) {
              console.error(`❌ [READY_TO_PLAY] No hay productos para ronda 1 - NO INICIAR RONDA`);
              socket.emit('error', { 
                message: 'No hay productos disponibles. Por favor, espera a que se generen.',
                type: 'market_missing_error'
              });
              return;
            }
            
            const products = marketDoc.data().products || [];
            const validProducts = products.filter(p => 
              p && 
              typeof p.currentPrice === 'number' && !isNaN(p.currentPrice) && p.currentPrice > 0 &&
              typeof p.waste === 'number' && !isNaN(p.waste) && p.waste > 0 &&
              p.marbleType && p.type && p.quality
            );
            
            if (validProducts.length === 0) {
              console.error(`❌ [READY_TO_PLAY] No hay productos válidos para ronda 1 - NO INICIAR RONDA`);
              socket.emit('error', { 
                message: 'Productos inválidos. Por favor, espera a que se regeneren.',
                type: 'market_validation_error'
              });
              return;
            }
            
            console.log(`✅ [READY_TO_PLAY] Verificados ${validProducts.length} productos válidos para ronda 1`);
          }
        } catch (checkError) {
          console.error(`❌ [READY_TO_PLAY] Error verificando productos:`, checkError);
          socket.emit('error', { 
            message: 'Error verificando productos. Por favor, intenta de nuevo.',
            type: 'market_check_error'
          });
          return;
        }
      }
      
      // Simular selección de industria ganadora (solo industrias que utilizan residuos físicos)
      const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
      room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
      console.log(`🏭 [WINNING INDUSTRY] Industria ganadora seleccionada: ${room.winningIndustry}`);
      
      // DEBUG: Ver el valor de room.round antes de crear el estado autoritativo
      console.log(`🚀 [DEBUG] room.round ANTES de createAuthoritativeRoundData: ${room.round}`);
      
      // CREAR ESTADO AUTORITATIVO PARA LA RONDA
      const authority = createAuthoritativeRoundData(gameId, room.round, 120000);
      
      // Verificar idempotencia para evitar duplicados
      const operationId = createOperationId(gameId, 'start_round', authority.roundId, authority.version);
      if (isOperationApplied(gameId, operationId)) {
        console.log(`🔄 [IDEMPOTENCY] start_round ya aplicado para ${gameId}, omitiendo`);
        return;
      }
      
      // Actualizar estado de la sala con datos autoritativos
      room.status = 'in_progress';
      room.roundTime = new Date(authority.roundEndsAtMs); // Mantener compatibilidad
      room.readyPlayers.clear();
      
      // CRÍTICO: Establecer estado del juego a PLAYING para que handleRoundEnd funcione
      setGameState(gameId, GAME_STATES.PLAYING, room.round);
      console.log(`🎮 [READY_TO_PLAY] Estado del juego establecido a PLAYING para ronda ${room.round}`);
      
      // Marcar operación como aplicada
      markOperationApplied(gameId, operationId);
      
      // Timer automático para terminar la ronda cuando se acabe el tiempo
      setTimeout(async () => {
        console.log(`⏰ [ROUND] Timer ended → preparing results for round=${room.round} gameId=${gameId}`);
        
        // Verificar que la ronda aún esté activa
        const currentRoom = getGameRoom(gameId);
        const currentAuthority = getGameAuthority(gameId);
        if (currentRoom && currentRoom.status === 'in_progress' && 
            currentRoom.round === room.round && 
            currentAuthority.roundId === authority.roundId) {
          // Llamar directamente a la lógica de fin de ronda
          await handleRoundEnd(gameId, currentRoom.round);
        }
      }, 120000); // 120 segundos (2 minutos)
      
      // CRÍTICO: Emitir productos nuevamente cuando todos están listos (especialmente para Ronda 1)
      // Esto asegura que todos los clientes reciban los productos incluso si se perdieron en start_game
      if (room.round === 1) {
        console.log(`📡 [READY_TO_PLAY] Re-emitiendo economy:state para Ronda 1 cuando todos están listos...`);
        try {
          // Obtener productos desde Firestore
          if (admin.apps.length) {
            const db = admin.firestore();
            const marketRef = db.collection('games').doc(gameId).collection('market').doc('1');
            const marketDoc = await marketRef.get();
            
            if (marketDoc.exists) {
              const marketData = marketDoc.data();
              const products = marketData.products || [];
              
              // Obtener legacy
              const legacyRef = db.collection('market').doc(gameId);
              const legacyDoc = await legacyRef.get();
              const legacyData = legacyDoc.exists ? (legacyDoc.data().rounds || {}) : {};
              const legacy = legacyData[1] || {};
              
              if (products.length > 0) {
                console.log(`✅ [READY_TO_PLAY] Re-emitiendo ${products.length} productos para Ronda 1`);
                emitToGame(gameId, 'economy:state', {
                  roundId: `${gameId}:1:${Date.now()}`,
                  version: 1,
                  round: 1,
                  market: {
                    products: products,
                    legacy: legacy
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error(`❌ [READY_TO_PLAY] Error re-emitiendo productos:`, error);
        }
      }
      
      // EMITIR ESTADO AUTORITATIVO
      emitAuthoritativeState(gameId, 'start_round', {
        gameId,
        round: room.round,
        winningIndustry: room.winningIndustry,
        roundTime: new Date(authority.roundEndsAtMs).toISOString(),
        roundEndsAtMs: authority.roundEndsAtMs, // CRÍTICO: Incluir explícitamente para que el timer funcione
        message: 'Ronda iniciada'
      });
      
      // Track round start
      trackRoundStart(gameId, room.round);
      
      console.log(`✅ [DEBUG] start_round autoritativo emitido exitosamente a juego ${gameId}`);
      
      // Sincronizar con Firestore al terminar la ronda
      await syncGameToFirestore(gameId, room);
      
      console.log(`📡 WebSocket: Coordinando inicio de ronda para juego ${gameId}`);
      
      console.log(`✅ Ronda ${room.round} iniciada para juego ${gameId}`);
    } else {
      // Notificar progreso
      socket.emit('waiting_players', {
        readyCount: room.readyPlayers.size,
        totalPlayers: room.players.length
      });
    }
  });

  // ENDPOINT DE RESINCRONIZACIÓN
  socket.on('resync_state', ({ gameId, userId }) => {
    console.log(`🔄 [RESYNC] Solicitud de resincronización de ${userId} en juego ${gameId}`);
    
    // Track resync request
    trackResync(gameId, userId);
    
    const authority = getGameAuthority(gameId);
    const serverNow = getServerTimestamp();
    
    const resyncData = {
      ...authority,
      serverNowMs: serverNow,
      gameId,
      userId
    };
    
    console.log(`🔄 [RESYNC] Enviando estado autoritativo:`, resyncData);
    socket.emit('resync_state', resyncData);
  });

  // ENDPOINT: Solicitar datos de mercado (productos)
  socket.on('request_market_data', async ({ gameId, round }) => {
    console.log(`📡 [MARKET_REQUEST] Solicitud de productos para ronda ${round} del juego ${gameId} desde socket ${socket.id}`);
    
    // Asegurar que el socket esté unido a la sala
    if (!socket.rooms.has(gameId)) {
      console.log(`🔗 [MARKET_REQUEST] Uniendo socket ${socket.id} a sala ${gameId}`);
      socket.join(gameId);
    }
    
    try {
      let products = [];
      let legacy = {};
      let productsFound = false;
      
      // PRIMERO: Intentar obtener productos desde Firestore
      if (admin.apps.length) {
        try {
          const db = admin.firestore();
          const marketRef = db.collection('games').doc(gameId).collection('market').doc(round.toString());
          const marketDoc = await marketRef.get();
          
          if (marketDoc.exists) {
            const marketData = marketDoc.data();
            products = marketData.products || [];
            
            // Obtener legacy desde el documento agregado
            const legacyRef = db.collection('market').doc(gameId);
            const legacyDoc = await legacyRef.get();
            const legacyData = legacyDoc.exists ? (legacyDoc.data().rounds || {}) : {};
            legacy = legacyData[round] || {};
            
            if (products.length > 0) {
              productsFound = true;
              console.log(`✅ [MARKET_REQUEST] Encontrados ${products.length} productos en Firestore para ronda ${round}`);
            } else {
              console.warn(`⚠️ [MARKET_REQUEST] Documento existe pero productos array está vacío`);
            }
          } else {
            console.warn(`⚠️ [MARKET_REQUEST] No se encontró documento en Firestore para ronda ${round}`);
          }
        } catch (firestoreError) {
          console.error(`❌ [MARKET_REQUEST] Error accediendo a Firestore:`, firestoreError);
        }
      } else {
        console.warn(`⚠️ [MARKET_REQUEST] Firebase Admin no disponible, generando productos directamente`);
      }
      
      // SEGUNDO: Si no hay productos, generar mercado
      if (!productsFound || products.length === 0) {
        console.log(`🔄 [MARKET_REQUEST] Generando productos para ronda ${round}...`);
        try {
          const marketData = await generateMarketForRound(gameId, round);
          if (marketData && marketData.products && marketData.products.length > 0) {
            products = marketData.products;
            legacy = marketData.legacy || {};
            productsFound = true;
            console.log(`✅ [MARKET_REQUEST] Productos generados exitosamente: ${products.length} productos`);
          } else {
            console.error(`❌ [MARKET_REQUEST] generateMarketForRound no devolvió productos válidos`);
          }
        } catch (genError) {
          console.error(`❌ [MARKET_REQUEST] Error generando productos:`, genError);
          console.error(`❌ [MARKET_REQUEST] Stack:`, genError.stack);
        }
      }
      
      // TERCERO: Emitir economy:state si tenemos productos
      if (productsFound && products.length > 0) {
        console.log(`📡 [MARKET_REQUEST] Emitiendo economy:state con ${products.length} productos a socket ${socket.id}`);
        socket.emit('economy:state', {
          roundId: `${gameId}:${round}:${Date.now()}`,
          version: 1,
          round: round,
          market: {
            products: products,
            legacy: legacy
          }
        });
        console.log(`✅ [MARKET_REQUEST] economy:state emitido exitosamente`);
      } else {
        console.error(`❌ [MARKET_REQUEST] No se pudieron obtener o generar productos. No se emite economy:state`);
        socket.emit('error', { 
          message: `No se pudieron cargar productos para ronda ${round}`,
          type: 'market_data_error'
        });
      }
    } catch (error) {
      console.error(`❌ [MARKET_REQUEST] Error general obteniendo productos:`, error);
      console.error(`❌ [MARKET_REQUEST] Stack:`, error.stack);
      socket.emit('error', { 
        message: `Error cargando productos: ${error.message}`,
        type: 'market_data_error'
      });
    }
  });

  // NUEVO: Jugador listo para siguiente ronda (round:ready) - IMPLEMENTACIÓN CORREGIDA
  socket.on('round:ready', async ({ gameId, userId, round }) => {
    console.log(`⏭️ [ROUND:READY] EVENTO RECIBIDO - Jugador ${userId} listo para ronda ${round} en juego ${gameId}`);
    console.log(`⏭️ [ROUND:READY] Socket ID: ${socket.id}`);
    console.log(`⏭️ [ROUND:READY] Timestamp: ${new Date().toISOString()}`);
    
    const room = getGameRoom(gameId);
    
    // DEBUG: Logs detallados del estado actual
    console.log(`🔍 [DEBUG] Estado actual del juego: ${room.status}`);
    console.log(`🔍 [DEBUG] Ronda actual: ${room.round}`);
    console.log(`🔍 [DEBUG] Jugadores en la sala: ${room.players.length}`);
    console.log(`🔍 [DEBUG] Jugadores listos: ${room.players.filter(p => p.readyForNextRound).length}`);
    console.log(`🔍 [DEBUG] Host ID: ${room.hostId}`);
    console.log(`🔍 [DEBUG] Winning Industry: ${room.winningIndustry}`);
    
    // VERIFICACIÓN DE ESTADO: Aceptar solo estados válidos
    const validStates = ['roundEnd', 'waitingForNextRound', 'in_progress'];
    if (!validStates.includes(room.status)) {
      console.log(`⚠️ [ROUND:READY] Estado que impide transición: ${room.status}`);
      socket.emit('round:ready:error', { 
        message: 'Estado de juego incorrecto',
        currentStatus: room.status,
        expectedStatus: 'roundEnd, waitingForNextRound, in_progress'
      });
      return;
    }
    
    // Si estamos en 'in_progress', cambiar a 'roundEnd' automáticamente
    if (room.status === 'in_progress') {
      console.log(`🔄 [ROUND:READY] Cambiando estado de in_progress a roundEnd automáticamente`);
      room.status = 'roundEnd';
    }
    
    // PROTECCIÓN DE IDEMPOTENCIA: Verificar si ya se está procesando la transición
    if (room.roundTransitioning) {
      console.log(`⚠️ [ROUND:READY] Transición ya en progreso, ignorando duplicado`);
      return;
    }
    
    // Marcar jugador como listo
    let player = room.players.find(p => p.userId === userId);
    
    // Si el jugador no está en la sala pero el juego está en progreso, intentar restaurarlo desde Firestore
    if (!player && room.status !== 'waiting') {
      console.log(`🔄 [ROUND:READY] Jugador ${userId} no encontrado en sala, intentando restaurar desde Firestore...`);
      
      try {
        // PRIMERO: Asegurarse de que el socket está unido a la sala
        socket.join(gameId);
        
        // Guardar referencia del socket
        playerSockets.set(userId, socket.id);
        
        // Intentar obtener datos del jugador desde Firestore
        if (admin.apps.length) {
          // Primero intentar obtener desde el documento del juego directamente
          const gameRef = admin.firestore().collection('games').doc(gameId);
          const gameDoc = await gameRef.get();
          
          let userName = 'Unknown';
          let userImageUrl = null;
          
          if (gameDoc.exists) {
            const gameData = gameDoc.data();
            const playerData = gameData?.players?.find(p => p.userId === userId);
            if (playerData) {
              userName = playerData.userName || 'Unknown';
              userImageUrl = playerData.imageUrl;
            }
          }
          
          // Si no encontramos en el juego, buscar en el documento del usuario
          if (userName === 'Unknown') {
            const userRef = admin.firestore().collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
              const userData = userDoc.data();
              const gameUserData = userData?.games?.[gameId];
              if (gameUserData) {
                userName = gameUserData.userName || userData.userName || 'Unknown';
                userImageUrl = userData.imageUrl;
              } else {
                userName = userData.userName || 'Unknown';
                userImageUrl = userData.imageUrl;
              }
            }
          }
          
          // Crear jugador restaurado
          const restoredPlayer = {
            userId: userId,
            userName: userName,
            socketId: socket.id,
            imageUrl: userImageUrl,
            readyForNextRound: false
          };
          
          room.players.push(restoredPlayer);
          
          // CRÍTICO: NO restaurar inventario desde Firestore aquí porque puede tener valores antiguos
          // El inventario en memoria (si existe) ya tiene los rewards aplicados
          // Solo inicializar si NO existe en memoria
          if (!playerInventories.has(gameId)) {
            playerInventories.set(gameId, new Map());
          }
          const gameInventory = playerInventories.get(gameId);
          
          // Solo inicializar inventario si NO existe en memoria
          if (!gameInventory.has(userId)) {
            // Si no existe en memoria, intentar restaurar desde Firestore como último recurso
          const userRef = admin.firestore().collection('users').doc(userId);
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const gameData = userData?.games?.[gameId];
            
            if (gameData) {
              const restoredInventory = {
                products: Array.isArray(gameData.products) ? gameData.products : [],
                rockCoins: typeof gameData.rockCoins === 'number' ? gameData.rockCoins : 600,
                waste: typeof gameData.waste === 'number' ? gameData.waste : 0
              };
              
              gameInventory.set(userId, restoredInventory);
                console.log(`⚠️ [ROUND:READY] Inventario inicializado desde Firestore para ${userId} (no existía en memoria):`, restoredInventory);
              } else {
                // Si no hay datos en Firestore, inicializar con defaults
                gameInventory.set(userId, { products: [], rockCoins: 600, waste: 0 });
                console.log(`⚠️ [ROUND:READY] Inventario inicializado con defaults para ${userId} (no existía en memoria ni Firestore)`);
              }
            } else {
              // Si no existe el usuario en Firestore, inicializar con defaults
              gameInventory.set(userId, { products: [], rockCoins: 600, waste: 0 });
              console.log(`⚠️ [ROUND:READY] Inventario inicializado con defaults para ${userId} (usuario no existe en Firestore)`);
            }
          } else {
            // Inventario ya existe en memoria - NO sobrescribir (tiene rewards aplicados)
            const existingInventory = gameInventory.get(userId);
            console.log(`✅ [ROUND:READY] Inventario en memoria ya existe para ${userId} (NO restaurando desde Firestore):`, {
              rockCoins: existingInventory?.rockCoins,
              waste: existingInventory?.waste,
              productsCount: existingInventory?.products?.length || 0
            });
          }
          
          player = restoredPlayer;
          console.log(`✅ [ROUND:READY] Jugador ${userId} restaurado desde Firestore: ${userName}`);
        } else {
          console.error(`❌ [ROUND:READY] Firebase Admin no inicializado`);
        }
      } catch (error) {
        console.error(`❌ [ROUND:READY] Error restaurando jugador desde Firestore:`, error);
        console.error(`❌ [ROUND:READY] Stack trace:`, error.stack);
      }
    }
    
    if (player) {
      // Actualizar socketId por si cambió
      player.socketId = socket.id;
      player.readyForNextRound = true;
      console.log(`✅ [ROUND:READY] Jugador ${userId} marcado como listo`);
    } else {
      console.error(`❌ [ROUND:READY] Jugador ${userId} no encontrado en la sala y no se pudo restaurar`);
      socket.emit('round:ready:error', { 
        message: 'Jugador no encontrado en la sala',
        currentStatus: room.status
      });
      return;
    }
    
    // Verificar si todos están listos
    const allReady = room.players.every(p => p.readyForNextRound);
    const readyCount = room.players.filter(p => p.readyForNextRound).length;
    console.log(`🔍 [ROUND:READY] Jugadores listos: ${readyCount}/${room.players.length}`);
    
    // Si es el primer jugador en marcar ready, cambiar estado a waitingForNextRound
    if (readyCount === 1 && room.status === 'roundEnd') {
      room.status = 'waitingForNextRound';
      console.log(`🔄 [ROUND:READY] Cambiando estado a waitingForNextRound`);
      
      // Emitir estado a todos los jugadores
      emitToGame(gameId, 'game_status', {
        status: 'waitingForNextRound',
        round: room.round,
        message: 'Esperando a otros jugadores...'
      });
    }
    
    // Emitir progreso a todos los jugadores
    emitToGame(gameId, 'round:ready:progress', {
      readyCount: readyCount,
      totalPlayers: room.players.length,
      round: room.round
    });
    
    // BLOQUE CRÍTICO: Solo ejecutar si todos están listos
    if (allReady) {
      console.log(`🎮 [ROUND:READY] Todos los jugadores listos para siguiente ronda en juego ${gameId}`);
      
      // ACTIVAR PROTECCIÓN DE IDEMPOTENCIA
      room.roundTransitioning = true;
      
      try {
        const currentRound = room.round;
        const nextRound = currentRound + 1;
        
        console.log(`🔄 [ROUND:READY] Transición: ronda ${currentRound} → ronda ${nextRound}`);
        
        // 1. PERSISTENCIA ATÓMICA EN FIRESTORE
        console.log(`💾 [ROUND:READY] Iniciando persistencia atómica...`);
        await persistRoundDataAtomic(gameId, room, currentRound);
        console.log(`✅ [ROUND:READY] FIRESTORE COMMIT OK (${currentRound} → ${nextRound})`);
        
        // 2. GENERAR MERCADO DETERMINISTA PARA SIGUIENTE RONDA
        console.log(`🏪 [ROUND:READY] Generando mercado para ronda ${nextRound}...`);
        const newMarket = await generateMarketForRound(gameId, nextRound);
        console.log(`✅ [ROUND:READY] MARKET OK (${nextRound})`);
        
        // 3. ACTUALIZAR ESTADO EN MEMORIA CON SISTEMA AUTORITATIVO
        room.round = nextRound;
        room.status = 'starting';
        
        // CRÍTICO: Resetear winningIndustry para la nueva ronda (aleatorio)
        const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
        room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
        console.log(`🏭 [ROUND:READY] winningIndustry reseteado para ronda ${nextRound}: ${room.winningIndustry}`);
        
        // CREAR ESTADO AUTORITATIVO PARA LA NUEVA RONDA (countdown de 3s)
        const authority = createAuthoritativeRoundData(gameId, nextRound, 3000);
        room.roundTime = new Date(authority.roundEndsAtMs); // Mantener compatibilidad
        room.readyPlayers.clear();
        
        // Resetear flags de ready para la nueva ronda
        room.players.forEach(player => {
          player.readyForNextRound = false;
        });
        
        // CRÍTICO: Resetear selectedIndustry en Firestore para todos los jugadores
        // Esto asegura que cada ronda requiere una nueva selección
        console.log(`🏭 [ROUND:READY] Reseteando selectedIndustry para todos los jugadores en Firestore...`);
        if (admin.apps.length) {
          const batch = admin.firestore().batch();
          for (const player of room.players) {
            const userRef = admin.firestore().collection('users').doc(player.userId);
            batch.update(userRef, {
              [`games.${gameId}.selectedIndustry`]: admin.firestore.FieldValue.delete()
            });
          }
          try {
            await batch.commit();
            console.log(`✅ [ROUND:READY] selectedIndustry reseteado para ${room.players.length} jugadores`);
          } catch (error) {
            console.error(`❌ [ROUND:READY] Error reseteando selectedIndustry:`, error);
            // Continuar aunque falle el reset (no crítico)
          }
        }
        
        // 4. SINCRONIZAR CON FIRESTORE
        await syncGameToFirestore(gameId, room);
        
        // 5. ENVIAR INVENTARIO ACTUALIZADO A TODOS LOS JUGADORES PRIMERO
        // CRÍTICO: Los inventarios en memoria ya tienen los rewards aplicados (de calculateRoundRewards)
        // NO debemos restaurar desde Firestore porque puede tener valores antiguos
        // Usar los valores en memoria como fuente de verdad
        console.log(`📦 [ROUND:READY] Enviando inventarios actualizados a todos los jugadores (valores en memoria con rewards)...`);
        for (const player of room.players) {
          let inventory = getPlayerInventory(gameId, player.userId);
          
          // CRÍTICO: Verificar que el inventario en memoria tenga valores válidos
          console.log(`🔍 [ROUND:READY] Inventario RAW en memoria para ${player.userId}:`, {
            rockCoins: inventory?.rockCoins,
            waste: inventory?.waste,
            productsCount: inventory?.products?.length || 0,
            type: typeof inventory?.rockCoins
          });
          
          // Validar y normalizar valores en memoria (que ya incluyen rewards)
          let rockCoins = typeof inventory.rockCoins === 'number' && !isNaN(inventory.rockCoins) && isFinite(inventory.rockCoins)
            ? Math.max(0, Math.round(inventory.rockCoins))
            : 600;
          let waste = typeof inventory.waste === 'number' && !isNaN(inventory.waste) && isFinite(inventory.waste)
            ? Math.max(0, Math.round(inventory.waste))
            : 0;
          let products = Array.isArray(inventory.products) ? inventory.products : [];
          
          // CRÍTICO: Si el valor normalizado es 600 (default) en una ronda > 1, podría significar que los rewards no se aplicaron
          // Verificar en Firestore para confirmar y corregir
          if (rockCoins === 600 && currentRound > 1) {
            console.warn(`⚠️ [ROUND:READY] VALOR POR DEFECTO DETECTADO para ${player.userId} en ronda ${currentRound}! Verificando Firestore...`);
            try {
              if (admin.apps.length) {
                const userRef = admin.firestore().collection('users').doc(player.userId);
                const userDoc = await userRef.get();
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  const gameData = userData?.games?.[gameId];
                  if (gameData && typeof gameData.rockCoins === 'number' && gameData.rockCoins !== 600) {
                    console.warn(`⚠️ [ROUND:READY] Firestore tiene ${gameData.rockCoins} pero memoria tiene ${rockCoins}. Usando Firestore como corrección...`);
                    // Usar valor de Firestore si es diferente y parece más actualizado
                    rockCoins = gameData.rockCoins;
                    waste = typeof gameData.waste === 'number' ? gameData.waste : waste;
                    products = Array.isArray(gameData.products) ? gameData.products : products;
                    
                    // Actualizar inventario en memoria con valores corregidos
                    inventory.rockCoins = rockCoins;
                    inventory.waste = waste;
                    inventory.products = products;
                    
                    const gameInventory = playerInventories.get(gameId) || new Map();
                    gameInventory.set(player.userId, inventory);
                    playerInventories.set(gameId, gameInventory);
                    
                    console.log(`✅ [ROUND:READY] Inventario corregido desde Firestore para ${player.userId}:`, {
                      rockCoins: rockCoins,
                      waste: waste,
                      productsCount: products.length
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`❌ [ROUND:READY] Error verificando Firestore para corrección:`, error);
            }
          }
          
          // Actualizar inventario en memoria con valores normalizados (o corregidos)
          inventory.rockCoins = rockCoins;
          inventory.waste = waste;
          inventory.products = products;
          
          const gameInventory = playerInventories.get(gameId) || new Map();
          gameInventory.set(player.userId, inventory);
          playerInventories.set(gameId, gameInventory);
          
          console.log(`📦 [ROUND:READY] Inventario FINAL en memoria para ${player.userId} (con rewards aplicados):`, {
            rockCoins: rockCoins,
            waste: waste,
            productsCount: products.length,
            note: 'Valores que se enviarán al cliente'
          });
          
          // Verificar Firestore para logging/debugging, pero NO sobrescribir memoria
          try {
            if (admin.apps.length) {
              const userRef = admin.firestore().collection('users').doc(player.userId);
              const userDoc = await userRef.get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                const gameData = userData?.games?.[gameId];
                
                if (gameData) {
                  const firestoreRockCoins = typeof gameData.rockCoins === 'number' ? gameData.rockCoins : null;
                  const firestoreWaste = typeof gameData.waste === 'number' ? gameData.waste : null;
                  
                  console.log(`🔍 [ROUND:READY] Comparación para ${player.userId}:`, {
                    enMemoria: { rockCoins, waste },
                    enFirestore: { rockCoins: firestoreRockCoins, waste: firestoreWaste },
                    coinciden: firestoreRockCoins === rockCoins && firestoreWaste === waste
                  });
                  
                  // Si Firestore tiene valores diferentes, actualizar Firestore con los valores de memoria (autoritativos)
                  if (firestoreRockCoins !== rockCoins || firestoreWaste !== waste) {
                    console.warn(`⚠️ [ROUND:READY] Firestore desincronizado para ${player.userId}, actualizando Firestore con valores de memoria...`);
                    await userRef.update({
                      [`games.${gameId}.rockCoins`]: rockCoins,
                      [`games.${gameId}.waste`]: waste,
                      [`games.${gameId}.products`]: products,
                      [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`✅ [ROUND:READY] Firestore actualizado con valores de memoria para ${player.userId}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ [ROUND:READY] Error verificando Firestore para ${player.userId}:`, error);
          }
          
          const playerSocketId = playerSockets.get(player.userId);
          
          if (playerSocketId) {
            console.log(`📦 [ROUND:READY] Enviando inventario actualizado a ${player.userName} (${player.userId}):`, {
              rockCoins: rockCoins,
              waste: waste,
              productsCount: products.length,
              note: 'Valores normalizados de memoria (con rewards aplicados)'
            });
            
            // Enviar valores normalizados (que ya incluyen rewards)
            io.to(playerSocketId).emit('inventory_data', {
              gameId,
              userId: player.userId,
              inventory: {
                rockCoins: rockCoins,
                waste: waste,
                products: products,
                miningQueue: inventory.miningQueue || 0
              }
            });
            
            // También enviar a la sala del juego como backup
            io.to(gameId).emit('inventory_data', {
              gameId,
              userId: player.userId,
              inventory: {
                rockCoins: rockCoins,
                waste: waste,
                products: products,
                miningQueue: inventory.miningQueue || 0
              }
            });
            
            console.log(`✅ [ROUND:READY] inventory_data enviado a ${player.userName} (${player.userId}) con valores:`, {
              rockCoins: rockCoins,
              waste: waste,
              productsCount: products.length
            });
          } else {
            console.warn(`⚠️ [ROUND:READY] No se encontró socketId para ${player.userId}, enviando a sala del juego...`);
            // Enviar a la sala del juego como fallback
            io.to(gameId).emit('inventory_data', {
              gameId,
              userId: player.userId,
              inventory: {
                rockCoins: rockCoins,
                waste: waste,
                products: products,
                miningQueue: 0
              }
            });
          }
        }
        console.log(`✅ [ROUND:READY] Inventarios enviados a todos los jugadores`);
        
        // Pequeña pausa para asegurar que el frontend recibe el inventario antes de iniciar
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 6. EMITIR EVENTOS EN ORDEN CORRECTO
        console.log(`📡 [ROUND:READY] Emitiendo eventos de transición...`);
        
        // PRIMERO: economy:state (hidrata mercado en UI) CON ESTADO AUTORITATIVO
        const roundId = `${gameId}:${nextRound}:${Date.now()}`;
        const version = nextRound;
        
        // Validar productos antes de emitir
        const validProducts = (newMarket.products || []).filter(p => 
          p && 
          typeof p.currentPrice === 'number' && !isNaN(p.currentPrice) && p.currentPrice > 0 &&
          typeof p.waste === 'number' && !isNaN(p.waste) && p.waste > 0 &&
          p.marbleType && p.type && p.quality
        );
        
        if (validProducts.length === 0 && newMarket.products && newMarket.products.length > 0) {
          console.error(`❌ [ROUND:READY] Todos los productos tienen valores inválidos!`);
          console.error(`❌ [ROUND:READY] Primeros 3 productos:`, newMarket.products.slice(0, 3));
        }
        
        console.log(`🔍 [ROUND:READY] Productos válidos: ${validProducts.length}/${newMarket.products?.length || 0}`);
        console.log(`🔍 [ROUND:READY] Legacy disponible:`, !!newMarket.legacy);
        console.log(`🔍 [ROUND:READY] Legacy keys:`, newMarket.legacy ? Object.keys(newMarket.legacy) : []);
        
        // Asegurar que legacy esté presente y sea válido
        let legacyToEmit = newMarket.legacy || {};
        if (!legacyToEmit || Object.keys(legacyToEmit).length === 0) {
          console.warn(`⚠️ [ROUND:READY] Legacy vacío, regenerando desde productos...`);
          // Regenerar legacy desde productos válidos si no está disponible
          if (validProducts.length > 0) {
            legacyToEmit = transformProductsToLegacy(validProducts, nextRound);
            console.log(`✅ [ROUND:READY] Legacy regenerado:`, Object.keys(legacyToEmit));
          } else if (newMarket.products && newMarket.products.length > 0) {
            legacyToEmit = transformProductsToLegacy(newMarket.products, nextRound);
            console.log(`✅ [ROUND:READY] Legacy regenerado desde productos originales:`, Object.keys(legacyToEmit));
          }
        }
        
        emitToGame(gameId, 'economy:state', {
          roundId: roundId,
          version: version,
          round: nextRound,
          market: {
            products: validProducts.length > 0 ? validProducts : newMarket.products, // Usar productos válidos si hay, sino originales
            legacy: legacyToEmit // SIEMPRE incluir legacy para ChatScreen (regenerado si es necesario)
          }
        });
        console.log(`✅ [ROUND:READY] EMIT economy:state autoritativo (${nextRound}) con ${validProducts.length || newMarket.products?.length || 0} productos y legacy con ${Object.keys(legacyToEmit).length} mármoles`);
        
        // SEGUNDO: game_status starting (dispara countdown) CON ESTADO AUTORITATIVO
        emitAuthoritativeState(gameId, 'game_status', {
          status: 'starting',
          round: nextRound,
          roundTime: room.roundTime,
          message: `Round ${nextRound} starting in 3 seconds...`
        });
        console.log(`✅ [ROUND:READY] EMIT game_status starting autoritativo (${nextRound}, ${room.roundTime})`);
        
        // TERCERO: round_ended informativo (opcional) CON ESTADO AUTORITATIVO
        emitAuthoritativeState(gameId, 'round_ended', {
          round: currentRound,
          persisted: true
        });
        console.log(`✅ [ROUND:READY] EMIT round_ended autoritativo (${currentRound})`);
        
        // NO EMITIR ROUND_END NI player_rankings_data AQUÍ
        // Estos eventos ya se emitieron cuando terminó la ronda actual
        // Solo emitimos los eventos necesarios para la transición
        
        console.log(`✅ [ROUND:READY] Nueva ronda ${nextRound} iniciada para juego ${gameId}`);
        
        // EMITIR ESTADO AUTORITATIVO DE COUNTDOWN (3s)
        console.log(`📡 [ROUND:READY] Emitiendo countdown para ronda ${nextRound}`);
        emitAuthoritativeState(gameId, 'countdown_start', {
          gameId,
          round: nextRound,
          countdownSeconds: 3,
          message: `Starting round ${nextRound} in 3 seconds...`
        });
        
        // PROGRAMAR EMISIÓN AUTOMÁTICA DE start_round DESPUÉS DEL COUNTDOWN
        // Esto asegura que el evento se emita incluso si el cliente no envía start_round_request
        console.log(`⏰ [ROUND:READY] Programando emisión automática de start_round después de 3 segundos para ronda ${nextRound}...`);
        const autoStartTimeout = setTimeout(() => {
          console.log(`⏰ [ROUND:READY] ===== TIMEOUT AUTOMÁTICO EJECUTADO =====`);
          const currentRoom = getGameRoom(gameId);
          const currentAuthority = getGameAuthority(gameId);
          
          console.log(`⏰ [ROUND:READY] Verificando estado antes de emitir automáticamente:`, {
            roomExists: !!currentRoom,
            currentRound: currentRoom?.round,
            expectedRound: nextRound,
            status: currentRoom?.status
          });
          
          // Verificar que aún estamos en el estado correcto
          if (!currentRoom) {
            console.error(`❌ [ROUND:READY] Sala no encontrada durante emisión automática`);
            return;
          }
          
          if (currentRoom.round !== nextRound) {
            console.log(`⚠️ [ROUND:READY] Ronda cambió durante el countdown (${currentRoom.round} vs ${nextRound}), cancelando emisión automática`);
            return;
          }
          
          // CRÍTICO: Siempre emitir si estamos en 'starting' o 'waiting'
          // Si el cliente ya envió start_round_request, el estado será 'in_progress' y no emitiremos
          if (currentRoom.status === 'starting' || currentRoom.status === 'waiting') {
            console.log(`🚀 [ROUND:READY] ===== INICIANDO RONDA ${nextRound} (IGUAL QUE RONDA 1) =====`);
            console.log(`🚀 [ROUND:READY] Emitiendo start_round automáticamente después del countdown para ronda ${nextRound}`);
            console.log(`🚀 [ROUND:READY] Estado actual: ${currentRoom.status}, cambiando a 'in_progress'`);
            
            // CREAR ESTADO AUTORITATIVO PARA LA RONDA (IGUAL QUE RONDA 1)
            const authority = createAuthoritativeRoundData(gameId, nextRound, 120000);
            console.log(`🚀 [ROUND:READY] Estado autoritativo creado (igual que ronda 1):`, {
              roundEndsAtMs: authority.roundEndsAtMs,
              roundTime: new Date(authority.roundEndsAtMs).toISOString(),
              roundId: authority.roundId,
              version: authority.version
            });
            
            // Verificar idempotencia para evitar duplicados (IGUAL QUE RONDA 1)
            const operationId = createOperationId(gameId, 'start_round', authority.roundId, authority.version);
            if (isOperationApplied(gameId, operationId)) {
              console.log(`🔄 [IDEMPOTENCY] start_round ya aplicado para ${gameId}, omitiendo`);
              return;
            }
            
            // Actualizar estado de la sala con datos autoritativos (IGUAL QUE RONDA 1)
            currentRoom.status = 'in_progress';
            currentRoom.roundTime = new Date(authority.roundEndsAtMs); // Mantener compatibilidad
            currentRoom.readyPlayers.clear();
            
            // CRÍTICO: Establecer estado del juego a PLAYING para que handleRoundEnd funcione (IGUAL QUE RONDA 1)
            setGameState(gameId, GAME_STATES.PLAYING, nextRound);
            console.log(`🎮 [ROUND:READY] Estado del juego establecido a PLAYING para ronda ${nextRound}`);
            
            // Marcar operación como aplicada (IGUAL QUE RONDA 1)
            markOperationApplied(gameId, operationId);
            
            // Timer automático para terminar la ronda cuando se acabe el tiempo (IGUAL QUE RONDA 1)
            // NOTA: setTimeout no puede ser async directamente, pero el callback puede serlo
            setTimeout(() => {
              (async () => {
                console.log(`⏰ [ROUND] Timer ended → preparing results for round=${nextRound} gameId=${gameId}`);
                
                // Verificar que la ronda aún esté activa
                const currentRoomCheck = getGameRoom(gameId);
                const currentAuthorityCheck = getGameAuthority(gameId);
                if (currentRoomCheck && currentRoomCheck.status === 'in_progress' && 
                    currentRoomCheck.round === nextRound && 
                    currentAuthorityCheck.roundId === authority.roundId) {
                  // Llamar directamente a la lógica de fin de ronda
                  await handleRoundEnd(gameId, currentRoomCheck.round);
                }
              })();
            }, 120000); // 120 segundos (2 minutos) - IGUAL QUE RONDA 1
            
            // EMITIR ESTADO AUTORITATIVO (IGUAL QUE RONDA 1)
            const startRoundPayload = {
              gameId,
              round: nextRound,
              winningIndustry: currentRoom.winningIndustry || 'Technology',
              roundTime: new Date(authority.roundEndsAtMs).toISOString(),
              roundEndsAtMs: authority.roundEndsAtMs, // CRÍTICO: Incluir explícitamente para que el timer funcione
              message: `Round ${nextRound} started!`
            };
            
            console.log(`🚀 [ROUND:READY] Emitiendo start_round con payload (igual que ronda 1):`, startRoundPayload);
            emitAuthoritativeState(gameId, 'start_round', startRoundPayload);
            
            // Track round start (IGUAL QUE RONDA 1)
            trackRoundStart(gameId, nextRound);
            
            console.log(`✅ [ROUND:READY] start_round autoritativo emitido exitosamente a juego ${gameId} (igual que ronda 1)`);
            
            // Sincronizar con Firestore al terminar la ronda (IGUAL QUE RONDA 1)
            // NOTA: syncGameToFirestore es async, pero estamos en un setTimeout, así que lo hacemos sin await
            syncGameToFirestore(gameId, currentRoom).catch(err => {
              console.error(`❌ [ROUND:READY] Error sincronizando con Firestore:`, err);
            });
            
            console.log(`✅ [ROUND:READY] Ronda ${nextRound} iniciada para juego ${gameId}`);
            console.log(`⏰ [ROUND:READY] ===== FIN TIMEOUT AUTOMÁTICO =====`);
          } else {
            console.log(`ℹ️ [ROUND:READY] Estado ya cambió a '${currentRoom.status}', emisión automática no necesaria`);
            console.log(`ℹ️ [ROUND:READY] Esto significa que el cliente ya envió start_round_request y se procesó`);
          }
        }, 3500); // 3.5 segundos (ligeramente después del countdown para dar tiempo al cliente y asegurar que se ejecute)
        
        // Guardar el timeout para poder cancelarlo si el cliente envía start_round_request antes
        room.autoStartTimeout = autoStartTimeout;
        
      } catch (error) {
        console.error(`❌ [ROUND:READY] Error en transición de ronda:`, error);
        console.error(`❌ [ROUND:READY] Error details:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        socket.emit('round:ready:error', { 
          message: 'Error en transición de ronda',
          error: error.message,
          details: error.stack
        });
      } finally {
        // DESACTIVAR PROTECCIÓN DE IDEMPOTENCIA
        room.roundTransitioning = false;
      }
    } else {
      // Notificar progreso
      socket.emit('round:ready:progress', {
        readyCount: room.players.filter(p => p.readyForNextRound).length,
        totalPlayers: room.players.length,
        round: room.round
      });
    }
  });

  // NUEVO: Cliente solicita inicio de ronda después del countdown
  socket.on('start_round_request', async ({ gameId, userId, round }) => {
    console.log(`🚀 [START_ROUND_REQUEST] ===== EVENTO RECIBIDO EN SERVIDOR =====`);
    console.log(`🚀 [START_ROUND_REQUEST] Cliente ${userId} solicita inicio de ronda ${round} en juego ${gameId}`);
    console.log(`🚀 [START_ROUND_REQUEST] Parámetros recibidos:`, { gameId, userId, round });
    console.log(`🚀 [START_ROUND_REQUEST] Socket ID: ${socket.id}`);
    
    const room = getGameRoom(gameId);
    console.log(`🚀 [START_ROUND_REQUEST] Sala encontrada:`, !!room);
    if (!room) {
      console.error(`❌ [START_ROUND_REQUEST] Sala no encontrada para ${gameId}`);
      console.error(`❌ [START_ROUND_REQUEST] Salas disponibles:`, Array.from(gameRooms.keys()));
      return;
    }
    
    console.log(`🚀 [START_ROUND_REQUEST] Estado de la sala:`, {
      round: room.round,
      roundSolicitada: round,
      status: room.status,
      playersCount: room.players?.length || 0
    });
    
    // Verificar que la ronda solicitada es correcta
    if (room.round !== round) {
      console.error(`❌ [START_ROUND_REQUEST] Ronda incorrecta: solicitada ${round}, actual ${room.round}`);
      console.error(`❌ [START_ROUND_REQUEST] Ignorando solicitud - ronda no coincide`);
      return;
    }
    
    // Verificar que estamos en estado válido para iniciar ronda
    // Permitir 'starting' (normal) o 'waiting' (si el estado cambió)
    const validStatesForStart = ['starting', 'waiting'];
    if (!validStatesForStart.includes(room.status)) {
      console.error(`❌ [START_ROUND_REQUEST] Estado incorrecto: ${room.status}, esperado 'starting' o 'waiting'`);
      console.error(`❌ [START_ROUND_REQUEST] Ignorando solicitud - estado no es válido para iniciar ronda`);
      console.error(`❌ [START_ROUND_REQUEST] Estado actual completo:`, {
        status: room.status,
        round: room.round,
        roundSolicitada: round
      });
      return;
    }
    
    // Si el estado es 'waiting', cambiarlo a 'starting' para continuar
    if (room.status === 'waiting') {
      console.log(`⚠️ [START_ROUND_REQUEST] Estado era 'waiting', cambiando a 'starting'`);
      room.status = 'starting';
    }
    
    console.log(`✅ [START_ROUND_REQUEST] Todas las validaciones pasaron - procesando inicio de ronda`);
    
    // Cancelar emisión automática si el cliente envió start_round_request
    if (room.autoStartTimeout) {
      console.log(`✅ [START_ROUND_REQUEST] Cancelando emisión automática - cliente envió request`);
      clearTimeout(room.autoStartTimeout);
      room.autoStartTimeout = null;
    }
    
    console.log(`🚀 [START_ROUND_REQUEST] ===== INICIANDO RONDA ${round} (IGUAL QUE RONDA 1) =====`);
    console.log(`🚀 [START_ROUND_REQUEST] Iniciando ronda ${round} para juego ${gameId}`);
    
    // CREAR ESTADO AUTORITATIVO PARA LA RONDA (IGUAL QUE RONDA 1)
    const authority = createAuthoritativeRoundData(gameId, round, 120000);
    console.log(`🎯 [START_ROUND_REQUEST] Estado autoritativo creado (igual que ronda 1):`, {
      round: authority.round,
      roundEndsAtMs: authority.roundEndsAtMs,
      roundTime: new Date(authority.roundEndsAtMs).toISOString(),
      roundId: authority.roundId,
      version: authority.version
    });
    
    // Verificar idempotencia para evitar duplicados (IGUAL QUE RONDA 1)
    const operationId = createOperationId(gameId, 'start_round', authority.roundId, authority.version);
    if (isOperationApplied(gameId, operationId)) {
      console.log(`🔄 [IDEMPOTENCY] start_round ya aplicado para ${gameId}, omitiendo`);
      return;
    }
    
    // Actualizar estado de la sala con datos autoritativos (IGUAL QUE RONDA 1)
    room.status = 'in_progress';
    room.roundTime = new Date(authority.roundEndsAtMs); // Mantener compatibilidad
    room.readyPlayers.clear();
    
    // CRÍTICO: Establecer estado del juego a PLAYING para que handleRoundEnd funcione (IGUAL QUE RONDA 1)
    setGameState(gameId, GAME_STATES.PLAYING, round);
    console.log(`🎮 [START_ROUND_REQUEST] Estado del juego establecido a PLAYING para ronda ${round}`);
    
    // Marcar operación como aplicada (IGUAL QUE RONDA 1)
    markOperationApplied(gameId, operationId);
    
    // Timer automático para terminar la ronda cuando se acabe el tiempo (IGUAL QUE RONDA 1)
    setTimeout(async () => {
      console.log(`⏰ [ROUND] Timer ended → preparing results for round=${round} gameId=${gameId}`);
      
      // Verificar que la ronda aún esté activa
      const currentRoom = getGameRoom(gameId);
      const currentAuthority = getGameAuthority(gameId);
      if (currentRoom && currentRoom.status === 'in_progress' && 
          currentRoom.round === round && 
          currentAuthority.roundId === authority.roundId) {
        // Llamar directamente a la lógica de fin de ronda
        await handleRoundEnd(gameId, currentRoom.round);
      }
    }, 120000); // 120 segundos (2 minutos) - IGUAL QUE RONDA 1
    
    // EMITIR ESTADO AUTORITATIVO DE INICIO DE RONDA
    console.log(`📡 [START_ROUND_REQUEST] Emitiendo start_round para ronda ${round}`);
    console.log(`📡 [START_ROUND_REQUEST] Datos que se enviarán (igual que ronda 1):`, {
      gameId,
      round: round,
      roundEndsAtMs: authority.roundEndsAtMs,
      roundTime: new Date(authority.roundEndsAtMs).toISOString(),
      winningIndustry: room.winningIndustry || 'Technology',
      roundId: authority.roundId,
      version: authority.version
    });
    
    // EMITIR ESTADO AUTORITATIVO (IGUAL QUE RONDA 1)
    const startRoundPayload = {
      gameId,
      round: round,
      winningIndustry: room.winningIndustry || 'Technology',
      roundTime: new Date(authority.roundEndsAtMs).toISOString(), // FECHA DE FIN (correcto)
      roundEndsAtMs: authority.roundEndsAtMs, // CRÍTICO: Incluir explícitamente para que el timer funcione
      message: `Round ${round} started!`
    };
    
    // Verificar que el socket está en la sala antes de emitir
    const socketRoom = io.sockets.adapter.rooms.get(gameId);
    const clientCount = socketRoom ? socketRoom.size : 0;
    const socketInRoom = socketRoom && socketRoom.has(socket.id);
    
    console.log(`🔍 [START_ROUND_REQUEST] Verificación de sala:`, {
      gameId,
      clientCount,
      socketInRoom,
      socketId: socket.id
    });
    
    if (!socketInRoom) {
      console.error(`❌ [START_ROUND_REQUEST] Socket ${socket.id} NO está en la sala ${gameId}`);
      console.error(`❌ [START_ROUND_REQUEST] Re-uniendo socket a la sala...`);
      socket.join(gameId);
      console.log(`✅ [START_ROUND_REQUEST] Socket re-unido a la sala`);
    }
    
    console.log(`🚀 [START_ROUND_REQUEST] Emitiendo start_round con payload (igual que ronda 1):`, startRoundPayload);
    emitAuthoritativeState(gameId, 'start_round', startRoundPayload);
    
    // Track round start (IGUAL QUE RONDA 1)
    trackRoundStart(gameId, round);
    
    console.log(`✅ [START_ROUND_REQUEST] start_round autoritativo emitido exitosamente a juego ${gameId} (igual que ronda 1)`);
    
    // Sincronizar con Firestore al terminar la ronda (IGUAL QUE RONDA 1)
    await syncGameToFirestore(gameId, room);
    
    console.log(`✅ [START_ROUND_REQUEST] Ronda ${round} iniciada para juego ${gameId}`);
    
    // Verificar que el evento se emitió correctamente
    const socketRoomAfterEmit = io.sockets.adapter.rooms.get(gameId);
    console.log(`✅ [START_ROUND_REQUEST] Sala después de emitir:`, {
      clientCount: socketRoomAfterEmit ? socketRoomAfterEmit.size : 0,
      socketInRoom: socketRoomAfterEmit && socketRoomAfterEmit.has(socket.id)
    });
  });

  // LEGACY: Mantener compatibilidad con el sistema anterior
  socket.on('player_ready_next_round', async ({ gameId, userId }) => {
    console.log(`⏭️ [LEGACY] Jugador ${userId} listo para siguiente ronda en juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    
    // Agregar a la lista de jugadores listos
    room.readyPlayers.add(userId);
    
    // Verificar si todos están listos
    if (areAllPlayersReady(gameId)) {
      console.log(`🎮 Todos los jugadores listos para siguiente ronda en juego ${gameId}`);
      
      // Incrementar ronda
      room.round += 1;
      
      // Verificar si el juego ha terminado (3 rondas)
      if (room.round > 3) {
        room.status = 'completed';
        emitToGame(gameId, 'game_completed', {
          round: room.round - 1,
          message: 'Game completed!'
        });
        return;
      }
      
      // Cambiar estado a 'starting' para nueva ronda
      room.status = 'starting';
      room.readyPlayers.clear();
      
      // CRÍTICO: Resetear winningIndustry para la nueva ronda (aleatorio)
      const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
      room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
      console.log(`🏭 [PLAYER_READY_NEXT_ROUND] winningIndustry reseteado para ronda ${room.round}: ${room.winningIndustry}`);
      
      // Emitir nueva ronda
      emitToGame(gameId, 'new_round', {
        gameId,
        status: 'starting',
        round: room.round,
        roundTimeISO: new Date(Date.now() + 3000).toISOString(), // 3 segundos de preparación
        winningIndustry: room.winningIndustry, // CRÍTICO: Incluir winningIndustry reseteado
        roundMeta: {
          totalRounds: 3,
          currentRound: room.round
        }
      });
      
      // Sincronizar con Firestore
      await syncGameToFirestore(gameId, room);
      
      console.log(`✅ Nueva ronda ${room.round} iniciada para juego ${gameId}`);
    } else {
      // Notificar progreso
      socket.emit('waiting_players_next_round', {
        readyCount: room.readyPlayers.size,
        totalPlayers: room.players.length
      });
    }
  });

  // FUNCIÓN PRINCIPAL: MANEJAR FIN DE RONDA (ORDEN CORRECTO)
  const handleRoundEnd = async (gameId, round) => {
    console.log(`🏁 [ROUND] ===== HANDLE ROUND END INICIADO =====`);
    console.log(`🏁 [ROUND] Timer ended → preparing results for round=${round} gameId=${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error(`❌ [ROUND] Sala no encontrada en handleRoundEnd para ${gameId}`);
      return;
    }
    
    console.log(`🏁 [ROUND] Sala encontrada: ${gameId}, ronda: ${room.round}, estado: ${room.status}`);
    console.log(`🏁 [ROUND] room.roundTime:`, room.roundTime);
    console.log(`🏁 [ROUND] room.players.length:`, room.players?.length);
    
    // IDEMPOTENCIA: Verificar si las recompensas ya fueron asignadas
    const rewardsKey = `${gameId}:${round}`;
    if (rewardsCommitted.has(rewardsKey)) {
      console.log(`[SERVER] rewards already committed for round=${round} → skip`);
      console.log(`🏁 [ROUND] ===== HANDLE ROUND END FIN (YA PROCESADO) =====`);
      return;
    }
    
    // Verificar estado actual y adquirir lock
    const gameState = getGameState(gameId);
    console.log(`🏁 [ROUND] Estado actual del juego: ${gameState.state}, esperado: ${GAME_STATES.PLAYING}`);
    console.log(`🏁 [ROUND] gameState.round: ${gameState.round}, round solicitado: ${round}`);
    if (gameState.state !== GAME_STATES.PLAYING) {
      console.log(`⚠️ [ROUND] Estado actual ${gameState.state} no permite transición a ROUND_CALCULATING`);
      console.log(`⚠️ [ROUND] Estado esperado: ${GAME_STATES.PLAYING}`);
      console.log(`🏁 [ROUND] ===== HANDLE ROUND END FIN (ESTADO INCORRECTO) =====`);
      return;
    }
    
    // Adquirir lock para esta ronda
    if (!acquireRoundLock(gameId, round)) {
      console.log(`⚠️ [ROUND] Lock ya adquirido para ${gameId}:${round}`);
      console.log(`🏁 [ROUND] ===== HANDLE ROUND END FIN (LOCK YA ADQUIRIDO) =====`);
      return;
    }
    
    try {
      console.log(`🏁 [ROUND] Iniciando try block para ${gameId}`);
      console.log(`🏁 [ROUND] Lock adquirido exitosamente para ${gameId}:${round}`);
      
      // Transición a ROUND_CALCULATING
      console.log(`🏁 [ROUND] ===== TRANSICIÓN A ROUND_CALCULATING =====`);
      console.log(`🏁 [ROUND] Estado anterior: ${gameState.state}, nuevo: ${GAME_STATES.ROUND_CALCULATING}`);
      setGameState(gameId, GAME_STATES.ROUND_CALCULATING, round);
      room.status = 'roundEnd';
      room.readyPlayers.clear();
      console.log(`🏁 [ROUND] Estado actualizado a ROUND_CALCULATING para ${gameId}`);
      console.log(`🏁 [ROUND] room.status actualizado a: ${room.status}`);
    
      // Emitir ROUND_CALCULATING para mostrar loader
      console.log(`🔄 [ROUND] ===== EMITIENDO ROUND_CALCULATING =====`);
      console.log(`🔄 [ROUND] Emitiendo ROUND_CALCULATING para ronda ${round}`);
      console.log(`🔄 [ROUND] gameId: ${gameId}`);
      console.log(`🔄 [ROUND] Sala tiene ${room.players?.length || 0} jugadores`);
      const socketRoom = io.sockets.adapter.rooms.get(gameId);
      console.log(`🔄 [ROUND] Clientes en sala: ${socketRoom ? socketRoom.size : 0}`);
      emitToGame(gameId, 'ROUND_CALCULATING', { round: round });
      console.log(`✅ [ROUND] ROUND_CALCULATING emitido exitosamente para ${gameId}`);
      console.log(`🔄 [ROUND] ===== FIN EMISIÓN ROUND_CALCULATING =====`);
      
      // GENERAR Y EMITIR ROUND_META CON ESTADO AUTORITATIVO
      const winningIndustry = room.winningIndustry || 'Technology';
      const wasteRewardApplied = Math.floor(Math.random() * 41) + 30; // 30..70
      const roundSeed = `${gameId}:${round}:${Date.now()}`;
      
      const roundMeta = {
        round: round,
        winningIndustry: winningIndustry,
        wasteRewardApplied: wasteRewardApplied,
        roundSeed: roundSeed
      };
      
      // Guardar en room para uso posterior
      room.roundMeta = roundMeta;
      
      console.log(`🎯 [ROUND_META] Generando meta de ronda:`, roundMeta);
      emitAuthoritativeState(gameId, 'round_meta', roundMeta);
      console.log(`🎯 [ROUND_META] round_meta autoritativo emitido para ${gameId}`);
      
      // CÁLCULO AUTORITATIVO DE RECOMPENSAS
      console.log(`💰 [ROUND] Iniciando cálculo autoritativo...`);
      const payload = await calculateRoundRewards(gameId, round);
      console.log(`[ROUND] winners.count=${payload.mining?.length || 0} for round=${round}`);
      console.log(`[ROUND] winningIndustry=${payload.winningIndustry || 'null'} for round=${round}`);
      console.log(`🏁 [ROUND] Cálculo de recompensas completado para ${gameId}`);
      
      // Transición a ROUND_END
      console.log(`🏁 [ROUND] Transición a ROUND_END para ${gameId}`);
      setGameState(gameId, GAME_STATES.ROUND_END, round);
      
      // Emitir game_status con estado roundEnd para que el cliente actualice el estado CON ESTADO AUTORITATIVO
      console.log(`📡 [ROUND] Emitiendo game_status con estado roundEnd`);
      console.log(`[ROUND] EMIT game_status { status:"roundEnd", round:${round} }`);
      emitAuthoritativeState(gameId, 'game_status', { 
        status: 'roundEnd',
        round: round,
        message: 'Ronda terminada por countdown'
      });
      console.log(`🏁 [ROUND] game_status autoritativo emitido para ${gameId}`);
      
      // Emitir ROUND_END con payload completo
      console.log(`📡 [ROUND] Emitiendo ROUND_END con payload completo`);
      console.log(`[ROUND] EMIT ROUND_END { round:${round}, winningIndustry:${payload.winningIndustry}, gameId:${gameId} }`);
      emitToGame(gameId, 'ROUND_END', payload);
      console.log(`🏁 [ROUND] ROUND_END emitido para ${gameId}`);

      // Emitir rewards_assigned para compatibilidad legacy (INCONDICIONAL)
      console.log(`💰 [ROUND] winners.count=${payload.mining?.length || 0} for round=${round}`);
      console.log(`🏭 [ROUND] winningIndustry=${payload.winningIndustry || 'null'} for round=${round}`);
      console.log(`💰 [ROUND] Emitiendo rewards_assigned para ronda ${round}`);
      const rewardsPayload = {
        gameId: gameId,
        round: round,
        rewards: payload.mining || [],
        winningIndustry: payload.winningIndustry || null,
        waste: payload.waste || null
      };
      emitToGame(gameId, 'rewards_assigned', rewardsPayload);
      console.log(`[ROUND] EMIT rewards_assigned { round:${round}, users:${payload.mining?.length || 0} }`);
      console.log(`✅ [ROUND] rewards_assigned emitido - ${payload.mining?.length || 0} ganadores de minado`);
      console.log(`🏁 [ROUND] rewards_assigned emitido para ${gameId}`);
      
      // Emitir round_ended con estado autoritativo
      console.log(`📡 [ROUND] Emitiendo round_ended con estado autoritativo`);
      emitAuthoritativeState(gameId, 'round_ended', {
        round: round,
        gameId: gameId,
        rewards: payload.mining || [],
        winningIndustry: payload.winningIndustry || null,
        waste: payload.waste || null
      });
      console.log(`🏁 [ROUND] round_ended autoritativo emitido para ${gameId}`);
      
      // NOTA: Los inventarios ya fueron persistidos en calculateRoundRewards después de aplicar rewards
      // syncGameToFirestore solo sincroniza el estado del juego, no los inventarios
      await syncGameToFirestore(gameId, room);
      console.log(`[ROUND] firestore commit done for round=${round}`);
      console.log(`[SERVER] firestore batch commit OK`);
      
      // Marcar recompensas como asignadas para idempotencia
      rewardsCommitted.set(rewardsKey, true);
      console.log(`[SERVER] rewards committed for round=${round}`);
      
    } catch (error) {
      console.error(`❌ [ROUND] Error en cálculo autoritativo:`, error);
      // En caso de error, liberar lock y mantener estado
      releaseRoundLock(gameId, round);
    } finally {
      // Liberar lock
      releaseRoundLock(gameId, round);
    }
  };

  // NUEVA MÁQUINA DE ESTADOS: Fin de ronda robusto
  socket.on('round_ended', async ({ gameId, userId, round }) => {
    console.log(`🏁 [ROUND_ENDED] ===== EVENTO RECIBIDO DEL CLIENTE =====`);
    console.log(`🏁 [ROUND_ENDED] Ronda terminada por jugador ${userId} en juego ${gameId}`);
    console.log(`🏁 [ROUND_ENDED] round recibido: ${round}`);
    console.log(`🏁 [ROUND_ENDED] socket.id: ${socket.id}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error(`❌ [ROUND_ENDED] Sala no encontrada para ${gameId}`);
      console.log(`🏁 [ROUND_ENDED] ===== FIN EVENTO (SALA NO ENCONTRADA) =====`);
      return;
    }
    
    const currentRound = (round && round > 0) ? round : room.round;
    console.log(`🏁 [ROUND_ENDED] Ronda actual de sala: ${room.round}`);
    console.log(`🏁 [ROUND_ENDED] Ronda a procesar: ${currentRound}`);
    console.log(`🏁 [ROUND_ENDED] Estado de sala: ${room.status}`);
    console.log(`🏁 [ROUND_ENDED] room.roundTime:`, room.roundTime);
    
    const gameState = getGameState(gameId);
    console.log(`🏁 [ROUND_ENDED] Estado del juego: ${gameState.state}`);
    console.log(`🏁 [ROUND_ENDED] gameState.round: ${gameState.round}`);
    
    // Llamar a la función centralizada de manejo de fin de ronda
    console.log(`🏁 [ROUND_ENDED] Llamando a handleRoundEnd para ${gameId}, ronda ${currentRound}`);
    await handleRoundEnd(gameId, currentRound);
    console.log(`🏁 [ROUND_ENDED] handleRoundEnd completado para ${gameId}`);
    console.log(`🏁 [ROUND_ENDED] ===== FIN EVENTO =====`);
  });
  // Asignar recompensas de ronda (DEPRECATED - ahora se procesa en round_ended)
  socket.on('assign_round_rewards', async ({ gameId }) => {
    console.log(`💰 Evento assign_round_rewards recibido para juego ${gameId} - DEPRECATED`);
    console.log(`💰 Las recompensas ya se procesan automáticamente en round_ended`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error('❌ Sala no encontrada:', gameId);
      return;
    }

    // Verificar si las recompensas ya fueron asignadas
    if (room.rewardsAssigned) {
      console.log('✅ Las recompensas ya fueron asignadas automáticamente en round_ended');
      
      // Re-enviar los datos actualizados por si acaso
      const gameRanking = playerRankings.get(gameId) || new Map();
      const productsCountByPlayer = getProductsCountByPlayer(gameId);
      const playerData = room.players.map(player => {
        const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
        const inventory = getPlayerInventory(gameId, player.userId);
        const productsCount = productsCountByPlayer.get(player.userId) || 0;
        return {
          userId: player.userId,
          userName: player.userName,
          rockCoins: inventory.rockCoins,
          waste: inventory.waste,
          blocksMined: productsCount,
          totalRewards: ranking.totalRewards
        };
      });
      
      console.log(`🏆 Re-enviando player_rankings_data actualizado:`, playerData);
      emitToGame(gameId, 'player_rankings_data', { 
        gameId, 
        playerData 
      });
      
      // Re-enviar inventarios individuales
      for (const player of room.players) {
        const inventory = getPlayerInventory(gameId, player.userId);
        const playerSocketId = playerSockets.get(player.userId);
        
        if (playerSocketId) {
          console.log(`📦 Re-enviando inventario actualizado a ${player.userName}:`, inventory);
          io.to(playerSocketId).emit('inventory_data', {
            gameId,
            userId: player.userId,
            inventory: inventory
          });
        }
      }
    } else {
      console.log('⚠️ Las recompensas no han sido asignadas aún - esto no debería pasar');
    }

  });

  // Nuevo problema de minado generado (legacy - mantener por compatibilidad)
  socket.on('new_mining_problem', ({ gameId, blockId, problemData }) => {
    console.log(`⛏️ Nuevo problema de minado generado (legacy) en juego ${gameId}, bloque ${blockId}`);
    
    const room = getGameRoom(gameId);
    
    // Notificar a todos los jugadores en el juego
    emitToGame(gameId, 'new_mining_problem', {
      blockId,
      problemData: {
        ...problemData,
        round: room.round || 1
      },
      round: room.round || 1,
      timestamp: Date.now()
    });
    
    console.log(`✅ Problema de minado notificado a todos los jugadores del juego ${gameId}`);
  });

  // Limpiar miningQueue al salir del minado
  socket.on('clear_mining_queue', ({ gameId, userId }) => {
    console.log(`🧹 Limpiando miningQueue para ${userId} en juego ${gameId}`);
    
    const inventory = getPlayerInventory(gameId, userId);
    if (inventory) {
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        ...inventory,
        miningQueue: 0
      });
      
      console.log(`🧹 miningQueue limpiado para ${userId}: ${inventory.miningQueue} -> 0`);
      
      // Enviar inventario actualizado al jugador
      socket.emit('transaction_success', {
        type: 'clear_mining_queue',
        inventory: updatedInventory
      });
    }
  });

  // NUEVO SISTEMA: Usuario abre un problema de minado
  socket.on('mining:problem-open', ({ blockId, userId }) => {
    console.log(`[MINING][OPEN] Cliente solicita abrir problema: blockId=${blockId}, userId=${userId}`);
    
    if (!blockId || !userId) {
      console.error('❌ Datos incompletos para mining:problem-open');
      socket.emit('mining:problem-open:error', { message: 'Datos incompletos' });
      return;
    }
    
    // Registrar el viewStart y responder con ACK
    const result = handleMiningProblemOpen(blockId, userId);
    
    // Enviar ACK con tiempo del servidor para sincronización
    socket.emit('mining:problem-open:ack', {
      ...result,
      serverTime: Date.now() // Tiempo del servidor para sincronización
    });
  });

  // NUEVO SISTEMA: Sincronización de cronómetro visual
  socket.on('mining:sync-timer', ({ blockId, viewStart, serverTime, clientTime }) => {
    console.log(`[MINING][SYNC] Cliente solicita sincronización: blockId=${blockId}, viewStart=${viewStart}`);
    
    if (!blockId || !viewStart) {
      console.error('❌ Datos incompletos para mining:sync-timer');
      return;
    }
    
    // Responder con ACK de sincronización
    socket.emit('mining:sync-timer:ack', {
      blockId,
      viewStart,
      serverTime: Date.now(),
      clientTime: Date.now()
    });
  });

  // NUEVO SISTEMA: Usuario envía respuesta de minado
  socket.on('mining:submit', ({ blockId, userId, response, userName, responseTime }) => {
    console.log(`[MINING][SUBMIT] Cliente envía respuesta: blockId=${blockId}, userId=${userId}, response=${response}, responseTime=${responseTime}`);
    
    if (!blockId || !userId || response === undefined) {
      console.error('❌ Datos incompletos para mining:submit');
      socket.emit('mining:submit:error', { message: 'Datos incompletos' });
      return;
    }
    
    // Procesar la respuesta con tiempo del cliente
    const result = handleMiningSubmit(blockId, userId, response, userName, responseTime);
    
    if (result.success) {
      socket.emit('mining:submit:confirmed', result);
      
      // Si hay un ganador y el bloque está completado, guardar el bloque minado
      console.log(`🔍 DEBUG: result.winner:`, result.winner);
      console.log(`🔍 DEBUG: result.isCompleted:`, result.isCompleted);
      console.log(`🔍 DEBUG: result.state:`, result.state);
      console.log(`🔍 DEBUG: result.standings:`, result.standings);
      
      if (result.winner) {
        console.log(`🏆 Bloque con ganador, actualizando minedBlocks`);
        
        // Obtener gameId del blockId (formato: gameId-timestamp)
        const gameId = blockId.split('-')[0];
      
      // Verificar si el bloque ya fue procesado
      const existingBlocks = getMinedBlocks(gameId);
      const blockExists = existingBlocks.find(block => block.id === blockId);
      
        // Siempre actualizar el bloque (crear nuevo o actualizar existente)
        const room = getGameRoom(gameId);
          const minedBlock = {
            id: blockId,
          winner: {
            userId: result.winner.userId,
            userName: result.winner.userName,
            response: result.winner.response,
            isCorrect: result.winner.isCorrect,
            elapsed: result.winner.elapsed,
            responseTime: result.winner.elapsed, // Para compatibilidad con BlockchainComponent
            timestamp: result.winner.timestamp
          },
          round: room.round, // Usar la ronda actual
            timestamp: Date.now(),
          responses: result.standings
          };
        
        if (!blockExists) {
          console.log(`⛓️ [CREANDO] Nuevo bloque:`, minedBlock);
          addMinedBlock(gameId, minedBlock);
        } else {
          console.log(`⛓️ [ACTUALIZANDO] Bloque existente con nuevo ganador:`, minedBlock);
          // Actualizar bloque existente
          const blocks = getMinedBlocks(gameId);
          const blockIndex = blocks.findIndex(block => block.id === blockId);
          if (blockIndex !== -1) {
            blocks[blockIndex] = minedBlock;
          }
        }
        
        console.log(`⛓️ Bloque guardado en minedBlocks:`, minedBlock);
          
          // Notificar a todos los clientes sobre los datos actualizados
        const blocksToSend = getMinedBlocks(gameId);
        console.log(`📡 [EMIT] Preparando mined_blocks_data para gameId=${gameId}:`, blocksToSend);
        console.log(`📡 [EMIT] Cantidad de bloques a enviar:`, blocksToSend.length);
        
          emitToGame(gameId, 'mined_blocks_data', { 
            gameId, 
          blocks: blocksToSend 
        });
        
        console.log(`📡 [EMIT] mined_blocks_data enviado a todos los clientes del juego ${gameId}`);
        }
      } else {
      socket.emit('mining:submit:error', { message: result.message });
    }
  });

  // NUEVO SISTEMA: Cliente solicita problemas pendientes
  socket.on('mining:pending-count', ({ userId }) => {
    console.log(`[MINING][PENDING] Cliente solicita problemas pendientes: userId=${userId}`);
    
    if (!userId) {
      console.error('❌ userId requerido para mining:pending-count');
      socket.emit('mining:pending-count:error', { message: 'userId requerido' });
      return;
    }
    
    const pendingCount = getPendingCountForUser(userId);
    console.log(`[MINING][PENDING] Enviando resultado: userId=${userId}, pendingCount=${pendingCount}`);
    socket.emit('mining:pending-count:result', { userId, pendingCount });
  });

  // SISTEMA ANTIGUO (DESHABILITADO): Respuesta de minado (legacy)
  // DESHABILITADO para evitar duplicación de recompensas - ahora se procesan solo en round_ended
  socket.on('submit_mining_response', ({ gameId, blockId, userId, response, responseTime, isCorrect, userName }) => {
    console.log(`⚠️ [LEGACY DISABLED] submit_mining_response recibido pero IGNORADO para evitar duplicación`);
    console.log(`⚠️ [LEGACY DISABLED] Las recompensas de minado ahora se procesan solo en round_ended`);
    
    // Solo confirmar al jugador que envió la respuesta, sin procesar recompensas
    socket.emit('mining_response_confirmed', { 
      success: true, 
      message: 'Respuesta registrada (recompensas se procesarán al final de ronda)' 
    });
  });

  // Compra/Venta de productos
  socket.on('product_transaction', async ({ gameId, userId, product, transactionType, transformedProduct, wasteExtra }) => {
    console.log(`🛒 [TRANSACTION] Transacción de producto: ${transactionType} por ${userId} en ${gameId}`);
    console.log(`🛒 [TRANSACTION] Datos recibidos:`, {
      gameId,
      userId,
      product: product ? { id: product.id, type: product.type } : null,
      transactionType,
      hasTransformedProduct: !!transformedProduct,
      wasteExtra
    });
    
    const inventory = getPlayerInventory(gameId, userId);
    
    if (transactionType === 'purchase') {
      // Verificar si tiene suficientes RockCoins
      if (inventory.rockCoins < product.currentPrice) {
        socket.emit('transaction_failed', { 
          reason: 'insufficient_funds',
          message: 'No tienes suficientes RockCoins'
        });
        return;
      }
      
      // Procesar compra
      const productsArray = Array.isArray(inventory.products) ? inventory.products : [];
      const updatedProducts = [...productsArray, product];
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: updatedProducts,
        rockCoins: inventory.rockCoins - product.currentPrice,
        waste: inventory.waste + product.waste,
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ [PURCHASE] Compra procesada para ${userId}:`, {
        productsCount: updatedInventory.products.length,
        products: updatedInventory.products,
        rockCoins: updatedInventory.rockCoins,
        waste: updatedInventory.waste
      });
      
      // ELIMINAR PRODUCTO DEL MERCADO
      const room = getGameRoom(gameId);
      if (room && room.productList) {
        const productIndex = room.productList.findIndex(p => p.id === product.id);
        if (productIndex !== -1) {
          room.productList.splice(productIndex, 1);
          console.log(`🗑️ Producto eliminado del mercado: ${product.id} (${product.type})`);
          
          // Emitir actualización de productos a todos los jugadores
          emitToGame(gameId, 'product_list_updated', {
            gameId,
            productList: room.productList
          });
          console.log(`📡 Lista de productos actualizada enviada a todos los jugadores`);
        }
      }
      
      // Notificar al jugador con transaction_success Y inventory_data
      console.log(`📡 Enviando transaction_success a ${userId}:`, {
        type: 'purchase',
        inventory: updatedInventory,
        product: product
      });
      socket.emit('transaction_success', {
        type: 'purchase',
        inventory: updatedInventory,
        product: product,
        userId: userId // IMPORTANTE: Incluir userId para que el listener pueda validar
      });
      
      // CRÍTICO: También enviar inventory_data para asegurar sincronización en frontend
      const playerSocketId = playerSockets.get(userId);
      if (playerSocketId) {
        console.log(`📦 [TRANSACTION] Enviando inventory_data actualizado a ${userId}:`, {
          rockCoins: updatedInventory.rockCoins,
          waste: updatedInventory.waste,
          products: updatedInventory.products?.length || 0
        });
        io.to(playerSocketId).emit('inventory_data', {
          gameId,
          userId: userId,
          inventory: {
            rockCoins: updatedInventory.rockCoins,
            waste: updatedInventory.waste,
            products: updatedInventory.products || [],
            miningQueue: updatedInventory.miningQueue || 0
          }
        });
      } else {
        console.warn(`⚠️ [TRANSACTION] No se encontró socketId para ${userId}, no se puede enviar inventory_data`);
      }
      
      // Actualizar ranking y notificar a todos
      updateAndEmitPlayerRankings(gameId);
      
      // Generar nuevo problema de minado después de la compra
      const transactionDetails = {
        productId: product.id,
        type: 'purchase',
        userId: userId,
        productType: product.type,
        marbleType: product.marbleType,
        price: product.currentPrice,
        waste: product.waste
      };
      
      const miningProblem = generateMiningProblem(gameId, transactionDetails);
      
      // Notificar a todos los jugadores del juego
      const roomPurchase = getGameRoom(gameId);
      console.log('📡 Enviando problema de minado (COMPRA) con timestamp:', {
        blockId: miningProblem.id,
        miningStartTime: miningProblem.activeProblem.miningStartTime,
        timestamp: miningProblem.timestamp,
        round: roomPurchase.round || 1
      });
      
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: {
          ...miningProblem.activeProblem,
          round: roomPurchase.round || 1
        },
        round: roomPurchase.round || 1,
        timestamp: miningProblem.timestamp
      });
      
      // Notificar a todos los jugadores sobre problemas pendientes actualizados
      const gameRoom = getGameRoom(gameId);
      if (gameRoom && gameRoom.players) {
        gameRoom.players.forEach(player => {
          const pendingCount = getPendingCountForUser(player.userId);
          io.to(player.socketId).emit('mining:pending-count:result', {
            userId: player.userId,
            pendingCount
          });
        });
      }
      
    } else if (transactionType === 'sell') {
      console.log(`💰 [SELL] Iniciando venta para ${userId}`);
      console.log(`💰 [SELL] Producto a vender:`, product);
      console.log(`💰 [SELL] Inventario actual:`, inventory);
      
      // Verificar si tiene el producto
      const productsArray = Array.isArray(inventory.products) ? inventory.products : [];
      const productIndex = productsArray.findIndex(p => p.id === product.id);
      
      if (productIndex === -1) {
        console.error(`❌ [SELL] Producto ${product.id} no encontrado en inventario`);
        console.error(`❌ [SELL] Productos en inventario:`, productsArray.map(p => ({ id: p.id, type: p.type })));
        socket.emit('transaction_failed', { 
          reason: 'product_not_found',
          message: 'No tienes este producto'
        });
        return;
      }
      
      // Procesar venta
      const updatedProducts = [...productsArray];
      updatedProducts.splice(productIndex, 1);
      
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: updatedProducts,
        rockCoins: inventory.rockCoins + product.currentPrice,
        waste: Math.max(0, inventory.waste - product.waste),
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ [SELL] Venta procesada para ${userId}:`, {
        productsCount: updatedInventory.products.length,
        products: updatedInventory.products,
        rockCoins: updatedInventory.rockCoins,
        waste: updatedInventory.waste
      });
      
      // Notificar al jugador con transaction_success Y inventory_data
      console.log(`📡 [SELL] Enviando transaction_success a ${userId}:`, {
        type: 'sell',
        inventory: updatedInventory,
        product: product
      });
      socket.emit('transaction_success', {
        type: 'sell',
        inventory: updatedInventory,
        product: product,
        userId: userId // IMPORTANTE: Incluir userId para que el listener pueda validar
      });
      
      // CRÍTICO: También enviar inventory_data para asegurar sincronización en frontend
      const playerSocketId = playerSockets.get(userId);
      if (playerSocketId) {
        console.log(`📦 [SELL] Enviando inventory_data actualizado a ${userId}:`, {
          rockCoins: updatedInventory.rockCoins,
          waste: updatedInventory.waste,
          products: updatedInventory.products?.length || 0
        });
        io.to(playerSocketId).emit('inventory_data', {
          gameId,
          userId: userId,
          inventory: {
            rockCoins: updatedInventory.rockCoins,
            waste: updatedInventory.waste,
            products: updatedInventory.products || [],
            miningQueue: updatedInventory.miningQueue || 0
          }
        });
      } else {
        console.warn(`⚠️ [SELL] No se encontró socketId para ${userId}, no se puede enviar inventory_data`);
      }
      
      // Actualizar ranking y notificar a todos
      updateAndEmitPlayerRankings(gameId);
      
      // Generar nuevo problema de minado después de la venta
      const transactionDetails = {
        productId: product.id,
        type: 'sell',
        userId: userId,
        productType: product.type,
        marbleType: product.marbleType,
        price: product.currentPrice,
        waste: product.waste
      };
      
      const miningProblem = generateMiningProblem(gameId, transactionDetails);
      
      // Notificar a todos los jugadores del juego
      const room = getGameRoom(gameId);
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: {
          ...miningProblem.activeProblem,
          round: room.round || 1 // AÑADIR: Ronda actual al problema
        },
        round: room.round || 1, // AÑADIR: Ronda actual
        timestamp: miningProblem.timestamp
      });
      
      // Notificar a todos los jugadores sobre problemas pendientes actualizados
      const gameRoom = getGameRoom(gameId);
      if (gameRoom && gameRoom.players) {
        gameRoom.players.forEach(player => {
          const pendingCount = getPendingCountForUser(player.userId);
          io.to(player.socketId).emit('mining:pending-count:result', {
            userId: player.userId,
            pendingCount
          });
        });
      }
    } else if (transactionType === 'transform') {
      console.log(`🔄 [TRANSFORM] Iniciando transformación para ${userId}`);
      console.log(`🔄 [TRANSFORM] Producto original:`, product);
      console.log(`🔄 [TRANSFORM] Producto transformado:`, transformedProduct);
      console.log(`🔄 [TRANSFORM] wasteExtra:`, wasteExtra);
      console.log(`🔄 [TRANSFORM] Inventario actual:`, inventory);
      
      // VALIDACIÓN: Verificar que transformedProduct y wasteExtra están presentes
      if (!transformedProduct) {
        console.error(`❌ [TRANSFORM] transformedProduct no proporcionado`);
        socket.emit('transaction_failed', { 
          reason: 'invalid_data',
          message: 'Datos de transformación incompletos'
        });
        return;
      }
      
      if (wasteExtra === undefined || wasteExtra === null) {
        console.error(`❌ [TRANSFORM] wasteExtra no proporcionado`);
        socket.emit('transaction_failed', { 
          reason: 'invalid_data',
          message: 'Datos de transformación incompletos'
        });
        return;
      }
      
      // Verificar si tiene el producto
      const productsArray = Array.isArray(inventory.products) ? inventory.products : [];
      const productIndex = productsArray.findIndex(p => p.id === product.id);
      
      if (productIndex === -1) {
        console.error(`❌ [TRANSFORM] Producto ${product.id} no encontrado en inventario`);
        console.error(`❌ [TRANSFORM] Productos en inventario:`, productsArray.map(p => ({ id: p.id, type: p.type })));
        socket.emit('transaction_failed', { 
          reason: 'product_not_found',
          message: 'No tienes este producto'
        });
        return;
      }
      
      // Procesar transformación
      const updatedProducts = [...productsArray];
      updatedProducts.splice(productIndex, 1);
      updatedProducts.push(transformedProduct);
      
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: updatedProducts,
        rockCoins: inventory.rockCoins, // No cambia el rockCoins
        waste: inventory.waste + wasteExtra,
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ [TRANSFORM] Transformación procesada para ${userId}:`, {
        productsCount: updatedInventory.products.length,
        products: updatedInventory.products,
        waste: updatedInventory.waste,
        wasteExtra: wasteExtra
      });
      
      // Notificar al jugador con transaction_success Y inventory_data
      console.log(`📡 Enviando transaction_success a ${userId}:`, {
        type: 'transform',
        inventory: updatedInventory,
        product: transformedProduct
      });
      socket.emit('transaction_success', {
        type: 'transform',
        inventory: updatedInventory,
        product: transformedProduct,
        userId: userId // IMPORTANTE: Incluir userId para que el listener pueda validar
      });
      
      // CRÍTICO: También enviar inventory_data para asegurar sincronización en frontend
      const playerSocketId = playerSockets.get(userId);
      if (playerSocketId) {
        console.log(`📦 [TRANSFORM] Enviando inventory_data actualizado a ${userId}:`, {
          rockCoins: updatedInventory.rockCoins,
          waste: updatedInventory.waste,
          products: updatedInventory.products?.length || 0
        });
        io.to(playerSocketId).emit('inventory_data', {
          gameId,
          userId: userId,
          inventory: {
            rockCoins: updatedInventory.rockCoins,
            waste: updatedInventory.waste,
            products: updatedInventory.products || [],
            miningQueue: updatedInventory.miningQueue || 0
          }
        });
      } else {
        console.warn(`⚠️ [TRANSFORM] No se encontró socketId para ${userId}, no se puede enviar inventory_data`);
      }
      
      // Actualizar ranking y notificar a todos
      updateAndEmitPlayerRankings(gameId);
      
      // Generar nuevo problema de minado después de la transformación
      const transactionDetails = {
        productId: transformedProduct.id,
        type: 'transform',
        userId: userId,
        productType: transformedProduct.type,
        marbleType: transformedProduct.marbleType,
        price: transformedProduct.currentPrice,
        waste: transformedProduct.waste
      };
      
      const miningProblem = generateMiningProblem(gameId, transactionDetails);
      
      // Notificar a todos los jugadores del juego
      const room = getGameRoom(gameId);
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: {
          ...miningProblem.activeProblem,
          round: room.round || 1 // AÑADIR: Ronda actual al problema
        },
        round: room.round || 1, // AÑADIR: Ronda actual
        timestamp: miningProblem.timestamp
      });
      
      // Notificar a todos los jugadores sobre problemas pendientes actualizados
      const gameRoom = getGameRoom(gameId);
      if (gameRoom && gameRoom.players) {
        gameRoom.players.forEach(player => {
          const pendingCount = getPendingCountForUser(player.userId);
          io.to(player.socketId).emit('mining:pending-count:result', {
            userId: player.userId,
            pendingCount
          });
        });
      }
    }
  });

  // Obtener inventario del jugador
  socket.on('get_inventory', ({ gameId, userId }) => {
    console.log(`📦 Solicitando inventario para ${userId} en ${gameId}`);
    const inventory = getPlayerInventory(gameId, userId);
    console.log(`📡 Enviando inventory_data a ${userId}:`, { gameId, userId, inventory });
    socket.emit('inventory_data', { gameId, userId, inventory });
  });

  // Obtener problemas de minado
  socket.on('get_mining_problems', ({ gameId }) => {
    console.log(`⛏️ Solicitando problemas de minado para ${gameId}`);
    // Obtener todos los problemas de minado del Map
    const problems = Array.from(miningProblems.values()).filter(problem => 
      problem.id.startsWith(gameId)
    );
    console.log(`📡 Enviando mining_problems_data a ${gameId}:`, { gameId, problems });
    socket.emit('mining_problems_data', { gameId, problems });
  });

  // Obtener bloques minados
  socket.on('get_mined_blocks', ({ gameId }) => {
    console.log(`⛓️ Solicitando bloques minados para ${gameId}`);
    const blocks = getMinedBlocks(gameId);
    console.log(`📡 Enviando mined_blocks_data a ${gameId}:`, { gameId, blocks });
    socket.emit('mined_blocks_data', { gameId, blocks });
  });

  // Obtener ranking de jugadores
  socket.on('get_player_rankings', ({ gameId }) => {
    console.log(`🏆 Solicitando ranking de jugadores para ${gameId}`);
    const room = getGameRoom(gameId);
    const gameRanking = playerRankings.get(gameId) || new Map();
    const productsCountByPlayer = getProductsCountByPlayer(gameId);
    
    // Crear lista completa de jugadores con sus datos
    const playerData = room.players.map(player => {
      const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
      const inventory = getPlayerInventory(gameId, player.userId);
      const productsCount = productsCountByPlayer.get(player.userId) || 0;
      
      return {
        userId: player.userId,
        userName: player.userName,
        rockCoins: inventory.rockCoins,
        waste: inventory.waste,
        blocksMined: productsCount,
        totalRewards: ranking.totalRewards,
        readyForNextRound: player.readyForNextRound || false
      };
    });
    
    console.log(`📡 Enviando player_rankings_data a ${gameId}:`, { gameId, playerData });
    socket.emit('player_rankings_data', { gameId, playerData });
  });

  // Handler para solicitar datos del usuario
  socket.on('request_user_data', ({ gameId, userId }) => {
    console.log(`👤 [SERVER] Solicitando datos del usuario ${userId} para juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.log(`❌ [SERVER] Juego ${gameId} no encontrado`);
      return;
    }

    // Buscar datos del jugador en la sala
    const player = room.players.find(p => p.userId === userId);
    if (player) {
      // Enviar datos del usuario al cliente
      socket.emit('user_data_updated', {
        gameId,
        userId,
        userName: player.userName,
        imageUrl: player.imageUrl
      });
      console.log(`📡 [SERVER] Datos del usuario enviados a ${userId}`);
    } else {
      console.log(`❌ [SERVER] Jugador ${userId} no encontrado en sala ${gameId}`);
    }
  });

  // Handler para solicitar ranking de jugadores
  socket.on('request_player_rankings', ({ gameId }) => {
    console.log(`🏆 [SERVER] Solicitando ranking para juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.log(`❌ [SERVER] Juego ${gameId} no encontrado`);
      return;
    }

    // Preparar datos del ranking
    const productsCountByPlayer = getProductsCountByPlayer(gameId);
    const playerData = room.players.map(player => {
      const productsCount = productsCountByPlayer.get(player.userId) || 0;
      return {
      userId: player.userId,
      userName: player.userName,
      imageUrl: player.imageUrl,
      totalRewards: playerRankings.get(gameId)?.get(player.userId)?.totalRewards || 0,
        blocksMined: productsCount
      };
    });

    // Ordenar por recompensas totales
    const sortedPlayers = playerData.sort((a, b) => (b.totalRewards || 0) - (a.totalRewards || 0));

    // Enviar ranking al cliente
    socket.emit('player_rankings_updated', {
      gameId,
      playerData: sortedPlayers
    });
    
    console.log(`📡 [SERVER] Ranking enviado para juego ${gameId}:`, sortedPlayers);
  });

  // Handler para iniciar siguiente ronda
  socket.on('start_next_round', async ({ gameId, userId }) => {
    console.log(`🎮 [SERVER] Iniciando siguiente ronda para juego ${gameId} por usuario ${userId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.log(`❌ [SERVER] Juego ${gameId} no encontrado`);
      return;
    }

    // Verificar que el usuario es el host
    if (room.hostId !== userId) {
      console.log(`❌ [SERVER] Usuario ${userId} no es el host del juego ${gameId}`);
      socket.emit('error', { message: 'Solo el host puede iniciar la siguiente ronda' });
      return;
    }

    // Verificar que hay al menos 2 jugadores
    // COMENTADO PARA PRUEBAS - Permitir 1 jugador
    // if (room.players.length < 2) {
    //   console.log(`❌ [SERVER] No se puede iniciar siguiente ronda con menos de 2 jugadores`);
    //   socket.emit('error', { message: 'Se necesitan al menos 2 jugadores para continuar' });
    //   return;
    // }

    // Actualizar estado de la sala
    room.status = 'starting';
    room.round = Math.max(1, room.round || 1) + 1;
    
    // CRÍTICO: Resetear winningIndustry para la nueva ronda (aleatorio)
    const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
    room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
    console.log(`🏭 [START_NEXT_ROUND] winningIndustry reseteado para ronda ${room.round}: ${room.winningIndustry}`);
    
    console.log(`✅ [SERVER] Siguiente ronda ${room.round} iniciada para juego ${gameId}`);
    
    // Los datos de mercado de la nueva ronda los genera este servidor (ver round:ready).
    
    // Notificar a todos los jugadores sobre la nueva ronda
    emitToGame(gameId, 'new_round', {
      gameId,
      round: room.round,
      status: 'starting',
      roundTimeISO: new Date(Date.now() + 3000).toISOString(), // 3 segundos de preparación
      winningIndustry: room.winningIndustry, // CRÍTICO: Incluir winningIndustry reseteado
      roundMeta: {
        totalRounds: 3,
        currentRound: room.round
      }
    });
    
    // También notificar que la ronda está preparada
    emitToGame(gameId, 'next_round:prepared', {
      gameId,
      round: room.round,
      roundMeta: {
        totalRounds: 3,
        currentRound: room.round
      },
      market: {
        products: [] // Se actualizará desde Firestore
      },
      roundTimeISO: new Date(Date.now() + 3000).toISOString()
    });
    
    console.log(`📡 [SERVER] Notificación de nueva ronda enviada a sala ${gameId}`);
  });

  // Handler para actualizar datos del usuario
  socket.on('update_user_profile', ({ gameId, userId, userName, imageUrl }) => {
    console.log(`👤 [SERVER] Actualizando perfil del usuario ${userId} en juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.log(`❌ [SERVER] Juego ${gameId} no encontrado`);
      return;
    }

    // Actualizar datos del jugador en la sala
    const playerIndex = room.players.findIndex(p => p.userId === userId);
    if (playerIndex !== -1) {
      room.players[playerIndex].userName = userName;
      room.players[playerIndex].imageUrl = imageUrl;
      
      console.log(`✅ [SERVER] Datos del jugador actualizados en sala ${gameId}`);
      
      // Notificar a todos los jugadores de la sala sobre la actualización
      emitToGame(gameId, 'player_profile_updated', {
        userId,
        userName,
        imageUrl,
        gameId
      });
      
      console.log(`📡 [SERVER] Notificación de actualización enviada a sala ${gameId}`);
    } else {
      console.log(`❌ [SERVER] Jugador ${userId} no encontrado en sala ${gameId}`);
    }
  });

  // Handler para salir del juego
  socket.on('leave_game', ({ gameId, userId }) => {
    console.log(`🚪 [SERVER] Jugador ${userId} saliendo del juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.log(`❌ [SERVER] Juego ${gameId} no encontrado`);
      return;
    }

    // Encontrar y remover jugador
    const playerIndex = room.players.findIndex(p => p.userId === userId);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      room.readyPlayers.delete(player.userId);
      playerSockets.delete(player.userId);
      
      console.log(`✅ [SERVER] Jugador ${userId} removido del juego ${gameId}`);
      
      // Si era el host, asignar nuevo host
      if (room.hostId === player.userId && room.players.length > 0) {
        room.hostId = room.players[0].userId;
        console.log(`👑 [SERVER] Nuevo host asignado: ${room.hostId}`);
      }
      
      // Si no quedan jugadores, eliminar la sala
      if (room.players.length === 0) {
        gameRooms.delete(gameId);
        console.log(`🗑️ [SERVER] Sala ${gameId} eliminada (sin jugadores)`);
      } else {
        // Notificar a otros jugadores
        emitToGame(gameId, 'player_left', {
          userId: player.userId,
          userName: player.userName,
          totalPlayers: room.players.length,
          newHostId: room.hostId
        });
        console.log(`📡 [SERVER] Notificación de salida enviada a sala ${gameId}`);
      }
    } else {
      console.log(`❌ [SERVER] Jugador ${userId} no encontrado en sala ${gameId}`);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
    
    // Encontrar y remover jugador
    for (const [gameId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        room.readyPlayers.delete(player.userId);
        playerSockets.delete(player.userId);
        
        // Si era el host, asignar nuevo host
        if (room.hostId === player.userId && room.players.length > 0) {
          room.hostId = room.players[0].userId;
        }
        
        // Notificar a otros jugadores
        emitToGame(gameId, 'player_left', {
          userId: player.userId,
          userName: player.userName,
          totalPlayers: room.players.length,
          newHostId: room.hostId
        });
        
        console.log(`👋 Jugador ${player.userId} desconectado de juego ${gameId}`);
        break;
      }
    }
  });
});

// Endpoint de estado del servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    activeGames: gameRooms.size,
    totalPlayers: Array.from(playerSockets.keys()).length,
    timestamp: new Date().toISOString()
  });
});

// Endpoint para obtener información de un juego
app.get('/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  const room = gameRooms.get(gameId);
  
  if (!room) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({
    gameId,
    status: room.status,
    round: room.round,
    players: room.players,
    hostId: room.hostId,
    roundTime: room.roundTime,
    winningIndustry: room.winningIndustry,
    readyPlayers: Array.from(room.readyPlayers)
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor WebSocket RockChain ejecutándose en puerto ${PORT}`);
  console.log(`📡 Socket.IO disponible en ws://0.0.0.0:${PORT}`);
  console.log(`🌐 Status endpoint: http://0.0.0.0:${PORT}/status`);
});

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('❌ Error en el servidor:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

module.exports = { io, gameRooms, playerSockets }; 