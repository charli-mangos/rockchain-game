import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { useSimpleMiningContext } from '../context/SimpleMiningContext';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';
import RotatingCube from './RotatingCube';

import MarketScreen from '../screens/MarketScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StatScreen from '../screens/StatsScreen';
import RecycleScreen from '../screens/RecycleScreen';
import ChatScreen from '../screens/ChatScreen';
import MiningScreen from '../screens/MiningScreen';

const Tab = createBottomTabNavigator();


const Tabs = ({ route }) => {
  const { gameId, userId } = useGameContextHybridRobust();
  const { setShowMiningBubble } = useGameContextHybridRobust();

  return (
    <Tab.Navigator 
      screenOptions={{ 
        headerShown: false, 
        tabBarStyle: { display: 'none' },
        tabBarHideOnKeyboard: true,
      }}
      screenListeners={{
        state: (e) => {
          if (e.data.state.routes[e.data.state.index].name === 'Mining') {
            setShowMiningBubble(false);
          } else {
            setShowMiningBubble(true);
          }
        },
      }}
    >
      <Tab.Screen name="Market" component={MarketScreen} initialParams={{ gameId, userId }} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ gameId, userId }} />
      <Tab.Screen name="Stats" component={StatScreen} initialParams={{ gameId, userId }} />
      <Tab.Screen name="Recycle" component={RecycleScreen} initialParams={{ gameId, userId }} />
      <Tab.Screen name="Chat" component={ChatScreen} initialParams={{ gameId, userId }} />
      <Tab.Screen name="Mining" component={MiningScreen} initialParams={{ gameId, userId }} />
    </Tab.Navigator>
  );
};

const GameTabs = ({ route }) => {
  const { gameId, userId, gameStatus } = useGameContextHybridRobust();
  const { showMiningBubble, setShowMiningBubble, miningQueue } = useGameContextHybridRobust();
  const simpleMiningContext = useSimpleMiningContext();
  
  // Usar el nuevo sistema si está disponible, sino fallback al existente
  const pendingCount = simpleMiningContext?.pendingCount || miningQueue;
  
  const navigation = useNavigation();

  // console.log(`[GAMETABS] pendingCount=${pendingCount}, showMiningBubble=${showMiningBubble}, miningQueue=${miningQueue}, simpleMiningContext=${!!simpleMiningContext}`);

  // Escuchar eventos de fin de ronda directamente en GameTabs
  useEffect(() => {
    console.log('🎮 GameTabs: Configurando listener para round_ended');
    
    const handleRoundEnded = (data) => {
      console.log('🎮 GameTabs: Recibido round_ended:', data);
      if (data.status === 'roundEnd') {
        console.log('🎮 GameTabs: round_ended recibido, esperando a que se procesen las recompensas...');
        // NO navegar inmediatamente - el timer maneja la navegación
      }
    };

    // Registrar el listener
    const webSocketService = getWebSocketService();
    webSocketService.on('round_ended', handleRoundEnded);

    // Cleanup
    return () => {
      console.log('🎮 GameTabs: Limpiando listener de round_ended');
      webSocketService.off('round_ended', handleRoundEnded);
    };
  }, [gameId, userId, navigation]);

  // ELIMINADO: Navegación basada en calculating - el timer maneja la navegación a EndOfRound

  return (
    <View style={{ flex: 1 }}>
      {pendingCount > 0 && showMiningBubble && (
        <View style={styles.miningBubbleContainer}>
          <TouchableOpacity 
            onPress={() => {
              setShowMiningBubble(false);
              navigation.navigate('GameTabs', {
                gameId,
                userId,
                screen: 'Mining',
                params: { gameId, userId }  // <- Esto va al tab interno
              });


            }} 
            style={styles.miningBubble}
          >
            <Text style={styles.miningBubbleText}>{pendingCount}</Text>
            <Ionicons name="hammer-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <Tabs route={route} />
      
      {/* ELIMINADO: Overlay de calculating - solo se muestra en EndOfRoundScreen */}
    </View>
  );
};

const styles = StyleSheet.create({
  miningBubbleContainer: {
    position: 'absolute',
    bottom: 105,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  miningBubble: {
    backgroundColor: '#ba5d17',
    borderRadius: 18,
    width: 120,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  miningBubbleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginTop: 15,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#1d3d39',
    marginTop: 5,
    textAlign: 'center',
  },
  rotatingCubeContainer: {
    marginBottom: 20,
  },
});

export default GameTabs;