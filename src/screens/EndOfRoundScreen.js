import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useGameContext } from '../context/GameContext';
import GameHeader from '../components/GameHeader';
import styles from '../styles/EndOfRoundScreenStyles';
import BlockchainComponent from '../components/BlockchainComponent';
import PlayerRankingComponent from '../components/PlayerRankingComponent';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigation } from '@react-navigation/native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const EndOfRoundScreen = ({ route }) => {
  const { gameId, userId } = route.params;
  const { players, round, isReadyForNextRound, markPlayerReady, winningIndustry } = useGameContext();
  const [userSelectedIndustry, setUserSelectedIndustry] = useState(null);
  const [hasReceivedReward, setHasReceivedReward] = useState(false);
  const [rewardMessage, setRewardMessage] = useState(null);
  const [roundRewards, setRoundRewards] = useState(null);
  const allPlayersReady = players.every(player => player.readyForNextRound);
  const navigation = useNavigation();

  useEffect(() => {
    console.log('EndOfRoundScreen mounted');
    const userRef = doc(db, 'users', userId);
    const gameRef = doc(db, 'games', gameId);

    const unsubscribeUser = onSnapshot(userRef, async (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const gameData = userData.games?.[gameId] || {};
        const selectedIndustry = gameData.selectedIndustry || 'No selection';
        setUserSelectedIndustry(selectedIndustry);
      }
    });

    const unsubscribeGame = onSnapshot(gameRef, async (doc) => {
      if (doc.exists()) {
        const gameData = doc.data();
        
        // Si los premios no han sido asignados, asignarlos
        if (!gameData.rewardsAssigned) {
          try {
            const assignRewardsFunction = httpsCallable(functions, 'assignRoundRewards');
            const result = await assignRewardsFunction({ gameId });
            console.log('Premios asignados:', result.data);
          } catch (error) {
            console.error('Error al asignar premios:', error);
          }
        }

        // Actualizar los premios mostrados
        if (gameData.roundRewards) {
          setRoundRewards(gameData.roundRewards);
          const userRewards = gameData.roundRewards[userId];
          if (userRewards) {
            let message = '';
            if (userRewards.industryReward) {
              message += `You've got it right! \n +${userRewards.industryReward} RockCoins \n`;
              if (userRewards.wasteRemoved > 0) {
                message += `Recycled waste: ${userRewards.wasteRemoved}\n`;
              }
            }
            if (userRewards.miningRewards) {
              message += `You have mined blocks! +${userRewards.miningRewards} RockCoins`;
            }
            setRewardMessage(message);
          }
        }
      }
    });

    return () => {
      console.log('EndOfRoundScreen unmounted');
      unsubscribeUser();
      unsubscribeGame();
    };
  }, [gameId, userId]);

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

      <TouchableOpacity 
        style={styles.readyButton}
        onPress={handleReady}
        disabled={isReadyForNextRound}
      >
        {!isReadyForNextRound ? (
          <Text style={styles.readyButtonText}>Ready for Next Round</Text>
        ) : (
          <ActivityIndicator color="#fff" size="small" />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default EndOfRoundScreen;