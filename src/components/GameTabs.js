import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useGameContextHybrid } from '../context/GameContextHybrid';
import { useSimpleMiningContext } from '../context/SimpleMiningContext';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import webSocketService from '../services/WebSocketService';

import MarketScreen from '../screens/MarketScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StatScreen from '../screens/StatsScreen';
import RecycleScreen from '../screens/RecycleScreen';
import ChatScreen from '../screens/ChatScreen';
import MiningScreen from '../screens/MiningScreen';

const Tab = createBottomTabNavigator();

const Tabs = ({ route }) => {
  const { gameId, userId } = useGameContextHybrid();
  const { setShowMiningBubble } = useGameContextHybrid();

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
  const { gameId, userId } = useGameContextHybrid();
  const { showMiningBubble, setShowMiningBubble, miningQueue } = useGameContextHybrid();
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
        console.log('🎮 GameTabs: Navegando a EndOfRoundScreen');
        navigation.navigate('EndOfRound', { gameId, userId });
      }
    };

    // Registrar el listener
    webSocketService.on('round_ended', handleRoundEnded);

    // Cleanup
    return () => {
      console.log('🎮 GameTabs: Limpiando listener de round_ended');
      webSocketService.off('round_ended', handleRoundEnded);
    };
  }, [gameId, userId, navigation]);

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
    backgroundColor: '#FF5733',
    borderRadius: 8,
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
});

export default GameTabs;