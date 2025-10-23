const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// Configuración para llamadas HTTP a Firebase Functions
const FIREBASE_FUNCTIONS_URL = 'https://your-region-your-project.cloudfunctions.net';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    // Para desarrollo local, usar credenciales por defecto del sistema
  admin.initializeApp({
    projectId: 'rockchain-83a7f'
  });
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
  
  const authoritativePayload = {
    ...authority,
    serverNowMs: serverNow,
    ...additionalData
  };
  
  console.log(`📡 [AUTHORITY] Emitiendo ${eventName} con estado autoritativo:`, authoritativePayload);
  emitToGame(gameId, eventName, authoritativePayload);
  
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
    
    // Aplicar recompensa
    const newRockCoins = userInventory.rockCoins + rewardAmount;
    userInventory.rockCoins = newRockCoins;
    
    // Actualizar inventario
    gameInventory.set(userId, userInventory);
    playerInventories.set(gameId, gameInventory);
    
    // Marcar operación como aplicada
    markRewardOperationApplied(gameId, operationId);
    
    console.log(`💰 [ATOMIC] Recompensa aplicada: ${userId} +${rewardAmount} = ${newRockCoins} rockCoins`);
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
    
    // 3. Elegir y persistir winningIndustry si no existe
    if (!room.winningIndustry) {
      const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
      room.winningIndustry = industries[Math.floor(Math.random() * industries.length)];
      console.log(`🏭 [ROUND][WASTE] winningIndustry=${room.winningIndustry}`);
    } else {
      console.log(`🏭 [ROUND][WASTE] winningIndustry ya existe: ${room.winningIndustry}`);
    }
    
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
        const currentWaste = inventory.waste || 0;
        const newWaste = Math.max(0, currentWaste - winner.wasteReduction);
        inventory.waste = newWaste;
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
    
    // Sincronizar inventarios de todos los jugadores
    const gameInventory = playerInventories.get(gameId);
    if (gameInventory) {
      for (const [userId, inventory] of gameInventory.entries()) {
        const userRef = admin.firestore().collection('users').doc(userId);
        await userRef.update({
          [`games.${gameId}.products`]: inventory.products,
          [`games.${gameId}.rockCoins`]: inventory.rockCoins,
          [`games.${gameId}.waste`]: inventory.waste,
          [`games.${gameId}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`📦 Inventario sincronizado para ${userId}:`, inventory);
      }
    }
    
    console.log(`✅ Estado del juego ${gameId} sincronizado con Firestore: ${room.status}`);
  } catch (error) {
    console.error(`❌ Error sincronizando juego ${gameId} con Firestore:`, error);
  }
};

// Función helper para emitir a todos en una sala
const emitToGame = (gameId, event, data) => {
  console.log(`📡 Emitiendo ${event} a sala ${gameId}:`, data);
  io.to(gameId).emit(event, data);
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
    
    // Agregar balances finales de todos los jugadores
    for (const player of room.players) {
      const inventory = getPlayerInventory(gameId, player.userId);
      roundData.results.balances[player.userId] = {
        rockCoins: inventory.rockCoins,
        waste: inventory.waste,
        products: inventory.products?.length || 0
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
    for (const player of room.players) {
      const inventory = getPlayerInventory(gameId, player.userId);
      const userRef = db.collection('users').doc(player.userId);
      batch.update(userRef, {
        [`games.${gameId}.products`]: inventory.products,
        [`games.${gameId}.rockCoins`]: inventory.rockCoins,
        [`games.${gameId}.waste`]: inventory.waste,
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

// NUEVA FUNCIÓN: Generar mercado determinista para una ronda
const generateMarketForRound = async (gameId, round) => {
  console.log(`🏪 [MARKET] Generando mercado para ronda ${round} del juego ${gameId}`);
  
  // Semilla determinista basada en gameId + round (SIN timestamp para reproducibilidad)
  const seed = `${gameId}:${round}`;
  console.log(`🌱 [MARKET] Semilla determinista: ${seed}`);
  
  // Generar productos con semilla determinista
  const products = generateProductsWithSeed(seed, round);
  
  // Persistir mercado en Firestore si está disponible
  if (admin.apps.length) {
    try {
      const db = admin.firestore();
      const marketRef = db.collection('games').doc(gameId).collection('market').doc(round.toString());
      
      await marketRef.set({
        round: round,
        products: products,
        seed: seed,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ [MARKET] Mercado persistido en Firestore para ronda ${round}`);

      // Además: actualizar documento agregado legacy para ChatScreen
      const legacyRef = db.collection('market').doc(gameId);
      // Transformar lista plana a estructura legacy
      const legacyRound = {};
      for (const p of products) {
        legacyRound[p.marbleType] = legacyRound[p.marbleType] || {};
        legacyRound[p.marbleType][p.type] = legacyRound[p.marbleType][p.type] || {};
        legacyRound[p.marbleType][p.type][p.quality] = {
          price: p.currentPrice,
          waste: p.waste
        };
      }
      await legacyRef.set({
        rounds: {
          [round]: legacyRound
        }
      }, { merge: true });
      console.log(`✅ [MARKET] Legacy market agregado/actualizado para ronda ${round}`);
    } catch (error) {
      console.error(`❌ [MARKET] Error persistiendo mercado:`, error);
    }
  }
  
  return {
    products: products,
    round: round,
    seed: seed
  };
};

// FUNCIÓN AUXILIAR: Generar productos con semilla determinista
// Estructura compatible con el frontend: type: 'Block'|'Slab', quality: 'A'|'B'|'C'
const generateProductsWithSeed = (seed, round) => {
  // Crear generador pseudoaleatorio con semilla
  const seededRandom = (seed) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return () => {
      hash = (hash * 9301 + 49297) % 233280;
      return hash / 233280;
    };
  };
  
  const random = seededRandom(seed);
  
  // Mármol y base
  const marbleTypes = ['Gray', 'White', 'Cream', 'Black', 'Red'];
  const marbleBasePrice = { Gray: 90, White: 120, Cream: 150, Black: 200, Red: 110 };
  const marbleBaseWaste = { Gray: 15, White: 12, Cream: 10, Black: 8, Red: 14 };
  const productTypes = ['Block', 'Slab'];
  const qualities = ['A', 'B', 'C'];
  const qualityMultipliers = {
    A: { price: 1.3, waste: 0.8 },
    B: { price: 1.0, waste: 1.0 },
    C: { price: 0.8, waste: 1.1 }
  };
  
  const products = [];
  const numProducts = 20; // 20 productos por ronda
  
  for (let i = 0; i < numProducts; i++) {
    const marble = marbleTypes[Math.floor(random() * marbleTypes.length)];
    const pType = productTypes[Math.floor(random() * productTypes.length)];
    const quality = qualities[Math.floor(random() * qualities.length)];
    
    // Precio base según mármol y tipo
    let basePrice = marbleBasePrice[marble];
    if (pType === 'Slab') basePrice = Math.round(basePrice * 1.25);
    // Waste base según mármol y tipo
    let baseWaste = marbleBaseWaste[marble];
    if (pType === 'Slab') baseWaste = Math.round(baseWaste * 1.1);
    
    // Variación ±20%
    const priceVariation = (random() - 0.5) * 0.4;
    const wasteVariation = (random() - 0.5) * 0.2;
    
    const mult = qualityMultipliers[quality] || qualityMultipliers['B']; // Fallback a calidad B
    const currentPrice = Math.max(1, Math.round(basePrice * (1 + priceVariation) * mult.price));
    const waste = Math.max(0, Math.round(baseWaste * (1 + wasteVariation) * mult.waste));
    
    products.push({
      id: `product-${seed}-${i}`,
      type: pType,
      quality,
      marbleType: marble,
      currentPrice,
      waste,
      round
    });
  }
  
  console.log(`🏪 [MARKET] Generados ${products.length} productos para semilla ${seed} (ronda ${round})`);
  return products;
};

