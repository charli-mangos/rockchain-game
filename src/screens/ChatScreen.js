import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LineChart } from 'react-native-chart-kit';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import styles from '../styles/ChatScreenStyles';
import DropDownPicker from 'react-native-dropdown-picker';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { getScreenDimensions, scaleSpacing } from '../utils/responsive';

const ChatScreen = ({ navigation, route }) => {
  const { gameId, userId, marketData, productList, round: currentRound } = useGameContextHybridRobust();
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
    // PRIORIDAD: Usar currentRound del contexto si está disponible
    if (currentRound && currentRound > 0) {
      setRound(currentRound);
    }
    
    if (!marketData || !marketData.rounds) {
      // Si no hay marketData pero hay productList, usar solo productList
      if (productList && Array.isArray(productList) && productList.length > 0) {
        updateMarbleBasePrices(null, selectedType, selectedQuality);
        // Generar priceHistory mínimo desde productList
        const filteredProducts = productList.filter(p => 
          p && p.type === selectedType && p.quality === selectedQuality
        );
        if (filteredProducts.length > 0) {
          const pricesByMarble = {};
          filteredProducts.forEach(p => {
            if (p.marbleType) {
              pricesByMarble[p.marbleType] = {
                price: p.currentPrice || 0,
                waste: p.waste || 0
              };
            }
          });
          const roundData = {
            round: currentRound || 1,
            prices: Object.fromEntries(Object.entries(pricesByMarble).map(([k, v]) => [k, v.price])),
            waste: Object.fromEntries(Object.entries(pricesByMarble).map(([k, v]) => [k, v.waste]))
          };
          setPriceHistory([roundData]);
        }
      } else {
        setRound(0);
        setPriceHistory([]);
        setMarbleBasePrices([]);
      }
      return;
    }

    const roundsData = marketData.rounds;
    const roundKeys = Object.keys(roundsData);
    const maxRound = Math.max(...roundKeys.map(k => parseInt(k, 10)).filter(n => !isNaN(n)), currentRound || 0);
    setRound(maxRound);

    const filteredData = generateFilteredData(roundsData, selectedType, selectedQuality);
    setPriceHistory(filteredData);
    updateMarbleBasePrices(roundsData, selectedType, selectedQuality);
  }, [marketData, selectedType, selectedQuality, productList, currentRound]);

  // FUNCIÓN AUXILIAR: Buscar valores para un mármol específico usando la misma lógica
  // Esta función asegura consistencia entre chart y lista
  const findMarbleValues = (marbleType, typeFilter, qualityFilter, sourceProducts, sourceLegacy = null) => {
    const allMarbleTypes = ['White', 'Black', 'Gray', 'Cream', 'Red'];
    if (!allMarbleTypes.includes(marbleType)) return null;
    
    // PRIORIDAD 1: Buscar en productList (productos exactos)
    if (sourceProducts && Array.isArray(sourceProducts) && sourceProducts.length > 0) {
      // PRIMERO: Productos exactos
      const exactProducts = sourceProducts.filter(p => 
        p && p.marbleType === marbleType && p.type === typeFilter && p.quality === qualityFilter && p.currentPrice && p.waste
      );
      
      if (exactProducts.length > 0) {
        const avgPrice = Math.round(
          exactProducts.reduce((sum, p) => sum + p.currentPrice, 0) / exactProducts.length
        );
        const avgWaste = Math.round(
          exactProducts.reduce((sum, p) => sum + p.waste, 0) / exactProducts.length
        );
        return { price: avgPrice, waste: avgWaste };
      }
      
      // SEGUNDO: Mismo tipo, diferente calidad
      const sameTypeProducts = sourceProducts.filter(p => 
        p && p.marbleType === marbleType && p.type === typeFilter && p.currentPrice && p.waste
      );
      
      if (sameTypeProducts.length > 0) {
        const avgPrice = Math.round(
          sameTypeProducts.reduce((sum, p) => sum + p.currentPrice, 0) / sameTypeProducts.length
        );
        const avgWaste = Math.round(
          sameTypeProducts.reduce((sum, p) => sum + p.waste, 0) / sameTypeProducts.length
        );
        return { price: avgPrice, waste: avgWaste };
      }
      
      // TERCERO: Cualquier producto del mismo mármol
      const anyProduct = sourceProducts.find(p => 
        p && p.marbleType === marbleType && p.currentPrice && p.waste
      );
      if (anyProduct) {
        return { price: anyProduct.currentPrice, waste: anyProduct.waste };
      }
    }
    
    // PRIORIDAD 2: Buscar en legacy (roundsData)
    if (sourceLegacy && typeof sourceLegacy === 'object') {
      // PRIMERO: Valor exacto
      const productData = sourceLegacy[marbleType];
      if (productData && typeof productData === 'object') {
        const productInfo = productData[typeFilter]?.[qualityFilter];
        if (productInfo && productInfo.price && productInfo.waste) {
          return { price: productInfo.price, waste: productInfo.waste };
        }
        
        // SEGUNDO: Mismo tipo, diferente calidad
        const sameTypeData = productData[typeFilter];
        if (sameTypeData && typeof sameTypeData === 'object') {
          const qualities = Object.keys(sameTypeData);
          if (qualities.length > 0) {
            const values = qualities.map(q => sameTypeData[q]).filter(v => v && v.price && v.waste);
            if (values.length > 0) {
              const avgPrice = Math.round(values.reduce((sum, v) => sum + v.price, 0) / values.length);
              const avgWaste = Math.round(values.reduce((sum, v) => sum + v.waste, 0) / values.length);
              return { price: avgPrice, waste: avgWaste };
            }
          }
        }
        
        // TERCERO: Cualquier tipo del mismo mármol
        const allTypes = Object.keys(productData);
        const allValues = [];
        allTypes.forEach(type => {
          const typeData = productData[type];
          if (typeData && typeof typeData === 'object') {
            Object.values(typeData).forEach(qualityData => {
              if (qualityData && qualityData.price && qualityData.waste) {
                allValues.push(qualityData);
              }
            });
          }
        });
        if (allValues.length > 0) {
          const avgPrice = Math.round(allValues.reduce((sum, v) => sum + v.price, 0) / allValues.length);
          const avgWaste = Math.round(allValues.reduce((sum, v) => sum + v.waste, 0) / allValues.length);
          return { price: avgPrice, waste: avgWaste };
        }
      }
    }
    
    return null;
  };

  const updateMarbleBasePrices = (roundsData, typeFilter, qualityFilter) => {
    // Lista de todos los tipos de mármol que DEBEN aparecer
    const allMarbleTypes = ['White', 'Black', 'Gray', 'Cream', 'Red'];
    const pricesByMarble = {};
    
    // Inicializar todos los tipos de mármol
    allMarbleTypes.forEach(marbleType => {
      pricesByMarble[marbleType] = { price: 0, waste: 0, found: false };
    });
    
    // PRIORIDAD 1: Usar productList del contexto si está disponible (más actualizado)
    if (productList && Array.isArray(productList) && productList.length > 0) {
      console.log(`🏪 [CHATSCREEN] Usando productList del contexto: ${productList.length} productos`);
      
      // Usar función auxiliar para buscar valores de cada mármol
      allMarbleTypes.forEach(marbleType => {
        const values = findMarbleValues(marbleType, typeFilter, qualityFilter, productList);
        if (values && (values.price > 0 || values.waste > 0)) {
          pricesByMarble[marbleType] = {
            price: values.price,
            waste: values.waste,
            found: true
          };
        }
      });
      
      const filteredPrices = Object.entries(pricesByMarble)
        .filter(([_, data]) => data.found && (data.price > 0 || data.waste > 0))
        .map(([marbleType, data]) => ({
          marbleType,
          price: data.price,
          waste: data.waste,
        }));
      
      if (filteredPrices.length > 0) {
        setMarbleBasePrices(filteredPrices);
        return;
      }
    }
    
    // PRIORIDAD 2: Usar roundsData (legacy) como fallback
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

    // Si currentRoundData tiene products, usarlos directamente
    if (currentRoundData.products && Array.isArray(currentRoundData.products)) {
      // Usar función auxiliar para buscar valores de cada mármol
      allMarbleTypes.forEach(marbleType => {
        const values = findMarbleValues(marbleType, typeFilter, qualityFilter, currentRoundData.products);
        if (values && (values.price > 0 || values.waste > 0)) {
          pricesByMarble[marbleType] = {
            price: values.price,
            waste: values.waste,
            found: true
          };
        }
      });
      
      const filteredPrices = Object.entries(pricesByMarble)
        .filter(([_, data]) => data.found && (data.price > 0 || data.waste > 0))
        .map(([marbleType, data]) => ({
          marbleType,
          price: data.price,
          waste: data.waste,
        }));
      
      if (filteredPrices.length > 0) {
        setMarbleBasePrices(filteredPrices);
        return;
      }
    }

    // USAR LEGACY - usar función auxiliar para buscar valores
    allMarbleTypes.forEach(marbleType => {
      const values = findMarbleValues(marbleType, typeFilter, qualityFilter, null, currentRoundData);
      if (values && (values.price > 0 || values.waste > 0)) {
        pricesByMarble[marbleType] = {
          price: values.price,
          waste: values.waste,
          found: true
        };
      }
    });
    
    const filteredPrices = Object.entries(pricesByMarble)
      .filter(([_, data]) => data.found && (data.price > 0 || data.waste > 0))
      .map(([marbleType, data]) => ({
        marbleType,
        price: data.price,
        waste: data.waste,
      }));
    
    setMarbleBasePrices(filteredPrices);
  };


  // Generar datos filtrados
  const generateFilteredData = (roundsData, typeFilter, qualityFilter) => {
    const filteredData = [];
    
    // PRIORIDAD: Si hay productList del contexto, usarlo para la ronda actual
    let marbleTypes = [];
    if (productList && Array.isArray(productList) && productList.length > 0) {
      const setTypes = new Set();
      productList.forEach(p => {
        if (p && p.marbleType) {
          setTypes.add(p.marbleType);
        }
      });
      marbleTypes = Array.from(setTypes);
    } else if (roundsData && Object.keys(roundsData).length > 0) {
      // Obtener todos los tipos de mármol de la última ronda
      const roundInts = Object.keys(roundsData).map((k) => parseInt(k, 10)).filter((n) => !Number.isNaN(n));
      if (roundInts.length === 0) return [];
      const lastRound = Math.max(...roundInts);
      const lastRoundData = roundsData[lastRound] || {};
      if (lastRoundData.products) {
        // nueva forma: lista de productos planos con marbleType
        const setTypes = new Set();
        (lastRoundData.products || []).forEach(p => {
          if (p && p.marbleType) {
            setTypes.add(p.marbleType);
          }
        });
        marbleTypes = Array.from(setTypes);
      } else {
        marbleTypes = Object.keys(lastRoundData || {});
      }
    } else {
      return [];
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
  
    // Procesar las rondas reales desde roundsData
    if (roundsData && Object.keys(roundsData).length > 0) {
      Object.entries(roundsData).forEach(([roundKey, roundData]) => {
        const prices = {};
        const waste = {};

        // Usar función auxiliar para buscar valores de cada mármol (misma lógica que la lista)
        const allMarbleTypesForChart = ['White', 'Black', 'Gray', 'Cream', 'Red'];
        allMarbleTypesForChart.forEach(marbleType => {
          let values = null;
          
          if (roundData && roundData.products && Array.isArray(roundData.products)) {
            // Buscar en products array
            values = findMarbleValues(marbleType, typeFilter, qualityFilter, roundData.products);
          } else {
            // Buscar en legacy
            values = findMarbleValues(marbleType, typeFilter, qualityFilter, null, roundData);
          }
          
          if (values && (values.price > 0 || values.waste > 0)) {
            prices[marbleType] = values.price;
            waste[marbleType] = values.waste;
          }
        });

        // Solo agregar si hay valores válidos
        if (Object.keys(prices).length > 0 || Object.keys(waste).length > 0) {
          filteredData.push({
            round: parseInt(roundKey, 10),
            prices,
            waste,
          });
        }
      });
    }
    
    // Agregar datos de productList para la ronda actual si no están ya incluidos
    if (productList && Array.isArray(productList) && productList.length > 0 && currentRound) {
      const currentRoundIndex = filteredData.findIndex(d => d.round === currentRound);
      const prices = {};
      const waste = {};
      
      // Usar función auxiliar para buscar valores de cada mármol (misma lógica que la lista)
      const allMarbleTypesForChart = ['White', 'Black', 'Gray', 'Cream', 'Red'];
      allMarbleTypesForChart.forEach(marbleType => {
        const values = findMarbleValues(marbleType, typeFilter, qualityFilter, productList);
        if (values && (values.price > 0 || values.waste > 0)) {
          prices[marbleType] = values.price;
          waste[marbleType] = values.waste;
        }
      });
      
      if (Object.keys(prices).length > 0 || Object.keys(waste).length > 0) {
        if (currentRoundIndex >= 0) {
          // Actualizar ronda existente con valores más actualizados
          filteredData[currentRoundIndex] = {
            round: currentRound,
            prices: { ...filteredData[currentRoundIndex].prices, ...prices },
            waste: { ...filteredData[currentRoundIndex].waste, ...waste }
          };
        } else {
          // Agregar nueva ronda
          filteredData.push({
            round: currentRound,
            prices,
            waste,
          });
        }
      }
    }
  
    // Ordenar por ronda
    filteredData.sort((a, b) => a.round - b.round);
    
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
    // Este efecto ya está cubierto por el useEffect principal que incluye selectedType y selectedQuality
    // Mantenerlo por compatibilidad pero simplificado
    if (!marketData && (!productList || productList.length === 0)) return;

    const roundsData = marketData?.rounds || {};
    const newFilteredData = generateFilteredData(roundsData, selectedType, selectedQuality);
    setPriceHistory(newFilteredData);
    updateMarbleBasePrices(roundsData, selectedType, selectedQuality);
  }, [selectedType, selectedQuality, marketData, productList]);

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

  // No retornar temprano - siempre mostrar navigation bar

  return (
    <View style={styles.screenContainer}>
      <GameHeader title="RockStock" gameId={gameId} userId={userId} />
      
      {!marketData || !marketData.rounds ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading market data...</Text>
        </View>
      ) : (
        <>
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
                width={getScreenDimensions().width - scaleSpacing(42)}
                height={220}
                fromZero={true}
                chartConfig={chartConfig}
                style={styles.chartStyle}
              />
            </View>
          </View>
        </View>
      )}
        </>
      )}

      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default React.memo(ChatScreen);

