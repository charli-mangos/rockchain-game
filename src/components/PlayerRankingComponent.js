import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PlayerRankingComponent = ({ players, title }) => {
  // Memoizar el header para evitar re-renders innecesarios
  const ListHeader = useMemo(() => (
    <View style={styles.headerRow}>
      <View style={styles.headerCell}>
        <Text style={styles.headerText}>Rank</Text>
      </View>
      <View style={styles.headerCell}>
        <Text style={styles.headerText}>Player</Text>
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
  const renderPlayerItem = useMemo(() => ({ item, index }) => {
    const balance = item.rockCoins - item.waste;
    const balanceColor = balance > 0 ? '#2ecc71' : '#e74c3c';
    
    return (
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.nameText}>{item.userName}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.valueText}>{item.rockCoins}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.valueText}>{item.waste}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.valueText, { color: balanceColor }]}>
            {balance}
          </Text>
        </View>
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={players}
        renderItem={renderPlayerItem}
        keyExtractor={(item) => item.userId}
        ListHeaderComponent={ListHeader}
        scrollEnabled={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f8f8f8',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  rankText: {
    fontSize: 16,
    color: '#666',
  },
  nameText: {
    fontSize: 16,
    color: '#000',
  },
  valueText: {
    fontSize: 16,
    color: '#000',
  },
  rockCoinIcon: {
    width: 20,
    height: 20,
  },
});

export default React.memo(PlayerRankingComponent); 