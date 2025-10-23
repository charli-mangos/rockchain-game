import React from 'react';
import { View, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import NavigationBar from '../components/NavigationBar';
import styles from '../styles/MarketScreenStyles';
import GameHeader from '../components/GameHeader';
import ExpandableProduct from '../components/ExpandableProduct';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';

const MarketScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { productList, gameId, userId } = useGameContextHybridRobust();
  
  console.log('🏪 [MarketScreen] productList recibido:', productList);
  console.log('🏪 [MarketScreen] productList.length:', productList?.length || 0);
  console.log('🏪 [MarketScreen] gameId:', gameId);
  console.log('🏪 [MarketScreen] userId:', userId);
  
  // Filtrar productos válidos y agregar elemento invisible si el número de productos es impar
  const validProducts = productList.filter(product => product && product.id);
  console.log('🏪 [MarketScreen] validProducts después del filtro:', validProducts.length);
  
  const dataWithSpacer = validProducts.length % 2 === 1 
    ? [...validProducts, { isSpacer: true, id: 'spacer' }]
    : validProducts;
  
  // console.log('MarketScreen - productList:', productList);
  // console.log('MarketScreen - gameId:', gameId);
  // console.log('MarketScreen - userId:', userId);

  // const [products, setProducts] = useState([]);

  // useEffect(() => {
  //   const fetchProducts = async () => {
  //       try {
  //           const gameRef = doc(db, 'games', gameId);
  //           const gameDoc = await getDoc(gameRef);

  //           if (gameDoc.exists()) {
  //               const gameData = gameDoc.data();
  //               const productList = gameData.productList || [];

  //               // Obtener los detalles de cada producto desde la colección 'products'
  //               const productsRef = collection(db, 'products');
  //               const productsSnapshot = await getDocs(productsRef);

  //               const productsMap = {};
  //               productsSnapshot.forEach((doc) => {
  //                   productsMap[doc.id] = doc.data();
  //               });

  //               const updatedProducts = productList.map((product) => {
  //                   const productDetails = productsMap[product.productType] || {};
  //                   return {
  //                     productType: product.productType,
  //                     id: product.id,
  //                     currentPrice: product.currentPrice,
  //                     waste: product.waste,
  //                     type: productDetails.type || 'Unknown',
  //                     marbleType: productDetails.marbleType || 'Unknown',
  //                     quality: product.quality || 'B', // Agregar calidad al producto
  //                     description: productDetails.description || 'No description available',
  //                   };
  //               });

  //               setProducts(updatedProducts);
  //           }
  //       } catch (error) {
  //           console.error('Error fetching products:', error);
  //       }
  // //   };

  //   fetchProducts();
  // }, [gameId]);

  const handleBuy = (product) => {
    console.log(`Buying ${product.name}`);
    // Implementa la lógica de compra aquí
  };

  const renderProduct = ({ item }) => {
    // Si es un espaciador invisible, renderizar View vacío
    if (item.isSpacer) {
      return <View style={{ flex: 1, margin: 5 }} />;
    }
    
    // Verificación defensiva: si el item no es válido, no renderizar nada
    if (!item || !item.id) {
      console.warn('MarketScreen - Item inválido:', item);
      return null;
    }
    
    // console.log('MarketScreen - rendering product:', item);
    return (
      <ExpandableProduct
        product={item}
        gameId={gameId}
        userId={userId}
        screenType="MarketScreen"
        productList={validProducts}
        onBuy={() => handleBuy(item)}
      />
    );
  };

  return (
    <View style={styles.screenContainer}>
      <GameHeader
          title={t('market.title')}
          gameId={gameId}
          userId={userId}
          onSettingsPress={() => console.log('Settings Pressed')}
      />
      <FlatList
        data={dataWithSpacer}
        renderItem={renderProduct}
        keyExtractor={(item, index) => item.isSpacer ? 'spacer' : index.toString()}
        numColumns={2}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContainer}
      />
      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default MarketScreen;
