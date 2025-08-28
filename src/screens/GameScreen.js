import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { functions, db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { httpsCallable } from 'firebase/functions';
import styles from '../styles/GameScreenStyles';
import WelcomeHeader from '../components/WelcomeHeader';
import RotatingCube from '../components/RotatingCube';

const GameScreen = ({ route }) => {
  const { gameId, userId, setGameParams } = route.params || {};
  const navigation = useNavigation();
  
  // Estados locales simples
  const [gameCode, setGameCode] = useState('');
  const [joinGameCode, setJoinGameCode] = useState('');
  const [playerCount, setPlayerCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [hostId, setHostId] = useState(null);
  
  console.log('🎮 GameScreen - Montando con gameId:', gameId, 'userId:', userId);

  // Verificar parámetros
  if (!gameId || !userId) {
    console.error('❌ GameScreen: gameId o userId son undefined:', { gameId, userId });
    return null;
  }

  // Suscribirse al juego en Firestore
  useEffect(() => {
    if (!gameId) {
      console.log('⚠️ No hay gameId, no suscribiendo a juego');
      return;
    }
    
    console.log('🔄 Suscribiendo a juego:', gameId);
    console.log('🔍 Verificando existencia del documento en Firestore...');
    console.log('🔍 Buscando en colección: games, documento:', gameId);
    console.log('🔍 Usuario actual:', userId);
    
    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      console.log('📝 onSnapshot callback ejecutado para juego:', gameId);
      console.log('📝 Documento existe:', docSnapshot.exists());
      
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        setGameCode(gameData.gameCode || '');
        setPlayerCount(gameData.players?.length || 1);
        setGameStatus(gameData.status || 'waiting');
        setHostId(gameData.hostId || null);
        
        console.log('📝 Documento del juego encontrado:', {
          gameCode: gameData.gameCode,
          status: gameData.status,
          players: gameData.players?.length || 0,
          hostId: gameData.hostId,
          gameId: gameId
        });
      } else {
        console.error('❌ Documento del juego no existe:', gameId);
        console.log('🔄 Esto indica un problema en el backend (createGame/joinGame)');
        console.log('🔄 El WebSocket está funcionando correctamente para coordinación');
        console.log('🔍 Verificar en Firestore: colección games, documento', gameId);
        console.log('🔍 NOTA: Si ves documentos en gameTriggers, esos NO son juegos reales');
        console.log('🔄 Intentando verificar si el documento se crea en los próximos segundos...');
        
        // Verificar después de un retraso
        setTimeout(async () => {
          try {
            const checkRef = doc(db, 'games', gameId);
            const checkDoc = await getDoc(checkRef);
            if (checkDoc.exists()) {
              console.log('✅ Documento del juego verificado después del retraso');
            } else {
              console.error('❌ Documento del juego aún no existe después del retraso');
              console.log('🔍 Verificar manualmente en Firestore: colección games');
            }
          } catch (error) {
            console.error('❌ Error verificando documento después del retraso:', error);
          }
        }, 2000);
      }
    });

    return () => {
      console.log('🧹 Desuscribiendo de juego:', gameId);
      unsubscribe();
    };
  }, [gameId]);

  // Calcular si es host
  const isHost = userId === hostId;

  // Función para unirse a un juego
  const joinGame = async () => {
    if (!joinGameCode.trim()) {
      Alert.alert('Error', 'Please enter a game code.');
      return;
    }

    console.log('🎮 Intentando unirse al juego con código:', joinGameCode);
    console.log('🎮 Código normalizado:', joinGameCode.toUpperCase());
    setLoading(true);

    try {
      // Buscar el juego por gameCode
      console.log('🔍 Buscando juego en Firestore con gameCode:', joinGameCode.toUpperCase());
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, where('gameCode', '==', joinGameCode.toUpperCase()));
      
      console.log('🔍 Query creada, ejecutando getDocs...');
      const querySnapshot = await getDocs(q);
      
      console.log('🔍 Resultado de búsqueda:', {
        empty: querySnapshot.empty,
        size: querySnapshot.size,
        docs: querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      });

      if (querySnapshot.empty) {
        console.error('❌ No se encontró ningún juego con gameCode:', joinGameCode.toUpperCase());
        Alert.alert('Error', 'Game not found. Please check the game code.');
        return;
      }

      const gameDoc = querySnapshot.docs[0];
      const gameData = gameDoc.data();
      const targetGameId = gameDoc.id;

      console.log('🎯 Juego encontrado:', { 
        gameId: targetGameId, 
        gameCode: gameData.gameCode,
        status: gameData.status,
        players: gameData.players?.length || 0,
        hostId: gameData.hostId
      });

      // Verificar que no se está uniendo a su propio juego
      if (targetGameId === gameId) {
        Alert.alert('Error', 'You cannot join your own game. Please enter a different game code.');
        return;
      }

      // Unirse al nuevo juego
      console.log('🔄 Uniéndose al nuevo juego:', targetGameId);
      const joinGameFunction = httpsCallable(functions, 'joinGame');
      const result = await callAuthenticatedFunction(
        () => joinGameFunction({ 
          gameId: targetGameId, 
          userId: userId 
        }),
        'joinGame'
      );

      console.log('✅ Unido al juego exitosamente:', result.data);

      // Actualizar parámetros
      if (setGameParams) {
        setGameParams({ gameId: targetGameId, userId: userId });
      }

      // Pequeño retraso para asegurar que el backend haya terminado
      console.log('⏳ Esperando 500ms para que el backend termine de procesar...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navegar al WaitingRoom del nuevo juego usando reset para asegurar parámetros correctos
      console.log('🎮 Navegando al WaitingRoom con parámetros:', { 
        gameId: targetGameId, 
        userId: userId 
      });
      
      // Usar reset para asegurar que se use el gameId correcto
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'WaitingRoom', 
          params: { 
            gameId: targetGameId, 
            userId: userId 
          } 
        }],
      });

      // Eliminar juego original DESPUÉS de navegar (en background)
      if (gameId && gameId !== targetGameId) {
        console.log('🗑️ Eliminando juego original en background:', gameId);
        setTimeout(async () => {
          try {
            const deleteGameFunction = httpsCallable(functions, 'deleteGame');
            await callAuthenticatedFunction(
              () => deleteGameFunction({ gameId: gameId }),
              'deleteGame'
            );
            console.log('✅ Juego original eliminado en background');
          } catch (error) {
            console.log('⚠️ Error eliminando juego original en background:', error);
          }
        }, 1000); // Esperar 1 segundo para que la navegación se complete
      }

    } catch (error) {
      console.error('❌ Error joining game:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      Alert.alert('Error', 'Failed to join the game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el juego
  const startGame = async () => {
    console.log('🎮 startGame called by user:', userId, 'hostId:', hostId, 'isHost:', isHost);
    
    if (!isHost) {
      Alert.alert('Error', 'Only the host can start the game.');
      return;
    }

    if (gameStatus !== 'waiting') {
      Alert.alert('Error', 'Game is already started or finished.');
      return;
    }

    console.log('✅ Host verified, starting game...');
    setLoading(true);
    
    try {
      const startGameFunction = httpsCallable(functions, 'startGame');
      await callAuthenticatedFunction(
        () => startGameFunction({ gameId: gameId }),
        'startGame'
      );
      
      console.log('Game starting...');
      navigation.navigate('WaitingRoom', { gameId: gameId, userId: userId });
    } catch (error) {
      console.error('Error starting the game:', error);
      Alert.alert('Error', 'Failed to start the game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <WelcomeHeader title={"Start a RockChain"} />
        {loading ? (
          <RotatingCube size={80} color="#000" /> 
        ) : (
          <View style={styles.inputContainer}>
            {/* Sección para el jugador para empezar su propia partida */}
            <Text style={styles.label}>Your Game Code: <Text style={styles.bold}>{gameCode}</Text></Text>
            <Text style={styles.label}>Number of players: {playerCount}/10</Text>
            
            {/* Mostrar botón START GAME solo si es el host y el juego está en waiting */}
            {isHost && gameStatus === 'waiting' ? (
              <TouchableOpacity style={styles.button} onPress={startGame}>
                <Text style={styles.buttonText}>START GAME</Text>
              </TouchableOpacity>
            ) : isHost && gameStatus !== 'waiting' ? (
              <Text style={styles.label}>Game is already in progress</Text>
            ) : (
              <Text style={styles.label}>Waiting for host to start the game...</Text>
            )}

            {/* Sección para unirse a la partida de otro jugador */}
            <Text style={styles.inputLabel}>Join a Game Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit game code"
              value={joinGameCode}
              onChangeText={(text) => setJoinGameCode(text.toUpperCase())}
              maxLength={6}
              keyboardType="default"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.button} onPress={joinGame}>
                <Text style={styles.buttonText}>JOIN GAME</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default GameScreen;