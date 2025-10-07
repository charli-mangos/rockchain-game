import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { callAuthenticatedFunction } from '../utils/authHelper';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { useProductDetails } from '../hooks/useProductDetails';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../styles/ExpandableProductStyle';
import { getWebSocketService } from '../services/WebSocketServiceUniversal';


const ExpandableProduct = ({ product, userId, gameId, screenType }) => {
  const [expanded, setExpanded] = useState(false);
  const [showSummary, setShowSummary] = useState(false); // Controla si se muestra el resumen de compra
  const navigation = useNavigation();
  const { setCurrentBlockId, incrementMiningQueue, webSocketInventory } = useGameContextHybridRobust();

  const images = {
    'Red': {
      'Block': require('../assets/RedBlock.png'),
      'Slab': require('../assets/RedSlab.png')
    },
    'Black': {
      'Block': require('../assets/BlackBlock.png'),
      'Slab': require('../assets/BlackSlab.png')
    },
    'Gray': {
      'Block': require('../assets/GrayBlock.png'),
      'Slab': require('../assets/GraySlab.png')
    },
    'White': {
      'Block': require('../assets/WhiteBlock.png'),
      'Slab': require('../assets/WhiteSlab.png')
    },
    'Cream': {
      'Block': require('../assets/CreamBlock.png'),
      'Slab': require('../assets/CreamSlab.png')
    }
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

      console.log('🔌 Generando problema de minado vía WebSocket:', {
        gameId,
        product,
        transType,
        userId
      });

      // Enviar transacción directamente al WebSocket
      const webSocketService = getWebSocketService();
      if (webSocketService.isConnected) {
        webSocketService.emit('product_transaction', {
          gameId,
          userId,
          product,
          transactionType: transType
        });
        
        console.log('✅ Transacción enviada al WebSocket - el problema se generará automáticamente');
        return { success: true, message: 'Transacción procesada vía WebSocket' };
      } else {
        throw new Error('WebSocket no está conectado');
      }
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

      // console.log('Starting purchase with data:', {
      //   gameId,
      //   productId: product.id,
      //   userId,
      //   product: {
      //     id: product.id,
      //     type: product.type,
      //     marbleType: product.marbleType,
      //     currentPrice: product.currentPrice,
      //     waste: product.waste
      //   }
      // });

      // Verificar que gameId es válido
      if (!gameId || typeof gameId !== 'string' || gameId.length === 0) {
        console.error('Invalid gameId:', gameId);
        Alert.alert("Purchase Failed", "Invalid game ID. Please restart the game.");
        return;
      }

      console.log('Attempting to access game document with ID:', gameId);

      // Pequeño retraso para asegurar que el juego esté completamente creado
      await new Promise(resolve => setTimeout(resolve, 1000));

      const gameRef = doc(db, 'games', gameId);
      const userRef = doc(db, 'users', userId);
  
      // Verificar que el documento existe antes de intentar obtenerlo
      console.log('Checking if game document exists...');
      const gameSnapshot = await getDoc(gameRef);
      
      if (!gameSnapshot.exists()) {
        console.error('Game document does not exist:', gameId);
        Alert.alert("Purchase Failed", "Game not found. Please try again.");
        return;
      }
      
      const gameData = gameSnapshot.data();
      
      if (!gameData) {
        console.error('Game data is null or undefined for gameId:', gameId);
        Alert.alert("Purchase Failed", "Game data is corrupted. Please try again.");
        return;
      }
      
      console.log('Game data retrieved:', gameData);
      const productList = gameData.productList || [];
      console.log('Product list from game:', productList);
      console.log('Looking for product with ID:', product.id);
      
      // Si la lista de productos está vacía, esperar un poco y reintentar
      if (productList.length === 0) {
        console.log('Product list is empty, waiting for products to load...');
        Alert.alert("Purchase Failed", "Products are still loading. Please try again in a moment.");
        return;
      }
  
      // Verificar si el producto existe
      const productToRemove = productList.find((item) => item.id === product.id);
      console.log('Product found:', productToRemove);
      
      if (!productToRemove) {
        console.error('Product not found in productList. Available products:', productList.map(p => ({ id: p.id, type: p.type, marbleType: p.marbleType })));
        Alert.alert("Purchase Failed", "This product is no longer available.");
        return;
      }
  
      // Validar saldo del usuario
      const userSnapshot = await getDoc(userRef);
      
      if (!userSnapshot.exists()) {
        console.error('User document does not exist:', userId);
        Alert.alert("Purchase Failed", "User not found. Please try again.");
        return;
      }
      
      const userData = userSnapshot.data();
      
      if (!userData) {
        console.error('User data is null or undefined for userId:', userId);
        Alert.alert("Purchase Failed", "User data is corrupted. Please try again.");
        return;
      }
      
      console.log('User data retrieved:', userData);
      const userRockCoins = userData.games[gameId]?.rockCoins || 0;
      const userWaste = userData.games[gameId]?.waste || 0;
  
      if (userRockCoins < product.currentPrice) {
        Alert.alert("Insufficient Funds", "You do not have enough RockCoins to purchase this product.");
        return;
      }
  
      // Procesar compra vía WebSocket (como en el contexto original)
      const webSocketService = getWebSocketService();
      if (webSocketService.isConnected) {
        console.log('🛒 Procesando compra vía WebSocket');
        webSocketService.emit('product_transaction', {
          gameId,
          userId,
          product: productToRemove,
          transactionType: 'purchase'
        });
        
        console.log("Product purchased successfully via WebSocket");
        setExpanded(false);
        navigation.navigate('Profile', { gameId, userId });
        return; // Salir aquí para evitar procesamiento local
      } else {
        console.log('⚠️ WebSocket no conectado, procesando localmente');
        
        // Solo procesar localmente si WebSocket no está conectado
        await generateProblem(product, 'purchase');
        incrementMiningQueue();
        
        console.log("Product purchased successfully");
        setExpanded(false);
        navigation.navigate('Profile', { gameId, userId });
      }
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
      // Usar el inventario del WebSocket en lugar de Firestore
      const productToSell = webSocketInventory.products.find((item) => item.id === product.id);
      if (!productToSell) {
        Alert.alert("Sell Failed", "This product is no longer available.");
        return;
      }

      // Procesar venta vía WebSocket (como en el contexto original)
      const webSocketService = getWebSocketService();
      if (webSocketService.isConnected) {
        console.log('🛒 Procesando venta vía WebSocket');
        webSocketService.emit('product_transaction', {
          gameId,
          userId,
          product: productToSell,
          transactionType: 'sell'
        });
        
        console.log("Product sold successfully via WebSocket");
        setExpanded(false);
        return; // Salir aquí para evitar procesamiento local
      } else {
        console.log('⚠️ WebSocket no conectado, procesando localmente');
        
        // Solo procesar localmente si WebSocket no está conectado
        await generateProblem(product, 'sell');
        incrementMiningQueue();
        
        console.log("Product sold successfully");
        setExpanded(false);
      }
    } catch (error) {
      console.error("Error selling product:", error);
      Alert.alert("Error", "An error occurred while processing the sale.");
    }
  };

  const handleTransform = async (product) => {
    try {
      // Usar el inventario del WebSocket en lugar de Firestore
      const productToTransform = webSocketInventory.products.find((item) => item.id === product.id);
      if (!productToTransform) {
        Alert.alert("Transform Failed", "This product is no longer available.");
        return;
      }
  
      if (productToTransform.type === "Slab") {
        Alert.alert("Transform Not Allowed", "Slabs cannot be transformed.");
        return;
      }
  
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
  
      // Procesar transformación vía WebSocket
      const webSocketService = getWebSocketService();
      if (webSocketService.isConnected) {
        console.log('🔄 Procesando transformación vía WebSocket');
        webSocketService.emit('product_transaction', {
          gameId,
          userId,
          product: productToTransform,
          transactionType: 'transform',
          transformedProduct: transformedProduct,
          wasteExtra: wasteExtra
        });
        
        // NO llamar a generateProblem ni incrementMiningQueue aquí
        // El WebSocket se encarga de todo
        console.log("Product transformed successfully via WebSocket");
        setExpanded(false);
        return; // Salir aquí para evitar procesamiento local
      } else {
        console.log('⚠️ WebSocket no conectado, procesando localmente');
      }
      
      // Solo procesar localmente si WebSocket no está conectado
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
        <View style={[
          styles.qualityContainer,
          product.quality === 'A' && { backgroundColor: '#2d5a56' },
          product.quality === 'B' && { backgroundColor: '#feda8c' },
          product.quality === 'C' && { backgroundColor: '#ba5d17' }
        ]}>
          <Text style={styles.qualityText}>{product.quality}</Text>
        </View>
        <Image style={styles.productIcon} source={images[product.marbleType][product.type]} />
        <Text style={styles.productText}>{product.marbleType + ' ' + product.type}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{product.currentPrice}</Text>
          <Image 
            source={require('../assets/RockCoinBlack.png')} 
            style={[styles.rockCoinIcon, styles.rockCoinIconAlign]}
            resizeMode="contain"
            tintColor="#1d3d39"
          />
        </View>
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
                    <Ionicons name="close-outline" size={24} color="#1d3d39" />
                  </TouchableOpacity>
                </View>
                <Image style={styles.expandedProductIcon} source={images[product.marbleType][product.type]} />
                <View style={styles.qualityRow}>
                  <Text style={styles.detailText}>Quality: </Text>
                  <View style={[
                    styles.qualityBadge,
                    product.quality === 'A' && { backgroundColor: '#2d5a56' },
                    product.quality === 'B' && { backgroundColor: '#feda8c' },
                    product.quality === 'C' && { backgroundColor: '#ba5d17' }
                  ]}>
                    <Text style={styles.qualityText}>{product.quality}</Text>
                  </View>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.detailText}>Price: <Text style={{fontWeight: 'bold'}}>{product.currentPrice}</Text></Text>
                  <Image 
                    source={require('../assets/RockCoinBlack.png')} 
                    style={styles.rockCoinIconDetail} 
                    resizeMode="contain"
                    tintColor='#1d3d39'
                  />
                </View>
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