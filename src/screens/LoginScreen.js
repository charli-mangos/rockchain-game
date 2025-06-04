import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { auth, db, functions } from '../../firebase';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import styles from '../styles/LoginStyles';
import WelcomeHeader from '../components/WelcomeHeader';
import RotatingCube from '../components/RotatingCube';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [showUserName, setShowUserName] = useState(false); // Controla la visibilidad del input de userName
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const createGame = async (userId) => {
    console.log('Creating game...');
    const createGameFunction = httpsCallable(functions, 'createGame');
    try {
      const result = await createGameFunction({ userId });
      const { gameId, gameCode } = result.data;
      console.log('Game created with ID:', gameId);
      return { gameId, gameCode };
    } catch (e) {
      console.error('Error creating game:', e);
      Alert.alert('Error', 'Failed to create the game. Please try again.');
      throw e;
    }
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      const gameData = await createGame(userId);
      navigation.navigate('Game', { gameId: gameData.gameId, gameCode: gameData.gameCode, userId: userId });
    } catch (error) {
      switch (error.code) {
        case 'auth/wrong-password':
          setError('Incorrect password.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email.');
          break;
        default:
          setError(error.message);
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (showUserName && !userName.trim()) {
      setError("Please enter a username.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      await saveUserToFirestore(userId, email, userName); // Guarda userName en Firestore

      const gameData = await createGame(userId);
      Alert.alert("Registration Successful", "You have successfully registered!");
      navigation.navigate('Game', { gameId: gameData.gameId, gameCode: gameData.gameCode, userId: userId });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveUserToFirestore = async (userId, email, userName) => {
    try {
      const userDocRef = doc(db, 'users', userId);
  
      // Estructura inicial del usuario
      const userData = {
        userId: userId,
        email: email,
        userName: userName,
        image: '',
        games: {},  // Objeto para almacenar datos de cada partida
      };
  
      await setDoc(userDocRef, userData);
      console.log('User saved to Firestore with new structure');
    } catch (error) {
      console.error('Error saving user to Firestore:', error);
      Alert.alert('Error', 'Could not save user to Firestore.');
    }
  };

  return (
    <View style={styles.container}>
      <WelcomeHeader title="Welcome to RockChain" />
      {loading ? (
        <RotatingCube size={80} color="#000" /> 
      ) : (
        <>
          {showUserName && (
            <TextInput
              placeholder="username"
              value={userName}
              onChangeText={setUserName}
              style={styles.input}
            />
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TextInput
            placeholder="email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            placeholder="password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          

          {/* Cambiar el botón de inicio de sesión a un enlace */}
          <TouchableOpacity style={styles.button} onPress={showUserName ? handleRegister : handleLogin}>
            <Text style={styles.buttonText}>{showUserName ? "Register" : "Sign in"}</Text>
          </TouchableOpacity>

          {/* Cambiar el botón de registro a un estilo de botón */}
          <TouchableOpacity
            onPress={() => {
              setShowUserName(!showUserName);
            }}
          >
            <Text style={styles.linkRegister}>{showUserName ? "Sign in" : "Register"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forgot your password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={styles.link}>Privacy</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default LoginScreen;
