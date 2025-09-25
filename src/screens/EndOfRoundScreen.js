import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import GameHeader from '../components/GameHeader';
import styles from '../styles/EndOfRoundScreenStyles';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { useNavigation } from '@react-navigation/native';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';

const EndOfRoundScreen = ({ route }) => {
  const { 
    gameId, 
    userId, 
    allPlayersData, 
    round, 
    isReadyForNextRound, 
    markPlayerReady, 
    winningIndustry,
    isWebSocketConnected,
    webSocketService
  } = useGameContextHybridRobust();
  
  // Usar los datos completos de todos los jugadores
  const players = allPlayersData.sort((a, b) => {
    // Ordenar por balance (RockCoins - Waste) de mayor a menor
    const balanceA = a.rockCoins - a.waste;
    const balanceB = b.rockCoins - b.waste;
    return balanceB - balanceA;
  });

  // Debug: Log de datos recibidos
  console.log('🎮 [EndOfRoundScreen] Datos recibidos del contexto:');
  console.log('🎮 [EndOfRoundScreen] allPlayersData:', allPlayersData);
  console.log('🎮 [EndOfRoundScreen] allPlayersData.length:', allPlayersData.length);
  console.log('🎮 [EndOfRoundScreen] players (ordenados):', players);
  console.log('🎮 [EndOfRoundScreen] winningIndustry:', winningIndustry);
  console.log('🎮 [EndOfRoundScreen] round:', round);
  console.log('🎮 [EndOfRoundScreen] isWebSocketConnected:', isWebSocketConnected);
  const [userSelectedIndustry, setUserSelectedIndustry] = useState(null);
  const [rewardMessage, setRewardMessage] = useState(null);
  const [roundRewards, setRoundRewards] = useState(null);
  const navigation = useNavigation();

  // Refs para controlar el estado de procesamiento
  const rewardsProcessedRef = useRef(false);
  const currentRoundRef = useRef(round);
  const unsubscribeRef = useRef(null);
  const effectRunRef = useRef(false);
  const isNavigatingRef = useRef(false); // Nuevo ref para controlar navegación

  // Resetear estado cuando cambia la ronda
  useEffect(() => {
    if (currentRoundRef.current !== round) {
      console.log(`🔄 Ronda cambiada de ${currentRoundRef.current} a ${round}`);
      currentRoundRef.current = round;
      rewardsProcessedRef.current = false;
      effectRunRef.current = false;
      isNavigatingRef.current = false; // Resetear estado de navegación
      setRewardMessage(null);
      setRoundRewards(null);
      
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

      webSocketService.on('rewards_assigned', handleRewardsAssigned);

      unsubscribeRef.current = () => {
        unsubscribeUser();
        webSocketService.off('rewards_assigned', handleRewardsAssigned);
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
      
      // Solo procesar recompensas si:
      // 1. No se han asignado recompensas en el backend
      // 2. No se han procesado localmente para esta ronda
      // 3. La ronda actual coincide con la ronda del juego
      // 4. NO estamos en proceso de navegación
      // 5. El estado del juego es 'roundEnd'
      if (!gameData.rewardsAssigned && 
          !rewardsProcessedRef.current && 
          gameData.round === round &&
          !isNavigatingRef.current &&
          gameData.status === 'roundEnd') {
        console.log(`💰 Asignando recompensas para la ronda ${round}`);
        try {
          const assignRewardsFunction = httpsCallable(functions, 'assignRoundRewards');
          
          // Usar verificación de autenticación
          const result = await callAuthenticatedFunction(
            () => assignRewardsFunction({ gameId }),
            'assignRoundRewards'
          );
          
          console.log('✅ Recompensas asignadas:', result.data);
          rewardsProcessedRef.current = true;
          } catch (error) {
          console.error('❌ Error al asignar recompensas:', error);
          // Si hay error, no marcar como procesado para permitir reintento
          rewardsProcessedRef.current = false;
        }
      } else {
        console.log(`🚫 No se procesan recompensas: rewardsAssigned=${gameData.rewardsAssigned}, processed=${rewardsProcessedRef.current}, round=${gameData.round}, currentRound=${round}, navigating=${isNavigatingRef.current}, status=${gameData.status}`);
      }
      
      // Mostrar recompensas si existen y no se han mostrado aún
      if (gameData.roundRewards && !rewardMessage && gameData.round === round && !isNavigatingRef.current) {
        console.log('📋 Mostrando recompensas:', gameData.roundRewards);
        setRoundRewards(gameData.roundRewards);
        
        const userRewards = gameData.roundRewards[userId];
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
          
          // SOLO mostrar recompensas por industria y reciclaje en el cartel verde
          // Las recompensas por minado se muestran de otra manera (en los bloques)
          
          // Total de recompensas (solo industria + reciclaje)
          if (totalRewards > 0) {
            message += `\nTotal: +${totalRewards} RockCoins`;
            console.log(`🎁 Mostrando mensaje de recompensas para ronda ${round}: ${message}`);
            setRewardMessage(message);
          }
        }
      } else if (gameData.roundRewards && gameData.round !== round) {
        // Si hay recompensas pero son de una ronda diferente, limpiarlas
        console.log(`🧹 Limpiando recompensas de ronda anterior: ${gameData.round} vs ${round}`);
        setRewardMessage(null);
        setRoundRewards(null);
      }
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
      setRoundRewards(null);
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
        // Para rondas 1 y 2, usar el sistema híbrido
        if (isWebSocketConnected) {
          console.log(`🔄 Marcando como listo para ronda ${round + 1} vía WebSocket`);
          await markPlayerReady();
        } else {
          console.log(`🔄 Marcando como listo para ronda ${round + 1} vía Firestore (fallback)`);
          await markPlayerReady();
        }
        // markPlayerReady() ya maneja la navegación a WaitingRoom
      }
    } catch (error) {
      console.error('Error al marcar como listo:', error);
      Alert.alert('Error', 'No se pudo marcar como listo para la siguiente ronda');
      // Si hay error, desactivar protección de navegación
      isNavigatingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <GameHeader 
        title={round === 3 ? 'Game Complete!' : `Round ${round} Complete`} 
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
          players={players} 
          title="Round Rankings" 
          currentUserId={userId}
          roundRewards={null}
        />

        <View style={styles.industryContainer}>
          <Text style={styles.industryTitle}>Waste Management</Text>
          <View style={styles.industryInfo}>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>Winning Industry:</Text>
              <Text style={styles.industryValue}>
                {winningIndustry || 'Not selected yet'}
              </Text>
            </View>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>Your Selection:</Text>
              <Text style={[
                styles.industryValue,
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
                  <Text style={styles.successBannerTitle}>Industry guessed!</Text>
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
                  <Text style={styles.failBannerTitle}>Industry Missed</Text>
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
          title="Mined Blocks" 
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
    </View>
  );
};

export default EndOfRoundScreen; 