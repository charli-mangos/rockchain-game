import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const RewardAnimation = ({ 
  reward, 
  type, // 'rockCoins' o 'waste'
  isVisible, 
  onAnimationComplete 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (isVisible && reward > 0) {
      // Iniciar animación
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Después de mostrar, mantener la animación clavada en el ranking
      setTimeout(() => {
        // Mantener la animación en su posición final sin fade out
        // La animación se queda clavada en el ranking
        onAnimationComplete?.();
      }, 2000); // Mostrar por 2 segundos
    }
  }, [isVisible, reward]);

  if (!isVisible || reward <= 0) {
    return null;
  }

  const getRewardText = () => {
    if (type === 'rockCoins') {
      return `+${reward}`;
    } else if (type === 'waste') {
      return `-${reward}`;
    }
    return '';
  };

  const getRewardColor = () => {
    if (type === 'rockCoins') {
      return '#2d5a56'; // Verde para RockCoins
    } else if (type === 'waste') {
      return '#2d5a56'; // Verde para reducción de waste
    }
    return '#2d5a56';
  };

  return (
    <Animated.View
      style={[
        styles.rewardContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
        },
      ]}
    >
      <Text style={[styles.rewardText, { color: getRewardColor() }]}>
        {getRewardText()}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rewardContainer: {
    position: 'absolute',
    right: -40,
    top: '50%',
    zIndex: 1000,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default RewardAnimation;
