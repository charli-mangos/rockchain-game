import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, functions, auth } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';

export const GameContextHybridRobust = createContext();

export const GameProviderHybridRobust = ({ children, gameId, userId, navigation }) => {
  
  // Validar que gameId y userId son válidos
  if (!gameId || !userId) {
    console.error('❌ GameProviderHybrid: gameId o userId son undefined:', { gameId, userId });
    console.error('❌ Esto indica un problema en el flujo de creación de juego');
    return null;
  }

  // Helper para obtener la instancia del WebSocketService
  const getWebSocket = () => getWebSocketService();
  
  // Estados del juego
  const [countdown, setCountdown] = useState(120);
  const [roundTime, setRoundTime] = useState(null);
  const [round, setRound] = useState(0);
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
  const [isWaiting, setIsWaiting] = useState(false);
  const [roundReadyError, setRoundReadyError] = useState(null);
  const [results, setResults] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [currentTransactionUserName, setCurrentTransactionUserName] = useState(null);
  const [currentProductDetails, setCurrentProductDetails] = useState(null);
  const [currentTransactionType, setCurrentTransactionType] = useState(null);
  const [miningHistory, setMiningHistory] = useState(new Set());

  // REFS
  const navigationRef = useRef(navigation);
  const hasNavigatedRef = useRef(false);
  const currentScreenRef = useRef(null);
  const intervalRef = useRef(null);
  const endRoundCalledRef = useRef(false);
  const roundTimerCalledRef = useRef(false);

  useEffect(() => {
    console.log('🔗 Estableciendo navigationRef:', !!navigation);
    navigationRef.current = navigation;
  }, [navigation]);

  // FUNCIONES DE NAVEGACIÓN
  const safeNavigate = (screen, params = {}) => {
    if (navigationRef.current && typeof navigationRef.current.navigate === 'function') {
      if (currentScreenRef.current === screen) return;
      currentScreenRef.current = screen;
      navigationRef.current.navigate(screen, { ...params, gameId, userId });
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
      setGameStatus(data.status);
      setRound(data.round || 1);
      
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
    });

    // NUEVO: Listener para ROUND_END con payload completo
    getWebSocket().on('ROUND_END', (data) => {
      console.log('🏁 [UI][ROUND] END round=', data.round, 'winners=', data.mining.length, 'winningIndustry=', data.winningIndustry);
      setGameStatus('roundEnd');
      setWinningIndustry(data.winningIndustry);
      setIsCalculatingRewards(false);
      
      // Procesar datos de recompensas para crear roundRewards
      const roundRewards = {};
      
      // Procesar recompensas de minado
      if (data.mining && data.mining.length > 0) {
        data.mining.forEach(miningReward => {
          if (!roundRewards[miningReward.winnerUserId]) {
            roundRewards[miningReward.winnerUserId] = {};
          }
          roundRewards[miningReward.winnerUserId].miningReward = miningReward.rewardApplied || 50;
        });
      }
      
      // Procesar recompensas de waste
      if (data.waste && data.waste.winners && data.waste.winners.length > 0) {
        data.waste.winners.forEach(winnerId => {
          if (!roundRewards[winnerId]) {
            roundRewards[winnerId] = {};
          }
          roundRewards[winnerId].wasteRemoved = data.waste.rewardAppliedPerUser || 0;
        });
      }
      
      console.log('💰 [ROUND_END] roundRewards procesados:', roundRewards);
      setRoundRewards(roundRewards);
      
      // Actualizar inventarios con balances finales
      if (data.balances && data.balances[userId]) {
        const finalBalance = data.balances[userId];
        setWebSocketInventory(prev => ({
          ...prev,
          rockCoins: finalBalance.rockCoins,
          waste: finalBalance.waste
        }));
      }
      
      // Actualizar datos de jugadores con balances finales
      if (data.balances) {
        const updatedPlayers = allPlayersData.map(player => {
          const finalBalance = data.balances[player.userId];
          if (finalBalance) {
            return {
              ...player,
              rockCoins: finalBalance.rockCoins,
              waste: finalBalance.waste
            };
          }
          return player;
        });
        setAllPlayersData(updatedPlayers);
      }
    });

    // LEGACY: Mantener listener original para compatibilidad
    getWebSocket().on('round_ended', (data) => {
      console.log('🏁 Fin de ronda (WebSocket):', data);
      setGameStatus(data.status || 'roundEnd');
      setWinningIndustry(data.winningIndustry);
      console.log('🎮 Estado actualizado a roundEnd - GameTabs se encargará de la navegación');
      
      // Resetear flags
      hasNavigatedRef.current = false;
      endRoundCalledRef.current = false;
    });

    getWebSocket().on('game_completed', (data) => {
      setGameStatus('completed');
      safeNavigate('GameResults');
    });

    // Listener para recompensas asignadas
    getWebSocket().on('rewards_assigned', (data) => {
      console.log('💰 Recompensas asignadas recibidas:', data);
      // Las recompensas se manejan en EndOfRoundScreen
    });

    // NUEVOS LISTENERS PARA FINAL DE RONDA
    // Listener para progreso de ready
    getWebSocket().on('round:ready:progress', (data) => {
      console.log('⏭️ [ROUND:READY] Progreso de jugadores listos:', data);
      // TODO: Mostrar progreso en la UI si es necesario
    });

    // Listener para errores de ready
    getWebSocket().on('round:ready:error', (data) => {
      console.error('❌ [ROUND:READY] Error:', data);
      console.error('❌ [ROUND:READY] Detalles del error:', {
        message: data.message,
        currentStatus: data.currentStatus,
        expectedStatus: data.expectedStatus
      });
      
      // Resetear estado de ready
      setIsReadyForNextRound(false);
      
      // Mostrar error en la UI
      setRoundReadyError(data.message);
      
      // Limpiar error después de 5 segundos
      setTimeout(() => {
        setRoundReadyError(null);
      }, 5000);
      
      console.error('❌ [ROUND:READY] Estado resetado, el usuario puede intentar de nuevo');
    });

    // Listener para nuevo estado de economía
    getWebSocket().on('economy:state', (data) => {
      console.log('🏪 [ECONOMY] Nuevo estado de economía recibido:', data);
      if (data.market) {
        setProductList(data.market.products || []);
        console.log(`🏪 [ECONOMY] Productos actualizados: ${data.market.products?.length || 0} productos`);
      }
    });

    // Listener para transición a pantalla de espera
    getWebSocket().on('game_status', (data) => {
      console.log('🔌 Recibiendo game_status - Estado actual:', gameStatus, 'Nuevo estado:', data.status);
      setGameStatus(data.status);
      setRound(data.round || 1);
      
      // Navegación basada en estado
      if (data.status === 'starting') {
        console.log('🎮 Navegando a WaitingRoom - estado starting');
        safeNavigate('WaitingRoom');
      } else if (data.status === 'waitingForNextRound') {
        console.log('🎮 Navegando a EndOfRoundWaiting - estado waitingForNextRound');
        safeNavigate('EndOfRoundWaiting');
      }
    });

    // Listener para round_ended informativo
    getWebSocket().on('round_ended', (data) => {
      console.log('🏁 [ROUND_ENDED] Ronda terminada:', data);
      if (data.persisted) {
        console.log('✅ [ROUND_ENDED] Datos de ronda persistidos exitosamente');
      }
    });

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
      
      if (data.playerData && Array.isArray(data.playerData)) {
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
    };
  }, [gameId, userId, round]);

  // FUNCIONES DEL JUEGO (HÍBRIDAS)
  const startGame = async () => {
    console.log('🎮 startGame called by user:', userId, 'hostId:', hostId, 'isHost:', userId === hostId);
    console.log('🔌 WebSocket conectado:', isWebSocketConnected);
    console.log('🔌 getWebSocket().isConnected:', getWebSocket().isConnected);
    
    if (isWebSocketConnected) {
      // Usar WebSocket para coordinación
      console.log('🚀 Iniciando juego vía WebSocket...');
      getWebSocket().startGame();
    } else {
      // Fallback a Firestore
      console.log('📄 Iniciando juego vía Firestore (fallback)...');
      const startGameFunction = httpsCallable(functions, 'startGame');
      await callAuthenticatedFunction(
        () => startGameFunction({ gameId }),
        'startGame'
      );
    }
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

  // NUEVA FUNCIÓN: Marcar como listo para la siguiente ronda (nuevo sistema)
  const markRoundReady = async () => {
    if (isWebSocketConnected) {
      console.log(`⏭️ [ROUND:READY] Marcando como listo para ronda ${round} vía WebSocket...`);
      console.log(`⏭️ [ROUND:READY] gameId: ${gameId}, userId: ${userId}, round: ${round}`);
      console.log(`⏭️ [ROUND:READY] WebSocket conectado: ${isWebSocketConnected}`);
      console.log(`⏭️ [ROUND:READY] WebSocket service:`, getWebSocket());
      setIsReadyForNextRound(true);
      getWebSocket().roundReady(gameId, userId, round);
    } else {
      // Fallback a Firestore
      console.log(`⏭️ [ROUND:READY] Marcando como listo vía Firestore (fallback)...`);
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
        setRound(gameData.round || 0);
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
        
        // Actualizar datos del usuario si es necesario
        if (gameData.rockCoins !== undefined) {
          // Los datos se actualizan automáticamente a través de WebSocket
        }
        
        // Actualizar otros datos del usuario si es necesario
        if (gameData.rockCoins !== undefined) {
          // Actualizar datos del usuario en el contexto si es necesario
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

      console.log("⏰ Iniciando temporizador con roundTime:", roundTime);

    intervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = roundTime.getTime() - now.getTime();
      const totalSecondsLeft = Math.max(0, Math.floor(diff / 1000));
      
        if (gameStatus === 'in_progress') {
          setCountdown(prevCountdown => {
            if (prevCountdown !== totalSecondsLeft) {
              return totalSecondsLeft;
            }
            return prevCountdown;
          });
        
        // Activar loading cuando countdown llegue a 0
        if (totalSecondsLeft <= 0 && !endRoundCalledRef.current) {
          console.log("🏁 Countdown llegó a 0 - activando loading de calculating rewards");
          endRoundCalledRef.current = true;
          setIsCalculatingRewards(true);
          
          // Solicitar al servidor que procese el final de ronda
          console.log("📡 Solicitando final de ronda al servidor");
          const webSocketService = getWebSocket();
          if (webSocketService.isConnected) {
            webSocketService.emit('round_ended', { gameId, userId });
          }
        }
      } else if (gameStatus === 'roundEnd') {
        // Cuando el estado es 'roundEnd', mantener el countdown en 0
        setCountdown(0);
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
  }, [roundTime, gameStatus]);

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
      
              // Inventario del WebSocket
              webSocketInventory,
        getInventoryFromWebSocket,
        minedBlocks,
        playerRankings,
        allPlayersData,
        getMinedBlocksFromWebSocket,
        getPlayerRankingsFromWebSocket,
        isCalculatingRewards,
        roundRewards,
        setRoundRewards,
        roundReadyError,
      
      // Funciones del juego
      startGame,
      readyToPlay,
      endRound,
      markRoundReady,
      
      // WebSocket
      isWebSocketConnected,
      webSocketService: getWebSocket()
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
