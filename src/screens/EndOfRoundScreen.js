import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Alert, ActivityIndicator, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import GameHeader from '../components/GameHeader';
import styles from '../styles/EndOfRoundScreenStyles';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';
import RewardAnimation from '../components/RewardAnimation';
import RotatingCube from '../components/RotatingCube';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { useNavigation } from '@react-navigation/native';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';

// Generador determinista 0..1
const seededRand = (seedStr) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const computeLocalRewards = ({
  allPlayersData,
  minedBlocks,
  round,
  roundMeta,
  userSelectedIndustry,
  gameId,
  userId
}) => {
  if (!Array.isArray(allPlayersData) || allPlayersData.length === 0) return null;

  const blocks = Array.isArray(minedBlocks) ? minedBlocks.filter(b => {
    return b && (b.round === round || b.round === (round - 1));
  }) : [];

  const rewards = {};
  // MINING: +50 por cada bloque correcto
  for (const block of blocks) {
    if (block?.winner?.isCorrect && block?.winner?.userId) {
      const uid = block.winner.userId;
      if (!rewards[uid]) rewards[uid] = {};
      rewards[uid].miningReward = (rewards[uid].miningReward || 0) + 50;
    }
  }

  // WASTE: si el usuario acierta → usar valor global de roundMeta
  console.log('🗑️ [WASTE] Verificando condiciones:', {
    roundMeta: roundMeta,
    userSelectedIndustry: userSelectedIndustry,
    winningIndustry: roundMeta?.winningIndustry,
    wasteRewardApplied: roundMeta?.wasteRewardApplied
  });
  
  if (roundMeta?.winningIndustry && userSelectedIndustry && userSelectedIndustry === roundMeta.winningIndustry) {
    const val = roundMeta.wasteRewardApplied; // Valor único global
    console.log('🗑️ [WASTE] Usuario acertó industria! Aplicando wasteRemoved:', val);
    if (!rewards[userId]) rewards[userId] = {};
    rewards[userId].wasteRemoved = val;
  } else {
    console.log('🗑️ [WASTE] Usuario no acertó industria o faltan datos');
  }

  return rewards;
};

