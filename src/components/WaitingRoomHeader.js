import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import RotatingCube from './RotatingCube';

const WaitingRoomHeader = ({ title }) => {
  
  return (
    <View style={styles.container}>
      <RotatingCube size={100} color="#ba5d17" /> 
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 35,
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 35,
    color: '#1d3d39',
  },
});

export default WaitingRoomHeader;
