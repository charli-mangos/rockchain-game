import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import GameScreen from './src/screens/GameScreen';
import WaitingRoomScreen from './src/screens/WaitingRoomScreen';
import GameTabs from './src/components/GameTabs';  // Importar el componente GameTabs que maneja el Tab Navigator
import EndOfRoundScreen from './src/screens/EndOfRoundScreen';
import { callGenerateProducts } from './src/components/callGenerateProducts';
import { GameProvider } from './src/context/GameContext';

import { HermesInternal } from 'react-native';
console.log("Hermes está activo:", !!HermesInternal);


const Stack = createStackNavigator();

const App = () => {
  // useEffect(() => {
  //   // Llama a la función solo una vez
  //   callGenerateProducts();
  // }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          gestureEnabled: false,
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="WaitingRoom" component={WaitingRoomScreen} />
        <Stack.Screen
          name="GameTabs"
          options={{ 
            headerShown: false,
            gestureEnabled: false,
          }}
        >
          {({ route, navigation }) => {
            if (!route.params.gameId || !route.params.userId) {
              console.error('Game ID or User ID is missing.');
              navigation.navigate('Login');
              return null;
            }

            return (
              <GameProvider
                gameId={route.params.gameId}
                userId={route.params.userId}
                navigation={navigation}
              >
                <GameTabs route={route} />
              </GameProvider>
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name="EndOfRound"
          options={{ 
            headerShown: false,
            gestureEnabled: false,
          }}
        >
          {({ route, navigation }) => {
            if (!route.params.gameId || !route.params.userId) {
              console.error('Game ID or User ID is missing.');
              navigation.navigate('Login');
              return null;
            }

            return (
              <GameProvider
                gameId={route.params.gameId}
                userId={route.params.userId}
                navigation={navigation}
              >
                <EndOfRoundScreen route={route} />
              </GameProvider>
            );
          }}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
