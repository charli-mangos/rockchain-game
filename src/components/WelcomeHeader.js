import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const WelcomeHeader = ({ title }) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')} // Asegúrate de tener la imagen en la carpeta assets
        style={styles.logo}
      />
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
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 35,
    marginTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 35,
    color: '#1d3d39',
  },
});

export default WelcomeHeader;
