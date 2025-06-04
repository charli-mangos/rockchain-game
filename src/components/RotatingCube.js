import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Asegúrate de tener @expo/vector-icons instalado

const RotatingCube = ({ size = 80, color = '#000' }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  // Animación de rotación
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000, // Duración del giro en milisegundos
        useNativeDriver: true,
      })
    );
    spinAnimation.start();

    return () => spinAnimation.stop(); // Detiene la animación si el componente se desmonta
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <MaterialCommunityIcons name="cube" size={size} color={color} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RotatingCube;
