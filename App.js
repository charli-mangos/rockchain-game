import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import GameScreen from './src/screens/GameScreen';
import WaitingRoomScreen from './src/screens/WaitingRoomScreen';
import GameTabs from './src/components/GameTabs';  // Importar el componente GameTabs que maneja el Tab Navigator
import EndOfRoundScreen from './src/screens/EndOfRoundScreen';
import GameResultsScreen from './src/screens/GameResultsScreen';
import { callGenerateProducts } from './src/components/callGenerateProducts';
import { GameProviderHybrid } from './src/context/GameContextHybrid';

import { HermesInternal } from 'react-native';
console.log("Hermes está activo:", !!HermesInternal);


const Stack = createStackNavigator();

const App = () => {
  const [gameParams, setGameParams] = useState(null);
  
  // Logging para debug
  console.log('🔍 App.js - gameParams actual:', gameParams);

  // useEffect(() => {
  //   // Llama a la función solo una vez
  //   callGenerateProducts();
  // }, []);

  return (
    <NavigationContainer>
      {gameParams ? (
        <GameProviderHybrid gameId={gameParams.gameId} userId={gameParams.userId}>
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
        </GameProviderHybrid>
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
