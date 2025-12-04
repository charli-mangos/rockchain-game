import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { functions, db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { httpsCallable } from 'firebase/functions';
import styles from '../styles/GameScreenStyles';
import WelcomeHeader from '../components/WelcomeHeader';
import RotatingCube from '../components/RotatingCube';
import TutorialModal from '../components/TutorialModal';
import { useTutorial } from '../hooks/useTutorial';
import EducationalFeedback from '../components/EducationalFeedback';
import LearningProgressModal from '../components/LearningProgressModal';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';

const GameScreen = ({ route }) => {
  const { t } = useTranslation();
  const { gameId, userId, setGameParams } = route.params || {};
  const navigation = useNavigation();
  
  // Estados locales simples
  const [gameCode, setGameCode] = useState('');
  const [joinGameCode, setJoinGameCode] = useState('');
  const [playerCount, setPlayerCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [hostId, setHostId] = useState(null);
  
  // Sistema de tutoriales
  const {
    currentTutorial,
    currentStep,
    showTutorial,
    startTutorial,
    closeTutorial,
    nextStep,
    previousStep,
    shouldShowTutorial,
    getTutorialProgress
  } = useTutorial(userId);
  
  // Sistema de feedback educativo
  const {
    educationalFeedback,
    showEducationalFeedback,
    dismissEducationalFeedback,
    learningProgress
  } = useGameContextHybridRobust();
  
  // Estados para el modal de progreso de aprendizaje
  const [showLearningProgress, setShowLearningProgress] = useState(false);
  
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
      Alert.alert(t('common.error'), t('game.pleaseEnterGameCode'));
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
        Alert.alert(t('common.error'), t('game.gameNotFound'));
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
        Alert.alert(t('common.error'), t('game.cannotJoinOwnGame'));
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
      Alert.alert(t('common.error'), t('game.failedToJoinGame'));
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar el juego
  const startGame = async () => {
    console.log('🎮 startGame called by user:', userId, 'hostId:', hostId, 'isHost:', isHost);
    
    if (!isHost) {
      Alert.alert(t('common.error'), t('game.onlyHostCanStart'));
      return;
    }

    if (gameStatus !== 'waiting') {
      Alert.alert(t('common.error'), t('game.gameAlreadyStarted'));
      return;
    }

    // Verificar que hay al menos 2 jugadores para iniciar
    if (playerCount < 2) {
      Alert.alert(t('common.error'), t('game.needAtLeastTwoPlayers'));
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
      Alert.alert(t('common.error'), t('game.failedToStartGame'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <WelcomeHeader title={t('game.startRockChain')} />
        {loading ? (
          <RotatingCube size={80} color="#ba5d17" /> 
        ) : (
          <View style={styles.inputContainer}>
            {/* Sección para el jugador para empezar su propia partida */}
            <Text style={styles.label}>{t('game.yourGameCode')}: <Text style={[styles.bold, { color: '#1d3d39' }]}>{gameCode}</Text></Text>
            <Text style={styles.label}>{t('game.numberOfPlayers')}: {playerCount}/5</Text>
            
            {/* Mostrar botón START GAME solo si es el host y el juego está en waiting */}
            {isHost && gameStatus === 'waiting' ? (
              <TouchableOpacity style={styles.button} onPress={startGame}>
                <Text style={styles.buttonText}>{t('game.startGame')}</Text>
              </TouchableOpacity>
            ) : isHost && gameStatus !== 'waiting' ? (
              <Text style={styles.label}>{t('game.gameInProgress')}</Text>
            ) : (
              <Text style={styles.label}>{t('game.waitingForHost')}</Text>
            )}

            {/* Sección para unirse a la partida de otro jugador */}
            <Text style={styles.inputLabel}>{t('game.joinGameCode')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('game.enterGameCode')}
              value={joinGameCode}
              onChangeText={(text) => setJoinGameCode(text.toUpperCase())}
              maxLength={6}
              keyboardType="default"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.button} onPress={joinGame}>
                <Text style={styles.buttonText}>{t('game.joinGame')}</Text>
            </TouchableOpacity>
            
            {/* Botón de tutoriales */}
            <TouchableOpacity 
              style={[styles.button, styles.tutorialButton]} 
              onPress={() => startTutorial()}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="information-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.tutorialButtonText}>Learn About RockChain</Text>
              </View>
            </TouchableOpacity>
            
            {/* Botón de progreso de aprendizaje */}
            <TouchableOpacity 
              style={[styles.button, styles.progressButton]} 
              onPress={() => setShowLearningProgress(true)}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="trophy-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.progressButtonText}>My Progress</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Modal de tutoriales */}
        <TutorialModal
          visible={showTutorial}
          onClose={closeTutorial}
          tutorial={currentTutorial}
          onNext={nextStep}
          onPrevious={previousStep}
          currentStep={currentStep}
          totalSteps={1}
        />
        
        {/* Feedback educativo */}
        <EducationalFeedback
          feedback={educationalFeedback}
          onDismiss={dismissEducationalFeedback}
          autoHide={true}
          duration={6000}
        />
        
        {/* Modal de progreso de aprendizaje */}
        <LearningProgressModal
          visible={showLearningProgress}
          onClose={() => setShowLearningProgress(false)}
          learningProgress={learningProgress}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default GameScreen;