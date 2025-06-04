import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
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
  const navigation = useNavigation();
  const intervalRef = useRef(null);
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

      const roundTimerFunction = httpsCallable(functions, 'roundTimer');
      try {
        const result = await roundTimerFunction({ gameId });
        console.log("roundTimer function called successfully:", result.data.message); 

        if (!hasNavigated.current) {
          hasNavigated.current = true;
          // Esperar un momento antes de navegar para asegurar que el estado se ha actualizado
          setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'GameTabs', params: { gameId, userId, screen: 'Market' } }],
        });
          }, 1000);
        }
      } catch (error) {
        console.error("Error starting new round:", error);
        Alert.alert('Error', 'Failed to start the new round. Please try again.');
        roundStarted.current = false;
      }
    }
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
  
          if (gameData.roundTime) {
            const newRoundTime = gameData.roundTime.toDate();
            if (!roundTime || newRoundTime.getTime() !== roundTime.getTime()) {
              setRoundTime(newRoundTime);
              console.log("Updated roundTime from Firestore:", newRoundTime);
            }
          }

          // Si el estado es 'in_progress' y no hemos navegado, navegar al Market
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
      };
    }, [gameId])
  );

  useEffect(() => {
    if (!roundTime) {
      console.log("Waiting for roundTime to be set.");
      return;
    }
  
    console.log("Initializing countdown. Round time:", roundTime);
  
    intervalRef.current = setInterval(() => {
      const now = new Date();
      const diff = roundTime.getTime() - now.getTime();
      const timeDiff = Math.max(0, Math.round(diff / 1000));
  
      if (timeDiff !== remainingTime) {
        setRemainingTime(timeDiff);
        console.log("Remaining time updated:", timeDiff);
      }
   
      if (timeDiff <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("Countdown finished, starting new round.");
        startNewRound();
      }
    }, 1000);
  
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roundTime]);

  return (
    <View style={styles.container}>
      <WaitingRoomHeader title={"Waiting Room"} />
      <Text style={styles.label}>Players: {playerCount}</Text>
      {gameStatus === 'starting' && remainingTime !== null ? (
        <Text style={styles.countdownText}>Starting in {remainingTime}...</Text>
      ) : (
        <Text style={styles.label}>Waiting for other players...</Text>
      )}
    </View>
  );
};

export default WaitingRoomScreen;
