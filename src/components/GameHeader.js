import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, Alert } from 'react-native';
import { functions } from '../../firebase';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';

const GameHeader = ({ title, userId, gameId, currentScreen }) => {
  const { countdown, round, webSocketInventory } = useGameContextHybridRobust();
  const rockCoins = webSocketInventory.rockCoins || 600;
  const waste = webSocketInventory.waste || 0;
  const rockCoinsAnim = useRef(new Animated.Value(1)).current;
  const wasteAnim = useRef(new Animated.Value(1)).current;
  const [prevRockCoins, setPrevRockCoins] = useState(0);
  const [prevWaste, setPrevWaste] = useState(0);
  const [rockCoinsColor, setRockCoinsColor] = useState("#1d3d39");
  const [wasteColor, setWasteColor] = useState("#1d3d39");
  const navigation = useNavigation();
  const [showExitModal, setShowExitModal] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  // Los datos ahora vienen del WebSocket a través del contexto
  // No necesitamos leer de Firestore

  useEffect(() => {
    if (rockCoins !== prevRockCoins) {
      const color = rockCoins > prevRockCoins ? "#2d5a56" : "#ba5d17";
      setRockCoinsColor(color);
      
      // Usar requestAnimationFrame para evitar problemas de renderizado
      requestAnimationFrame(() => {
        Animated.sequence([
          Animated.timing(rockCoinsAnim, {
            toValue: 1.5,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rockCoinsAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Usar setTimeout para evitar setState durante render
          setTimeout(() => setRockCoinsColor("#1d3d39"), 0);
        });
      });
  
      setPrevRockCoins(rockCoins);
    }
  }, [rockCoins, prevRockCoins]);
  
  useEffect(() => {
    if (waste !== prevWaste) {
      const color = waste > prevWaste ? "#ba5d17" : "#1d3d39";
      setWasteColor(color);
      
      // Usar requestAnimationFrame para evitar problemas de renderizado
      requestAnimationFrame(() => {
        Animated.sequence([
          Animated.timing(wasteAnim, {
            toValue: 1.5,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(wasteAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Usar setTimeout para evitar setState durante render
          setTimeout(() => setWasteColor("#1d3d39"), 0);
        });
      });
  
      setPrevWaste(waste); 
    }
  }, [waste, prevWaste]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleExitPress = () => {
    setShowExitModal(true);
  };

  const createNewGame = async () => {
    console.log('🔄 Creando nueva partida desde GameHeader...');
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
      
      // Navegar a GameScreen con la nueva partida usando reset
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

  const handleConfirmExit = async () => {
    setShowExitModal(false);
    await createNewGame();
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topContainer}>
        <TouchableOpacity 
          onPress={currentScreen === 'RockMining' ? handleBack : handleExitPress} 
          style={styles.iconContainer}
        >
          <Ionicons 
            name={currentScreen === 'RockMining' ? "arrow-back" : "close"} 
            size={24} 
            color="#1d3d39" 
          />
        </TouchableOpacity>
        <View style={styles.resourcesContainer}>
          <View style={styles.bitcoinContainer}>
            <Animated.Text style={[styles.bitcoin, { transform: [{ scale: rockCoinsAnim }], color: rockCoinsColor }]}>
              {rockCoins}
            </Animated.Text>
            <Image 
              source={require('../assets/RockCoinBlack.png')} 
              style={styles.rockCoinIcon} 
              tintColor='#1d3d39'
            />
          </View>
          <View style={styles.trashContainer}>
            <Animated.Text style={[styles.resources, { transform: [{ scale: wasteAnim }], color: wasteColor }]}>
              {waste}
            </Animated.Text>
            <Ionicons name="trash" size={24} color="#1d3d39" />
          </View>
        </View>
      </View>
      <View style={styles.bottomContainer}>
        <Text style={styles.title}>{title}</Text>
        {currentScreen !== 'EndOfRound' && (
          <View style={styles.roundTimerContainer}>
            <Text style={styles.round}>R{round}</Text>
            <View style={styles.timerContainer}>
              <Text style={countdown <= 10 ? styles.timerRed : styles.timer}>{countdown}s</Text>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={handleCancelExit}
            >
              <Ionicons name="close" size={24} color="#1d3d39" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>¿Quieres salir de la partida?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={handleCancelExit}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              
                          <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton, isCreatingGame && styles.disabledButton]} 
              onPress={handleConfirmExit}
              disabled={isCreatingGame}
            >
              <Text style={styles.buttonText}>
                {isCreatingGame ? 'Creando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
  },
  topContainer: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: {
    padding: 5,
  },
  resourcesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bitcoinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  trashContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  resources: {
    fontSize: 20,
    marginRight: 10,
  },
  bitcoin: {
    fontSize: 20,
    marginRight: 5,
  },
  bottomContainer: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1d3d39',
  },
  roundTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  round: {
    fontSize: 20,
    marginRight: 10,
    color: '#1d3d39',
  },
  timerContainer: {
    height: 42,
    width: 65,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1d3d39',
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#fdf4e8',
  },
  timer: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1d3d39',
  },
  timerRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ba5d17',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    width: '80%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 30,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#4a6b68',
  },
  confirmButton: {
    backgroundColor: '#ba5d17',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rockCoinIcon: {
    width: 24,
    height: 24,
    marginLeft: 5,
  },
});

export default GameHeader;