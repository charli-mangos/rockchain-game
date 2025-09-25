import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const RotatingCube = ({ 
  size = 80, 
  color = '#ba5d17', 
  duration = 2000,
  style = {},
  containerStyle = {} 
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  // Animación de rotación
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();

    return () => spinAnimation.stop(); // Detiene la animación si el componente se desmonta
  }, [spinValue, duration]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View style={[{ transform: [{ rotate: spin }] }, style]}>
        <MaterialCommunityIcons name="cube" size={size} color={color} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RotatingCube;
