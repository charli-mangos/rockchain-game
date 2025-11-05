import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { useNavigation } from '@react-navigation/native';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { useTranslation } from 'react-i18next';

const GameResultsScreen = ({ route }) => {
  const { t } = useTranslation();
  const { gameId, userId, allPlayersData } = useGameContextHybridRobust();
  
  // Usar los datos completos de todos los jugadores
  const players = allPlayersData.sort((a, b) => {
    // Ordenar por balance (RockCoins - Waste) de mayor a menor
    const balanceA = a.rockCoins - a.waste;
    const balanceB = b.rockCoins - b.waste;
    return balanceB - balanceA;
  });
  const [userPosition, setUserPosition] = useState(0);
  const [userRockCoins, setUserRockCoins] = useState(0);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const navigation = useNavigation();

  // Función helper para esperar a que el documento del juego exista
  const waitForGameDocument = async (gameId, maxRetries = 10, delay = 500) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const gameRef = doc(db, 'games', gameId);
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
          console.log(`✅ Documento del juego ${gameId} verificado después de ${i + 1} intentos`);
          return true;
        }
        console.log(`⏳ Esperando documento del juego ${gameId}... (intento ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`❌ Error verificando documento del juego:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    console.error(`❌ Documento del juego ${gameId} no encontrado después de ${maxRetries} intentos`);
    return false;
  };

  // Función para crear una nueva partida (reutilizada del LoginScreen)
  const createNewGame = async () => {
    console.log('🔄 Creando nueva partida...');
    setIsCreatingGame(true);
    
    const createGameFunction = httpsCallable(functions, 'createGame');
    try {
      // Usar verificación de autenticación
      const result = await callAuthenticatedFunction(
        () => createGameFunction({ userId }),
        'createGame'
      );
      
      const { gameId: newGameId, gameCode } = result.data;
      console.log('✅ Nueva partida creada con ID:', newGameId, 'Código:', gameCode);
      
      // Esperar a que el documento esté disponible en Firestore
      const documentExists = await waitForGameDocument(newGameId);
      if (!documentExists) {
        throw new Error('El documento del juego no está disponible en Firestore');
      }
      
      // Navegar a GameScreen con la nueva partida (como en el login)
      navigation.reset({
        index: 0,
        routes: [{ name: 'Game', params: { gameId: newGameId, gameCode, userId } }],
      });
    } catch (error) {
      console.error('❌ Error al crear nueva partida:', error);
      Alert.alert(t('common.error'), t('game.failedToCreateNewGame'));
    } finally {
      setIsCreatingGame(false);
    }
  };

  // Calcular posición del usuario cuando cambian los players (como en StatsScreen)
  useEffect(() => {
    console.log(`🔄 GameResultsScreen - Players actualizados:`, players);
    
    if (players && players.length > 0) {
      console.log(`📊 Players from context:`, players);
      console.log(`👤 Buscando usuario: ${userId}`);
      
      // Los players ya vienen ordenados por rockCoins (descendente) desde el contexto
      const userIndex = players.findIndex(player => {
        console.log(`🔍 Comparando: ${player.userId} vs ${userId}`);
        return player.userId === userId;
      });
      
      if (userIndex !== -1) {
        const userPlayer = players[userIndex];
        setUserPosition(userIndex + 1);
        setUserRockCoins(userPlayer.rockCoins);
        console.log(`🏆 Usuario encontrado en posición ${userIndex + 1} con ${userPlayer.rockCoins} RockCoins`);
        console.log(`🏆 Datos completos del usuario:`, userPlayer);
      } else {
        console.log(`❌ Usuario ${userId} no encontrado en el ranking`);
        console.log(`❌ Players disponibles:`, players.map(p => ({ userId: p.userId, userName: p.userName })));
        setUserPosition(0);
        setUserRockCoins(0);
      }
    } else {
      console.log('📭 No hay players disponibles aún');
    }
  }, [players, userId]);

  const getPositionMessage = (position) => {
    switch (position) {
      case 1:
        return "🥇 Congratulations! You won the game.";
      case 2:
        return "🥈 Great job! You came in second.";
      case 3:
        return "🥉 You finished third! Better luck next time.";
      default:
        return `You finished in ${position}th place. Keep practicing!`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header limpio sin contador ni número de ronda */}
      <View style={styles.header}>
        <Text style={styles.title}>Game Results</Text>
        <Text style={styles.subtitle}>Final Standings</Text>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mensaje personalizado */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            {getPositionMessage(userPosition)}
          </Text>
        </View>

        {/* Ranking de jugadores - usando el mismo contexto que StatsScreen */}
        <PlayerRankingComponent 
          players={players} 
          title="Final Rankings" 
          currentUserId={userId}
          roundRewards={null}
        />
        

        {/* Blockchain completo - todos los bloques de la partida */}
        <BlockchainComponent 
          gameId={gameId} 
          title="Final Blockchain" 
          showReward={true}
          filterByRound={null} // Mostrar todos los bloques sin filtro de ronda
          currentUserId={userId}
        />
      </ScrollView>

      <TouchableOpacity 
        style={[styles.newGameButton, isCreatingGame && styles.newGameButtonDisabled]}
        onPress={createNewGame}
        disabled={isCreatingGame}
      >
        <Text style={styles.newGameButtonText}>
          {isCreatingGame ? 'Creando...' : 'Nueva Partida'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#1d3d39',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  messageContainer: {
    backgroundColor: '#1d3d39',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  newGameButton: {
    backgroundColor: '#1d3d39',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  newGameButtonDisabled: {
    backgroundColor: '#ccc',
  },
  newGameButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 24,
  },
  debugText: {
    fontSize: 16,
    color: '#1d3d39',
  },
});

export default GameResultsScreen; 