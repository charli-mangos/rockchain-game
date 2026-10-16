import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Configuración de Firebase: se lee de variables EXPO_PUBLIC_* (ver .env.example)
const env = process.env;

const firebaseConfig = {
  apiKey: Platform.OS === 'android'
    ? env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID || env.EXPO_PUBLIC_FIREBASE_API_KEY
    : env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS || env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Platform.OS === 'android'
    ? env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID
    : env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('[firebase] Missing EXPO_PUBLIC_FIREBASE_* variables. Copy .env.example to .env');
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const functions = getFunctions(app, env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'us-central1');
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Emuladores locales (EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true)
if (env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
  const host = env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectAuthEmulator(auth, `http://${host}:9099`);
}

export { db, functions, auth };
