import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PlayerRankingComponent = ({ players, title, currentUserId, roundRewards }) => {
  // Debug: Log de datos recibidos
  console.log('🏆 [PlayerRankingComponent] Datos recibidos:');
  console.log('🏆 [PlayerRankingComponent] players:', players);
  console.log('🏆 [PlayerRankingComponent] players.length:', players?.length || 0);
  console.log('🏆 [PlayerRankingComponent] title:', title);
  console.log('🏆 [PlayerRankingComponent] currentUserId:', currentUserId);
  console.log('🏆 [PlayerRankingComponent] roundRewards:', roundRewards);
  console.log('🏆 [PlayerRankingComponent] roundRewards type:', typeof roundRewards);
  console.log('🏆 [PlayerRankingComponent] roundRewards is null?', roundRewards === null);
  
  // Debug específico para recompensas
  if (roundRewards) {
    console.log('🏆 [PlayerRankingComponent] roundRewards detallado:', JSON.stringify(roundRewards, null, 2));
    Object.keys(roundRewards).forEach(userId => {
      const rewards = roundRewards[userId];
      console.log(`🏆 [PlayerRankingComponent] Usuario ${userId} tiene recompensas:`, rewards);
    });
  } else {
    console.log('🏆 [PlayerRankingComponent] roundRewards es null o undefined');
  }

  
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
          style={[styles.rockCoinIcon, { tintColor: '#1d3d39' }]} 
          resizeMode="contain"
        />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trash" size={20} color="#1d3d39" />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="cube" size={20} color="#1d3d39" />
      </View>
      <View style={styles.headerCell}>
        <Ionicons name="trending-up" size={20} color="#1d3d39" />
      </View>
    </View>
  ), []);

  // Memoizar el renderizado de cada item
  const renderPlayerItem = useMemo(() => ({ item, index }) => {
    const balance = item.rockCoins - item.waste;
    const balanceColor = balance > 0 ? '#2d5a56' : '#ba5d17';
    const isCurrentUser = currentUserId && item.userId === currentUserId;
    const isLastItem = index === players.length - 1;
    
    // Obtener recompensas para este jugador desde roundRewards
    const playerRewards = roundRewards?.[item.userId];
    const hasMiningReward = playerRewards?.miningReward > 0;
    const hasWasteReduction = playerRewards?.wasteRemoved > 0;
    
    // Debug logs solo si hay recompensas
    if (hasMiningReward || hasWasteReduction) {
      console.log(`🏆 [PlayerRankingComponent] ${item.userName} tiene recompensas:`, playerRewards);
    }
    
    return (
      <View style={[styles.row, isCurrentUser && styles.currentUserRow, isLastItem && styles.rowLast]}>
        <View style={styles.cell}>
          <Text style={[styles.rankText, isCurrentUser && styles.currentUserText]}>#{index + 1}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.nameText, isCurrentUser && styles.currentUserText]}>{item.userName}</Text>
        </View>
        <View style={styles.cell}>
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.rockCoins}</Text>
            {hasMiningReward && (
              <View style={styles.rewardBadge}>
                <Text style={styles.rewardBadgeText}>+{playerRewards.miningReward}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cell}>
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.waste}</Text>
            {hasWasteReduction && (
              <View style={styles.rewardBadge}>
                <Text style={styles.rewardBadgeText}>-{playerRewards.wasteRemoved}</Text>
              </View>
            )}
          </View>
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
  }, [currentUserId, roundRewards, players.length]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.cardContainer}>
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
    color: '#1d3d39',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1d3d39',
    backgroundColor: '#f8f8f8',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  rowLast: {
    borderBottomWidth: 0,
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
  relativeCell: {
    position: 'relative',
  },
  valueContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 16,
    color: '#1d3d39',
    fontWeight: '600',
  },
  rankText: {
    fontSize: 16,
    color: '#1d3d39',
  },
  nameText: {
    fontSize: 16,
    color: '#1d3d39',
  },
  valueText: {
    fontSize: 16,
    color: '#1d3d39',
  },
  rockCoinIcon: {
    width: 20,
    height: 20,
  },
  currentUserRow: {
    backgroundColor: '#fdf4e8',
    borderLeftWidth: 4,
    borderLeftColor: '#ba5d17',
  },
  currentUserText: {
    fontWeight: 'bold',
    color: '#ba5d17',
  },
  // Estilos para cartelitos de recompensas (pegatina superpuesta)
  rewardBadge: {
    position: 'absolute',
    top: -12,
    right: -25,
    backgroundColor: '#2d5a56',
    borderRadius: 12, // Igualado a BlockchainComponent
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#feda8c', // Borde amarillo
    opacity: 0.85, // Reducir opacidad para que no sean tan "pegostosos"
    shadowColor: '#2d5a56',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  rewardBadgeText: {
    color: '#feda8c',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default React.memo(PlayerRankingComponent); 