import React, { useState, useEffect } from 'react';
import { View, Text, Image, TextInput, FlatList, Modal, TouchableOpacity, TouchableWithoutFeedback, Keyboard, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';  // Importamos ImagePicker
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';
import NavigationBar from '../components/NavigationBar';
import styles from '../styles/ProfileScreenStyles';
import GameHeader from '../components/GameHeader';
import ExpandableProduct from '../components/ExpandableProduct';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';


const ProfileScreen = ({ navigation, route }) => {
  const { userData, webSocketInventory, gameId, userId } = useGameContextHybridRobust();
  const userProducts = webSocketInventory?.products || []; 
  const [isEditing, setIsEditing] = useState(false);  // Estado para controlar si el modal está abierto
  
  // Proteger contra userData null
  if (!userData) {
    return (
      <View style={styles.container}>
        <Text>Cargando datos del usuario...</Text>
      </View>
    );
  }

  // Función para seleccionar una imagen desde la galería
  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (result.granted) {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!pickerResult.cancelled) {
        setUserData({ ...userData, image: pickerResult.uri });  // Guardamos la imagen seleccionada en el estado
      }
    } else {
      alert('Permission to access gallery was denied');
    }
  };

  const renderProduct = ({ item }) => (
    <ExpandableProduct
      product={item}
      gameId={gameId}
      userId={userId}
      screenType="ProfileScreen"
    />
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screenContainer}>
        <GameHeader
          title="RockProfile"
          gameId={gameId} // Pasamos el gameId aquí
          userId={userId}
          onSettingsPress={() => console.log('Settings Pressed')}
        />
        {/* Contenedor horizontal para usuario e inventario */}
        <View style={styles.horizontalContainer}>
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.userInfoContainer}>
            <Image source={userData.image ? { uri: userData.image } : require('../assets/User.png')} style={[styles.avatar, { tintColor: '#1d3d39' }]} />
            <Text style={[styles.userName, { color: '#1d3d39' }]}>{userData.userName}</Text>
          </TouchableOpacity>

          {/* Información del inventario */}
          <View style={styles.inventoryInfo}>
          <Text style={styles.inventoryTitle}>Inventory Status</Text>
          <View style={styles.inventoryStats}>
            <View style={styles.inventoryStatRow}>
              <Image 
                source={require('../assets/RockCoinBlack.png')} 
                style={styles.inventoryIcon} 
                tintColor='#1d3d39'
              />
              <Text style={[styles.inventoryStat, { color: '#1d3d39' }]}>RockCoins: {webSocketInventory.rockCoins || 600}</Text>
            </View>
            <View style={styles.inventoryStatRow}>
              <Ionicons name="trash" size={20} color="#1d3d39" style={styles.inventoryIcon} />
              <Text style={styles.inventoryStat}>Waste: {webSocketInventory.waste || 0}</Text>
            </View>
            <View style={styles.inventoryStatRow}>
              <Ionicons name="cube" size={20} color="#1d3d39" style={styles.inventoryIcon} />
              <Text style={styles.inventoryStat}>Products: {userProducts.length}</Text>
            </View>
          </View>
        </View>
        </View>

        {/* Modal para editar el perfil */}
        <Modal visible={isEditing} transparent={true} animationType="none">
          <TouchableWithoutFeedback onPress={() => setIsEditing(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.modalContent}>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setIsEditing(false)}>
                    <Ionicons name="close" size={24} color="#1d3d39" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Edit Profile</Text>

                  {/* Imagen seleccionable */}
                  <TouchableOpacity onPress={pickImage}>
                    <Image source={userData.image ? { uri: userData.image } : require('../assets/User.png')} style={[styles.avatar, { tintColor: '#1d3d39' }]} />
                  </TouchableOpacity>

                  <TextInput
                    value={userData.userName}
                    onChangeText={(text) => setUserData({ ...userData, name: text })}
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor="#1d3d39"
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Texto de productos en itálica */}
        <Text style={styles.productsTitle}>Your Products</Text>

        {/* FlatList para mostrar los productos comprados */}
        <FlatList
          data={userProducts}
          renderItem={renderProduct}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          style={styles.flatList}
          contentContainerStyle={styles.flatListContainer}
        />
        <NavigationBar navigation={navigation} />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ProfileScreen;
