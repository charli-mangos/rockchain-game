import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useGameContextHybrid } from '../context/GameContextHybrid';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

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
  const { miningQueue, showMiningBubble, setShowMiningBubble } = useGameContextHybrid();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1 }}>
      {miningQueue > 0 && showMiningBubble && (
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
            <Text style={styles.miningBubbleText}>{miningQueue}</Text>
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