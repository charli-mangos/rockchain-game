import React from 'react';
import { View } from 'react-native';
import styles from '../styles/StatsScreenStyles';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';

const StatsScreen = ({ navigation, route }) => {
  const { gameId, userId, allPlayersData } = useGameContextHybridRobust();
  
  // Usar los datos completos de todos los jugadores
  const players = allPlayersData.sort((a, b) => {
    // Ordenar por balance (RockCoins - Waste) de mayor a menor
    const balanceA = a.rockCoins - a.waste;
    const balanceB = b.rockCoins - b.waste;
    return balanceB - balanceA;
  });

  return (
    <View style={styles.screenContainer}>
      <GameHeader
        title="RockStats"
        gameId={gameId}
        userId={userId}
        onSettingsPress={() => console.log('Settings Pressed')}
      />

      <View style={styles.playersContainer}>
        <PlayerRankingComponent 
          players={players} 
          title="Global Rankings" 
          currentUserId={userId}
          roundRewards={null}
        />
      </View>

      <View style={styles.playersContainer}>
        <BlockchainComponent gameId={gameId} currentUserId={userId} />
      </View>

      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default StatsScreen;
