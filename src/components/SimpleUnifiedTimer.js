import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const SimpleUnifiedTimer = ({ blockId, isActive = true, onTimeUpdate }) => {
  const [displayTime, setDisplayTime] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);
  const problemRef = useRef(null);

  // Función para formatear el tiempo
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  // Función para limpiar timer
  const cleanupTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Función para iniciar timer
  const startTimer = () => {
    if (!isScreenFocused || startTime) {
      return;
    }

    const now = Date.now();
    setStartTime(now);
    setDisplayTime(0);
    
    console.log(`[UI][MINING][TIMER] problem=${blockId} (start timer at ${now})`);

    cleanupTimer();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - now;
      setDisplayTime(elapsed);
      
      // Notificar al componente padre del tiempo actual
      if (onTimeUpdate) {
        onTimeUpdate(elapsed);
      }
    }, 10);
    
    intervalRef.current = interval;
  };

  // Función para detener timer
  const stopTimer = () => {
    console.log(`[UI][MINING][TIMER] problem=${blockId} (stop timer)`);
    cleanupTimer();
    setStartTime(null);
  };

  // Detectar cuando la pantalla gana/pierde foco
  useFocusEffect(
    React.useCallback(() => {
      console.log(`[UI][MINING][FOCUS] Pantalla ganó foco para problema=${blockId}`);
      setIsScreenFocused(true);
      
      // Solo iniciar si es un problema nuevo
      if (blockId !== problemRef.current) {
        console.log(`[UI][MINING][NEW_PROBLEM] problem=${blockId} (reset timer)`);
        setDisplayTime(0);
        setStartTime(null);
        problemRef.current = blockId;
      }
      
      return () => {
        console.log(`[UI][MINING][BLUR] Pantalla perdió foco para problema=${blockId}`);
        setIsScreenFocused(false);
        stopTimer();
      };
    }, [blockId])
  );

  // Efecto para manejar cambios de foco
  useEffect(() => {
    if (isScreenFocused && !startTime && isActive) {
      startTimer();
    } else if (!isScreenFocused) {
      stopTimer();
    }

    return cleanupTimer;
  }, [isScreenFocused, isActive, blockId]);

  // Limpiar al desmontar
  useEffect(() => {
    return cleanupTimer;
  }, []);

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerText}>{formatTime(displayTime)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  timerContainer: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'monospace',
  },
});

export default SimpleUnifiedTimer;
