import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import styles from '../styles/WaitingScreenStyles';
import WaitingRoomHeader from '../components/WaitingRoomHeader';

const WaitingRoomScreen = ({ route }) => {
  const { gameId, userId } = route.params;
  const [playerCount, setPlayerCount] = useState(1); 
  const [gameStatus, setGameStatus] = useState('waiting'); 
  const [roundTime, setRoundTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const navigation = useNavigation();
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const roundStarted = useRef(false);
  const hasNavigated = useRef(false);

  const startNewRound = async () => {
    if (!roundStarted.current && gameId && !hasNavigated.current) {
      roundStarted.current = true;
      console.log("Round is starting, calling roundTimer...");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // VERIFICACIÓN ADICIONAL: Asegurar que el estado esté limpio antes de iniciar
      try {
        const gameRef = doc(db, 'games', gameId);
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
          const gameData = gameDoc.data();
          console.log(`🔍 Estado del juego antes de iniciar ronda: status=${gameData.status}, rewardsAssigned=${gameData.rewardsAssigned}`);
          
          // Si el estado no está limpio, esperar un poco más
          if (gameData.rewardsAssigned === false && gameData.roundRewards === null) {
            console.log('⏳ Estado de transición detectado, esperando 2 segundos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error('Error verificando estado del juego:', error);
      }

      const roundTimerFunction = httpsCallable(functions, 'roundTimer');
      try {
        const result = await roundTimerFunction({ gameId });
        console.log("roundTimer function called successfully:", result.data.message); 

        if (!hasNavigated.current) {
          hasNavigated.current = true;
        navigation.reset({
          index: 0,
          routes: [{ name: 'GameTabs', params: { gameId, userId, screen: 'Market' } }],
        });
        }
      } catch (error) {
        console.error("Error starting new round:", error);
        Alert.alert('Error', 'Failed to start the new round. Please try again.');
        roundStarted.current = false;
      }
    }
  };

  const startCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          startNewRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log("WaitingRoomScreen gained focus");
      roundStarted.current = false;
      hasNavigated.current = false;
  
      const gameRef = doc(db, 'games', gameId);
      const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          setPlayerCount(gameData.players?.length || 1);
          setGameStatus(gameData.status);
  
          // Verificar si todos los jugadores están en la sala de espera
          const allPlayersInWaitingRoom = gameData.players?.every(playerId => {
            const playerRef = doc(db, 'users', playerId);
            return new Promise((resolve) => {
              const unsubscribe = onSnapshot(playerRef, (playerDoc) => {
                if (playerDoc.exists()) {
                  const playerData = playerDoc.data();
                  resolve(playerData.games?.[gameId]?.readyForNextRound === true);
                } else {
                  resolve(false);
                }
                unsubscribe();
              });
            });
          });

          if (allPlayersInWaitingRoom && !countdownRef.current) {
            startCountdown();
          }

          if (gameData.status === 'in_progress' && !hasNavigated.current) {
            hasNavigated.current = true;
            navigation.reset({
              index: 0,
              routes: [{ name: 'GameTabs', params: { gameId, userId, screen: 'Market' } }],
            });
          }
        }
      });
  
      return () => {
        console.log("WaitingRoomScreen lost focus or unmounted");
        unsubscribe();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }, [gameId])
  );

  return (
    <View style={styles.container}>
      <WaitingRoomHeader title={"Waiting Room"} />
      <Text style={styles.playerCountLabel}>Players: {playerCount}</Text>
      {countdown !== null ? (
        <Text style={styles.countdownText}>Starting in {countdown}...</Text>
      ) : (
        <Text style={styles.label}>Waiting for other players...</Text>
      )}
    </View>
  );
};

export default WaitingRoomScreen;
