import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Dimensions, Image, TouchableOpacity } from 'react-native';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LineChart } from 'react-native-chart-kit';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import styles from '../styles/ChatScreenStyles';
import DropDownPicker from 'react-native-dropdown-picker';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';

const ChatScreen = ({ navigation, route }) => {
  const { gameId, userId, marketData } = useGameContextHybridRobust();
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
  
  // Estado para controlar la vista (lista o chart)
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'chart'

  const marbleColors = {
    White: '#FF9999',
    Black: '#333333',
    Gray: '#808080',
    Cream: '#FFD700',
    Red: '#FF6347',
  };

  useEffect(() => {
    // Logs eliminados para reducir ruido
    if (!marketData || !marketData.rounds) {
      // fallback vacío seguro
      setRound(0);
      setPriceHistory([]);
      setMarbleBasePrices([]);
      return;
    }

    const roundsData = marketData.rounds;
    const roundKeys = Object.keys(roundsData);
    setRound(roundKeys.length);

    const filteredData = generateFilteredData(roundsData, selectedType, selectedQuality);
    setPriceHistory(filteredData);
    updateMarbleBasePrices(roundsData, selectedType, selectedQuality);
  }, [marketData, selectedType, selectedQuality]);

  const updateMarbleBasePrices = (roundsData, typeFilter, qualityFilter) => {
    if (!roundsData || Object.keys(roundsData).length === 0) {
      console.log('🏪 [CHATSCREEN] No hay roundsData disponible');
      return;
    }

    // Obtener la última ronda disponible de forma segura
    const roundInts = Object.keys(roundsData).map((k) => parseInt(k, 10)).filter((n) => !Number.isNaN(n));
    if (roundInts.length === 0) {
      console.log('🏪 [CHATSCREEN] No hay rondas válidas');
      return;
    }
    const lastRound = Math.max(...roundInts);
    const currentRoundData = roundsData[lastRound];
    
    if (!currentRoundData) {
      console.log(`🏪 [CHATSCREEN] No hay datos para ronda ${lastRound}`);
      return;
    }

    // USAR SOLO LOS VALORES EXACTOS - NO BUSCAR ALTERNATIVOS
    const filteredPrices = Object.entries(currentRoundData).map(([marbleType, productData]) => {
      const productInfo = productData[typeFilter]?.[qualityFilter];
      const price = productInfo?.price || 0;
      const waste = productInfo?.waste || 0;
      
      return {
        marbleType,
        price: price,
        waste: waste,
      };
    });
    
    // Logs eliminados para reducir ruido
    setMarbleBasePrices(filteredPrices);
  };


  // Generar datos filtrados
  const generateFilteredData = (roundsData, typeFilter, qualityFilter) => {
    const filteredData = [];
  
    // Obtener todos los tipos de mármol de la última ronda
    const roundInts = Object.keys(roundsData).map((k) => parseInt(k, 10)).filter((n) => !Number.isNaN(n));
    if (roundInts.length === 0) return [];
    const lastRound = Math.max(...roundInts);
    // roundsData puede venir del doc legacy con estructura por mármol/Block/Slab/A,B,C
    // o del per-round collection con { products: [...] }. Normalizamos aquí para extraer tipos.
    let marbleTypes = [];
    const lastRoundData = roundsData[lastRound] || {};
    if (lastRoundData.products) {
      // nueva forma: lista de productos planos con marbleType
      const setTypes = new Set();
      (lastRoundData.products || []).forEach(p => setTypes.add(p.marbleType));
      marbleTypes = Array.from(setTypes);
    } else {
      marbleTypes = Object.keys(lastRoundData || {});
    }
  
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

      if (roundData && roundData.products) {
        // nueva forma
        (roundData.products || []).forEach(p => {
          if (p.type === typeFilter && p.quality === qualityFilter) {
            prices[p.marbleType] = p.currentPrice || 0;
            waste[p.marbleType] = p.waste || 0;
          }
        });
      } else {
        // forma legacy - USAR SOLO VALORES EXACTOS
        Object.entries(roundData || {}).forEach(([marbleType, productData]) => {
          const productInfo = productData[typeFilter]?.[qualityFilter];
          if (productInfo && productInfo.price && productInfo.waste) {
            prices[marbleType] = productInfo.price;
            waste[marbleType] = productInfo.waste;
          }
        });
      }

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
          style={[styles.rockCoinIcon, { tintColor: '#1d3d39' }]} 
          resizeMode="contain"
        />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trash" size={20} color="#1d3d39" />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trending-up" size={20} color="#1d3d39" />
      </View>
    </View>
  ), []);

  // Renderizar cada item de la tabla
  const renderPriceItem = ({ item, index }) => {
    const isLastItem = index === sortedMarbleBasePrices.length - 1;
    return (
      <View style={[styles.row, isLastItem && styles.rowLast]}>
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
          <Text style={[styles.valueText, { color: item.balance > 0 ? '#2d5a56' : '#ba5d17' }]}>
            {item.balance}
          </Text>
        </View>
      </View>
    );
  };

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

      {/* Selector de vista */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'chart' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('chart')}
        >
          <Text style={[styles.viewModeText, viewMode === 'chart' && styles.viewModeTextActive]}>
            Chart
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros principales */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterWrapper}>
          <Text style={styles.filterLabel}>Type</Text>
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
            style={styles.dropdownStyle}
            textStyle={styles.dropdownTextStyle}
            dropDownContainerStyle={[styles.dropdownContainerStyle, { zIndex: 3000 }]}
            listItemLabelStyle={styles.dropdownItemStyle}
            containerStyle={[styles.dropdownContainer, { zIndex: 3000 }]}
            zIndex={3000}
          />
        </View>
        <View style={styles.filterWrapper}>
          <Text style={styles.filterLabel}>Quality</Text>
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
            style={styles.dropdownStyle}
            textStyle={styles.dropdownTextStyle}
            dropDownContainerStyle={[styles.dropdownContainerStyle, { zIndex: 3000 }]}
            listItemLabelStyle={styles.dropdownItemStyle}
            containerStyle={[styles.dropdownContainer, { zIndex: 3000 }]}
            zIndex={3000}
          />
        </View>
      </View>

      {/* Contenido condicional: Lista o Chart */}
      {viewMode === 'list' ? (
        <View style={styles.tableContainer}>
          <View style={styles.tableCard}>
            <FlatList
              data={sortedMarbleBasePrices}
              keyExtractor={(item, index) => `${item.marbleType}-${index}`}
              renderItem={renderPriceItem}
              ListHeaderComponent={ListHeader}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      ) : (
        <View style={styles.chartContentContainer}>
          {/* Métrica de la gráfica */}
          <View style={styles.chartMetricContainer}>
            <Text style={styles.chartMetricLabel}>Chart Metric</Text>
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
              style={styles.dropdownStyle}
              textStyle={styles.dropdownTextStyle}
              dropDownContainerStyle={[styles.dropdownContainerStyle, { zIndex: 1000 }]}
              listItemLabelStyle={styles.dropdownItemStyle}
              containerStyle={[styles.chartDropdownContainer, { zIndex: 1000 }]}
              zIndex={1000}
            />
          </View>

          {/* Gráfica */}
          <View style={styles.chartWrapper}>
            <View style={styles.chartContainer}>
              <LineChart
                data={chartData}
                width={Dimensions.get('window').width - 42}
                height={220}
                fromZero={true}
                chartConfig={chartConfig}
                style={styles.chartStyle}
              />
            </View>
          </View>
        </View>
      )}

      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default React.memo(ChatScreen);

