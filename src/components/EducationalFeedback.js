import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const EducationalFeedback = ({ feedback, onDismiss, autoHide = true, duration = 5000 }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (feedback) {
      // Animar entrada
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide después del tiempo especificado
      if (autoHide) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
  }, [feedback, autoHide, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!feedback) return null;

  const getIconAndColor = (type) => {
    switch (type) {
      case 'mining_success':
        return { icon: 'hammer', color: '#4CAF50', bgColor: '#E8F5E8' };
      case 'waste_reduction_success':
        return { icon: 'leaf', color: '#2E7D32', bgColor: '#E8F5E8' };
      case 'transaction_success':
        return { icon: 'checkmark-circle', color: '#2196F3', bgColor: '#E3F2FD' };
      case 'industry_selection':
        return { icon: 'business', color: '#FF9800', bgColor: '#FFF3E0' };
      case 'blockchain_concept':
        return { icon: 'link', color: '#9C27B0', bgColor: '#F3E5F5' };
      default:
        return { icon: 'information-circle', color: '#1d3d39', bgColor: '#f8f9fa' };
    }
  };

  const { icon, color, bgColor } = getIconAndColor(feedback.type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.feedbackCard, { backgroundColor: bgColor, borderLeftColor: color }]}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color }]}>
              {feedback.title || 'Educational Tip'}
            </Text>
            <Text style={styles.message}>{feedback.message}</Text>
            {feedback.explanation && (
              <Text style={styles.explanation}>{feedback.explanation}</Text>
            )}
          </View>
          <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        
        {feedback.reward && (
          <View style={styles.rewardContainer}>
            <Text style={styles.rewardText}>
              +{feedback.reward} RockCoins
            </Text>
          </View>
        )}
        
        {feedback.industryEfficiency && (
          <View style={styles.efficiencyContainer}>
            <Text style={styles.efficiencyText}>
              Industry Efficiency: {feedback.industryEfficiency}%
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  feedbackCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 4,
  },
  explanation: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  rewardContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  efficiencyContainer: {
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  efficiencyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
});

export default EducationalFeedback;
