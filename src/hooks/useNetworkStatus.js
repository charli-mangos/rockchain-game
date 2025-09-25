import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isReconnecting: false
  });

  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    // Listener de estado de red
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      console.log('🌐 [NetworkStatus] Estado de red:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      });

      setNetworkState(prevState => ({
        ...prevState,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isReconnecting: !state.isConnected && prevState.isConnected
      }));
    });

    // Listener de estado de la app
    const handleAppStateChange = (nextAppState) => {
      console.log('📱 [NetworkStatus] AppState cambió a:', nextAppState);
      setAppState(nextAppState);
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Obtener estado inicial
    NetInfo.fetch().then(state => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isReconnecting: false
      });
    });

    return () => {
      unsubscribeNetInfo();
      appStateSubscription?.remove();
    };
  }, []);

  return {
    ...networkState,
    appState,
    isOnline: networkState.isConnected && networkState.isInternetReachable,
    isOffline: !networkState.isConnected || !networkState.isInternetReachable
  };
};

export default useNetworkStatus;