// Función para actualizar y emitir el ranking de jugadores
const updateAndEmitPlayerRankings = (gameId) => {
  const room = getGameRoom(gameId);
  const gameRanking = playerRankings.get(gameId) || new Map();
  
  console.log(`🏆 Actualizando ranking para juego ${gameId}`);
  console.log(`🏆 Jugadores en la sala:`, room.players.map(p => ({ userId: p.userId, userName: p.userName })));
  
  // Crear lista completa de jugadores con sus datos actualizados
  const playerData = room.players.map(player => {
    const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
    const inventory = getPlayerInventory(gameId, player.userId);
    
    const playerInfo = {
      userId: player.userId,
      userName: player.userName,
      rockCoins: inventory.rockCoins,
      waste: inventory.waste,
      blocksMined: ranking.blocksMined,
      totalRewards: ranking.totalRewards,
      readyForNextRound: player.readyForNextRound || false
    };
    
    console.log(`🏆 Datos del jugador ${player.userName}:`, {
      rockCoins: playerInfo.rockCoins,
      waste: playerInfo.waste,
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
  
  console.log(`📡 Emitiendo player_rankings_data actualizado a ${gameId}:`, { gameId, playerData });
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
  Object.assign(inventory, updates);
  console.log(`📦 Inventario actualizado para ${userId} en ${gameId}:`, inventory);
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
    
    // Verificar si el juego ya está lleno (máximo 3 jugadores)
    if (room.players.length >= 3) {
      console.log(`❌ Juego ${gameId} lleno: ${room.players.length}/3 jugadores`);
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
    // COMENTADO PARA PRUEBAS - Permitir 1 jugador
    // if (room.players.length < 2) {
    //   console.log(`❌ No se puede iniciar el juego con menos de 2 jugadores. Jugadores actuales: ${room.players.length}`);
    //   socket.emit('error', { message: 'Se necesitan al menos 2 jugadores para iniciar el juego.' });
    //   return;
    // }
    
    // Cambiar estado a 'starting'
    room.status = 'starting';
    room.round = 1;
    room.readyPlayers.clear();
    
    // Generar productos para la Ronda 1
    console.log(`🏪 [START_GAME] Generando productos para Ronda 1...`);
    generateMarketForRound(gameId, 1).then(marketData => {
      console.log(`✅ [START_GAME] Productos generados para Ronda 1: ${marketData.products.length} productos`);
      
      // Emitir economy:state para que el cliente reciba los productos
      console.log(`📡 [START_GAME] Emitiendo economy:state para Ronda 1...`);
      const roundId = `${gameId}:1:${Date.now()}`;
      const version = 1;
      emitToGame(gameId, 'economy:state', {
        roundId: roundId,
        version: version,
        round: 1,
        market: {
          products: marketData.products,
          round: 1,
          seed: marketData.seed
        }
      });
      console.log(`✅ [START_GAME] economy:state emitido para Ronda 1`);
    }).catch(error => {
      console.error(`❌ [START_GAME] Error generando productos para Ronda 1:`, error);
    });
    
    // Sincronizar con Firestore
    syncGameToFirestore(gameId, room);
    
    console.log(`📡 Emitiendo game_status a sala ${gameId} con ${room.players.length} jugadores`);
    console.log(`👥 Jugadores en la sala:`, room.players.map(p => ({ userId: p.userId, socketId: p.socketId })));
    
    // Emitir a todos los jugadores
    emitToGame(gameId, 'game_status', {
      status: 'starting',
      round: 1,
      message: 'Game starting in 3 seconds...'
    });
    
    console.log(`✅ Juego ${gameId} iniciado por host ${userId}`);
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
      
      // EMITIR ESTADO AUTORITATIVO
      emitAuthoritativeState(gameId, 'start_round', {
        gameId,
        round: room.round,
        winningIndustry: room.winningIndustry,
        roundTime: new Date(authority.roundEndsAtMs).toISOString(),
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
    const player = room.players.find(p => p.userId === userId);
    if (player) {
      player.readyForNextRound = true;
      console.log(`✅ [ROUND:READY] Jugador ${userId} marcado como listo`);
    } else {
      console.error(`❌ [ROUND:READY] Jugador ${userId} no encontrado en la sala`);
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
        
        // CREAR ESTADO AUTORITATIVO PARA LA NUEVA RONDA (countdown de 3s)
        const authority = createAuthoritativeRoundData(gameId, nextRound, 3000);
        room.roundTime = new Date(authority.roundEndsAtMs); // Mantener compatibilidad
        room.readyPlayers.clear();
        
        // Resetear flags de ready para la nueva ronda
        room.players.forEach(player => {
          player.readyForNextRound = false;
        });
        
        // 4. SINCRONIZAR CON FIRESTORE
        await syncGameToFirestore(gameId, room);
        
        // 5. EMITIR EVENTOS EN ORDEN CORRECTO
        console.log(`📡 [ROUND:READY] Emitiendo eventos de transición...`);
        
        // PRIMERO: economy:state (hidrata mercado en UI) CON ESTADO AUTORITATIVO
        const roundId = `${gameId}:${nextRound}:${Date.now()}`;
        const version = nextRound;
        emitToGame(gameId, 'economy:state', {
          roundId: roundId,
          version: version,
          round: nextRound,
          market: newMarket
        });
        console.log(`✅ [ROUND:READY] EMIT economy:state autoritativo (${nextRound})`);
        
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
    console.log(`🚀 [START_ROUND_REQUEST] Cliente ${userId} solicita inicio de ronda ${round} en juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error(`❌ [START_ROUND_REQUEST] Sala no encontrada para ${gameId}`);
      return;
    }
    
    // Verificar que la ronda solicitada es correcta
    if (room.round !== round) {
      console.error(`❌ [START_ROUND_REQUEST] Ronda incorrecta: solicitada ${round}, actual ${room.round}`);
      return;
    }
    
    // Verificar que estamos en estado 'starting'
    if (room.status !== 'starting') {
      console.error(`❌ [START_ROUND_REQUEST] Estado incorrecto: ${room.status}, esperado 'starting'`);
      return;
    }
    
    console.log(`🚀 [START_ROUND_REQUEST] Iniciando ronda ${round} para juego ${gameId}`);
    
    // CREAR NUEVO ESTADO AUTORITATIVO PARA LA RONDA DE JUEGO (120s)
    const gameAuthority = createAuthoritativeRoundData(gameId, round, 120000);
    console.log(`🎯 [START_ROUND_REQUEST] Estado autoritativo creado para ronda ${round}:`, {
      round: gameAuthority.round,
      roundEndsAtMs: gameAuthority.roundEndsAtMs,
      roundTime: new Date(gameAuthority.roundEndsAtMs).toISOString()
    });
    
    // Actualizar estado de la sala
    room.status = 'in_progress';
    room.roundTime = new Date(gameAuthority.roundEndsAtMs);
    
    // EMITIR ESTADO AUTORITATIVO DE INICIO DE RONDA
    console.log(`📡 [START_ROUND_REQUEST] Emitiendo start_round para ronda ${round}`);
    emitAuthoritativeState(gameId, 'start_round', {
      gameId,
      round: round,
      winningIndustry: room.winningIndustry || 'Technology',
      roundTime: new Date(gameAuthority.roundEndsAtMs).toISOString(),
      message: `Round ${round} started!`
    });
    
    // Timer automático para terminar la ronda
    setTimeout(async () => {
      console.log(`⏰ [ROUND] Timer ended → preparing results for round=${round} gameId=${gameId}`);
      
      const currentRoom = getGameRoom(gameId);
      const currentAuthority = getGameAuthority(gameId);
      if (currentRoom && currentRoom.status === 'in_progress' && 
          currentRoom.round === round && 
          currentAuthority.roundId === gameAuthority.roundId) {
        await handleRoundEnd(gameId, round);
      }
    }, 120000); // 120 segundos
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
      
      // Emitir nueva ronda
      emitToGame(gameId, 'new_round', {
        status: 'starting',
        round: room.round,
        roundTime: Date.now() + 3000, // 3 segundos para countdown
        message: `Round ${room.round} starting in 3 seconds...`
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
    console.log(`🏁 [ROUND] Timer ended → preparing results for round=${round} gameId=${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error(`❌ [ROUND] Sala no encontrada en handleRoundEnd para ${gameId}`);
      return;
    }
    
    console.log(`🏁 [ROUND] Sala encontrada: ${gameId}, ronda: ${room.round}, estado: ${room.status}`);
    
    // IDEMPOTENCIA: Verificar si las recompensas ya fueron asignadas
    const rewardsKey = `${gameId}:${round}`;
    if (rewardsCommitted.has(rewardsKey)) {
      console.log(`[SERVER] rewards already committed for round=${round} → skip`);
      return;
    }
    
    // Verificar estado actual y adquirir lock
    const gameState = getGameState(gameId);
    console.log(`🏁 [ROUND] Estado actual del juego: ${gameState.state}, esperado: ${GAME_STATES.PLAYING}`);
    if (gameState.state !== GAME_STATES.PLAYING) {
      console.log(`⚠️ [ROUND] Estado actual ${gameState.state} no permite transición a ROUND_CALCULATING`);
      return;
    }
    
    // Adquirir lock para esta ronda
    if (!acquireRoundLock(gameId, round)) {
      console.log(`⚠️ [ROUND] Lock ya adquirido para ${gameId}:${round}`);
      return;
    }
    
    try {
      console.log(`🏁 [ROUND] Iniciando try block para ${gameId}`);
      
      // Transición a ROUND_CALCULATING
      console.log(`🏁 [ROUND] Transición a ROUND_CALCULATING para ${gameId}`);
      setGameState(gameId, GAME_STATES.ROUND_CALCULATING, round);
      room.status = 'roundEnd';
      room.readyPlayers.clear();
      console.log(`🏁 [ROUND] Estado actualizado a ROUND_CALCULATING para ${gameId}`);
    
      // Emitir ROUND_CALCULATING para mostrar loader
      console.log(`🔄 [ROUND] Emitiendo ROUND_CALCULATING para ronda ${round}`);
      console.log(`[SERVER] ROUND_CALCULATING emitted for round=${round}`);
      emitToGame(gameId, 'ROUND_CALCULATING', { round: round });
      console.log(`🏁 [ROUND] ROUND_CALCULATING emitido para ${gameId}`);
      
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
      
      // Sincronizar con Firestore
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
    console.log(`🏁 [ROUND] Ronda terminada por jugador ${userId} en juego ${gameId}`);
    
    const room = getGameRoom(gameId);
    if (!room) {
      console.error(`❌ [ROUND] Sala no encontrada para ${gameId}`);
      return;
    }
    
    const currentRound = (round && round > 0) ? round : room.round;
    console.log(`🏁 [ROUND] Ronda actual: ${currentRound}, Estado: ${room.status}`);
    
    // Llamar a la función centralizada de manejo de fin de ronda
    console.log(`🏁 [ROUND] Llamando a handleRoundEnd para ${gameId}, ronda ${currentRound}`);
    await handleRoundEnd(gameId, currentRound);
    console.log(`🏁 [ROUND] handleRoundEnd completado para ${gameId}`);
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
      const playerData = room.players.map(player => {
        const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
        const inventory = getPlayerInventory(gameId, player.userId);
        return {
          userId: player.userId,
          userName: player.userName,
          rockCoins: inventory.rockCoins,
          waste: inventory.waste,
          blocksMined: ranking.blocksMined,
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

  // Nuevo problema de minado generado
  socket.on('new_mining_problem', ({ gameId, blockId, problemData }) => {
    console.log(`⛏️ Nuevo problema de minado generado en juego ${gameId}, bloque ${blockId}`);
    
    // Notificar a todos los jugadores en el juego
    emitToGame(gameId, 'new_mining_problem', {
      blockId,
      problemData,
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
  socket.on('product_transaction', async ({ gameId, userId, product, transactionType }) => {
    console.log(`🛒 Transacción de producto: ${transactionType} por ${userId} en ${gameId}`);
    
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
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: [...inventory.products, product],
        rockCoins: inventory.rockCoins - product.currentPrice,
        waste: inventory.waste + product.waste,
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ Compra procesada para ${userId}:`, updatedInventory);
      
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
      
      // Notificar al jugador
      console.log(`📡 Enviando transaction_success a ${userId}:`, {
        type: 'purchase',
        inventory: updatedInventory,
        product: product
      });
      socket.emit('transaction_success', {
        type: 'purchase',
        inventory: updatedInventory,
        product: product
      });
      
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
      console.log('📡 Enviando problema de minado (COMPRA) con timestamp:', {
        blockId: miningProblem.id,
        miningStartTime: miningProblem.activeProblem.miningStartTime,
        timestamp: miningProblem.timestamp
      });
      
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: miningProblem.activeProblem,
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
      // Verificar si tiene el producto
      const productIndex = inventory.products.findIndex(p => p.id === product.id);
      if (productIndex === -1) {
        socket.emit('transaction_failed', { 
          reason: 'product_not_found',
          message: 'No tienes este producto'
        });
        return;
      }
      
      // Procesar venta
      const updatedProducts = [...inventory.products];
      updatedProducts.splice(productIndex, 1);
      
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: updatedProducts,
        rockCoins: inventory.rockCoins + product.currentPrice,
        waste: Math.max(0, inventory.waste - product.waste),
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ Venta procesada para ${userId}:`, updatedInventory);
      
      // Notificar al jugador
      console.log(`📡 Enviando transaction_success a ${userId}:`, {
        type: 'sell',
        inventory: updatedInventory,
        product: product
      });
      socket.emit('transaction_success', {
        type: 'sell',
        inventory: updatedInventory,
        product: product
      });
      
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
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: miningProblem.activeProblem,
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
      // Verificar si tiene el producto
      const productIndex = inventory.products.findIndex(p => p.id === product.id);
      if (productIndex === -1) {
        socket.emit('transaction_failed', { 
          reason: 'product_not_found',
          message: 'No tienes este producto'
        });
        return;
      }
      
      // Procesar transformación
      const updatedProducts = [...inventory.products];
      updatedProducts.splice(productIndex, 1);
      updatedProducts.push(transformedProduct);
      
      const updatedInventory = updatePlayerInventory(gameId, userId, {
        products: updatedProducts,
        rockCoins: inventory.rockCoins, // No cambia el rockCoins
        waste: inventory.waste + wasteExtra,
        miningQueue: (inventory.miningQueue || 0) + 1
      });
      
      console.log(`✅ Transformación procesada para ${userId}:`, updatedInventory);
      
      // Notificar al jugador
      console.log(`📡 Enviando transaction_success a ${userId}:`, {
        type: 'transform',
        inventory: updatedInventory,
        product: transformedProduct
      });
      socket.emit('transaction_success', {
        type: 'transform',
        inventory: updatedInventory,
        product: transformedProduct
      });
      
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
      emitToGame(gameId, 'new_mining_problem', {
        blockId: miningProblem.id,
        problemData: miningProblem.activeProblem,
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
    
    // Crear lista completa de jugadores con sus datos
    const playerData = room.players.map(player => {
      const ranking = gameRanking.get(player.userId) || { blocksMined: 0, totalRewards: 0 };
      const inventory = getPlayerInventory(gameId, player.userId);
      
      return {
        userId: player.userId,
        userName: player.userName,
        rockCoins: inventory.rockCoins,
        waste: inventory.waste,
        blocksMined: ranking.blocksMined,
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
    const playerData = room.players.map(player => ({
      userId: player.userId,
      userName: player.userName,
      imageUrl: player.imageUrl,
      totalRewards: playerRankings.get(gameId)?.get(player.userId)?.totalRewards || 0,
      blocksMined: playerRankings.get(gameId)?.get(player.userId)?.blocksMined || 0
    }));

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
    
    console.log(`✅ [SERVER] Siguiente ronda ${room.round} iniciada para juego ${gameId}`);
    
    // LLAMAR A FIREBASE FUNCTIONS PARA ACTUALIZAR DATOS DE LA NUEVA RONDA
    console.log(`🔄 [FIREBASE] Actualizando datos para ronda ${room.round}...`);
    try {
      // 1. Seleccionar industria ganadora
      console.log(`🏭 [FIREBASE] Seleccionando industria ganadora...`);
      const selectIndustryResponse = await fetch(`${FIREBASE_FUNCTIONS_URL}/selectWinningIndustry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });
      if (selectIndustryResponse.ok) {
        console.log(`✅ [FIREBASE] Industria ganadora seleccionada`);
      } else {
        console.log(`⚠️ [FIREBASE] Error seleccionando industria ganadora`);
      }
      
      // 2. Actualizar precios de productos
      console.log(`💰 [FIREBASE] Actualizando precios para ronda ${room.round}...`);
      const updatePricesResponse = await fetch(`${FIREBASE_FUNCTIONS_URL}/updateProductPrices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, round: room.round })
      });
      if (updatePricesResponse.ok) {
        console.log(`✅ [FIREBASE] Precios actualizados`);
      } else {
        console.log(`⚠️ [FIREBASE] Error actualizando precios`);
      }
      
      // 3. Asignar productos al juego
      console.log(`📦 [FIREBASE] Asignando productos para ronda ${room.round}...`);
      const assignProductsResponse = await fetch(`${FIREBASE_FUNCTIONS_URL}/assignProductsToGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, round: room.round })
      });
      if (assignProductsResponse.ok) {
        console.log(`✅ [FIREBASE] Productos asignados`);
      } else {
        console.log(`⚠️ [FIREBASE] Error asignando productos`);
      }
      
      console.log(`✅ [FIREBASE] Datos de ronda ${room.round} actualizados exitosamente`);
    } catch (error) {
      console.error(`❌ [FIREBASE] Error actualizando datos para ronda ${room.round}:`, error);
      // Continuar con la ronda aunque haya error en Firebase Functions
      console.log(`⚠️ [FIREBASE] Continuando con la ronda a pesar del error`);
    }
    
    // Notificar a todos los jugadores sobre la nueva ronda
    emitToGame(gameId, 'new_round', {
      gameId,
      round: room.round,
      status: 'starting',
      roundTimeISO: new Date(Date.now() + 3000).toISOString(), // 3 segundos de preparación
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
  console.log(`🔌 Accesible desde: http://localhost:${PORT}`);
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