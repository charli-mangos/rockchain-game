import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import RotatingCube from '../components/RotatingCube';

const WaitingForNextRoundScreen = ({ route }) => {
  const { t } = useTranslation();
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
        return t('waiting.waitingForAllPlayers');
      case 'preparingNextRound':
        return t('waiting.preparingNextRound');
      case 'startingNextRound':
        return t('waiting.startingIn', { count: countdown });
      default:
        return t('waiting.gettingReady');
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
      <View style={styles.content}>
        {/* Status Icon */}
        <View style={styles.statusContainer}>
          {getStatusIcon()}
        </View>
        
        {/* Status Message */}
        <Text style={styles.statusMessage}>
          {getStatusMessage()}
        </Text>
        
        {/* Progress for waiting */}
        {gameStatus === 'waitingForNextRound' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {t('waiting.playersReady', { 
                ready: roundReadyProgress.readyCount || 0, 
                total: roundReadyProgress.totalPlayers || 0 
              })}
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
                      {isReady ? t('waiting.ready') : t('waiting.waiting')}
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
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d3d39',
    textAlign: 'center',
    marginBottom: 20,
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
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
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
    color: '#4caf50',
  },
  notReady: {
    color: '#ff9800',
  },
});

export default WaitingForNextRoundScreen;