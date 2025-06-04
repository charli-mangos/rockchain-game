import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Alert } from 'react-native';
import { useGameContext } from '../context/GameContext';
import GameHeader from '../components/GameHeader';
import styles from '../styles/EndOfRoundScreenStyles';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigation } from '@react-navigation/native';

const EndOfRoundScreen = ({ route }) => {
  const { gameId, userId } = route.params;
  const { players, round, isReadyForNextRound, markPlayerReady, winningIndustry } = useGameContext();
  const [userSelectedIndustry, setUserSelectedIndustry] = useState(null);
  const [hasReceivedReward, setHasReceivedReward] = useState(false);
  const [rewardMessage, setRewardMessage] = useState(null);
  const allPlayersReady = players.every(player => player.readyForNextRound);
  const navigation = useNavigation();

  useEffect(() => {
    console.log('EndOfRoundScreen mounted');
    const userRef = doc(db, 'users', userId);

    const unsubscribeUser = onSnapshot(userRef, async (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const gameData = userData.games?.[gameId] || {};
        const selectedIndustry = gameData.selectedIndustry || 'No selection';
        setUserSelectedIndustry(selectedIndustry);

        // Verificar si el jugador acertó y aún no ha recibido la recompensa
        if (winningIndustry && selectedIndustry === winningIndustry && !hasReceivedReward) {
          try {
            const reward = 100 + Math.floor(gameData.waste * 0.5);
            await updateDoc(userRef, {
              [`games.${gameId}.rockCoins`]: (gameData.rockCoins || 0) + reward,
              [`games.${gameId}.hasReceivedReward`]: true
            });
            setHasReceivedReward(true);
            setRewardMessage(`¡Has acertado! Recompensa obtenida: ${reward} RockCoins`);
          } catch (error) {
            console.error('Error al otorgar la recompensa:', error);
          }
        }
      }
    });

    return () => {
      console.log('EndOfRoundScreen unmounted');
      unsubscribeUser();
    };
  }, [gameId, userId, winningIndustry, hasReceivedReward]);

  const handleReady = async () => {
    try {
      await markPlayerReady();
      navigation.navigate('WaitingRoom', { gameId, userId });
    } catch (error) {
      console.error('Error al marcar como listo:', error);
      Alert.alert('Error', 'No se pudo marcar como listo para la siguiente ronda');
    }
  };

  return (
    <View style={styles.container}>
      <GameHeader 
        title={`Round ${round} Complete`} 
        userId={userId} 
        gameId={gameId}
        currentScreen="EndOfRound"
      />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PlayerRankingComponent 
          players={players} 
          title="Round Rankings" 
          showReadyStatus={true}
        />

        <View style={styles.industryContainer}>
          <Text style={styles.industryTitle}>Waste Management</Text>
          <View style={styles.industryInfo}>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>Winning Industry:</Text>
              <Text style={styles.industryValue}>
                {winningIndustry || 'Not selected yet'}
              </Text>
            </View>
            <View style={styles.industryRow}>
              <Text style={styles.industryLabel}>Your Selection:</Text>
              <Text style={[
                styles.industryValue,
                userSelectedIndustry === winningIndustry ? styles.correctSelection : styles.incorrectSelection
              ]}>
                {userSelectedIndustry}
              </Text>
            </View>
            {rewardMessage && (
              <View style={styles.rewardContainer}>
                <Text style={styles.rewardText}>{rewardMessage}</Text>
              </View>
            )}
          </View>
        </View>

        <BlockchainComponent gameId={gameId} />
      </ScrollView>

      {!isReadyForNextRound ? (
        <TouchableOpacity 
          style={styles.readyButton}
          onPress={handleReady}
        >
          <Text style={styles.readyButtonText}>Ready for Next Round</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.waitingText}>Waiting for other players...</Text>
      )}
    </View>
  );
};

export default EndOfRoundScreen; 