import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useNetworkStatus from '../hooks/useNetworkStatus';

const NetworkStatusBanner = () => {
  const { isOnline, isReconnecting, isConnected, isInternetReachable } = useNetworkStatus();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (!isOnline || isReconnecting) {
      // Mostrar banner
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Ocultar banner
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline, isReconnecting, fadeAnim]);

  if (isOnline && !isReconnecting) {
    return null;
  }

  const getStatusInfo = () => {
    if (isReconnecting) {
      return {
        icon: 'sync',
        text: 'Reconectando al servidor...',
        color: '#FFA500',
        backgroundColor: '#FFF3CD'
      };
    }
    
    if (!isConnected) {
      return {
        icon: 'wifi-off',
        text: 'Sin conexión de red',
        color: '#DC3545',
        backgroundColor: '#F8D7DA'
      };
    }
    
    if (!isInternetReachable) {
      return {
        icon: 'globe-outline',
        text: 'Sin acceso a internet',
        color: '#DC3545',
        backgroundColor: '#F8D7DA'
      };
    }
    
    return {
      icon: 'warning',
      text: 'Problema de conectividad',
      color: '#DC3545',
      backgroundColor: '#F8D7DA'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Animated.View 
      style={[
        styles.banner, 
        { 
          backgroundColor: statusInfo.backgroundColor,
          opacity: fadeAnim 
        }
      ]}
    >
      <View style={styles.content}>
        <Ionicons 
          name={statusInfo.icon} 
          size={16} 
          color={statusInfo.color}
          style={styles.icon}
        />
        <Text style={[styles.text, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default NetworkStatusBanner;
