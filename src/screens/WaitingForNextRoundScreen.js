import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import RotatingCube from '../components/RotatingCube';

const WaitingForNextRoundScreen = ({ route }) => {
  const { gameId, userId } = route?.params || {};
  const {
    round,
    gameStatus,
    nextRoundWaiting,
    roundReadyProgress,
    allPlayersData,
    roundMeta
  } = useGameContextHybridRobust();

  const [countdown, setCountdown] = useState(3);

  // Countdown para starting_next_round
  useEffect(() => {
    if (gameStatus === 'startingNextRound') {
      let timer = 3;
      setCountdown(timer);
      
      const interval = setInterval(() => {
        timer--;
        setCountdown(timer);
        
        if (timer <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [gameStatus]);

  const getStatusMessage = () => {
    switch (gameStatus) {
      case 'waitingForNextRound':
        return 'Waiting for all players...';
      case 'preparingNextRound':
        return 'Preparing next round...';
      case 'startingNextRound':
        return `Starting in ${countdown}...`;
      default:
        return 'Preparing next round...';
    }
  };

  const getStatusIcon = () => {
    switch (gameStatus) {
      case 'waitingForNextRound':
        return <RotatingCube size={120} />;
      case 'preparingNextRound':
        return <RotatingCube size={120} />;
      case 'startingNextRound':
        return (
          <View style={styles.countdownContainer}>
            <RotatingCube size={100} />
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        );
      default:
        return <RotatingCube size={120} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header similar a WaitingRoomHeader */}
      <View style={styles.headerContainer}>
        <RotatingCube size={100} color="#ba5d17" />
        <Text style={styles.headerTitle}>{getStatusMessage()}</Text>
      </View>
      
      <View style={styles.content}>
        
        {/* Progress for waiting */}
        {gameStatus === 'waitingForNextRound' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {roundReadyProgress.readyCount || 0} / {roundReadyProgress.totalPlayers || 0} players ready
            </Text>
            
            {/* Player List */}
            <View style={styles.playerList}>
              {allPlayersData.map((player, index) => {
                // El jugador actual siempre aparece como Ready (porque está en esta pantalla)
                // Los demás aparecen como Ready si están en readyList, sino Waiting
                const isCurrentPlayer = player.userId === userId;
                const isReady = isCurrentPlayer || roundReadyProgress.readyList?.includes(player.userId) || false;
                
                return (
                  <View key={player.userId} style={styles.playerItem}>
                    <Text style={styles.playerName}>
                      {player.userName}
                    </Text>
                    <Text style={[
                      styles.readyStatus,
                      isReady ? styles.ready : styles.notReady
                    ]}>
                      {isReady ? '✓ Ready' : '⏳ Waiting'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 35,
    marginTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 35,
    color: '#1d3d39',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d3d39',
    textAlign: 'center',
    marginBottom: 30,
  },
  countdownContainer: {
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1d3d39',
    marginTop: 20,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 20,
  },
  progressText: {
    fontSize: 18,
    color: '#1d3d39',
    textAlign: 'center',
    marginBottom: 20,
  },
  playerList: {
    width: '100%',
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fdf4e8',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1d3d39',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1d3d39',
  },
  readyStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  ready: {
    color: '#2d5a56',
  },
  notReady: {
    color: '#ba5d17',
  },
});

export default WaitingForNextRoundScreen;