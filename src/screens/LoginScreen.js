import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { auth, db, functions } from '../../firebase';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';
import styles from '../styles/LoginStyles';
import WelcomeHeader from '../components/WelcomeHeader';
import RotatingCube from '../components/RotatingCube';
import DismissKeyboardView from '../components/DismissKeyboardView';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AuthErrorPanel from '../components/AuthErrorPanel';

const LoginScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { setGameParams } = route.params || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [showUserName, setShowUserName] = useState(false); // Controla la visibilidad del input de userName
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const createGame = async (userId) => {
    console.log('Creating game...');
    const createGameFunction = httpsCallable(functions, 'createGame');
    try {
      // Usar verificación de autenticación
      const result = await callAuthenticatedFunction(
        () => createGameFunction({ userId }),
        'createGame'
      );
      
      const { gameId, gameCode } = result.data;
      console.log('Game created with ID:', gameId);
      console.log('🔍 LoginScreen - createGame resultado completo:', result.data);
      console.log('🔍 LoginScreen - gameId extraído:', gameId);
      console.log('🔍 LoginScreen - gameCode extraído:', gameCode);
      return { gameId, gameCode };
    } catch (e) {
      console.error('Error creating game:', e);
      // No mostrar Alert, el error se manejará en el componente padre
      throw e;
    }
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      setError('invalid-email');
      setErrorCode('auth/invalid-email');
      return;
    }
    setError('');
    setErrorCode(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      const gameData = await createGame(userId);
      console.log('LoginScreen - Game created successfully:', gameData);
      console.log('LoginScreen - Game data details:', {
        gameId: gameData.gameId,
        gameCode: gameData.gameCode,
        success: gameData.success
      });
      
      if (setGameParams) {
        console.log('LoginScreen - Setting game params:', { gameId: gameData.gameId, userId: userId });
        setGameParams({ gameId: gameData.gameId, userId: userId });
      } else {
        navigation.navigate('Game', { gameId: gameData.gameId, gameCode: gameData.gameCode, userId: userId });
      }
    } catch (error) {
      setErrorCode(error.code || null);
      // Usar mensajes naturales en lugar de los técnicos de Firebase
      setError(''); // El AuthErrorPanel mostrará el mensaje apropiado basado en errorCode
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validateEmail(email)) {
      setError('invalid-email');
      setErrorCode('auth/invalid-email');
      return;
    }
    if (showUserName && !userName.trim()) {
      setError('username-required');
      setErrorCode(null);
      return;
    }
    setError('');
    setErrorCode(null);
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      await saveUserToFirestore(userId, email, userName); // Guarda userName en Firestore
      
      const gameData = await createGame(userId);
      console.log('LoginScreen - Game created successfully (register):', gameData);
      console.log('LoginScreen - Game data details (register):', {
        gameId: gameData.gameId,
        gameCode: gameData.gameCode,
        success: gameData.success
      });
      
      if (setGameParams) {
        console.log('LoginScreen - Setting game params (register):', { gameId: gameData.gameId, userId: userId });
        setGameParams({ gameId: gameData.gameId, userId: userId });
      } else {
        navigation.navigate('Game', { gameId: gameData.gameId, gameCode: gameData.gameCode, userId: userId });
      }
    } catch (error) {
      setErrorCode(error.code || null);
      // Usar mensajes naturales en lugar de los técnicos de Firebase
      setError(''); // El AuthErrorPanel mostrará el mensaje apropiado basado en errorCode
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
      // El error se manejará en el componente que llama a esta función
      throw error;
    }
  };

  return (
    <DismissKeyboardView style={styles.container}>
      <WelcomeHeader title={t('home.welcomeToRockChain')} />
      {loading ? (
        <RotatingCube size={80} color="#ba5d17" /> 
      ) : (
        <>
          <View style={styles.languageSwitcherContainer}>
            <LanguageSwitcher />
          </View>
          {showUserName && (
            <TextInput
              placeholder={t('auth.username')}
              value={userName}
              onChangeText={setUserName}
              style={styles.input}
            />
          )}
          <AuthErrorPanel
            error={error}
            errorCode={errorCode}
            onDismiss={() => {
              setError('');
              setErrorCode(null);
            }}
            visible={!!(error || errorCode)}
          />
          <TextInput
            placeholder={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            placeholder={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          

          {/* Cambiar el botón de inicio de sesión a un enlace */}
          <TouchableOpacity style={styles.button} onPress={showUserName ? handleRegister : handleLogin}>
            <Text style={styles.buttonText}>{showUserName ? t('auth.register') : t('auth.signIn')}</Text>
          </TouchableOpacity>

          {/* Cambiar el botón de registro a un estilo de botón */}
          <TouchableOpacity
            onPress={() => {
              setShowUserName(!showUserName);
            }}
          >
            <Text style={styles.linkRegister}>{showUserName ? t('auth.signIn') : t('auth.register')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={styles.link}>{t('auth.privacy')}</Text>
          </TouchableOpacity>
        </>
      )}
    </DismissKeyboardView>
  );
};

export default LoginScreen;
