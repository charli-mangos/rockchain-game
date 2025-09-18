import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PlayerRankingComponent = ({ players, title, currentUserId }) => {
  // Debug: Log de datos recibidos
  console.log('🏆 [PlayerRankingComponent] Datos recibidos:');
  console.log('🏆 [PlayerRankingComponent] players:', players);
  console.log('🏆 [PlayerRankingComponent] players.length:', players?.length || 0);
  console.log('🏆 [PlayerRankingComponent] title:', title);
  console.log('🏆 [PlayerRankingComponent] currentUserId:', currentUserId);
  
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
        <Ionicons name="cube" size={20} color="#666" />
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
    const isCurrentUser = currentUserId && item.userId === currentUserId;
    
    return (
      <View style={[styles.row, isCurrentUser && styles.currentUserRow]}>
        <View style={styles.cell}>
          <Text style={[styles.rankText, isCurrentUser && styles.currentUserText]}>#{index + 1}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.nameText, isCurrentUser && styles.currentUserText]}>{item.userName}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.rockCoins}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.waste}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.blocksMined || 0}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.valueText, { color: balanceColor }, isCurrentUser && styles.currentUserText]}>
            {balance}
          </Text>
        </View>
      </View>
    );
  }, [currentUserId]);

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
  currentUserRow: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  currentUserText: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
});

export default React.memo(PlayerRankingComponent); 