const EndOfRoundScreen = ({ route }) => {
  const { t } = useTranslation();
  const { 
    gameId, 
    userId, 
    allPlayersData, 
    round, 
    gameStatus,
    isReadyForNextRound, 
    markPlayerReady, 
    markRoundReady,
    winningIndustry,
    isWebSocketConnected,
    webSocketService,
    roundRewards,
    setRoundRewards,
    isCalculatingRewards,
    roundMeta,
    webSocketInventory,
    setWebSocketInventory,
    getWebSocket,
    minedBlocks,
    setIsWaitingNextRoundLocal
  } = useGameContextHybridRobust();
  
  // Crear displayPlayers aplicando recompensas locales solo para UI
  const basePlayers = [...allPlayersData].sort((a, b) => {
    const balanceA = a.rockCoins - a.waste;
    const balanceB = b.rockCoins - b.waste;
    return balanceB - balanceA;
  });

  const displayPlayers = basePlayers.map(p => {
    const r = (roundRewards && roundRewards[p.userId]) || {};
    const rockCoins = p.rockCoins + (r.miningReward || 0);
    const waste = Math.max(0, p.waste - (r.wasteRemoved || 0));
    return { ...p, rockCoins, waste };
  }).sort((a, b) => (b.rockCoins - b.waste) - (a.rockCoins - a.waste));

  // Debug: Log de datos recibidos
  console.log('🎮 [EndOfRoundScreen] Datos recibidos del contexto:');
  console.log('🎮 [EndOfRoundScreen] allPlayersData:', allPlayersData);
  console.log('🎮 [EndOfRoundScreen] allPlayersData.length:', allPlayersData.length);
  console.log('🎮 [EndOfRoundScreen] displayPlayers (con recompensas aplicadas):', displayPlayers);
  console.log('🎮 [EndOfRoundScreen] winningIndustry:', winningIndustry);
  console.log('🎮 [EndOfRoundScreen] round:', round);
  console.log('🎮 [EndOfRoundScreen] isWebSocketConnected:', isWebSocketConnected);
  const [userSelectedIndustry, setUserSelectedIndustry] = useState(null);
  
  // Cargar industria seleccionada del usuario desde el contexto
  useEffect(() => {
    if (allPlayersData && allPlayersData.length > 0) {
      const currentPlayer = allPlayersData.find(player => player.userId === userId);
      if (currentPlayer && currentPlayer.selectedIndustry) {
        console.log('🏭 [INDUSTRY] Cargando industria seleccionada:', currentPlayer.selectedIndustry);
        setUserSelectedIndustry(currentPlayer.selectedIndustry);
      }
    }
  }, [allPlayersData, userId]);
  
  // Estado interno para overlay de calculating (3 segundos fijos como detalle visual)
  const [isCalculating, setIsCalculating] = useState(true);
  const [rewardMessage, setRewardMessage] = useState(null);
  const calculatingTimeoutRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Overlay de calculating de 3 segundos como detalle visual
  useEffect(() => {
    console.log('🎬 [CALCULATING] Iniciando overlay de 3 segundos');
    setIsCalculating(true);
    
    // Animación de progreso de 3 segundos
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
    
    calculatingTimeoutRef.current = setTimeout(() => {
      console.log('🎬 [CALCULATING] Overlay de 3 segundos completado');
      setIsCalculating(false);
    }, 3000);

    return () => {
      if (calculatingTimeoutRef.current) {
        clearTimeout(calculatingTimeoutRef.current);
      }
    };
  }, []); // Solo se ejecuta una vez al montar el componente

  // Calcular recompensas locales y apagar overlay SIEMPRE
  useEffect(() => {
    console.log('⛏️ [REWARDS] Calculando recompensas locales...');
    console.log('🎯 [ROUND_META] roundMeta recibido:', roundMeta);
    console.log('👤 [USER] userSelectedIndustry:', userSelectedIndustry);
    
    const rewards = computeLocalRewards({
      allPlayersData,
      minedBlocks,
      round,
      roundMeta,
      userSelectedIndustry,
      gameId,
      userId
    });

    if (rewards && Object.keys(rewards).length > 0) {
      console.log('🎁 [REWARDS] setRoundRewards con recompensas:', rewards);
      setRoundRewards(rewards);
    } else {
      console.log('🎁 [REWARDS] setRoundRewards vacío para apagar overlay');
      setRoundRewards({}); // sin premios, pero quita el loader
    }

    // 2) Inventario optimista (una sola vez por pantalla)
    if (!appliedOptimisticRef.current && rewards && Object.keys(rewards).length > 0) {
      appliedOptimisticRef.current = true;
      const mine = rewards[userId] || {};
      const deltaCoins = mine.miningReward || 0;
      const deltaWaste = -(mine.wasteRemoved || 0);

      console.log('💰 [OPTIMISTIC] Aplicando inventario optimista:', { deltaCoins, deltaWaste });
      
      setWebSocketInventory(prev => ({
        ...prev,
        rockCoins: Math.max(0, (prev?.rockCoins || 0) + deltaCoins),
        waste: Math.max(0, (prev?.waste || 0) + deltaWaste),
      }));
    }

    // 3) Emitir fin de ronda (idempotente en server)
    try {
      const ws = getWebSocket && getWebSocket();
      if (ws) {
        ws.emit('round_ended', { gameId, userId });
        console.log('📡 [END] round_ended emitido (optimista)');
      }
    } catch (e) {
      console.warn('No se pudo emitir round_ended (optimista):', e?.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, minedBlocks, roundMeta, userSelectedIndustry, gameId, userId]);
  const navigation = useNavigation();

  // Refs para controlar el estado de procesamiento
  const rewardsProcessedRef = useRef(false);
  const currentRoundRef = useRef(round);
  const unsubscribeRef = useRef(null);
  const effectRunRef = useRef(false);
  const isNavigatingRef = useRef(false); // Nuevo ref para controlar navegación
  
  // Correlación: calcId local para logs
  const calcIdRef = useRef(`${gameId}:${round}:${userId}:${Date.now()}`);
  console.log('🆔 [ROUND_CALC] calcId=', calcIdRef.current);
  
  // Ref para evitar doble contabilidad optimista
  const appliedOptimisticRef = useRef(false);

  // Resetear estado cuando cambia la ronda
  useEffect(() => {
    if (currentRoundRef.current !== round) {
      console.log(`🔄 Ronda cambiada de ${currentRoundRef.current} a ${round}`);
      currentRoundRef.current = round;
      rewardsProcessedRef.current = false;
      effectRunRef.current = false;
      isNavigatingRef.current = false; // Resetear estado de navegación
      setRewardMessage(null);
      // NO limpiar roundRewards aquí - viene del contexto global
      
      // Limpiar cualquier suscripción anterior
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      console.log(`🧹 Estados reseteados para ronda ${round}`);
    }
  }, [round]);

  // Efecto principal para manejar recompensas (simplificado para sistema híbrido)
  useEffect(() => {
    // Evitar múltiples ejecuciones del mismo efecto
    if (effectRunRef.current) {
      console.log('⚠️ Efecto ya ejecutado, evitando re-ejecución');
      return;
    }
    
    effectRunRef.current = true;
    console.log(`🎮 EndOfRoundScreen - Ronda ${round}, userId: ${userId}`);
    console.log(`🔌 WebSocket conectado: ${isWebSocketConnected}`);

    // Si estamos usando WebSocket, simplificar la lógica
    if (isWebSocketConnected) {
      console.log('🔌 Usando sistema híbrido - datos ya disponibles desde WebSocket');
      console.log('💰 Las recompensas se procesan automáticamente en el servidor cuando llega round_ended');
      
      // NO llamar assignRoundRewards desde el cliente - se procesa automáticamente en el servidor
      rewardsProcessedRef.current = true;
      
      // Obtener industria seleccionada del usuario desde Firestore
      const userRef = doc(db, 'users', userId);
      const unsubscribeUser = onSnapshot(userRef, (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const gameUserData = userData.games?.[gameId] || {};
          const selectedIndustry = gameUserData.selectedIndustry || 'No selection';
          setUserSelectedIndustry(selectedIndustry);
        }
      });

      // Escuchar recompensas asignadas desde WebSocket
      const handleRewardsAssigned = (data) => {
        console.log('💰 Recompensas asignadas recibidas en EndOfRoundScreen:', data);
        if (data.roundRewards) {
          setRoundRewards(data.roundRewards);
          
          const userRewards = data.roundRewards[userId];
          if (userRewards) {
            let message = '';
            let totalRewards = 0;
            
            // Recompensa por industria
            if (userRewards.industryReward && userRewards.industryReward > 0) {
              message += `Industry Reward: +${userRewards.industryReward} RockCoins\n`;
              totalRewards += userRewards.industryReward;
              if (userRewards.wasteRemoved > 0) {
                message += `Waste reduced: -${userRewards.wasteRemoved}\n`;
              }
            }
            
            // Total de recompensas (solo industria + reciclaje)
            if (totalRewards > 0) {
              message += `\nTotal: +${totalRewards} RockCoins`;
              console.log(`🎁 Mostrando mensaje de recompensas para ronda ${round}: ${message}`);
              setRewardMessage(message);
              
            }
          }
        }
      };

      const ws = getWebSocket();
      if (ws) {
        ws.on('rewards_assigned', handleRewardsAssigned);
      }

      unsubscribeRef.current = () => {
        unsubscribeUser();
        const ws = getWebSocket();
        if (ws) {
          ws.off('rewards_assigned', handleRewardsAssigned);
        }
      };

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }

    // Fallback a Firestore si no hay WebSocket
    const gameRef = doc(db, 'games', gameId);
    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(gameRef, async (gameDoc) => {
      if (!gameDoc.exists()) return;
      
      const gameData = gameDoc.data();
      console.log(`📊 Estado del juego: rewardsAssigned=${gameData.rewardsAssigned}, round=${gameData.round}, currentRoundRef=${currentRoundRef.current}, isNavigating=${isNavigatingRef.current}`);

      // PROTECCIÓN CRÍTICA: No procesar recompensas si estamos navegando
      if (isNavigatingRef.current) {
        console.log('🚫 Navegación en progreso, evitando procesamiento de recompensas');
        return;
      }
      
      // ELIMINADO: El servidor ahora es la única autoridad para recompensas
      // Las recompensas se procesan automáticamente en el servidor cuando llega round_ended
      // El cliente solo muestra los datos que recibe del servidor
      console.log(`📊 Estado del juego: status=${gameData.status}, round=${gameData.round}, rewardsAssigned=${gameData.rewardsAssigned}`);
      
      // ELIMINADO: Las recompensas ahora vienen del servidor via ROUND_END
      // No hay procesamiento local de recompensas - solo mostrar lo que viene del servidor
      console.log(`📊 Recompensas manejadas por el servidor - solo mostrar datos recibidos`);
    });

    // Obtener industria seleccionada del usuario
    const unsubscribeUser = onSnapshot(userRef, (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const gameUserData = userData.games?.[gameId] || {};
        const selectedIndustry = gameUserData.selectedIndustry || 'No selection';
        setUserSelectedIndustry(selectedIndustry);
      }
    });

    unsubscribeRef.current = () => {
      unsubscribe();
      unsubscribeUser();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [gameId, userId, round, isWebSocketConnected]); // Agregar isWebSocketConnected como dependencia

  const handleReady = async () => {
    try {
      console.log('🚀 Usuario presionó Next Round');
      console.log(`🔌 WebSocket conectado: ${isWebSocketConnected}`);
      
      // ACTIVAR PROTECCIÓN DE NAVEGACIÓN
      isNavigatingRef.current = true;
      console.log('🔒 Activando protección de navegación');
      
      // Resetear estados solo cuando el usuario presiona Next Round
      setRewardMessage(null);
      // NO limpiar roundRewards aquí - viene del contexto global
      rewardsProcessedRef.current = false;
      effectRunRef.current = false;
      
      // Si es la ronda 3, navegar a GameResultsScreen usando reset para evitar bucle
      if (round === 3) {
        console.log('🏁 Ronda 3 completada, navegando a resultados finales');
        navigation.reset({
          index: 0,
          routes: [{ name: 'GameResults', params: { gameId, userId } }],
        });
      } else {
        // Para rondas 1 y 2, usar el NUEVO sistema de round:ready
        if (isWebSocketConnected) {
          console.log(`🔄 [ROUND:READY] Marcando como listo para ronda ${round} vía WebSocket`);
          
          // 1) Marcar ready en server (idempotente)
          await markRoundReady();
          
          // 2) Setear intención local y navegar SOLO este jugador
          setIsWaitingNextRoundLocal(true);
          console.log('🧭 [READY] Navegando a WaitingForNextRound (solo este jugador)');
          navigation.navigate('WaitingForNextRound', { gameId, userId });
        } else {
          console.log(`🔄 [ROUND:READY] Marcando como listo para ronda ${round} vía Firestore (fallback)`);
          await markPlayerReady();
        }
      }
    } catch (error) {
      console.error('Error al marcar como listo:', error);
      Alert.alert('Error', 'No se pudo marcar como listo para la siguiente ronda');
      // Si hay error, desactivar protección de navegación
      isNavigatingRef.current = false;
    }
  };

  // Overlay de calculating que se muestra encima del contenido original
  // Solo mostrar si estamos realmente en fin de ronda (evita overlay rezagado en nueva ronda)
  const showCalculatingOverlay = (gameStatus === 'roundEnd') && (isCalculatingRewards || !roundRewards);

  // Activar sistema de recompensas cuando se monte el componente en modo calculating
  useEffect(() => {
    if (isCalculatingRewards && !roundRewards) {
      console.log('🎯 [REWARDS] Activando sistema de recompensas - solicitando al servidor');
      console.log('🎯 [REWARDS] Estado actual:', { isCalculatingRewards, hasRoundRewards: !!roundRewards, gameId, userId });
      
      // Solicitar al servidor que procese el final de ronda
      const webSocketService = getWebSocket();
      if (webSocketService && webSocketService.isConnected) {
        console.log("📡 [REWARDS] Emitiendo round_ended al servidor:", { gameId, userId });
        webSocketService.emit('round_ended', { gameId, userId });
        console.log("✅ [REWARDS] Solicitud de final de ronda enviada al servidor");
      } else {
        console.error("❌ [REWARDS] WebSocket no conectado, no se puede emitir round_ended");
      }
    }
  }, [isCalculatingRewards, roundRewards, gameId, userId]);

  // Cálculo inmediato de recompensas desde blockchain si no hay roundRewards
  useEffect(() => {
    if (!roundRewards && !isCalculatingRewards) {
      console.log('⛏️ [REWARDS] Calculando recompensas inmediatamente desde blockchain');
      
      const roundRewards = {};
      const currentRoundBlocks = minedBlocks.filter(block => block.round === 0);
      console.log(`⛏️ [REWARDS] Bloques encontrados:`, currentRoundBlocks);
      
      currentRoundBlocks.forEach(block => {
        if (block.winner && block.winner.isCorrect) {
          const winnerId = block.winner.userId;
          if (!roundRewards[winnerId]) {
            roundRewards[winnerId] = {};
          }
          roundRewards[winnerId].miningReward = (roundRewards[winnerId].miningReward || 0) + 50;
          console.log(`💰 [REWARDS] ${block.winner.userName || winnerId}: +50 RockCoins`);
        }
      });
      
      if (Object.keys(roundRewards).length > 0) {
        console.log('🎁 [REWARDS] Recompensas calculadas:', roundRewards);
        setRoundRewards(roundRewards);
      }
    }
  }, [roundRewards, isCalculatingRewards, minedBlocks]);

  // Log cuando se reciben las recompensas
  useEffect(() => {
    if (roundRewards && Object.keys(roundRewards).length > 0) {
      console.log('🎉 [REWARDS] Recompensas recibidas del servidor:', roundRewards);
      console.log('🎉 [REWARDS] Desglose de recompensas:');
      if (roundRewards.mining) {
        console.log('⛏️ [REWARDS] Recompensas de minado:', roundRewards.mining);
      }
      if (roundRewards.waste) {
        console.log('🗑️ [REWARDS] Recompensas de waste:', roundRewards.waste);
      }
      if (roundRewards.balances) {
        console.log('💰 [REWARDS] Balances finales:', roundRewards.balances);
      }
    }
  }, [roundRewards]);

  return (
    <View style={styles.container}>
      <GameHeader 
        title={round === 3 ? t('round.gameComplete') : t('round.roundComplete', { n: round })} 
        userId={userId} 
        gameId={gameId}
        currentScreen="EndOfRound"
      />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PlayerRankingComponent 
          players={displayPlayers}
          title={t('round.rankings')} 
          currentUserId={userId}
          roundRewards={roundRewards}
        />

        <View style={styles.industryContainer}>
          <Text style={styles.industryTitle}>{t('round.wasteManagement')}</Text>
          <View style={styles.industryInfo}>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>{t('round.winningIndustry')}:</Text>
              <Text style={styles.industryValue}>
                {winningIndustry || 'Not selected yet'}
              </Text>
            </View>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>{t('round.yourSelection')}:</Text>
              <Text style={[
                styles.yourSelectionValue,
                userSelectedIndustry === winningIndustry ? styles.correctSelection : styles.incorrectSelection
              ]}>
                {userSelectedIndustry}
              </Text>
            </View>
            
            {/* Señalización visual para acertar industria */}
            {userSelectedIndustry === winningIndustry && winningIndustry && (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerIcon}>✓</Text>
                <View style={styles.successBannerText}>
                  <Text style={styles.successBannerTitle}>{t('round.industryGuessed')}!</Text>
                  <Text style={styles.successBannerSubtitle}>
                    Your waste it's been reduced
                  </Text>
                </View>
              </View>
            )}
            
            {/* Señalización visual para no acertar */}
            {userSelectedIndustry !== winningIndustry && userSelectedIndustry && winningIndustry && (
              <View style={styles.failBanner}>
                <Text style={styles.failBannerIcon}>✕</Text>
                <View style={styles.failBannerText}>
                  <Text style={styles.failBannerTitle}>{t('round.industryMissed')}</Text>
                  <Text style={styles.failBannerSubtitle}>
                    No waste reduction this round
                  </Text>
                </View>
              </View>
            )}
            
            {rewardMessage && (
              <View style={styles.rewardContainer}>
                <Text style={styles.rewardText}>{rewardMessage}</Text>
              </View>
            )}
          </View>
        </View>

        <BlockchainComponent 
          gameId={gameId} 
          title={t('round.minedBlocks')} 
          showReward={true}
          filterByRound={round}
          currentUserId={userId}
        />
      </ScrollView>

        <TouchableOpacity 
          style={styles.readyButton}
          onPress={handleReady}
        disabled={isReadyForNextRound}
      >
        {!isReadyForNextRound ? (
          <Text style={styles.readyButtonText}>
            {round === 3 ? 'End Game' : 'Next Round'}
          </Text>
        ) : (
          <ActivityIndicator color="#fff" size="small" />
        )}
      </TouchableOpacity>
      
      {/* Overlay de calculating - 3 segundos como detalle visual */}
      {showCalculatingOverlay && (
        <View style={styles.calculatingOverlay}>
          <View style={styles.calculatingContent}>
            <RotatingCube size={100} />
            <Text style={styles.calculatingTitle}>
              Calculating rewards…
            </Text>
            <Text style={styles.calculatingSubtitle}>
              Processing mining results
            </Text>
            <View style={styles.calculatingProgress}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default EndOfRoundScreen; 