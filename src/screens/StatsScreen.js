import React from 'react';
import { View } from 'react-native';
import styles from '../styles/StatsScreenStyles';
import GameHeader from '../components/GameHeader';
import NavigationBar from '../components/NavigationBar';
import { useGameContext } from '../context/GameContext';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';

const StatsScreen = ({ navigation, route }) => {
  const { gameId, userId } = route.params;
  const { players } = useGameContext();

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
          showReadyStatus={false}
        />
      </View>

      <View style={styles.playersContainer}>
        <BlockchainComponent gameId={gameId} />
      </View>

      <NavigationBar navigation={navigation} />
    </View>
  );
};

export default StatsScreen;
