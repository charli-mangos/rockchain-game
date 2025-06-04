import React, { useState, useEffect } from 'react';
import { View, Alert, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Modal, TouchableWithoutFeedback } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { doc,setDoc, collection, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db, functions } from '../../firebase';
import styles from '../styles/ExpandableProductStyle';
import { httpsCallable } from 'firebase/functions';
import { useGameContext } from '../context/GameContext';


const ExpandableProduct = ({ product, userId, gameId, screenType }) => {
  const [expanded, setExpanded] = useState(false);
  const [showSummary, setShowSummary] = useState(false); // Controla si se muestra el resumen de compra
  const navigation = useNavigation();
  const { setBlockId, incrementMiningQueue } = useGameContext(); // Importar correctamente el contexto

  const images = {
    'Red': require('../assets/Red.png'),
    'Black': require('../assets/Black.png'),
    'Gray': require('../assets/Gray.png'),
    'White': require('../assets/White.png'),
    'Cream': require('../assets/Cream.png'),
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
    setShowSummary(false); // Ocultar resumen si se cierra el modal
  };

  const generateProblem = async (product, transType) => {
    try {
      if (!gameId) {
        console.error('gameId is undefined in generateProblem');
        throw new Error('Game ID is required but was not provided');
      }

      const requestData = {
        gameId: gameId,
        transactionDetails: {
          productId: product.id,
          type: transType,
          userId: userId,
          productType: product.type,
          marbleType: product.marbleType,
          price: product.currentPrice,
          waste: product.waste
        }
      };

      console.log('Generating mining problem with data:', requestData);

      const generateMiningProblem = httpsCallable(functions, 'generateMiningProblem');
      const result = await generateMiningProblem(requestData);
  
      console.log('Mining problem created successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error in generateProblem:', {
        error,
        gameId,
        productId: product?.id,
        transType,
        userId
      });
      Alert.alert('Error', 'Failed to generate mining problem. Please try again.');
      throw error;
    }
  };
  
  const handlePurchase = async (product) => {
    try {
      if (!gameId) {
        console.error('gameId is undefined in handlePurchase');
        throw new Error('Game ID is required but was not provided');
      }

      console.log('Starting purchase with data:', {
        gameId,
        productId: product.id,
        userId
      });

      const gameRef = doc(db, 'games', gameId);
      const userRef = doc(db, 'users', userId);
  
      // Obtener los datos del juego
      const gameSnapshot = await getDoc(gameRef);
      const gameData = gameSnapshot.data();
      const productList = gameData.productList || [];
  
      // Verificar si el producto existe
      const productToRemove = productList.find((item) => item.id === product.id);
      if (!productToRemove) {
        Alert.alert("Purchase Failed", "This product is no longer available.");
        return;
      }
  
      // Validar saldo del usuario
      const userSnapshot = await getDoc(userRef);
      const userData = userSnapshot.data();
      const userRockCoins = userData.games[gameId]?.rockCoins || 0;
      const userWaste = userData.games[gameId]?.waste || 0;
  
      if (userRockCoins < product.currentPrice) {
        Alert.alert("Insufficient Funds", "You do not have enough RockCoins to purchase this product.");
        return;
      }
  
      // Actualizar los datos en Firestore
      await updateDoc(gameRef, {
        productList: arrayRemove(productToRemove),
      });
  
      await updateDoc(userRef, {
        [`games.${gameId}.products`]: arrayUnion(productToRemove),
        [`games.${gameId}.rockCoins`]: userRockCoins - product.currentPrice,
        [`games.${gameId}.waste`]: userWaste + product.waste,
      });

      // Generar problema de minería
      await generateProblem(product, 'purchase');
      
      incrementMiningQueue();
  
      console.log("Product purchased successfully");

      setExpanded(false);
      navigation.navigate('Profile', { gameId, userId });
    } catch (error) {
      console.error("Error in handlePurchase:", {
        error,
        gameId,
        productId: product?.id,
        userId
      });
      Alert.alert("Error", "An error occurred while processing your purchase.");
    }
  };

  const handleSell = async (product) => {
    try {
      const gameRef = doc(db, 'games', gameId);
      const userRef = doc(db, 'users', userId);

      // Obtener datos actuales del usuario y del juego
      const userSnapshot = await getDoc(userRef);
      const userData = userSnapshot.data();
      const gameSnapshot = await getDoc(gameRef);
      const gameData = gameSnapshot.data();

      const userProducts = userData.games[gameId]?.products || [];
      const productToSell = userProducts.find((item) => item.id === product.id);
      if (!productToSell) {
        Alert.alert("Sell Failed", "This product is no longer available.");
        return;
      }

      const userRockCoins = userData.games[gameId]?.rockCoins || 0;
      const userWaste = userData.games[gameId]?.waste || 0;

      // Actualizar Firestore
      await updateDoc(userRef, {
        [`games.${gameId}.products`]: arrayRemove(productToSell), // Eliminar del inventario del usuario
        [`games.${gameId}.rockCoins`]: userRockCoins + product.currentPrice, // Sumar dinero al usuario
        [`games.${gameId}.waste`]: Math.max(0, userWaste - product.waste), // Restar el waste
      });

      await updateDoc(gameRef, {
        productList: arrayUnion(productToSell), // Añadir al mercado
      });

      // Generar problema de minería
      await generateProblem(product, 'sell');

      incrementMiningQueue(); // Se incrementa la burbuja de minería

      console.log("Product sold successfully");
      setExpanded(false); // Cerrar el modal
    } catch (error) {
      console.error("Error selling product:", error);
      Alert.alert("Error", "An error occurred while processing the sale.");
    }
  };

  const handleTransform = async (product) => {
    try {
      const userRef = doc(db, 'users', userId);
  
      // Obtener datos del usuario
      const userSnapshot = await getDoc(userRef);
      const userData = userSnapshot.data();
  
      const userProducts = userData.games[gameId]?.products || [];
      const productToTransform = userProducts.find((item) => item.id === product.id);
      if (!productToTransform) {
        Alert.alert("Transform Failed", "This product is no longer available.");
        return;
      }
  
      if (productToTransform.type === "Slab") {
        Alert.alert("Transform Not Allowed", "Slabs cannot be transformed.");
        return;
      }
  
      const userWaste = userData.games[gameId]?.waste || 0;
  
      // Determinar multiplicadores según el tipo
      const newType = "Slab";
      const priceMultiplier = 1.25;
      const wasteMultiplier = 1.25;
  
      // Calcular nuevos valores
      const newPrice = Math.ceil(productToTransform.currentPrice * priceMultiplier);
      const newWaste = Math.ceil(productToTransform.waste * wasteMultiplier);
      const wasteExtra = Math.ceil(productToTransform.waste * (wasteMultiplier - 1)); // Incremento de waste para el usuario
  
      const transformedProduct = {
        ...productToTransform,
        type: newType,
        currentPrice: newPrice,
        waste: newWaste,
      };
  
      // Actualizar Firestore
      await updateDoc(userRef, {
        [`games.${gameId}.products`]: arrayRemove(productToTransform), // Eliminar el producto original
      });
  
      await updateDoc(userRef, {
        [`games.${gameId}.products`]: arrayUnion(transformedProduct), // Añadir el producto transformado
        [`games.${gameId}.waste`]: userWaste + wasteExtra, // Incrementar el waste del usuario
      });
      
      // Generar problema de minería
      await generateProblem(transformedProduct, 'transform');
      
      incrementMiningQueue(); // Se incrementa la burbuja de minería
  
      console.log("Product transformed successfully");
      setExpanded(false); // Cerrar el modal
    } catch (error) {
      console.error("Error transforming product:", error);
      Alert.alert("Error", "An error occurred while transforming the product.");
    }
  };
  
  
  
  return (
    <>
      {/* Vista compacta */}
      <TouchableOpacity style={styles.productContainer} onPress={toggleExpand}>
        <View style={styles.qualityBadge}>
          <Text style={styles.qualityText}>{product.quality}</Text>
        </View>
        <Image style={styles.productIcon} source={images[product.marbleType]} />
        <Text style={styles.productText}>{product.marbleType + ' ' + product.type}</Text>
        <Text style={styles.productPrice}>${product.currentPrice}</Text>
      </TouchableOpacity>

      {/* Modal expandido */}   
      <Modal
        visible={expanded}
        animationType="fade"
        transparent={true}
        onRequestClose={toggleExpand}
      >
        <TouchableWithoutFeedback onPress={toggleExpand}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.expandedContainer}>
                <View style={styles.header}>
                  <Text style={styles.title}>{product.marbleType + ' ' + product.type}</Text>
                  <TouchableOpacity onPress={toggleExpand} style={styles.closeButton}>
                    <Ionicons name="close-outline" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                <Image style={styles.expandedProductIcon} source={images[product.marbleType]} />
                <Text style={styles.detailText}>Description: {product.description || 'No description available'}</Text>
                <Text style={styles.detailText}>
                  Quality: {product.quality || 'Unknown'} {/* Evitar undefined */}
                </Text>                
                <Text style={styles.detailText}>
                    Price: <Text style={styles.negativeText}>${product.currentPrice}</Text>
                </Text>
                <Text style={styles.detailText}>
                    Waste: <Text style={styles.negativeText}>{product.waste}</Text>
                </Text>
                <View style={styles.buttonsContainer}>
                  {screenType === 'MarketScreen' && (
                    showSummary ? (
                      <View style={styles.purchaseSummary}>
                        <Text style={styles.summaryText}>Do you want to confirm this purchase?</Text>
                        <View style={styles.confirmationButtons}>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowSummary(false)}
                          >
                            <Text style={styles.buttonText}>CANCEL</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => handlePurchase(product)}
                          >
                            <Text style={styles.buttonText}>CONFIRM</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.button} onPress={() => setShowSummary(true)}>
                        <Text style={styles.buttonText}>BUY</Text>
                      </TouchableOpacity>
                    )
                  )}
                  {screenType === "ProfileScreen" && (
                    <View style={styles.buttonsContainer}>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => handleSell(product)}
                      >
                        <Text style={styles.buttonText}>SELL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, product.type === "Slab" && styles.disabledButton]}
                        onPress={() => handleTransform(product)}
                        disabled={product.type === "Slab"}
                      >
                        <Text style={styles.buttonText}>TRANSFORM</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default ExpandableProduct;