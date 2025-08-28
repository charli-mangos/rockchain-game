import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Dimensions, Image } from 'react-native';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LineChart } from 'react-native-chart-kit';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import styles from '../styles/ChatScreenStyles';
import DropDownPicker from 'react-native-dropdown-picker';
import { useGameContextHybrid } from '../context/GameContextHybrid';

const ChatScreen = ({ navigation, route }) => {
  const { gameId, userId } = useGameContextHybrid();
  const { marketData } = useGameContextHybrid();  // ✅ Usar datos en tiempo real desde `GameContext`
  const [priceHistory, setPriceHistory] = useState([]); // Inicializar como array vacío
  const [round, setRound] = useState(0); // Inicializar como 0
  const [marbleBasePrices, setMarbleBasePrices] = useState([]); // Inicializar como array vacío

  // Estados para los nuevos filtros
  const [selectedMetric, setSelectedMetric] = useState('Price'); // Default: Price
  const [openMetric, setOpenMetric] = useState(false);
  const [selectedType, setSelectedType] = useState('Block'); // Default: Block
  const [selectedQuality, setSelectedQuality] = useState('A'); // Default: A
  const [openType, setOpenType] = useState(false);
  const [openQuality, setOpenQuality] = useState(false);

  const marbleColors = {
    White: '#FF9999',
    Black: '#333333',
    Gray: '#808080',
    Cream: '#FFD700',
    Red: '#FF6347',
  };

  useEffect(() => {
    if (!marketData) return;

    const roundsData = marketData.rounds || {};
    setRound(Object.keys(roundsData).length);

    const filteredData = generateFilteredData(roundsData, selectedType, selectedQuality);
    setPriceHistory(filteredData);
    updateMarbleBasePrices(roundsData, selectedType, selectedQuality);
}, [marketData, selectedType, selectedQuality]);

  // useEffect(() => {
  //   const fetchMarketData = async () => {
  //     try {
  //       const marketRef = doc(db, 'market', gameId);
  //       const marketSnapshot = await getDoc(marketRef);
    
  //       if (!marketSnapshot.exists()) {
  //         console.error(`No market data found for gameId: ${gameId}`);
  //         return;
  //       }
    
  //       const marketData = marketSnapshot.data();
  //       console.log('Raw Market Data:', marketData); // Log completo de los datos
    
  //       const roundsData = marketData.rounds || {};
  //       console.log('Rounds Data:', roundsData); // Log de los datos de las rondas
    
  //       const currentRound = Object.keys(roundsData).length;
  //       setRound(currentRound);
    
  //       const initialFilteredData = generateFilteredData(roundsData, 'Block', 'A');
  //       console.log('Initial Filtered Data:', initialFilteredData); // Log del conjunto filtrado
    
  //       setPriceHistory(initialFilteredData);
  //     } catch (error) {
  //       console.error('Error fetching market data:', error);
  //     }
  //   };

  //   fetchMarketData();
  // }, [gameId]);

  const updateMarbleBasePrices = (roundsData, typeFilter, qualityFilter) => {
    if (!roundsData || Object.keys(roundsData).length === 0) return;

    // Obtener la última ronda disponible
    const lastRound = Math.max(...Object.keys(roundsData).map(Number));
    const currentRoundData = roundsData[lastRound];

    const filteredPrices = Object.entries(currentRoundData).map(([marbleType, productData]) => ({
        marbleType,
        price: productData[typeFilter]?.[qualityFilter]?.price || 0,
        waste: productData[typeFilter]?.[qualityFilter]?.waste || 0,
    }));

    setMarbleBasePrices(filteredPrices);
  };


  // Generar datos filtrados
  const generateFilteredData = (roundsData, typeFilter, qualityFilter) => {
    const filteredData = [];
  
    // Obtener todos los tipos de mármol de la última ronda
    const lastRound = Math.max(...Object.keys(roundsData).map(Number));
    const marbleTypes = Object.keys(roundsData[lastRound] || {});
  
    // Agregar ronda 0 con valores en 0
    const roundZero = {
      round: 0,
      prices: marbleTypes.reduce((acc, marbleType) => {
        acc[marbleType] = 0;
        return acc;
      }, {}),
      waste: marbleTypes.reduce((acc, marbleType) => {
        acc[marbleType] = 0;
        return acc;
      }, {}),
    };
    filteredData.push(roundZero);
  
    // Procesar las rondas reales
    Object.entries(roundsData).forEach(([roundKey, roundData]) => {
      const prices = {};
      const waste = {};
  
      Object.entries(roundData).forEach(([marbleType, productData]) => {
        const productInfo = productData[typeFilter]?.[qualityFilter];
        if (productInfo) {
          prices[marbleType] = productInfo.price;
          waste[marbleType] = productInfo.waste;
        }
      });
  
      filteredData.push({
        round: parseInt(roundKey, 10),
        prices,
        waste,
      });
    });
  
    return filteredData;
  };

  const sortedMarbleBasePrices = marbleBasePrices
    .map((item) => ({
      ...item,
      balance: item.price - item.waste, // Calcular balance
    }))
    .sort((a, b) => b.balance - a.balance); // Ordenar de mayor a menor balance

  // Actualizar filtros al cambiar el tipo o calidad
  useEffect(() => {
    if (!marketData) return;

    const roundsData = marketData.rounds || {};
    const newFilteredData = generateFilteredData(roundsData, selectedType, selectedQuality);
    setPriceHistory(newFilteredData);
    updateMarbleBasePrices(roundsData, selectedType, selectedQuality);
  }, [selectedType, selectedQuality, marketData]);

  // // Manejar cambios en los filtros
  // const handleFilterChange = (type, quality) => {
  //   const marketRef = doc(db, 'market', gameId);

  //   getDoc(marketRef).then((marketSnapshot) => {
  //     if (marketSnapshot.exists()) {
  //       const marketData = marketSnapshot.data();
  //       const roundsData = marketData.rounds || {};

  //       // Filtrar datos para la gráfica
  //       const newFilteredData = generateFilteredData(roundsData, type, quality);
  //       setPriceHistory(newFilteredData);

  //       // Actualizar la lista de precios base
  //       const filteredPrices = Object.entries(roundsData['1'] || {}).map(([marbleType, productData]) => ({
  //         marbleType,
  //         price: productData[type]?.[quality]?.price || 0,
  //         waste: productData[type]?.[quality]?.waste || 0,
  //       }));
  //       setMarbleBasePrices(filteredPrices);
  //     }
  //   });
  // };

  // Configuración de la gráfica
  const sanitizeValue = (value) => {
      if (typeof value !== 'number' || !isFinite(value)) {
          console.warn(`⚠ Invalid value detected: ${value}, replacing with 0`);
          return 0;
      }
      return value;
  };

  const chartData = {
    labels: [' ', ...Array.from({ length: round }, (_, i) => `R${i + 1}`)],
    datasets: Object.keys(marbleColors).map((marbleType) => {
        const rawData = priceHistory.map((roundData) => {
            if (selectedMetric === 'Price') {
                return roundData.prices[marbleType] || 0;
            } else if (selectedMetric === 'Waste') {
                return roundData.waste[marbleType] || 0;
            } else {
                return (roundData.prices[marbleType] || 0) - (roundData.waste[marbleType] || 0);
            }
        });

        const data = rawData.length > 0 ? rawData : [0];  // ✅ Asegurar que nunca hay un array vacío

        return {
            data,
            strokeWidth: 2,
            color: () => marbleColors[marbleType],
            label: marbleType,
        };
    }),
};

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    fillShadowGradientFrom: '#ffffff', 
    fillShadowGradientTo: '#ffffff',
  };

  // Memoizar el header para evitar re-renders innecesarios
  const ListHeader = useMemo(() => (
    <View style={styles.headerRow}>
      <View style={styles.headerCell}>
        <Text style={styles.headerText}>Type</Text>
      </View>
      <View style={styles.headerCell}>
        <Image 
          source={require('../assets/RockCoinBlack.png')} 
          style={[styles.rockCoinIcon, { tintColor: '#666' }]} 
          resizeMode="contain"
        />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trash" size={20} color="#666" />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trending-up" size={20} color="#666" />
      </View>
    </View>
  ), []);

  // Memoizar el renderizado de cada item
  const renderPriceItem = useMemo(() => ({ item }) => (
    <View style={styles.row}>
      <View style={styles.cell}>
        <Text style={[styles.nameText, { color: marbleColors[item.marbleType] }]}>
        {item.marbleType}
      </Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.valueText}>{item.price}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={styles.valueText}>{item.waste}</Text>
      </View>
      <View style={styles.cell}>
        <Text style={[styles.valueText, { color: item.balance > 0 ? '#2ecc71' : '#e74c3c' }]}>
          {item.balance}
        </Text>
      </View>
    </View>
  ), [marbleColors]);

  if (!marketData) {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Loading market data...</Text>
        </View>
    );
}

  return (
    <View style={styles.screenContainer}>
      <GameHeader title="RockStock" gameId={gameId} userId={userId} />

      {/* Filtros principales */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 21 }}>
        <DropDownPicker
          open={openType}
          value={selectedType}
          items={[
            { label: 'Block', value: 'Block' },
            { label: 'Slab', value: 'Slab' },
          ]}
          setOpen={setOpenType}
          setValue={setSelectedType}
          placeholder="Select Type"
          style={{ marginBottom: 5 }}
          containerStyle={{ width: '35%' }}
        />
        <DropDownPicker
          open={openQuality}
          value={selectedQuality}
          items={[
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
          ]}
          setOpen={setOpenQuality}
          setValue={setSelectedQuality}
          placeholder="Select Quality"
          style={{ marginBottom: 5 }}
          containerStyle={{ width: '35%' }}
        />
      </View>

      {/* Lista de precios base */}
      <View style={styles.marbleContainer}>
        <FlatList
          data={sortedMarbleBasePrices}
          keyExtractor={(item, index) => `${item.marbleType}-${index}`}
          renderItem={renderPriceItem}
          ListHeaderComponent={ListHeader}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>

      {/* Métrica de la gráfica */}
      <DropDownPicker
        open={openMetric}
        value={selectedMetric}
        items={[
          { label: 'Price', value: 'Price' },
          { label: 'Waste', value: 'Waste' },
          { label: 'Balance', value: 'Balance' },
        ]}
        setOpen={setOpenMetric}
        setValue={setSelectedMetric}
        containerStyle={{ 
          width: '35%', 
          height: 50, 
          alignSelf: 'center',
          marginTop: 16,
          marginBottom: 0
        }}
      />

      {/* Gráfica */}
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 21}
          height={220}
          fromZero={true}
          chartConfig={chartConfig}
          style={{
            margin: -15,
            marginBottom: -30,
          }}
        />
      </View>

      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default React.memo(ChatScreen);
