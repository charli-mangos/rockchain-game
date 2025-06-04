import React, { useState, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions, firestore } from '../../firebase';  // Asegúrate de importar Firebase Firestore correctamente
import { doc, getDoc } from 'firebase/firestore';  // Para obtener el estado del juego
import styles from '../styles/GameScreenStyles';
import WelcomeHeader from '../components/WelcomeHeader';
import RotatingCube from '../components/RotatingCube'; 

const GameScreen = ({ route, navigation }) => {
  const { gameId, gameCode: initialGameCode, userId } = route.params; // Recibe gameId y gameCode de LoginScreen
  const [gameCode, setGameCode] = useState(initialGameCode || ''); // Código de la partida del jugador
  const [joinGameCode, setJoinGameCode] = useState(''); // Código de la partida a la que se quiere unir
  const [playerCount, setPlayerCount] = useState(1);
  const [loading, setLoading] = useState(false); // Estado de carga
  const gameDocIdRef = useRef(gameId);

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Función para obtener el estado del juego desde Firestore
  const checkGameStatus = async () => {
    const gameRef = doc(firestore, 'games', gameId);
    const gameSnapshot = await getDoc(gameRef);
    if (gameSnapshot.exists()) {
      return gameSnapshot.data().status;
    }
    return null;
  };

  // Función para unirse a un juego en el backend (No afecta el gameCode del jugador)
  const joinGame = async () => {
    console.log('Joining game with code:', joinGameCode);
    setLoading(true); // Mostrar pantalla de carga
    const joinGameFunction = httpsCallable(functions, 'joinGame');
    try {
      const result = await joinGameFunction({ gameCode: joinGameCode });
      const { joinId } = result.data;
      console.log('Successfully joined game with ID:', joinId);
      navigation.navigate('WaitingRoom', { gameId: joinId, userId: userId });
    } catch (error) {
      console.error('Error joining game:', error);
      Alert.alert('Error', 'Failed to join the game. Please try again.');
    } finally {
      setLoading(false); // Ocultar pantalla de carga
    }
  };

  // Función para iniciar el juego
  const startGame = async () => {
    console.log('Starting game with ID:', gameDocIdRef.current); // Verifica que este ID es válido
    if (gameDocIdRef.current) {
      setLoading(true);
      const startGameFunction = httpsCallable(functions, 'startGame');
      try {
        await startGameFunction({ gameId: gameDocIdRef.current });
        console.log('Game starting...');
        navigation.navigate('WaitingRoom', { gameId: gameDocIdRef.current, userId: userId });
      } catch (error) {
        console.error('Error starting the game:', error);
        Alert.alert('Error', 'Failed to start the game. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      Alert.alert('Error', 'No game found to start.');
    }
  };

  return (
    <View style={styles.container}>
      <WelcomeHeader title={"Start a RockChain"} />
      {loading ? (
        <RotatingCube size={80} color="#000" /> 
      ) : (
        <View style={styles.inputContainer}>
          {/* Sección para el jugador para empezar su propia partida */}
          <Text style={styles.label}>Your Game Code: <Text style={styles.bold}>{gameCode}</Text></Text>
          <Text style={styles.label}>Number of players: {playerCount}/10</Text>
          <TouchableOpacity style={styles.button} onPress={startGame}>
              <Text style={styles.buttonText}>START GAME</Text>
          </TouchableOpacity>

          {/* Sección para unirse a la partida de otro jugador */}
          <Text style={styles.inputLabel}>Join a Game Code</Text>
          <TextInput
              placeholder="Enter existing game code"
              value={joinGameCode} // Nuevo estado para la partida a la que quiere unirse
              onChangeText={setJoinGameCode}
              style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={joinGame}>
              <Text style={styles.buttonText}>JOIN GAME</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default GameScreen;