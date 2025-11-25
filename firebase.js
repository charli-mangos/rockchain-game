import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// const firebaseConfig = {
//   apiKey: "REDACTED_API_KEY",
//   authDomain: "another-project.firebaseapp.com",
//   projectId: "another-project",
//   storageBucket: "another-project.appspot.com",
//   messagingSenderId: "537323071895",
//   appId: "1:537323071895:web:1dfe02262e7066abf4fcd2"
// };

// Configuración de Firebase
const firebaseConfig  = {
  authDomain: "rockchain-83a7f.firebaseapp.com",
  projectId: "rockchain-83a7f", // Usar el proyecto real que está configurado
  storageBucket: "rockchain-83a7f.appspot.com",
  messagingSenderId: "96971331973",
  appId: Platform.select({
    android: "1:96971331973:android:1da409eab4005d4502ccec",
    ios: "1:96971331973:ios:50f8effb741b8c9f02ccec"
  }),
};  

// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);


// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore y conectarse al emulador
const db = getFirestore(app);
// connectFirestoreEmulator(db, 'localhost', 8080);

// Inicializar Functions y conectarse al emulador
const functions = getFunctions(app);
// connectFunctionsEmulator(functions, 'localhost', 5001);

// Inicializar Auth y conectarse al emulador
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
//connectAuthEmulator(auth, 'http://localhost:9099');

export { db, functions, auth };
