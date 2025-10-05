import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RewardAnimation from './RewardAnimation';

const PlayerRankingComponent = ({ players, title, currentUserId, roundRewards }) => {
  // Debug: Log de datos recibidos
  console.log('🏆 [PlayerRankingComponent] Datos recibidos:');
  console.log('🏆 [PlayerRankingComponent] players:', players);
  console.log('🏆 [PlayerRankingComponent] players.length:', players?.length || 0);
  console.log('🏆 [PlayerRankingComponent] title:', title);
  console.log('🏆 [PlayerRankingComponent] currentUserId:', currentUserId);
  console.log('🏆 [PlayerRankingComponent] roundRewards:', roundRewards);

  // Estado para manejar animaciones de recompensas
  const [rewardAnimations, setRewardAnimations] = useState({});
  const [previousPlayers, setPreviousPlayers] = useState([]);

  // Detectar cambios en los valores de los jugadores para mostrar animaciones
  useEffect(() => {
    if (players && previousPlayers.length > 0) {
      const newAnimations = {};
      
      players.forEach((currentPlayer, index) => {
        const previousPlayer = previousPlayers.find(p => p.userId === currentPlayer.userId);
        
        if (previousPlayer) {
          // Detectar cambios en RockCoins
          const rockCoinsDiff = currentPlayer.rockCoins - previousPlayer.rockCoins;
          if (rockCoinsDiff > 0) {
            newAnimations[`${currentPlayer.userId}_rockCoins`] = {
              reward: rockCoinsDiff,
              type: 'rockCoins',
              isVisible: true
            };
          }
          
          // Detectar cambios en Waste (reducción)
          const wasteDiff = previousPlayer.waste - currentPlayer.waste;
          if (wasteDiff > 0) {
            newAnimations[`${currentPlayer.userId}_waste`] = {
              reward: wasteDiff,
              type: 'waste',
              isVisible: true
            };
          }
        }
      });
      
      if (Object.keys(newAnimations).length > 0) {
        console.log('🎬 Iniciando animaciones de recompensas:', newAnimations);
        setRewardAnimations(newAnimations);
        
        // Limpiar animaciones después de 3 segundos
        setTimeout(() => {
          setRewardAnimations({});
        }, 3000);
      }
    }
    
    setPreviousPlayers(players || []);
  }, [players]);

  // Función para manejar la finalización de animaciones
  const handleAnimationComplete = (animationKey) => {
    setRewardAnimations(prev => {
      const newAnimations = { ...prev };
      delete newAnimations[animationKey];
      return newAnimations;
    });
  };
  
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
    
    // Obtener animaciones para este jugador
    const rockCoinsAnimation = rewardAnimations[`${item.userId}_rockCoins`];
    const wasteAnimation = rewardAnimations[`${item.userId}_waste`];
    
    return (
      <View style={[styles.row, isCurrentUser && styles.currentUserRow]}>
        <View style={styles.cell}>
          <Text style={[styles.rankText, isCurrentUser && styles.currentUserText]}>#{index + 1}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.nameText, isCurrentUser && styles.currentUserText]}>{item.userName}</Text>
        </View>
        <View style={[styles.cell, styles.relativeCell]}>
          <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.rockCoins}</Text>
          {rockCoinsAnimation && (
            <RewardAnimation
              reward={rockCoinsAnimation.reward}
              type={rockCoinsAnimation.type}
              isVisible={rockCoinsAnimation.isVisible}
              onAnimationComplete={() => handleAnimationComplete(`${item.userId}_rockCoins`)}
            />
          )}
        </View>
        <View style={[styles.cell, styles.relativeCell]}>
          <Text style={[styles.valueText, isCurrentUser && styles.currentUserText]}>{item.waste}</Text>
          {wasteAnimation && (
            <RewardAnimation
              reward={wasteAnimation.reward}
              type={wasteAnimation.type}
              isVisible={wasteAnimation.isVisible}
              onAnimationComplete={() => handleAnimationComplete(`${item.userId}_waste`)}
            />
          )}
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
  }, [currentUserId, rewardAnimations]);

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
    color: '#1d3d39',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d3d39',
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
  relativeCell: {
    position: 'relative',
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
});

export default React.memo(PlayerRankingComponent); 