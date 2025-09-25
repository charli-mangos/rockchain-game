import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as NavigationBar from 'expo-navigation-bar';
import LoginScreen from './src/screens/LoginScreen';
import GameScreen from './src/screens/GameScreen';
import WaitingRoomScreen from './src/screens/WaitingRoomScreen';
import GameTabs from './src/components/GameTabs';  // Importar el componente GameTabs que maneja el Tab Navigator
import EndOfRoundScreen from './src/screens/EndOfRoundScreen';
import GameResultsScreen from './src/screens/GameResultsScreen';
import { GameProviderHybridRobust } from './src/context/GameContextHybridRobust';
import { SimpleMiningProvider } from './src/context/SimpleMiningContext';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';

import { HermesInternal } from 'react-native';


const Stack = createStackNavigator();

const App = () => {
  const [gameParams, setGameParams] = useState(null);
  

  // Ocultar la barra de navegación del sistema en Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);


  return (
    <NavigationContainer>
      {gameParams ? (
        <GameProviderHybridRobust gameId={gameParams.gameId} userId={gameParams.userId}>
          <SimpleMiningProvider gameId={gameParams.gameId} userId={gameParams.userId}>
            <NetworkStatusBanner />
            <Stack.Navigator 
              initialRouteName="Game"
              screenOptions={{
                gestureEnabled: false,
                headerShown: false,
              }}
            >
              <Stack.Screen
                name="Game"
                component={GameScreen}
                initialParams={{ setGameParams, gameId: gameParams.gameId, userId: gameParams.userId }}
              />
              <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} />
              <Stack.Screen name="GameTabs" component={GameTabs} />
              <Stack.Screen name="EndOfRound" component={EndOfRoundScreen} />
              <Stack.Screen name="GameResults" component={GameResultsScreen} />
            </Stack.Navigator>
          </SimpleMiningProvider>
        </GameProviderHybridRobust>
      ) : (
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            gestureEnabled: false,
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="Login" 
            component={LoginScreen}
            initialParams={{ setGameParams }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default App;
