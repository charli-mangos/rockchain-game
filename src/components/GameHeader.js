import React, { useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { db } from '../../firebase';
import { GameContext } from '../context/GameContext';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const GameHeader = ({ title, userId, gameId, currentScreen }) => {
  const { countdown, round } = useContext(GameContext);
  const [rockCoins, setRockCoins] = useState(0);
  const [waste, setWaste] = useState(0);
  const rockCoinsAnim = useRef(new Animated.Value(1)).current;
  const wasteAnim = useRef(new Animated.Value(1)).current;
  const [prevRockCoins, setPrevRockCoins] = useState(0);
  const [prevWaste, setPrevWaste] = useState(0);
  const [rockCoinsColor, setRockCoinsColor] = useState("#000");
  const [wasteColor, setWasteColor] = useState("#000");
  const navigation = useNavigation();
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const userRef = doc(db, 'users', userId);
      
    const unsubscribeUser = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const gameData = userData.games?.[gameId] || {};
  
        setRockCoins(gameData.rockCoins || 0);
        setWaste(gameData.waste || 0);
        console.log("Updated rockCoins and waste from user data:", gameData);
      } else {
        console.error("User document does not exist:", userId);
      }
    });

    return () => {
      unsubscribeUser();
    };
  }, [userId, gameId]);

  useEffect(() => {
    if (rockCoins !== prevRockCoins) {
      const color = rockCoins > prevRockCoins ? "#00C853" : "#D32F2F";
      setRockCoinsColor(color);
      
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
      ]).start(() => setRockCoinsColor("#000"));
  
      setPrevRockCoins(rockCoins);
    }
  }, [rockCoins]);
  
  useEffect(() => {
    if (waste !== prevWaste) {
      const color = waste > prevWaste ?"#D32F2F" : "#00C853";
      setWasteColor(color);
      
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
      ]).start(() => setWasteColor("#000")); 
  
      setPrevWaste(waste); 
    }
  }, [waste]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleExitPress = () => {
    setShowExitModal(true);
  };

  const handleConfirmExit = () => {
    navigation.navigate('Game');
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
            color="#000" 
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
            />
          </View>
          <View style={styles.trashContainer}>
            <Animated.Text style={[styles.resources, { transform: [{ scale: wasteAnim }], color: wasteColor }]}>
              {waste}
            </Animated.Text>
            <Ionicons name="trash" size={24} color="#000" />
          </View>
        </View>
      </View>
      <View style={styles.bottomContainer}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.roundTimerContainer}>
          <Text style={styles.round}>R{round}</Text>
          <View style={styles.timerContainer}>
            <Text style={countdown <= 10 ? styles.timerRed : styles.timer}>{countdown}s</Text>
          </View>
        </View>
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
              <Ionicons name="close" size={24} color="#000" />
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
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={handleConfirmExit}
              >
                <Text style={styles.buttonText}>Confirmar</Text>
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
  },
  roundTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  round: {
    fontSize: 20,
    marginRight: 10,
  },
  timerContainer: {
    height: 42,
    width: 65,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    padding: 8,
    borderRadius: 5,
  },
  timer: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  timerRed: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'red',
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
    backgroundColor: '#e0e0e0',
  },
  confirmButton: {
    backgroundColor: '#ff4444',
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