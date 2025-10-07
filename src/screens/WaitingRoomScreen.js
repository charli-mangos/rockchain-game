import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import styles from '../styles/WaitingScreenStyles';
import WaitingRoomHeader from '../components/WaitingRoomHeader';

const WaitingRoomScreen = ({ route }) => {
  const { t } = useTranslation();
  const { 
    gameId, 
    userId,
    hostId, 
    countdown: contextCountdown, 
    roundTime: contextRoundTime, 
    gameStatus: contextGameStatus,
    isWebSocketConnected,
    readyToPlay,
    playerCount
  } = useGameContextHybridRobust();
  
  const [waitingRoomCountdown, setWaitingRoomCountdown] = useState(null);
  const navigation = useNavigation();

  // Refs para controlar la navegación
  const hasNavigatedRef = useRef(false);
  const countdownValueRef = useRef(null);
  const effectRunRef = useRef(false);

  // Calcular si el usuario actual es el host
  const isHost = userId === hostId;

  // Log de plataforma al inicio
  console.log(`📱 WaitingRoomScreen iniciado en ${Platform.OS}`);
  console.log(`🔌 WebSocket conectado: ${isWebSocketConnected}`);

  // FUNCIÓN HELPER: Determinar qué mensaje mostrar
  const getDisplayMessage = () => {
    if (contextGameStatus === 'starting' && waitingRoomCountdown !== null && waitingRoomCountdown > 0) {
      return t('game.startingIn', { count: waitingRoomCountdown });
    }
    
    if (contextGameStatus === 'starting') {
      return t('game.preparingGame');
    }
    
    if (contextGameStatus === 'in_progress') {
      return t('game.preparingToStart');
    }
    
    return t('game.waitingForPlayers');
  };

  // EFECTO PARA MANEJAR COUNTDOWN DE WAITING ROOM (3 segundos)
  useEffect(() => {
    console.log(`⏰ WaitingRoomScreen - contextGameStatus: ${contextGameStatus}, waitingRoomCountdown: ${waitingRoomCountdown}`);
    console.log(`📱 Plataforma: ${Platform.OS}`);
    console.log(`🔌 WebSocket conectado: ${isWebSocketConnected}`);
    
    // Solo procesar si estamos en starting
    if (contextGameStatus !== 'starting') {
      console.log(`⏰ No procesando countdown - contextGameStatus: ${contextGameStatus}`);
      return;
    }
    
    // Solo iniciar countdown si no hay uno activo
    if (countdownValueRef.current !== null) {
      console.log(`⏰ Countdown ya activo: ${countdownValueRef.current}`);
      return;
    }
    
    // Protección contra múltiples ejecuciones
    if (effectRunRef.current) {
      console.log(`⚠️ Efecto ya ejecutado, evitando re-ejecución`);
      return;
    }
    
    effectRunRef.current = true;
    console.log(`🔄 Estado starting detectado, iniciando countdown de 3 segundos`);
    
    // Iniciar countdown fijo de 3 segundos
    countdownValueRef.current = 3;
    setWaitingRoomCountdown(3);
    
    console.log(`🎯 Iniciando countdown simplificado`);
    
    // Countdown simplificado con 3 timeouts separados
    console.log(`⏰ Programando countdown: 3 → 2 → 1 → 0`);
    
    // Tick 1: 3 → 2
    setTimeout(() => {
      console.log(`⏰ Countdown tick: 3 → 2`);
      if (countdownValueRef.current !== null) {
        countdownValueRef.current = 2;
        setWaitingRoomCountdown(2);
      }
    }, 1000);
    
    // Tick 2: 2 → 1
    setTimeout(() => {
      console.log(`⏰ Countdown tick: 2 → 1`);
      if (countdownValueRef.current !== null) {
        countdownValueRef.current = 1;
        setWaitingRoomCountdown(1);
      }
    }, 2000);
    
    // Tick 3: 1 → 0 (navegación)
    setTimeout(() => {
      console.log(`⏰ Countdown tick: 1 → 0`);
      if (countdownValueRef.current !== null) {
        countdownValueRef.current = 0;
        setWaitingRoomCountdown(0);
        
        console.log(`✅ Countdown terminado. Navegando a GameTabs...`);
        console.log(`🧭 hasNavigatedRef.current:`, hasNavigatedRef.current);
        
        countdownValueRef.current = null;
        effectRunRef.current = false;
          
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true;
          // SOLUCIÓN ROBUSTA: Siempre intentar ambos métodos
          if (isWebSocketConnected) {
            readyToPlay();
          }
          
          // FALLBACK ADICIONAL: Si después de 2 segundos no hay start_round, forzar inicio
          setTimeout(() => {
            if (contextGameStatus !== 'in_progress' && !contextRoundTime) {
              // PROTECCIÓN: Solo navegar si no se ha navegado ya
              if (!hasNavigatedRef.current) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'GameTabs', params: { gameId, userId, screen: 'Market' } }],
                });
              }
            }
          }, 2000); // 2 segundos de gracia
          
          // Navegar a GameTabs inmediatamente también
          navigation.reset({
            index: 0,
            routes: [{ name: 'GameTabs', params: { gameId, userId, screen: 'Market' } }],
          });
          
          return;
        } else {
          console.log(`⚠️ Ya se ha navegado, evitando navegación duplicada`);
        }
      }
    }, 3000);
    
    console.log(`⏰ Countdown programado exitosamente`);
    
    // Cleanup function
    return () => {
      console.log(`🧹 Cleanup del efecto de countdown`);
      
      // No ejecutar cleanup si ya se ha navegado
      if (hasNavigatedRef.current) {
        console.log(`🚫 Cleanup omitido - ya se ha navegado`);
        return;
      }
      
      // Reset del flag de ejecución
      effectRunRef.current = false;
    };
  }, [contextGameStatus, isWebSocketConnected, readyToPlay, gameId, userId, navigation]);

  // EFECTO PARA LIMPIAR COUNTDOWN CUANDO CAMBIE EL ESTADO
  useEffect(() => {
    // Solo limpiar si el estado NO es starting y hay un countdown activo
    if (contextGameStatus !== 'starting' && countdownValueRef.current !== null) {
      console.log(`🧹 Limpiando countdown de waiting room - estado cambió a: ${contextGameStatus}`);
      
      // No ejecutar cleanup si ya se ha navegado
      if (hasNavigatedRef.current) {
        console.log(`🚫 Cleanup omitido - ya se ha navegado`);
        return;
      }
      
      countdownValueRef.current = null;
      setWaitingRoomCountdown(null);
      
      // Reset del flag de ejecución
      effectRunRef.current = false;
    }
  }, [contextGameStatus, waitingRoomCountdown]);

  // EFECTO PARA SUSCRIPCIÓN AL JUEGO
  useFocusEffect(
    React.useCallback(() => {
      console.log("WaitingRoomScreen gained focus");
      
      // Solo resetear si no hay un countdown activo
      if (countdownValueRef.current === null) {
        hasNavigatedRef.current = false; // Reset del ref de navegación
        console.log(`🔄 Reseteando refs de navegación`);
      } else {
        console.log(`⏰ Countdown activo (${countdownValueRef.current}), no reseteando refs`);
          }

      return () => {
        console.log("WaitingRoomScreen lost focus");
        
        // No ejecutar cleanup si ya se ha navegado
        if (hasNavigatedRef.current) {
          console.log(`🚫 Cleanup omitido - ya se ha navegado`);
          return;
        }
        
        // Solo limpiar countdown si está activo
        if (countdownValueRef.current !== null) {
          countdownValueRef.current = null;
        }
      };
    }, [gameId, userId, navigation])
  );

  return (
    <View style={styles.container}>
      <WaitingRoomHeader title={t('game.waitingRoom')} />
      <Text style={styles.playerCountLabel}>{t('game.playersConnected')}: {playerCount}</Text>
      <Text style={styles.label}>{getDisplayMessage()}</Text>
      {!isWebSocketConnected && (
        <Text style={[styles.label, { color: '#F44336', fontSize: 12 }]}>
          ⚠️ {t('game.websocketDisconnected')}
        </Text>
      )}
    </View>
  );
};

export default WaitingRoomScreen;
