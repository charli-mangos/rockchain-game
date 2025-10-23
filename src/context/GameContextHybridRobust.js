import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, collection, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, functions, auth } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';
import { useLearningProgress } from '../hooks/useLearningProgress';

export const GameContextHybridRobust = createContext();

export const GameProviderHybridRobust = ({ children, gameId, userId }) => {
  
  // Validar que gameId y userId son válidos
  if (!gameId || !userId) {
    console.error('❌ GameProviderHybrid: gameId o userId son undefined:', { gameId, userId });
    console.error('❌ Esto indica un problema en el flujo de creación de juego');
    return null;
  }

  // Obtener navigation y traducción usando los hooks
  const navigation = useNavigation();
  const { t } = useTranslation();

  // Helper para obtener la instancia del WebSocketService
  const getWebSocket = () => getWebSocketService();
  
  // Helper para obtener títulos de feedback
  const getFeedbackTitle = (type) => {
    switch (type) {
      case 'mining_success':
        return 'Block Mined Successfully!';
      case 'waste_reduction_success':
        return 'Circular Economy Achievement!';
      case 'transaction_success':
        return 'Transaction Completed!';
      case 'industry_selection':
        return 'Industry Selected!';
      case 'blockchain_concept':
        return 'Blockchain Concept Learned!';
      default:
        return 'Educational Tip';
    }
  };
  
  // Estados del juego
  const [countdown, setCountdown] = useState(120);
  const [roundTime, setRoundTime] = useState(null);
  const [round, setRound] = useState(1);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [isReadyForNextRound, setIsReadyForNextRound] = useState(false);
  const [winningIndustry, setWinningIndustry] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  
  // Estados adicionales del contexto original
  const [productList, setProductList] = useState([]);
  const [userData, setUserData] = useState(null);
  const [userProducts, setUserProducts] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const marketUnsubRef = useRef(null);
  const [webSocketInventory, setWebSocketInventory] = useState({
    products: [],
    rockCoins: 600,
    waste: 0
  });
  const [miningQueue, setMiningQueue] = useState(0);
  const [miningProblems, setMiningProblems] = useState([]); // Cola global del socket
  const [localPendingProblems, setLocalPendingProblems] = useState([]); // Cola local del jugador
  const [minedBlocks, setMinedBlocks] = useState([]);
  const [playerRankings, setPlayerRankings] = useState([]);
  const [allPlayersData, setAllPlayersData] = useState([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [miningStartTime, setMiningStartTime] = useState(null); // Timestamp cuando se abre el minado
  const [showMiningBubble, setShowMiningBubble] = useState(true);
  const [isCalculatingRewards, setIsCalculatingRewards] = useState(false);
  const [roundRewards, setRoundRewards] = useState(null);
  const [roundMeta, setRoundMeta] = useState(null); // { round, winningIndustry, wasteRewardApplied, roundSeed }
  const [isWaiting, setIsWaiting] = useState(false);
  const [results, setResults] = useState(null);
  const [roundEndedSent, setRoundEndedSent] = useState(false);
  
  // Estados para el sistema de Ready
  const [nextRoundWaiting, setNextRoundWaiting] = useState(false);
  
  // Estados para feedback educativo
  const [educationalFeedback, setEducationalFeedback] = useState(null);
  const [showEducationalFeedback, setShowEducationalFeedback] = useState(false);
  
  // Sistema de progreso de aprendizaje
  const learningProgress = useLearningProgress(userId);
  const [roundReadyProgress, setRoundReadyProgress] = useState({ 
    readyCount: 0, 
    totalPlayers: 0, 
    readyList: [] 
  });

  // Funciones para manejar feedback educativo
  const dismissEducationalFeedback = () => {
    setShowEducationalFeedback(false);
    setEducationalFeedback(null);
  };

  // Funciones para actualizar progreso de aprendizaje
  const updateLearningProgress = async (type, data = {}) => {
    try {
      let result;
      switch (type) {
        case 'block_mined':
          result = await learningProgress.recordBlockMined();
          break;
        case 'waste_reduced':
          result = await learningProgress.recordWasteReduction(data.amount || 0);
          break;
        case 'correct_industry':
          result = await learningProgress.recordCorrectIndustrySelection();
          break;
        case 'rockcoins_earned':
          result = await learningProgress.recordRockcoinsEarned(data.amount || 0);
          break;
        case 'game_completed':
          result = await learningProgress.recordGameCompleted();
          break;
        case 'transaction_completed':
          result = await learningProgress.recordTransactionCompleted();
          break;
        default:
          console.log('Unknown learning progress type:', type);
          return;
      }

      // Mostrar notificación si hay nuevos logros
      if (result.newAchievements.length > 0) {
        console.log('🎉 New achievements unlocked:', result.newAchievements);
        // Aquí podrías mostrar una notificación de logros desbloqueados
      }

      // Mostrar notificación si subió de nivel
      if (result.levelUp) {
        console.log('🎊 Level up! New level:', result.newProgress.level);
        // Aquí podrías mostrar una notificación de subida de nivel
      }
    } catch (error) {
      console.error('Error updating learning progress:', error);
    }
  };
  
  // Estado local para controlar navegación individual
  const [isWaitingNextRoundLocal, setIsWaitingNextRoundLocal] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [currentTransactionUserName, setCurrentTransactionUserName] = useState(null);
  const [currentProductDetails, setCurrentProductDetails] = useState(null);
  const [currentTransactionType, setCurrentTransactionType] = useState(null);
  const [miningHistory, setMiningHistory] = useState(new Set());

  // ESTADOS PARA COORDINACIÓN EN TIEMPO REAL
  const [clockDrift, setClockDrift] = useState(0); // Desfase entre reloj local y servidor (ms)
  const [lastAppliedRoundId, setLastAppliedRoundId] = useState(null); // Para idempotencia
  const [lastAppliedVersion, setLastAppliedVersion] = useState(0); // Para idempotencia
  const [authoritativeState, setAuthoritativeState] = useState(null); // Estado autoritativo del servidor

  // REFS
  const navigationRef = useRef(navigation);
  const hasNavigatedRef = useRef(false);
  const currentScreenRef = useRef(null);
  const intervalRef = useRef(null);
  const endRoundCalledRef = useRef(false);
  const roundTimerCalledRef = useRef(false);
  const lastSyncTimeRef = useRef(null); // Para tracking de resincronización

  useEffect(() => {
    console.log('🔗 Estableciendo navigationRef:', !!navigation);
    navigationRef.current = navigation;
  }, [navigation]);

  // FUNCIONES DE NAVEGACIÓN
  const safeNavigate = (screen, params = {}) => {
    console.log('🧭 [safeNavigate] Intentando navegar a:', screen);
    console.log('🧭 [safeNavigate] navigationRef.current:', !!navigationRef.current);
    console.log('🧭 [safeNavigate] currentScreenRef.current:', currentScreenRef.current);
    
    if (navigationRef.current && typeof navigationRef.current.navigate === 'function') {
      if (currentScreenRef.current === screen) {
        console.log('🧭 [safeNavigate] Ya estamos en', screen, '- evitando navegación duplicada');
        return;
      }
      console.log('🧭 [safeNavigate] Navegando de', currentScreenRef.current, 'a', screen);
      currentScreenRef.current = screen;
      navigationRef.current.navigate(screen, { ...params, gameId, userId });
      console.log('🧭 [safeNavigate] Navegación ejecutada');
    } else {
      console.error('❌ [safeNavigate] navigationRef.current no disponible o navigate no es función');
    }
  };

  const safeReset = (screen, params = {}) => {
    if (navigationRef.current && typeof navigationRef.current.reset === 'function') {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: screen, params: { ...params, gameId, userId } }],
      });
    }
  };

  // FUNCIONES PARA COORDINACIÓN EN TIEMPO REAL
  const calculateClockDrift = (serverNowMs) => {
    const localNow = Date.now();
    const drift = serverNowMs - localNow;
    console.log(`🕐 [CLOCK_DRIFT] serverNow: ${serverNowMs}, localNow: ${localNow}, drift: ${drift}ms`);
    
    // Log métrica de drift
    console.log(`📊 [CLIENT_METRIC] clock_drift: ${drift}ms, gameId: ${gameId}, userId: ${userId}`);
    
    return drift;
  };

  const getCorrectedTime = () => {
    return Date.now() + clockDrift;
  };

  const calculateRemainingTime = (roundEndsAtMs) => {
    if (!roundEndsAtMs) return 0;
    const correctedNow = getCorrectedTime();
    const remaining = Math.max(0, roundEndsAtMs - correctedNow);
    console.log(`⏰ [TIMER] roundEndsAt: ${roundEndsAtMs}, correctedNow: ${correctedNow}, remaining: ${remaining}ms`);
    return remaining;
  };

  const isEventIdempotent = (roundId, version) => {
    // Si es la misma ronda pero versión menor o igual, ya fue aplicado
    if (lastAppliedRoundId === roundId && version <= lastAppliedVersion) {
      console.log(`🔄 [IDEMPOTENCY] Evento ya aplicado: roundId=${roundId}, version=${version}`);
      return false;
    }
    return true;
  };

  const applyAuthoritativeState = (state) => {
    if (!isEventIdempotent(state.roundId, state.version)) {
      console.log(`📊 [CLIENT_METRIC] event_duplicate: roundId=${state.roundId}, version=${state.version}, gameId=${gameId}`);
      return false;
    }

    console.log(`🎯 [AUTHORITY] Aplicando estado autoritativo:`, state);
    
    // Log métrica de aplicación de estado
    console.log(`📊 [CLIENT_METRIC] state_applied: roundId=${state.roundId}, version=${state.version}, gameId=${gameId}, userId=${userId}`);
    
    // Actualizar desfase de reloj
    if (state.serverNowMs) {
      const newDrift = calculateClockDrift(state.serverNowMs);
      setClockDrift(newDrift);
      lastSyncTimeRef.current = Date.now();
    }

    // Actualizar estado del juego
    if (state.round !== undefined) setRound(state.round);
    if (state.roundEndsAtMs) {
      setRoundTime(new Date(state.roundEndsAtMs));
    }

    // Actualizar tracking de idempotencia
    setLastAppliedRoundId(state.roundId);
    setLastAppliedVersion(state.version);
    setAuthoritativeState(state);

    return true;
  };

  const requestResync = () => {
    console.log(`🔄 [RESYNC] Solicitando resincronización...`);
    const webSocketService = getWebSocket();
    if (webSocketService && webSocketService.isConnected) {
      webSocketService.emit('resync_state', { gameId, userId });
    }
  };

  // CONECTAR AL WEBSOCKET
  useEffect(() => {
    console.log('🔌 Iniciando useEffect de conexión WebSocket...');
    console.log('🔌 gameId:', gameId, 'userId:', userId);
    
    const connectToWebSocket = async () => {
      try {
        console.log('🔌 Conectando al WebSocket para coordinación...');
        
        // Obtener instancia singleton
        const webSocketService = getWebSocket();
        
        // Desconectar del WebSocket anterior si existe
        if (getWebSocket().isConnected) {
          console.log('🔌 Desconectando del WebSocket anterior...');
          getWebSocket().disconnect();
          // Esperar un poco para que se complete la desconexión
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('🔌 Estado antes de conectar:', getWebSocket().getConnectionStatus());
        await getWebSocket().connect();
        console.log('🔌 Estado después de conectar:', getWebSocket().getConnectionStatus());
        
        // Obtener userName desde Firestore
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userName = userDoc.data()?.userName || 'Player';
        console.log('🔌 userName obtenido:', userName);
        
        // Unirse al juego
        getWebSocket().joinGame(gameId, userId, userName);
        
        // Solicitar resincronización inmediata
        setTimeout(() => {
          requestResync();
        }, 500); // Esperar 500ms para que se complete la conexión
        
        console.log('✅ WebSocket conectado para coordinación');
      } catch (error) {
        console.error('❌ Error conectando WebSocket:', error);
      }
    };

    if (gameId && userId) {
      connectToWebSocket();
    } else {
      console.log('⚠️ gameId o userId no disponibles:', { gameId, userId });
    }

    // Cleanup: desconectar al cambiar gameId o userId
    return () => {
      const webSocketService = getWebSocket();
      if (getWebSocket().isConnected) {
        console.log('🔌 Cleanup: desconectando WebSocket');
        getWebSocket().disconnect();
      }
    };
  }, [gameId, userId]); // Agregar gameId como dependencia

  // CARGAR INVENTARIO DESDE WEBSOCKET
  useEffect(() => {
    if (isWebSocketConnected && gameId && userId) {
      getInventoryFromWebSocket();
      getMinedBlocksFromWebSocket();
      getPlayerRankingsFromWebSocket();
    }
  }, [isWebSocketConnected, gameId, userId]);

  // SOLICITAR RANKING ACTUALIZADO CUANDO HAY JUGADORES
  useEffect(() => {
    if (isWebSocketConnected && gameId && players.length > 0) {
      getPlayerRankingsFromWebSocket();
    }
  }, [isWebSocketConnected, gameId, players.length]);

  // INICIALIZAR DATOS DE JUGADORES DESDE PLAYERS
  useEffect(() => {
    if (players.length > 0 && allPlayersData.length === 0) {
      const initialPlayerData = players.map(player => ({
        userId: player.userId,
        userName: player.userName,
        rockCoins: player.rockCoins || 600,
        waste: player.waste || 0,
        blocksMined: 0,
        totalRewards: 0,
        readyForNextRound: player.readyForNextRound || false
      }));
      
      // Ordenar por nombre si están empatados en balance
      initialPlayerData.sort((a, b) => {
        const balanceA = a.rockCoins - a.waste;
        const balanceB = b.rockCoins - b.waste;
        if (balanceA !== balanceB) {
          return balanceB - balanceA; // Mayor balance primero
        }
        return a.userName.localeCompare(b.userName); // Orden alfabético si empatan
      });
      
      setAllPlayersData(initialPlayerData);
    }
  }, [players, allPlayersData.length]);

  // LISTENERS PARA EVENTOS AUTORITATIVOS
  useEffect(() => {
    console.log('🎯 Configurando listeners de eventos autoritativos...');
    
    const webSocketService = getWebSocket();
    if (!webSocketService) return;

    // Listener para resincronización
    const handleResyncState = (data) => {
      console.log('🔄 [RESYNC] Recibido estado autoritativo:', data);
      applyAuthoritativeState(data);
    };

    // Listener para start_round autoritativo
    const handleStartRound = (data) => {
      console.log('🚀 [START_ROUND] Recibido evento autoritativo:', data);
      if (applyAuthoritativeState(data)) {
        setGameStatus('in_progress');
        if (data.winningIndustry) setWinningIndustry(data.winningIndustry);
        // Actualizar roundTime si viene en el evento
        if (data.roundTime) {
          const roundTimeDate = new Date(data.roundTime);
          setRoundTime(roundTimeDate);
          console.log('🚀 [START_ROUND] roundTime actualizado desde evento autoritativo:', roundTimeDate);
        }
      }
    };

    // Listener para game_status autoritativo
    const handleGameStatus = (data) => {
      console.log('📊 [GAME_STATUS] Recibido evento autoritativo:', data);
      if (applyAuthoritativeState(data)) {
        // NO cambiar gameStatus si es roundEnd - se maneja en el listener específico
        if (data.status && data.status !== 'roundEnd') {
          setGameStatus(data.status);
        } else if (data.status === 'roundEnd') {
          console.log('📊 [GAME_STATUS] Estado roundEnd autoritativo recibido - delegando al listener específico');
        }
      }
    };

    // Listener para round_ended autoritativo
    const handleRoundEnded = (data) => {
      console.log('🏁 [ROUND_ENDED] Recibido evento autoritativo:', data);
      if (applyAuthoritativeState(data)) {
        setGameStatus('roundEnd');
        // Actualizar la ronda si viene en el evento
        if (data.round !== undefined) {
          setRound(data.round);
          console.log('🏁 [ROUND_ENDED] Ronda actualizada a:', data.round);
        }
      }
    };

    // Listener para countdown_start
    const handleCountdownStart = (data) => {
      console.log('⏰ [COUNTDOWN] Recibido countdown_start:', data);
      
      // Aplicar estado autoritativo
      if (applyAuthoritativeState(data)) {
        setGameStatus('starting');
        // Actualizar la ronda si viene en el evento
        if (data.round !== undefined) {
          setRound(data.round);
          console.log('⏰ [COUNTDOWN] Ronda actualizada a:', data.round);
        }
      }
      
      // Solicitar inicio de ronda después del countdown
      if (data.countdownSeconds) {
        setTimeout(() => {
          console.log('🚀 [COUNTDOWN] Solicitando inicio de ronda después del countdown');
          webSocketService.emit('start_round_request', { 
            gameId, 
            userId, 
            round: data.round 
          });
        }, data.countdownSeconds * 1000);
      }
    };

    // Listener para economy:state (actualización de mercado de la ronda ACTIVA)
    // Importante: NO sobrescribir marketData histórico aquí; solo hidratar productList/round
    const handleEconomyState = (data) => {
      console.log('🏪 [ECONOMY_STATE] ===== EVENTO RECIBIDO =====');
      console.log('🏪 [ECONOMY_STATE] Recibido evento autoritativo:', data);
      console.log('🏪 [ECONOMY_STATE] applyAuthoritativeState result:', applyAuthoritativeState(data));
      if (applyAuthoritativeState(data)) {
        if (data.round !== undefined) {
          setRound(data.round);
          console.log('🏪 [ECONOMY_STATE] Round actualizado a:', data.round);
        }
        if (data.market) {
          console.log('🏪 [ECONOMY_STATE] data.market:', data.market);
          console.log('🏪 [ECONOMY_STATE] data.market.products:', data.market.products);
          console.log('🏪 [ECONOMY_STATE] data.market.products.length:', data.market.products?.length);
          setProductList(data.market.products || []);
          console.log('🏪 [ECONOMY_STATE] Productos actualizados para ronda:', data.round, 'count=', (data.market.products || []).length);
          console.log('🏪 [ECONOMY_STATE] ===== PRODUCTOS ACTUALIZADOS =====');
        }
      } else {
        console.log('🏪 [ECONOMY_STATE] Evento rechazado por applyAuthoritativeState');
      }
    };

    // Listener para round_meta (metadatos de ronda)
    const handleRoundMeta = (data) => {
      console.log('🎯 [ROUND_META] Recibido evento autoritativo:', data);
      if (applyAuthoritativeState(data)) {
        setRoundMeta(data);
        if (data.winningIndustry) setWinningIndustry(data.winningIndustry);
        console.log('🎯 [ROUND_META] Metadatos de ronda actualizados:', data);
        console.log('🎯 [ROUND_META] winningIndustry actualizado a:', data.winningIndustry);
        console.log('🎯 [ROUND_META] wasteRewardApplied:', data.wasteRewardApplied);
      }
    };

    // Listener para feedback educativo
    const handleEducationalFeedback = (data) => {
      console.log('📚 [EDUCATIONAL_FEEDBACK] Recibido feedback educativo:', data);
      
      // Solo mostrar feedback si es para el usuario actual
      if (data.userId === userId) {
        setEducationalFeedback({
          type: data.type,
          title: getFeedbackTitle(data.type),
          message: data.message,
          explanation: data.explanation,
          reward: data.reward,
          industryEfficiency: data.industryEfficiency,
          selectedIndustry: data.selectedIndustry
        });
        setShowEducationalFeedback(true);
      }
    };

    // Registrar listeners
    webSocketService.on('resync_state', handleResyncState);
    webSocketService.on('start_round', handleStartRound);
    webSocketService.on('game_status', handleGameStatus);
    webSocketService.on('educational_feedback', handleEducationalFeedback);
    webSocketService.on('round_ended', handleRoundEnded);
    webSocketService.on('countdown_start', handleCountdownStart);
    webSocketService.on('economy:state', handleEconomyState);
    webSocketService.on('round_meta', handleRoundMeta);


    // Cleanup
    return () => {
      console.log('🧹 Limpiando listeners de eventos autoritativos');
      webSocketService.off('resync_state', handleResyncState);
      webSocketService.off('start_round', handleStartRound);
      webSocketService.off('game_status', handleGameStatus);
      webSocketService.off('educational_feedback', handleEducationalFeedback);
      webSocketService.off('round_ended', handleRoundEnded);
      webSocketService.off('countdown_start', handleCountdownStart);
      webSocketService.off('economy:state', handleEconomyState);
      webSocketService.off('round_meta', handleRoundMeta);
      if (marketUnsubRef.current) {
        marketUnsubRef.current();
        marketUnsubRef.current = null;
      }
    };
  }, [gameId, userId]);

  // RESINCRONIZACIÓN PERIÓDICA
  useEffect(() => {
    // Suscripción al histórico de mercado en Firestore: games/{gameId}/market/*
    // Construye un objeto marketHistory = { rounds: { [round]: { products: [...] } } }
    if (!gameId) return;
    try {
      // limpiar subscripción previa si existiese
      if (marketUnsubRef.current) {
        marketUnsubRef.current();
        marketUnsubRef.current = null;
      }
      
      // 1) Preferir el documento agregado legacy: collection 'market' doc '{gameId}'
      const legacyDocRef = doc(db, 'market', gameId);
      const stopLegacy = onSnapshot(legacyDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.rounds && Object.keys(data.rounds).length > 0) {
            setMarketData({ rounds: data.rounds });
            console.log('🏪 [MARKET_HISTORY] Legacy doc detected. Rondas:', Object.keys(data.rounds).length);
          }
        }
      });

      // 2) También escuchar la colección por-ronda nueva: 'games/{gameId}/market'
      const roundsColRef = collection(db, 'games', gameId, 'market');
      const stopPerRound = onSnapshot(roundsColRef, (snapshot) => {
        const rounds = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const r = parseInt(docSnap.id, 10);
          if (!Number.isNaN(r)) {
            rounds[r] = {
              products: data.products || [],
              seed: data.seed,
            };
          }
        });
        const count = Object.keys(rounds).length;
        if (count > 0) {
          // No transformamos a la forma de ChatScreen aquí (productos planos), solo proveemos respaldo si no existe legacy
          // Mantener compatibilidad: si ya tenemos legacy.rounds, no sobreescribimos
          setMarketData((prev) => {
            if (prev && prev.rounds && Object.keys(prev.rounds).length > 0) return prev;
            const ordered = Object.keys(rounds)
              .map((k) => parseInt(k, 10))
              .sort((a, b) => a - b)
              .reduce((acc, r) => { acc[r] = rounds[r]; return acc; }, {});
            console.log('🏪 [MARKET_HISTORY] Per-round collection detected. Docs:', count);
            return { rounds: ordered };
          });
        }
      });

      // Guardar multi-cleanup
      marketUnsubRef.current = () => {
        stopLegacy && stopLegacy();
        stopPerRound && stopPerRound();
      };
    } catch (e) {
      console.error('❌ [MARKET_HISTORY] Error suscribiendo a histórico de mercado:', e);
    }

    if (!isWebSocketConnected || !gameId || !userId) return;

    // Solicitar resincronización cada 30 segundos si no hemos sincronizado recientemente
    const resyncInterval = setInterval(() => {
      const timeSinceLastSync = lastSyncTimeRef.current ? Date.now() - lastSyncTimeRef.current : Infinity;
      
      // Si han pasado más de 30 segundos desde la última sincronización, solicitar resync
      if (timeSinceLastSync > 30000) {
        console.log('🔄 [RESYNC] Resincronización periódica (30s sin sync)');
        requestResync();
      }
    }, 30000); // Cada 30 segundos

    return () => {
      clearInterval(resyncInterval);
    };
  }, [isWebSocketConnected, gameId, userId]);

  // SUSCRIBIRSE A EVENTOS DEL WEBSOCKET
  useEffect(() => {
    console.log('🔌 Configurando listeners de WebSocket...');
    console.log('🔌 Estado actual de isWebSocketConnected:', isWebSocketConnected);
    const webSocketService = getWebSocket();
    console.log('🔌 Estado actual de getWebSocket().isConnected:', getWebSocket().isConnected);
    console.log('🔌 Estado completo del servicio:', getWebSocket().getConnectionStatus());
    
    // Limpiar listeners anteriores
    getWebSocket().off('connection_success');
    getWebSocket().off('connection_lost');
    getWebSocket().off('game_status');
    getWebSocket().off('start_round');
    getWebSocket().off('new_round');
    getWebSocket().off('round_ended');
    getWebSocket().off('game_completed');
    getWebSocket().off('new_mining_problem');
    getWebSocket().off('mining_response_update');
    
    // Eventos de conexión WebSocket
    getWebSocket().on('connection_success', (data) => {
      console.log('✅ WebSocket conectado:', data);
      console.log('🔌 Estado isWebSocketConnected ANTES:', isWebSocketConnected);
      setIsWebSocketConnected(true);
      console.log('🔌 Estado isWebSocketConnected DESPUÉS: true');
      console.log('🔌 Estado completo del servicio:', getWebSocket().getConnectionStatus());
      
      // RESINCRONIZACIÓN AUTOMÁTICA AL RECONECTAR
      setTimeout(() => {
        console.log('🔄 [RESYNC] Solicitando resincronización tras reconexión...');
        requestResync();
      }, 1000); // Esperar 1 segundo para que se complete la conexión
      
      // REHIDRATACIÓN: Si estamos en roundEnd y no tenemos roundRewards, solicitar rehidratación
      if (gameStatus === 'roundEnd' && !roundRewards) {
        console.log('🔄 [REHYDRATE] Conexión restablecida en roundEnd sin roundRewards, solicitando rehidratación');
        getWebSocket().emit('rehydrate_end_of_round', { gameId });
      }
    });

    getWebSocket().on('connection_lost', (data) => {
      console.log('🔌 WebSocket desconectado:', data);
      console.log('🔌 Estado isWebSocketConnected ANTES:', isWebSocketConnected);
      setIsWebSocketConnected(false);
      console.log('🔌 Estado isWebSocketConnected DESPUÉS: false');
      console.log('🔌 Estado completo del servicio:', getWebSocket().getConnectionStatus());
    });

    getWebSocket().on('connection_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
      setIsWebSocketConnected(false);
    });

    // Eventos del juego
    getWebSocket().on('game_status', (data) => {
      console.log('🔌 Recibiendo game_status - Estado actual:', gameStatus, 'Nuevo estado:', data.status);
      console.log('🔌 [GAME_STATUS] Ronda recibida:', data.round);
      
      // NO cambiar gameStatus si es roundEnd - se maneja en el listener específico
      if (data.status === 'roundEnd') {
        console.log('🔌 [GAME_STATUS] Estado roundEnd recibido - delegando al listener específico');
        if (data.round !== undefined && data.round !== null) {
          setRound(data.round);
          console.log('🔌 [GAME_STATUS] Ronda actualizada a:', data.round);
        }
        return;
      }
      
      setGameStatus(data.status);
      if (data.round !== undefined && data.round !== null) {
        setRound(data.round);
        console.log('🔌 [GAME_STATUS] Ronda actualizada a:', data.round);
      }
      
      // Navegación basada en estado
      if (data.status === 'starting') {
        console.log('🎮 Navegando a WaitingRoom - estado starting');
        safeNavigate('WaitingRoom');
      }
    });

    getWebSocket().on('start_round', (data) => {
        console.log('🎯 Inicio de ronda (WebSocket):', data);
      
      setGameStatus(data.status);
      setRound(data.round || 1);
      setWinningIndustry(data.winningIndustry);
      setRoundEndedSent(false);
      
      if (data.roundTime) {
        const roundTimeDate = new Date(data.roundTime);
        setRoundTime(roundTimeDate);
          console.log('🕒 roundTime actualizado desde WebSocket:', roundTimeDate);
        }
      
      // Navegación a GameTabs
      console.log('🎮 Navegando a GameTabs - inicio de ronda');
      safeNavigate('GameTabs');
    });

    getWebSocket().on('new_round', (data) => {
      setGameStatus('starting');
      setRound(data.round);
      setRoundTime(new Date(data.roundTime));
      
      // Resetear flags
      hasNavigatedRef.current = false;
      endRoundCalledRef.current = false;
    });

    // NUEVO: Listener para ROUND_CALCULATING
    getWebSocket().on('ROUND_CALCULATING', (data) => {
      console.log('🔄 [UI][ROUND] CALCULATING round=', data.round);
      setGameStatus('calculating');
      setIsCalculatingRewards(true);
      
      // Timeout de seguridad para evitar que se quede calculando para siempre
      setTimeout(() => {
        console.log('⏰ [UI][ROUND] Timeout de calculating - forzando fin');
        setIsCalculatingRewards(false);
        setGameStatus('roundEnd');
        
        // Calcular recompensas desde blockchain como fallback
        console.log('⏰ [REWARDS] Timeout alcanzado, calculando desde blockchain');
        calculateRewardsFromBlockchain();
      }, 4000); // 4 segundos máximo
    });

    // FALLBACK: Calcular recompensas automáticamente si no llega ROUND_END del servidor
    const calculateRewardsFromBlockchain = () => {
      console.log('⛏️ [REWARDS] Calculando recompensas desde blockchain local');
      const roundRewards = {};
      
      // Obtener bloques de la ronda anterior (round: 0 para ronda 1)
      const currentRoundBlocks = minedBlocks.filter(block => block.round === 0);
      console.log(`⛏️ [REWARDS] Bloques de la ronda 0 (ronda actual):`, currentRoundBlocks);
      
      currentRoundBlocks.forEach(block => {
        if (block.winner && block.winner.isCorrect) {
          const winnerId = block.winner.userId;
          if (!roundRewards[winnerId]) {
            roundRewards[winnerId] = {};
          }
          roundRewards[winnerId].miningReward = (roundRewards[winnerId].miningReward || 0) + 50;
          console.log(`💰 [REWARDS] ${block.winner.userName || winnerId}: +50 RockCoins (minado desde blockchain)`);
        }
      });
      
      if (Object.keys(roundRewards).length > 0) {
        console.log('🎁 [REWARDS] Recompensas calculadas desde blockchain:', roundRewards);
        setRoundRewards(roundRewards);
      } else {
        console.log('⚠️ [REWARDS] No se encontraron bloques minados correctamente');
      }
    };

    // Listener para ROUND_END - reconciliación autoritativa
    getWebSocket().off('ROUND_END');
    getWebSocket().on('ROUND_END', (data) => {
      console.log('🏁 [ROUND_END] payload:', data);

      // 1) Estado base
      setGameStatus('roundEnd');
      setIsCalculatingRewards(false);
      if (data.winningIndustry) setWinningIndustry(data.winningIndustry);

      // 2) Actualizar roundMeta con datos autoritativos del servidor
      if (data.winningIndustry && data.waste?.rewardAppliedPerUser) {
        setRoundMeta({
          round: data.round || round,
          winningIndustry: data.winningIndustry,
          wasteRewardApplied: data.waste.rewardAppliedPerUser,
          roundSeed: `${gameId}:${data.round || round}:${Date.now()}`
        });
      }

      // 3) Cartelitos desde server (si vienen): mining[], waste{}
      const rewards = {};
      if (Array.isArray(data.mining)) {
        data.mining.forEach(m => {
          // server: { userId, userName, rockCoins, blockId }
          if (!rewards[m.userId]) rewards[m.userId] = {};
          rewards[m.userId].miningReward = m.rockCoins ?? 50;
        });
      }
      if (data.waste?.winners?.length) {
        data.waste.winners.forEach(winnerId => {
          if (!rewards[winnerId]) rewards[winnerId] = {};
          rewards[winnerId].wasteRemoved = data.waste.rewardAppliedPerUser ?? 0;
        });
      }
      setRoundRewards(rewards);

      // 4) Balances finales → inventario y ranking global
      if (data.balances && data.balances[userId]) {
        const finalMe = data.balances[userId];
        setWebSocketInventory(prev => ({ ...prev, rockCoins: finalMe.rockCoins, waste: finalMe.waste }));
      }
      if (data.balances && Array.isArray(allPlayersData) && allPlayersData.length) {
        const updatedPlayers = allPlayersData.map(p => {
          const fb = data.balances[p.userId];
          return fb ? { ...p, rockCoins: fb.rockCoins, waste: fb.waste } : p;
        });
        setAllPlayersData(updatedPlayers);
      }
    });

    // Listener para round_meta (meta global de ronda)
    getWebSocket().off('round_meta');
    getWebSocket().on('round_meta', (data) => {
      console.log('🎯 [ROUND_META] Meta de ronda recibida:', data);
      setRoundMeta(data);
      if (data.winningIndustry) {
        setWinningIndustry(data.winningIndustry);
        console.log('🎯 [ROUND_META] winningIndustry actualizado a:', data.winningIndustry);
      }
      console.log('🎯 [ROUND_META] wasteRewardApplied:', data.wasteRewardApplied);
    });

    // Safety net en game_status
    getWebSocket().off('game_status');
    getWebSocket().on('game_status', (data) => {
      if (data.status === 'roundEnd') {
        setRound(data.round || 1);
        setTimeout(() => {
          if (!roundRewards) {
            console.log('🛟 [SAFETY] No llegó ROUND_END aún → rehydrate_end_of_round');
            getWebSocket().emit('rehydrate_end_of_round', { gameId });
          }
        }, 2000);
        return;
      }
      // ...otros estados
    });

    getWebSocket().on('game_completed', (data) => {
      setGameStatus('completed');
      safeNavigate('GameResults');
    });

    // ELIMINADO: Listener legacy rewards_assigned - solo usar ROUND_END

    // NUEVOS LISTENERS PARA FINAL DE RONDA
    // === SISTEMA DE READY PARA NEXT ROUND ===
    
    // Listener para progreso de ready
    getWebSocket().on('round:ready:progress', (data) => {
      console.log('⏭️ [ROUND:READY] Progreso de jugadores listos:', data);
      setRoundReadyProgress({
        readyCount: data.readyCount,
        totalPlayers: data.totalPlayers,
        readyList: data.readyList
      });
      // NO cambiar gameStatus aquí - solo guardar progreso
      // NO navegar aquí - cada jugador navega cuando pulsa Next Round
    });

    // Listener para errores de ready
    getWebSocket().on('round:ready:error', (data) => {
      console.error(`❌ [ROUND:READY] Error en transición de ronda:`, data);
      // Resetear el estado de ready
      setIsReadyForNextRound(false);
      setRoundReadyProgress({ readyCount: 0, totalPlayers: 0, readyList: [] });
      // Mostrar mensaje de error al usuario
      console.error(`❌ [ROUND:READY] ${data.message}`);
    });

    // Listener para todos listos
    getWebSocket().on('round:ready:all', (data) => {
      console.log('🎉 [ROUND:READY] Todos los jugadores listos:', data);
      
      // Solo el host puede iniciar la siguiente ronda
      if (userId === hostId) {
        console.log('🚀 [HOST] Todos listos, iniciando siguiente ronda automáticamente...');
        startNextRound();
      } else {
        console.log('⏳ [PLAYER] Esperando a que el host inicie la siguiente ronda...');
      }
    });

    // Listener para preparando siguiente ronda
    getWebSocket().on('next_round:preparing', (data) => {
      console.log('🔄 [NEXT_ROUND] Preparando siguiente ronda:', data);
      setGameStatus('preparingNextRound');
    });

    // Listener para ronda preparada
    getWebSocket().on('next_round:prepared', (data) => {
      console.log('✅ [NEXT_ROUND] Ronda preparada:', data);
      setRound(data.round);
      setRoundMeta(data.roundMeta);
      setMarketData(data.market);
      setProductsData(data.products);
      setRoundTime(new Date(data.roundTimeISO));
      setGameStatus('startingNextRound');
    });

    // Listener para countdown de inicio
    getWebSocket().on('starting_next_round', (data) => {
      console.log('🚀 [NEXT_ROUND] Iniciando ronda en 3 segundos:', data);
      // Resetear calculating para evitar overlays en nueva ronda
      setIsCalculatingRewards(false);
    });

    // Listener para nueva ronda iniciada
    getWebSocket().on('new_round', (data) => {
      console.log('🎮 [NEW_ROUND] Nueva ronda iniciada:', data);
      
      // 1) RESET completo de todos los flags del fin de ronda anterior
      setIsCalculatingRewards(false);
      setRoundRewards(null);
      setWinningIndustry(null);
      setIsWaitingNextRoundLocal(false);
      setRoundEndedSent(false);
      setMinedBlocks([]);
      setNextRoundWaiting(false);
      setRoundReadyProgress({ readyCount: 0, totalPlayers: 0, readyList: [] });
      
      // 2) Estado base de la ronda nueva
      setRound(data.round);
      setGameStatus('in_progress');
      setRoundTime(new Date(data.roundTimeISO));
      setRoundMeta(data.roundMeta);
      setMarketData(data.market);
      setProductsData(data.products);
      
      // 3) Resetear flags del timer para nueva ronda
      endRoundCalledRef.current = false;
      
      // 4) Navegación después de todos los resets
      if (safeReset) {
        safeReset('GameTabs');
      } else if (safeNavigate) {
        safeNavigate('GameTabs');
      }
    });

    // Listener para nuevo estado de economía - ELIMINADO (duplicado con handleEconomyState)

    // Listener para transición a pantalla de espera
    getWebSocket().on('game_status', (data) => {
      console.log('🔌 [GAME_STATUS] Recibiendo game_status - Estado actual:', gameStatus, 'Nuevo estado:', data.status);
      
      // NO cambiar gameStatus si es roundEnd - se maneja en ROUND_END
      if (data.status === 'roundEnd') {
        console.log('🎮 [GAME_STATUS] Estado roundEnd recibido - esperando ROUND_END para cambiar status');
        if (data.round !== undefined && data.round !== null) {
          setRound(data.round);
          console.log('🎮 [GAME_STATUS] Ronda actualizada a:', data.round);
        }
        return;
      }
      
      console.log('🎮 [GAME_STATUS] Cambiando gameStatus de', gameStatus, 'a', data.status);
      setGameStatus(data.status);
      if (data.round !== undefined && data.round !== null) {
        setRound(data.round);
        console.log('🎮 [GAME_STATUS] Ronda actualizada a:', data.round);
      }
      
      // Navegación basada en estado
      if (data.status === 'starting') {
        console.log('🎮 [GAME_STATUS] Navegando a WaitingRoom - estado starting');
        safeNavigate('WaitingRoom');
      }
      // ELIMINADO: Auto-navegación por waitingForNextRound - cada jugador navega cuando pulsa Next Round
    });

    // SISTEMA ORIGINAL DE CALCULATING REWARDS (como funcionaba ayer)
    getWebSocket().on('ROUND_CALCULATING', (data) => {
      console.log('🔄 [ROUND_CALCULATING] Calculando recompensas...', data);
      setIsCalculatingRewards(true);
      // NO navegar automáticamente - EndOfRound manejará su propio calculating state
    });

    // ELIMINADO: Listener duplicado de ROUND_END - solo mantener el primero

    // Nuevo problema de minado - Separando cola global y local
    getWebSocket().on('new_mining_problem', (data) => {
        console.log('⛏️ Nuevo problema de minado recibido (WebSocket):', data);
      
      const newProblem = {
        id: data.blockId,
        activeProblem: data.problemData, // problemData ES el problema, no problemData.problem
        timestamp: data.timestamp || Date.now(),
        responses: [],
        isCompleted: false
      };
      
      console.log(`🔍 DEBUG: Creando nuevo problema:`, {
        blockId: data.blockId,
        problemData: data.problemData,
        newProblem: newProblem
      });
      
      // ACTUALIZAR COLA GLOBAL (todos los problemas del socket)
      setMiningProblems(prevProblems => {
        const exists = prevProblems.find(p => p.id === data.blockId);
        if (!exists) {
          console.log('✅ Nuevo problema añadido a miningProblems (global):', newProblem);
          
          const updatedProblems = [...prevProblems, newProblem];
          updatedProblems.sort((a, b) => a.timestamp - b.timestamp);
          
          console.log(`🔍 DEBUG: Problemas globales actualizados:`, {
            prevProblemsLength: prevProblems.length,
            updatedProblemsLength: updatedProblems.length
          });
          
          return updatedProblems;
        }
        
        console.log('⚠️ Problema ya existe en miningProblems (global):', data.blockId);
        return prevProblems;
      });

      // ACTUALIZAR COLA LOCAL (solo problemas pendientes para este jugador)
      setLocalPendingProblems(prevLocal => {
        const exists = prevLocal.find(p => p.id === data.blockId);
        if (!exists) {
          console.log('✅ Nuevo problema añadido a localPendingProblems:', newProblem);
          
          const updatedLocal = [...prevLocal, newProblem];
          updatedLocal.sort((a, b) => a.timestamp - b.timestamp);
          
          console.log(`🔍 DEBUG: Problemas locales actualizados:`, {
            prevLocalLength: prevLocal.length,
            updatedLocalLength: updatedLocal.length
          });
          
          // Ajustar currentProblemIndex si es necesario
          if (updatedLocal.length === 1 || currentProblemIndex >= updatedLocal.length) {
            console.log(`🔍 DEBUG: Ajustando currentProblemIndex de ${currentProblemIndex} a 0`);
            setCurrentProblemIndex(0);
          }
          
          return updatedLocal;
        }
        
        console.log('⚠️ Problema ya existe en localPendingProblems:', data.blockId);
        return prevLocal;
      });
    });

    // Listener para transacciones de productos
    getWebSocket().on('transaction_success', (data) => {
      console.log('🛒 Transacción exitosa recibida:', data);
      if (data.inventory) {
        console.log('📊 Actualizando webSocketInventory con miningQueue:', data.inventory.miningQueue);
        setWebSocketInventory(data.inventory);
        setUserProducts(data.inventory.products);
      }
    });

    // Listener para datos del inventario
    getWebSocket().on('inventory_data', (data) => {
      if (data.inventory) {
        setWebSocketInventory(data.inventory);
        setUserProducts(data.inventory.products);
      }
    });

    // Listener para actualizaciones de datos del usuario
    getWebSocket().on('user_data_updated', (data) => {
      console.log('👤 [CLIENTE] Datos del usuario actualizados:', data);
      if (data.gameId === gameId && data.userId === userId) {
        setUserData(prevData => ({
          ...prevData,
          userName: data.userName || prevData.userName,
          imageUrl: data.imageUrl || prevData.imageUrl
        }));
        console.log('👤 [CLIENTE] Datos del usuario actualizados en el contexto');
      }
    });

    // Listener para actualizaciones del ranking
    getWebSocket().on('player_rankings_updated', (data) => {
      console.log('🏆 [CLIENTE] Ranking actualizado:', data);
      if (data.gameId === gameId) {
        if (Array.isArray(data.playerData)) {
          const sortedPlayers = data.playerData.sort((a, b) => (b.totalRewards || 0) - (a.totalRewards || 0));
          setPlayerRankings(sortedPlayers);
          setAllPlayersData(sortedPlayers);
          console.log('🏆 [CLIENTE] Ranking actualizado en el contexto:', sortedPlayers);
        }
      }
    });

    // Listener para actualizaciones de perfil de jugadores
    getWebSocket().on('player_profile_updated', (data) => {
      console.log('👤 [CLIENTE] Perfil de jugador actualizado:', data);
      if (data.gameId === gameId) {
        // Actualizar datos del jugador en el ranking si es el usuario actual
        if (data.userId === userId) {
          setUserData(prevData => ({
            ...prevData,
            userName: data.userName,
            imageUrl: data.imageUrl
          }));
          console.log('👤 [CLIENTE] Datos del usuario actual actualizados');
        }
        
        // Actualizar datos del jugador en el ranking
        setPlayerRankings(prevRankings => 
          prevRankings.map(player => 
            player.userId === data.userId 
              ? { ...player, userName: data.userName, imageUrl: data.imageUrl }
              : player
          )
        );
        
        setAllPlayersData(prevPlayers => 
          prevPlayers.map(player => 
            player.userId === data.userId 
              ? { ...player, userName: data.userName, imageUrl: data.imageUrl }
              : player
          )
        );
        
        console.log('👤 [CLIENTE] Datos del jugador actualizados en ranking');
      }
    });

    // Listener para actualizaciones de datos del usuario (desde Firebase)
    getWebSocket().on('user_data_updated', (data) => {
      console.log('👤 [CLIENTE] Datos del usuario actualizados desde Firebase:', data);
      if (data.gameId === gameId && data.userId === userId) {
        // Actualizar datos del usuario actual inmediatamente
        setUserData(prevData => ({
          ...prevData,
          userName: data.userName || prevData.userName,
          imageUrl: data.imageUrl || prevData.imageUrl
        }));
        
        // Actualizar en el ranking también
        setPlayerRankings(prevRankings => 
          prevRankings.map(player => 
            player.userId === userId 
              ? { ...player, userName: data.userName || player.userName, imageUrl: data.imageUrl || player.imageUrl }
              : player
          )
        );
        
        setAllPlayersData(prevPlayers => 
          prevPlayers.map(player => 
            player.userId === userId 
              ? { ...player, userName: data.userName || player.userName, imageUrl: data.imageUrl || player.imageUrl }
              : player
          )
        );
        
        console.log('👤 [CLIENTE] Datos del usuario actualizados desde Firebase en el contexto');
      }
    });

    // Listener para bloques minados
    getWebSocket().on('mined_blocks_data', (data) => {
      console.log('⛓️ [CLIENTE] Datos de bloques minados recibidos:', data);
      console.log('⛓️ [CLIENTE] Tipo de data:', typeof data);
      console.log('⛓️ [CLIENTE] data.blocks:', data.blocks);
      console.log('⛓️ [CLIENTE] Array.isArray(data.blocks):', Array.isArray(data.blocks));
      
      if (data.blocks && Array.isArray(data.blocks)) {
        setMinedBlocks(data.blocks);
        console.log('⛓️ [CLIENTE] Bloques minados cargados desde WebSocket:', data.blocks);
        console.log('⛓️ [CLIENTE] Total de bloques minados:', data.blocks.length);
        console.log('⛓️ [CLIENTE] Estado minedBlocks actualizado');
      } else {
        console.log('⚠️ [CLIENTE] No hay bloques válidos en los datos recibidos');
        console.log('⚠️ [CLIENTE] data.blocks es:', data.blocks);
      }
    });

    // Listener para ranking de jugadores
    getWebSocket().on('player_rankings_data', (data) => {
      console.log('🏆 [CLIENTE] Datos de ranking de jugadores recibidos:', data);
      console.log('🏆 [CLIENTE] Tipo de data:', typeof data);
      console.log('🏆 [CLIENTE] data.playerData:', data.playerData);
      console.log('🏆 [CLIENTE] Array.isArray(data.playerData):', Array.isArray(data.playerData));
      
      // PROTECCIÓN: No actualizar si el array está vacío y ya tenemos datos
      if (data.playerData && Array.isArray(data.playerData) && data.playerData.length > 0) {
        // Ordenar por balance (mayor a menor) y por nombre si empatan
        const sortedPlayerData = data.playerData.sort((a, b) => {
          const balanceA = a.rockCoins - a.waste;
          const balanceB = b.rockCoins - b.waste;
          if (balanceA !== balanceB) {
            return balanceB - balanceA; // Mayor balance primero
          }
          return a.userName.localeCompare(b.userName); // Orden alfabético si empatan
        });
        
        console.log('🏆 [CLIENTE] Datos de jugadores ordenados:', sortedPlayerData);
        setAllPlayersData(sortedPlayerData);
        console.log('🏆 [CLIENTE] Estado allPlayersData actualizado');
      } else if (data.playerData && Array.isArray(data.playerData) && data.playerData.length === 0) {
        console.log('⚠️ [CLIENTE] Array de jugadores vacío recibido - manteniendo datos existentes');
        // No actualizar si recibimos un array vacío
        
        // Delay para asegurar que todos los datos estén completamente actualizados antes de navegar
        setTimeout(() => {
          console.log('✅ [CLIENTE] Todos los datos actualizados, desactivando loading y permitiendo navegación');
          setIsCalculatingRewards(false);
        }, 1500); // 1.5 segundos para asegurar que todo esté completamente listo
      } else {
        console.log('⚠️ [CLIENTE] No hay datos de jugadores válidos en los datos recibidos');
        console.log('⚠️ [CLIENTE] data.playerData es:', data.playerData);
      }
    });

    // Listener para actualización de lista de productos
    getWebSocket().on('product_list_updated', (data) => {
      console.log('🛒 [CLIENTE] Lista de productos actualizada:', data);
      if (data && data.productList && Array.isArray(data.productList)) {
        console.log('🛒 [CLIENTE] Actualizando productList con', data.productList.length, 'productos');
        setProductList(data.productList);
      }
    });

    // Listener para problemas de minado
    getWebSocket().on('mining_problems_data', (data) => {
      if (data.problems) {
        console.log('⛏️ Problemas de minado cargados desde WebSocket:', data.problems);
        setMiningProblems(data.problems);
        
        // Ajustar currentProblemIndex si es necesario
        if (data.problems.length > 0 && currentProblemIndex >= data.problems.length) {
          setCurrentProblemIndex(0);
        }
      }
    });

    // Actualización de respuestas de minado
    getWebSocket().on('mining_response_update', (data) => {
      console.log('⛏️ Actualización de respuestas de minado (WebSocket):', data);
      console.log('🔍 Estado actual de results:', results);
      
      // Actualizar los resultados siempre que lleguen datos (no solo cuando esté completado)
      if (data.responses) {
        console.log('📊 Actualizando resultados con respuestas del WebSocket:', data.responses);
        console.log('🏆 Ganador:', data.winner);
        
        // Enriquecer las respuestas con información de usuario
        const enrichedResponses = data.responses.map((res) => ({
          userName: res.userName || "Unknown",
          isCorrect: res.isCorrect,
          response: res.response,
          responseTime: res.responseTime,
          userId: res.userId,
          timestamp: res.timestamp,
          isWinner: data.winner && res.userId === data.winner.userId,
          hasNotResponded: res.hasNotResponded || false
        }));
        
        console.log('📊 Respuestas enriquecidas:', enrichedResponses);
        
        // Ordenar: ganador primero, luego correctos por tiempo, luego incorrectos, luego no respondidos
        const sortedResponses = enrichedResponses.sort((a, b) => {
          // Ganador siempre primero
          if (a.isWinner && !b.isWinner) return -1;
          if (!a.isWinner && b.isWinner) return 1;
          
          // Luego correctos por tiempo
          if (a.isCorrect && !b.isCorrect) return -1;
          if (!a.isCorrect && b.isCorrect) return 1;
          if (a.isCorrect && b.isCorrect) return a.responseTime - b.responseTime;
          
          // Luego incorrectos
          if (!a.isCorrect && !b.isCorrect && !a.hasNotResponded && !b.hasNotResponded) {
            return a.responseTime - b.responseTime;
          }
          
          // Finalmente no respondidos
          if (a.hasNotResponded && !b.hasNotResponded) return 1;
          if (!a.hasNotResponded && b.hasNotResponded) return -1;
          
          return 0;
        });
        
        console.log('📊 Respuestas ordenadas:', sortedResponses);
        
        // Actualizar los resultados en el contexto
        setResults(sortedResponses);
        
        // Actualizar miningProblems solo si el bloque está completado
        if (data.isCompleted) {
          setMiningProblems(prevProblems => {
            const updatedProblems = prevProblems.map(problem => {
              if (problem.id === data.blockId) {
                return {
                  ...problem,
                  responses: enrichedResponses,
                  isCompleted: true
                };
              }
              return problem;
            });
            
            // Si el problema no existe, añadirlo
            const existingProblem = updatedProblems.find(p => p.id === data.blockId);
            if (!existingProblem) {
              updatedProblems.push({
                id: data.blockId,
                responses: enrichedResponses,
                isCompleted: true,
                timestamp: Date.now()
              });
            }
            
            console.log('✅ miningProblems actualizado con bloque completado');
            return updatedProblems;
          });
        }
        
        console.log('✅ Resultados actualizados en el contexto');
      } else {
        console.log('⚠️ Bloque no completado o sin respuestas:', {
          isCompleted: data.isCompleted,
          hasResponses: !!data.responses,
          responsesCount: data.responses?.length
        });
      }
    });

    return () => {
      console.log('🔌 Cleanup: removiendo listeners de WebSocket');
      getWebSocket().off('connection_success');
      getWebSocket().off('connection_lost');
      getWebSocket().off('connection_error');
      getWebSocket().off('game_status');
      getWebSocket().off('start_round');
      getWebSocket().off('new_round');
      getWebSocket().off('round_ended');
      getWebSocket().off('game_completed');
      getWebSocket().off('new_mining_problem');
      getWebSocket().off('mining_response_update');
      getWebSocket().off('transaction_success');
      getWebSocket().off('inventory_data');
      getWebSocket().off('user_data_updated');
      getWebSocket().off('player_rankings_updated');
      getWebSocket().off('player_profile_updated');
    };
  }, [gameId, userId, round]);

  // FUNCIÓN PARA SALIR DEL JUEGO
  const leaveGame = async () => {
    console.log(`🚪 [CLIENTE] Saliendo del juego ${gameId}`);
    
    try {
      // 1. LLAMAR A LA FUNCIÓN FIREBASE
      const leaveGameFunction = httpsCallable(functions, 'leaveGame');
      await callAuthenticatedFunction(
        () => leaveGameFunction({ gameId }),
        'leaveGame'
      );
      
      console.log(`✅ [CLIENTE] Función leaveGame ejecutada exitosamente`);
      
      // 2. NOTIFICAR AL SERVIDOR WEBSOCKET
      if (getWebSocket().isConnected) {
        getWebSocket().emit('leave_game', { gameId, userId });
        console.log(`📡 [CLIENTE] Notificación de salida enviada al WebSocket`);
      }
      
      // 3. LIMPIAR ESTADO LOCAL
      setGameData(null);
      setUserData(prevData => ({
        ...prevData,
        gameData: null
      }));
      setPlayerRankings([]);
      setAllPlayersData([]);
      setWebSocketInventory({ products: [], rockCoins: 600, waste: 0 });
      
      console.log(`🧹 [CLIENTE] Estado local limpiado`);
      
      // 4. NAVEGAR A LA PANTALLA DE LOGIN
      navigation.navigate('Login');
      
    } catch (error) {
      console.error('❌ Error al salir del juego:', error);
      Alert.alert(t('common.error'), t('game.failedToLeaveGame'));
    }
  };

  // FUNCIÓN PARA INICIAR SIGUIENTE RONDA
  const startNextRound = async () => {
    console.log(`🎮 startNextRound llamado por usuario: ${userId}, hostId: ${hostId}, isHost: ${userId === hostId}`);
    
    // Verificar que el usuario es el host
    if (userId !== hostId) {
      console.log('❌ Solo el host puede iniciar la siguiente ronda');
      Alert.alert(t('common.error'), 'Solo el host puede iniciar la siguiente ronda');
      return;
    }
    
    // Verificar que hay al menos 2 jugadores
    // COMENTADO PARA PRUEBAS - Permitir 1 jugador
    // if (playerCount < 2) {
    //   console.log('❌ No se puede iniciar la siguiente ronda con menos de 2 jugadores');
    //   Alert.alert(t('common.error'), 'Se necesitan al menos 2 jugadores para continuar');
    //   return;
    // }
    
    try {
      console.log('🚀 Iniciando siguiente ronda vía Firebase Function...');
      const startNextRoundFunction = httpsCallable(functions, 'startNextRound');
      const result = await callAuthenticatedFunction(
        () => startNextRoundFunction({ gameId }),
        'startNextRound'
      );
      
      console.log('✅ Siguiente ronda iniciada exitosamente en Firestore');
      console.log('📊 Resultado de startNextRound:', result);
      
      // Extraer datos de la respuesta
      const newRound = result.data?.round || (round + 1);
      const roundData = result.data?.data || {};
      
      console.log(`📊 Nueva ronda: ${newRound}`);
      console.log(`📊 Datos de la ronda:`, roundData);
      
      // Notificar al servidor WebSocket sobre la nueva ronda
      if (getWebSocket().isConnected) {
        getWebSocket().emit('start_next_round', { gameId, userId });
        console.log('📡 Notificación de nueva ronda enviada al WebSocket');
        
        // Notificar a todos los jugadores que la ronda está preparada
        getWebSocket().emit('next_round:prepared', {
          gameId,
          round: newRound,
          roundMeta: {
            totalRounds: 3,
            currentRound: newRound
          },
          market: {
            products: [] // Se actualizará desde Firestore
          },
          roundTimeISO: new Date(Date.now() + 3000).toISOString() // 3 segundos de preparación
        });
        
        console.log('📡 Notificación de ronda preparada enviada a todos los jugadores');
      }
      
    } catch (error) {
      console.error('❌ Error al iniciar siguiente ronda:', error);
      Alert.alert(t('common.error'), 'Error al iniciar la siguiente ronda');
    }
  };

  // FUNCIONES DEL JUEGO (HÍBRIDAS)
  const startGame = async () => {
    console.log('🎮 startGame called by user:', userId, 'hostId:', hostId, 'isHost:', userId === hostId);
    console.log('🔌 WebSocket conectado:', isWebSocketConnected);
    console.log('🔌 getWebSocket().isConnected:', getWebSocket().isConnected);
    
    // Verificar que hay al menos 2 jugadores para iniciar
    // COMENTADO PARA PRUEBAS - Permitir 1 jugador
    // if (playerCount < 2) {
    //   console.log('❌ No se puede iniciar el juego con menos de 2 jugadores. Jugadores actuales:', playerCount);
    //   Alert.alert(t('common.error'), t('game.needAtLeastTwoPlayers'));
    //   return;
    // }
    
    try {
      const webSocketService = getWebSocket();
      console.log('🔍 [DEBUG] Estado del WebSocket:', {
        isWebSocketConnected,
        webSocketConnected: webSocketService.isConnected,
        connectionState: webSocketService.getConnectionState(),
        currentGameId: webSocketService.currentGameId,
        currentUserId: webSocketService.currentUserId
      });
      
      if (isWebSocketConnected && webSocketService.isConnected) {
        // Usar WebSocket para coordinación
        console.log('🚀 Iniciando juego vía WebSocket...');
        const result = webSocketService.startGame();
        console.log('🚀 [DEBUG] startGame result:', result);
      } else {
        // Fallback a Firestore
        console.log('📄 Iniciando juego vía Firestore (fallback)...');
        const startGameFunction = httpsCallable(functions, 'startGame');
        await callAuthenticatedFunction(
          () => startGameFunction({ gameId }),
          'startGame'
        );
      }
    } catch (error) {
      console.error('❌ Error en startGame:', error);
      console.error('Error starting the game:', error);
      
      // Intentar fallback si el WebSocket falla
      if (isWebSocketConnected) {
        console.log('🔄 WebSocket falló, intentando fallback a Firestore...');
        try {
          const startGameFunction = httpsCallable(functions, 'startGame');
          await callAuthenticatedFunction(
            () => startGameFunction({ gameId }),
            'startGame'
          );
        } catch (fallbackError) {
          console.error('❌ Error en fallback de startGame:', fallbackError);
          Alert.alert(t('common.error'), 'Error al iniciar el juego. Intenta de nuevo.');
        }
      } else {
        Alert.alert(t('common.error'), 'Error al iniciar el juego. Intenta de nuevo.');
      }
    }
  };

  // Función para refrescar los datos del usuario y ranking
  const refreshUserData = () => {
    console.log('🔄 Refrescando datos del usuario y ranking...');
    
    if (getWebSocket().isConnected) {
      // Solicitar actualización de datos del usuario
      getWebSocket().emit('request_user_data', { gameId, userId });
      
      // Solicitar actualización del ranking
      getWebSocket().emit('request_player_rankings', { gameId });
      
      console.log('✅ Solicitudes de actualización enviadas al WebSocket');
    } else {
      console.log('⚠️ WebSocket no conectado, no se puede refrescar datos');
    }
  };

  // Función para actualizar datos del usuario inmediatamente (sin esperar Firebase)
  const updateUserDataImmediately = (newUserName, newImageUrl) => {
    console.log('🔄 Actualizando datos del usuario inmediatamente:', { newUserName, newImageUrl });
    
    // Actualizar userData
    setUserData(prevData => ({
      ...prevData,
      userName: newUserName,
      imageUrl: newImageUrl
    }));
    
    // Actualizar en playerRankings
    setPlayerRankings(prevRankings => 
      prevRankings.map(player => 
        player.userId === userId 
          ? { ...player, userName: newUserName, imageUrl: newImageUrl }
          : player
      )
    );
    
    // Actualizar en allPlayersData
    setAllPlayersData(prevPlayers => 
      prevPlayers.map(player => 
        player.userId === userId 
          ? { ...player, userName: newUserName, imageUrl: newImageUrl }
          : player
      )
    );
    
    console.log('✅ Datos del usuario actualizados inmediatamente en el contexto');
  };

  // Protección contra ejecución múltiple
  const readyToPlayExecuted = useRef(false);
  
  const readyToPlay = () => {
    // PROTECCIÓN: Evitar ejecución múltiple
    if (readyToPlayExecuted.current) {
      return;
    }
    
    readyToPlayExecuted.current = true;
    
    if (isWebSocketConnected) {
      console.log('✅ Listo para jugar vía WebSocket...');
      getWebSocket().readyToPlay();
      
      // Timeout para verificar si recibimos start_round
      setTimeout(() => {
        if (gameStatus !== 'in_progress' && !roundTime) {
          console.log('🚀 Forzando start_round manualmente...');
          
          // Forzar start_round manualmente
          const futureTime = new Date(Date.now() + 120000); // 2 minutos
          setGameStatus('in_progress');
          setRoundTime(futureTime);
          setRound(1);
          
          // Navegar a GameTabs
          safeNavigate('GameTabs');
        }
      }, 3000); // 3 segundos de espera
    } else {
      console.log('📄 WebSocket desconectado, forzando directamente...');
      
      // Forzar inmediatamente si no hay WebSocket
      const futureTime = new Date(Date.now() + 120000); // 2 minutos
      setGameStatus('in_progress');
      setRoundTime(futureTime);
      setRound(1);
      
      // Navegar a GameTabs
      safeNavigate('GameTabs');
    }
  };

  // Función para obtener inventario del WebSocket
  const getInventoryFromWebSocket = () => {
    if (isWebSocketConnected && gameId && userId) {
      const webSocketService = getWebSocket();
      if (webSocketService.isConnected && webSocketService.socket) {
        webSocketService.socket.emit('get_inventory', { gameId, userId });
      }
    }
  };

  // Función para obtener bloques minados del WebSocket
  const getMinedBlocksFromWebSocket = () => {
    if (isWebSocketConnected && gameId) {
      console.log('⛓️ Solicitando bloques minados al WebSocket...');
      const webSocketService = getWebSocket();
      if (webSocketService.isConnected && webSocketService.socket) {
        webSocketService.socket.emit('get_mined_blocks', { gameId });
      }
    }
  };

  // Función para obtener ranking de jugadores del WebSocket
  const getPlayerRankingsFromWebSocket = () => {
    if (isWebSocketConnected && gameId) {
      const webSocketService = getWebSocket();
      if (webSocketService.isConnected && webSocketService.socket) {
        webSocketService.socket.emit('get_player_rankings', { gameId });
      }
    }
  };

  // Función para obtener problemas de minado del WebSocket (NO USADA)

  // Función para marcar ready para la siguiente ronda
  const markRoundReady = () => {
    console.log('✅ [READY] Marcando como listo para siguiente ronda');
    const webSocketService = getWebSocket();
    if (webSocketService && webSocketService.isConnected) {
      webSocketService.emit('round:ready', { gameId, userId, round });
      // NO cambiar estado global aquí - solo enviar al servidor
      console.log('✅ [READY] Ready enviado al servidor');
    } else {
      console.error('❌ [READY] WebSocket no conectado');
    }
  };

  const markPlayerReady = async () => {
    if (isWebSocketConnected) {
      // Usar WebSocket para coordinación
      console.log('⏭️ Marcando como listo vía WebSocket...');
      setIsReadyForNextRound(true);
      getWebSocket().readyForNextRound();
    } else {
      // Fallback a Firestore
      console.log('⏭️ Marcando como listo vía Firestore (fallback)...');
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        [`games.${gameId}.readyForNextRound`]: true
      });
      setIsReadyForNextRound(true);
      safeNavigate('WaitingRoom');
    }
  };


  const endRound = () => {
    console.log('🏁 endRound() llamada');
    
    if (isWebSocketConnected) {
      getWebSocket().endRound();
    } else {
      // Fallback a Firestore
      const endRoundFunction = httpsCallable(functions, 'endRound');
      callAuthenticatedFunction(
        () => endRoundFunction({ gameId }),
        'endRound'
      );
    }
  };

  // EFECTO PRINCIPAL - SUSCRIPCIÓN AL JUEGO (FIRESTORE PARA DATOS PERSISTENTES)
  useEffect(() => {
    if (!gameId) {
      console.log('⚠️ No hay gameId, no suscribiendo a juego');
      return;
    }

    // Verificar estado de autenticación
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      console.log('🔐 Estado de autenticación:', user ? `Autenticado como ${user.uid}` : 'No autenticado');
      if (!user) {
        console.error('❌ Usuario no autenticado - esto causará errores de permisos');
      }
    });

    console.log(`🔍 Verificando existencia del documento en Firestore...`);
    console.log(`🔍 Buscando en colección: games, documento: ${gameId}`);
    console.log(`🔍 Usuario actual: ${userId}`);
    
    // El documento del juego debe existir en Firestore (creado por el backend)
    // Si no existe, es un problema del backend, no del WebSocket
    const gameRef = doc(db, 'games', gameId);
    let isSubscribed = true;

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!isSubscribed) return;

      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        const newStatus = gameData.status;
        
        // console.log(`📝 Documento del juego ${gameId} encontrado en Firestore:`, {
        //   status: newStatus,
        //   players: gameData.players?.length || 0,
        //   hostId: gameData.hostId,
        //   gameCode: gameData.gameCode,
        //   productList: gameData.productList?.length || 0
        // });

        // ACTUALIZAR ESTADOS BÁSICOS (siempre desde Firestore)
        // NO sobrescribir gameStatus si estamos en una ronda en progreso
        // EXCEPCIÓN: Permitir cambios si el nuevo estado es también in_progress
        if (gameStatus === 'in_progress' && newStatus !== 'in_progress') {
          return; // Salir sin hacer nada
        } else {
          setGameStatus(newStatus);
        }
        setRound(gameData.round || 1);
        setWinningIndustry(gameData.winningIndustry);
        setPlayerCount(gameData.players?.length || 0);
        setProductList(gameData.productList || []);
        setHostId(gameData.hostId || null);

        // ACTUALIZAR ROUNDTIME
        // PROTECCIÓN: No sobrescribir roundTime si ya tenemos uno válido y el juego está en progreso
        if (gameStatus === 'in_progress' && roundTime && gameData.roundTime) {
          // Mantener roundTime existente
        } else if (gameData.roundTime) {
          let roundTimeDate;
          
          if (typeof gameData.roundTime.toDate === 'function') {
            // Es un Timestamp de Firestore
            roundTimeDate = gameData.roundTime.toDate();
          } else if (typeof gameData.roundTime === 'number') {
            // Es un timestamp (número)
            roundTimeDate = new Date(gameData.roundTime);
          } else if (gameData.roundTime instanceof Date) {
            // Ya es un objeto Date
            roundTimeDate = gameData.roundTime;
          }
          
          if (roundTimeDate) {
            setRoundTime(roundTimeDate);
          } else {
            setRoundTime(null);
          }
        } else {
          // Solo resetear roundTime si no estamos en progreso
          if (gameStatus !== 'in_progress') {
            setRoundTime(null);
          }
        }

        // SUSCRIBIRSE A JUGADORES (siempre desde Firestore)
        if (gameData.players && Array.isArray(gameData.players)) {
          const playerUnsubscribes = gameData.players.map((playerId) => {
            const playerRef = doc(db, 'users', playerId);
            return onSnapshot(playerRef, (playerDoc) => {
              if (playerDoc.exists()) {
                const playerData = playerDoc.data();
                const gameData = playerData.games?.[gameId] || {};
                
                setPlayers((prevPlayers) => {
                  const updatedPlayers = prevPlayers.filter((p) => p.userId !== playerId);
                  updatedPlayers.push({
                    userId: playerId,
                    userName: playerData.userName || "Unknown",
                    rockCoins: gameData.rockCoins || 0,
                    waste: gameData.waste || 0,
                    readyForNextRound: gameData.readyForNextRound || false
                  });
                  return updatedPlayers.sort((a, b) => b.rockCoins - a.rockCoins);
                });
              }
            });
          });
          
          return () => playerUnsubscribes.forEach(unsubscribe => unsubscribe());
        }
      } else {
        console.error(`❌ El documento del juego ${gameId} no existe en Firestore`);
        console.log(`🔄 Esto indica un problema en el backend (createGame/joinGame)`);
        console.log(`🔄 El WebSocket está funcionando correctamente para coordinación`);
        console.log(`🔍 Verificar en Firestore: colección 'games', documento '${gameId}'`);
        console.log(`🔍 NOTA: Si ves documentos en 'gameTriggers', esos NO son juegos reales`);
        console.log(`🔄 Intentando verificar si el documento se crea en los próximos segundos...`);
        
        // Intentar verificar la existencia del documento después de un retraso
        setTimeout(async () => {
          try {
            const checkRef = doc(db, 'games', gameId);
            const checkDoc = await getDoc(checkRef);
            if (checkDoc.exists()) {
              console.log(`✅ Documento del juego ${gameId} encontrado después del retraso`);
            } else {
              console.error(`❌ Documento del juego ${gameId} aún no existe después del retraso`);
              console.log(`🔍 Verificar manualmente en Firestore: colección 'games'`);
            }
          } catch (error) {
            console.error(`❌ Error verificando documento después del retraso:`, error);
          }
        }, 3000);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
      unsubscribeAuth();
    };
    
    // Verificar el documento después de un retraso
    setTimeout(async () => {
      try {
        const checkRef = doc(db, 'games', gameId);
        const checkDoc = await getDoc(checkRef);
        if (checkDoc.exists()) {
          console.log(`✅ Documento del juego ${gameId} verificado después del retraso`);
        } else {
          console.error(`❌ Documento del juego ${gameId} aún no existe después del retraso`);
          console.log(`🔍 Verificar manualmente en Firestore: colección 'games'`);
        }
      } catch (error) {
        console.error(`❌ Error verificando documento después del retraso:`, error);
      }
    }, 2000);
  }, [gameId, isWebSocketConnected]);

  // EFECTO PARA SUSCRIBIRSE A LOS DATOS DEL USUARIO ACTUAL (incluyendo miningQueue)
  useEffect(() => {
    if (!gameId || !userId) {
      console.log('⚠️ No hay gameId o userId, no suscribiendo a datos del usuario');
      return;
    }

    console.log(`🔄 Suscribiendo a datos del usuario ${userId} para juego ${gameId}`);
    
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const gameData = userData.games?.[gameId] || {};
        
        console.log(`📝 Datos del usuario actualizados:`, {
          userName: userData.userName,
          imageUrl: userData.imageUrl,
          gameData: gameData
        });
        
        // Actualizar datos del usuario en el contexto
        setUserData({
          userName: userData.userName || 'Player',
          imageUrl: userData.imageUrl || null,
          ...gameData
        });
        
        // Si hay cambios en el perfil, solicitar actualización del ranking
        if (userData.userName || userData.imageUrl) {
          console.log(`🔄 Perfil actualizado, solicitando actualización del ranking`);
          // Solicitar actualización del ranking al WebSocket
          if (getWebSocket().isConnected) {
            getWebSocket().emit('request_player_update', { 
              gameId, 
              userId, 
              userName: userData.userName,
              imageUrl: userData.imageUrl 
            });
          }
        }
      }
    });

    return () => {
      console.log(`🧹 Desuscribiendo de datos del usuario ${userId}`);
      unsubscribe();
    };
  }, [gameId, userId]);

  // EFECTO PARA CARGAR PROBLEMAS YA RESPONDIDOS DESDE FIRESTORE
  useEffect(() => {
    if (!gameId || !userId) return;

    const loadRespondedProblems = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const gameData = userData.games?.[gameId] || {};
          const respondedProblems = gameData.respondedProblems || {};
          
          // Convertir a Set para el estado local
          const respondedSet = new Set(Object.keys(respondedProblems));
          setMiningHistory(respondedSet);
          
          console.log(`📋 Cargados ${respondedSet.size} problemas ya respondidos desde Firestore`);
        }
      } catch (error) {
        console.error('❌ Error cargando problemas respondidos:', error);
      }
    };

    loadRespondedProblems();
  }, [gameId, userId]);

  // EFECTO PARA CALCULAR MINING QUEUE BASADO EN COLA LOCAL
  useEffect(() => {
    console.log('🔄 useEffect miningQueue ejecutándose...');
    console.log('📊 localPendingProblems.length:', localPendingProblems.length);
    console.log('📊 localPendingProblems:', localPendingProblems.map(p => ({ id: p.id, hasActiveProblem: !!p.activeProblem })));
    console.log('📊 miningHistory:', Array.from(miningHistory));
    
    // Filtrar solo los problemas que NO han sido respondidos
    const pendingProblems = localPendingProblems.filter(problem => !miningHistory.has(problem.id));
    const queueCount = pendingProblems.length;
    
    console.log(`📊 Calculando miningQueue: ${localPendingProblems.length} total, ${queueCount} pendientes`);
    console.log(`📊 Problemas pendientes:`, pendingProblems.map(p => p.id));
    
    setMiningQueue(queueCount);
    
    // Si no hay problemas pendientes, resetear el índice actual
    if (queueCount === 0) {
      setCurrentProblemIndex(0);
    }
  }, [localPendingProblems, miningHistory]);

  // EFECTO PARA EL TEMPORIZADOR DE COUNTDOWN
  useEffect(() => {
    console.log("🕒 roundTime:", roundTime);
    console.log("🎮 gameStatus:", gameStatus);

    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!roundTime) {
      console.log("⚠️ No hay roundTime, manteniendo countdown en 120");
      setCountdown(120);
      return;
    }

        console.log("⏰ [TIMER] Iniciando temporizador con roundTime:", roundTime);

    intervalRef.current = setInterval(() => {
      // Usar estado autoritativo si está disponible, sino fallback a roundTime
      const roundEndsAtMs = authoritativeState?.roundEndsAtMs || roundTime?.getTime();
      
      if (!roundEndsAtMs) {
        setCountdown(120);
        return;
      }

      // Calcular tiempo restante usando tiempo corregido
      const remainingMs = calculateRemainingTime(roundEndsAtMs);
      const totalSecondsLeft = Math.max(0, Math.floor(remainingMs / 1000));
      
      // Debug del timer (solo en casos críticos)
      if (gameStatus === 'in_progress' && totalSecondsLeft <= 5 && totalSecondsLeft > 0) {
        console.log(`⏰ [TIMER] Últimos segundos: ${totalSecondsLeft}s (drift: ${clockDrift}ms)`);
      }
      
      // Activar loading cuando countdown llegue a 0 SOLO si estamos en in_progress
      if (totalSecondsLeft <= 0 && !endRoundCalledRef.current && gameStatus === 'in_progress') {
        console.log("🏁 [TIMER] Countdown llegó a 0 - activando loading de calculating rewards");
        endRoundCalledRef.current = true;
        setIsCalculatingRewards(true);
        
        // LIMPIAR EL TIMER INMEDIATAMENTE para evitar bucles
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          console.log("🧹 [TIMER] Timer limpiado al llegar a 0");
        }
        
        // Navegación automática a EndOfRound cuando timer llegue a 0
        console.log('🧭 [TIMER] Navegando a EndOfRound (modo loader)');
        console.log('🧭 [TIMER] safeNavigate disponible:', !!safeNavigate);
        console.log('🧭 [TIMER] gameId:', gameId, 'userId:', userId);
        
        if (safeNavigate) {
          console.log('🧭 [TIMER] Ejecutando safeNavigate("EndOfRound")');
          safeNavigate('EndOfRound');
          console.log('🧭 [TIMER] safeNavigate ejecutado');
        } else {
          console.error('❌ [TIMER] safeNavigate no disponible');
        }
        
        // Solicitar al servidor que procese el final de ronda (solo una vez)
        if (!roundEndedSent) {
          console.log("📡 [TIMER] Solicitando final de ronda al servidor");
          const webSocketService = getWebSocket();
          if (webSocketService.isConnected) {
            console.log("📡 [TIMER] Emitiendo round_ended al servidor:", { gameId, userId, round });
            webSocketService.emit('round_ended', { gameId, userId, round });
            setRoundEndedSent(true);
          } else {
            console.error("❌ [TIMER] WebSocket no conectado, no se puede emitir round_ended");
          }
        } else {
          console.log("📡 [TIMER] round_ended ya enviado, omitiendo");
        }
      }

        if (gameStatus === 'in_progress') {
          setCountdown(prevCountdown => {
            if (prevCountdown !== totalSecondsLeft) {
              // Solo log cada 10 segundos o en los últimos 10
              if (totalSecondsLeft % 10 === 0 || totalSecondsLeft <= 10) {
                console.log(`⏰ [TIMER] Countdown: ${totalSecondsLeft}s`);
              }
              return totalSecondsLeft;
            }
            return prevCountdown;
          });
      } else if (gameStatus === 'roundEnd') {
        // Cuando el estado es 'roundEnd', NO interrumpir el timer - dejar que continúe hasta que llegue a 0 naturalmente
        // Solo actualizar countdown si aún no ha llegado a 0
        if (totalSecondsLeft > 0) {
          setCountdown(totalSecondsLeft);
        } else {
          setCountdown(0);
        }
      } else {
        // console.log("⏳ countdown tick (otros estados):", totalSecondsLeft, "- manteniendo en 120");
        // En otros estados, mantener countdown en 120
        setCountdown(120);
      }
    }, 1000);

    return () => {
      console.log("🧹 Limpiando temporizador");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roundTime, gameStatus, clockDrift, authoritativeState, endRoundCalledRef.current, roundEndedSent]);

  // EFECTO ADICIONAL PARA LIMPIAR TIMER AL DESMONTAJE
  useEffect(() => {
    return () => {
      console.log("🧹 Cleanup del contexto: limpiando timer");
      console.log("🧹 navigationRef.current al desmontar:", !!navigationRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // EFECTO DESHABILITADO: Problemas de minado ahora se manejan solo vía WebSocket
  // useEffect(() => {
  //   if (!gameId) return;
  //   
  //   const blocksRef = collection(db, 'blockchain', gameId, 'blocks');
  //   const unsubscribeBlocks = onSnapshot(blocksRef, (snapshot) => {
  //     const problems = [];
  //     const seenProblems = new Set();

  //     snapshot.forEach((doc) => {
  //       const data = doc.data();
  //       if (
  //         data.activeProblem && 
  //         data.isActive !== false && 
  //         !data.winner && 
  //         !data.responses?.some(r => r.userId === userId) &&
  //         !seenProblems.has(doc.id)
  //       ) {
  //         problems.push({
  //           id: doc.id,
  //           activeProblem: data.activeProblem,
  //           timestamp: data.timestamp || data.createdAt?.toMillis() || Date.now(),
  //           responses: data.responses || []
  //         });
  //         seenProblems.add(doc.id);
  //       }
  //     });

  //     problems.sort((a, b) => a.timestamp - b.timestamp);
  //     setMiningProblems(problems);
  //     
  //     if (problems.length === 0 || currentProblemIndex >= problems.length) {
  //       setCurrentProblemIndex(0);
  //     }
  //   });

  //   return () => unsubscribeBlocks();
  // }, [gameId, userId, currentProblemIndex]);

  useEffect(() => {
    if (!gameId || !userId) return;

    const userRef = doc(db, 'users', userId);
    const unsubscribeUser = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setUserData({
          userName: data.userName || "Unknown",
          image: data.image || "",
        });

        const userGames = data.games || {};
        const gameData = userGames[gameId] || {};
        setUserProducts(gameData.products || []);
      }
    });

    return () => unsubscribeUser();
  }, [gameId, userId]);

  useEffect(() => {
    if (!gameId) return;

    const marketRef = doc(db, 'market', gameId);
    const unsubscribeMarket = onSnapshot(marketRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setMarketData(docSnapshot.data());
      }
    });

    return () => unsubscribeMarket();
  }, [gameId]);

  // FUNCIONES DE MINERÍA (actualizadas para cálculo local)
  const incrementMiningQueue = () => {
    console.log('📈 Incrementando miningQueue (manejado localmente)');
    // No hacer nada - se calcula automáticamente desde miningProblems
  };
  
  const decrementMiningQueue = async () => {
    console.log('📉 Decrementando miningQueue (manejado localmente)');
    // No hacer nada - se calcula automáticamente desde miningProblems
  };
  const hasRespondedToProblem = (blockId) => miningHistory.has(blockId);
  const markProblemAsResponded = async (blockId) => {
    console.log(`✅ Marcando problema ${blockId} como respondido`);
    setMiningHistory(prev => new Set([...prev, blockId]));
    
    // REMOVER DE LA COLA LOCAL (pero mantener en la cola global)
    setLocalPendingProblems(prevLocal => {
      const updatedLocal = prevLocal.filter(problem => problem.id !== blockId);
      console.log(`🗑️ Problema ${blockId} removido de cola local: ${prevLocal.length} -> ${updatedLocal.length}`);
      return updatedLocal;
    });
    
    // También actualizar en Firestore para sincronización
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        [`games.${gameId}.respondedProblems.${blockId}`]: true
      });
      console.log(`✅ Problema ${blockId} marcado como respondido en Firestore`);
    } catch (error) {
      console.error(`❌ Error marcando problema como respondido en Firestore:`, error);
    }
  };

  const getNextAvailableProblem = () => {
    if (!localPendingProblems.length) return null;
    
    // Buscar el primer problema en la cola local (ya están filtrados los no respondidos)
    for (let i = 0; i < localPendingProblems.length; i++) {
      if (!hasRespondedToProblem(localPendingProblems[i].id)) {
        return i;
      }
    }
    return null;
  };

  const setMiningStartTimestamp = () => {
    const timestamp = Date.now();
    setMiningStartTime(timestamp);
    console.log('⏰ Timestamp de apertura del minado establecido:', timestamp);
  };

  const getMiningStartTimestamp = () => {
    return miningStartTime;
  };

  const resetMiningStartTimestamp = () => {
    setMiningStartTime(null);
    console.log('🔄 Timestamp de apertura del minado reseteado');
  };

  const nextProblem = () => {
    const nextIndex = getNextAvailableProblem();
    if (nextIndex !== null) {
      console.log(`⛏️ Navegando al siguiente problema: índice ${nextIndex}`);
      setCurrentProblemIndex(nextIndex);
    } else {
      console.log(`⛏️ No hay más problemas disponibles`);
    }
  };

  const hasMoreProblems = () => {
    const hasMore = getNextAvailableProblem() !== null;
    console.log(`⛏️ ¿Hay más problemas? ${hasMore} (miningQueue: ${miningQueue})`);
    return hasMore;
  };

  // Log del estado antes de renderizar
  // console.log('🎮 GameProviderHybrid renderizando con:', {
  //   gameStatus,
  //   isWebSocketConnected,
  //   hostId,
  //   roundTime
  // });

  return (
    <GameContextHybridRobust.Provider value={{
      // Parámetros de navegación
      gameId,
      userId,
      
      // Estados
      miningQueue, incrementMiningQueue, decrementMiningQueue,
      
      // Estados de feedback educativo
      educationalFeedback,
      showEducationalFeedback,
      dismissEducationalFeedback,
      
      // Sistema de progreso de aprendizaje
      learningProgress,
      updateLearningProgress,  
      miningProblems, localPendingProblems, currentProblemIndex, setCurrentProblemIndex, nextProblem, hasMoreProblems,
      hasRespondedToProblem, markProblemAsResponded, getNextAvailableProblem,
      setMiningStartTimestamp, getMiningStartTimestamp, resetMiningStartTimestamp,
      showMiningBubble, setShowMiningBubble,
      countdown, productList,
      gameStatus, playerCount, players, round, userData, userProducts, marketData,
      isWaiting, setIsWaiting,
      results, setResults,
      correctAnswer, setCorrectAnswer,
      currentBlockId, setCurrentBlockId,
      currentTransactionUserName, setCurrentTransactionUserName,
      currentProductDetails, setCurrentProductDetails,
      currentTransactionType, setCurrentTransactionType,
      isReadyForNextRound, markPlayerReady,
      winningIndustry,
      hostId,
      roundTime,
      safeNavigate,
      safeReset,
      refreshUserData,
      updateUserDataImmediately,
      
              // Inventario del WebSocket
              webSocketInventory,
              setWebSocketInventory,
        getInventoryFromWebSocket,
        minedBlocks,
        playerRankings,
        allPlayersData,
        getMinedBlocksFromWebSocket,
        getPlayerRankingsFromWebSocket,
        isCalculatingRewards,
        roundRewards,
        setRoundRewards,
        roundMeta,
      
      // Sistema de Ready para Next Round
      nextRoundWaiting, setNextRoundWaiting,
      roundReadyProgress, setRoundReadyProgress,
      
      // Funciones del juego
      startGame,
      startNextRound,
      readyToPlay,
      endRound,
      markRoundReady,
      leaveGame,
      
      // Estados para Next Round
      nextRoundWaiting,
      roundReadyProgress,
      isWaitingNextRoundLocal,
      setIsWaitingNextRoundLocal,
      
      // WebSocket
      isWebSocketConnected,
      webSocketService: getWebSocket(),
      
      // Coordinación en tiempo real
      clockDrift,
      authoritativeState,
      requestResync,
      applyAuthoritativeState,
      calculateRemainingTime,
      getCorrectedTime,
      getWebSocket
    }}>
      {children}
    </GameContextHybridRobust.Provider>
  );
};

export const useGameContextHybridRobust = () => {
  const context = useContext(GameContextHybridRobust);
  if (!context) {
    throw new Error('useGameContextHybridRobust must be used within a GameProviderHybridRobust');
  }
  return context;
};
