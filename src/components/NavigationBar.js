import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import styles from '../styles/NavigationBarStyles';

const NavigationBar = ({ navigation }) => {
  const route = useRoute();  // Hook para obtener la ruta activa

  const getColor = (routeName) => {
    return route.name === routeName ? '#ba5d17' : '#1d3d39';  // Compara la ruta actual y ajusta el color
  };

  return (
    <View style={styles.navBar}>
      <TouchableOpacity style={styles.icon} onPress={() => navigation.navigate('Profile')}>
        <Ionicons name="person" size={30} color={getColor('Profile')} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => navigation.navigate('Recycle')}>
        <FontAwesome name="recycle" size={30} color={getColor('Recycle')} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => navigation.navigate('Market')}>
        <FontAwesome name="shopping-cart" size={30} color={getColor('Market')} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => navigation.navigate('Stats')}>
        <MaterialIcons name="bar-chart" size={30} color={getColor('Stats')} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.icon} onPress={() => navigation.navigate('Chat')}>
        <MaterialIcons name="show-chart" size={30} color={getColor('Chat')} />
      </TouchableOpacity>
    </View>
  );
};

export default NavigationBar;
