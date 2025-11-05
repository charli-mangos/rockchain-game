import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameContextHybridRobust } from '../context/GameContextHybridRobust';
import { useUserName } from '../hooks/useUserName';

const BlockCard = ({ block, index, showReward, currentUserId, currentRound, showMiningReward = false }) => {
  const { t } = useTranslation();
  const minerId = block.winner?.userId;
  const minerName = useUserName(minerId);
  const isCurrentUserWinner = minerId === currentUserId;
  
  // Determinar si el bloque es de la ronda actual o de una ronda anterior
  // El servidor asigna rounds 1-indexed (1, 2, 3...), así que block.round es directamente el número de ronda
  // Entonces si block.round === currentRound, es de la ronda actual
  const blockRoundNumber = block.round !== undefined ? block.round : 1; // block.round ya es el número de ronda (1, 2, 3...)
  const isCurrentRound = currentRound !== undefined && block.round === currentRound;
  
  // Determinar qué mostrar en el cartelito y su estilo
  let badgeText = null;
  let showBadge = false;
  let isPreviousRound = false;
  
  // Siempre mostrar la ronda (R1, R2, R3...) si hay un bloque con winner
  if (showReward && block.winner) {
    badgeText = `R${blockRoundNumber}`;
    showBadge = true;
    isPreviousRound = true; // Por defecto, mostrar estilo naranja (ronda anterior)
    
    // Solo en EndOfRoundScreen, si es la ronda actual y el usuario ganó, mostrar +50 en lugar de la ronda
    if (showMiningReward && isCurrentRound && isCurrentUserWinner) {
      badgeText = '+50';
      isPreviousRound = false; // Estilo verde con fondo para el reward de minado
    }
  }
  
  return (
    <View style={styles.blockCard}>
      <Text style={styles.blockNumber}>{t('blockchain.blockNumber', { number: index + 1 })}</Text>
      <Text style={styles.blockId}>{t('blockchain.id')}: {block.id}</Text>
      <Text style={styles.minedByLabel}>{t('blockchain.minedBy')}:</Text>
      <Text style={styles.minedByName}>{minerName || t('blockchain.unknown')}</Text>
      <Text style={styles.blockDetails}>
        {t('blockchain.time')}: {((block.winner?.responseTime || 0) / 1000).toFixed(2)}s
      </Text>
      {showBadge && (
        <View style={[
          styles.rewardContainer,
          isPreviousRound && styles.rewardContainerPreviousRound
        ]}>
          <Text style={[
            styles.rewardText,
            isPreviousRound && styles.rewardTextPreviousRound,
            !isPreviousRound && styles.rewardTextCurrentRound // Estilo amarillo para +50
          ]}>{badgeText}</Text>
        </View>
      )}
    </View>
  );
};

const BlockConnection = () => (
  <View style={styles.blockConnection} />
);

const BlockchainComponent = ({ gameId, title = "Blockchain", showReward = false, filterByRound = null, currentUserId, currentRound, showMiningReward = false }) => {
  const { t } = useTranslation();
  const { webSocketInventory, minedBlocks, round } = useGameContextHybridRobust();
  const [blocks, setBlocks] = useState([]);
  
  // Usar currentRound si se proporciona, sino usar el round del contexto
  const displayRound = currentRound !== undefined ? currentRound : round;

  useEffect(() => {
    if (!gameId) {
      console.log('❌ [BLOCKCHAIN] No hay gameId, no se pueden cargar bloques');
      return;
    }

    console.log(`⛓️ [BLOCKCHAIN] Usando datos del WebSocket para gameId: ${gameId}, filterByRound: ${filterByRound}`);
    console.log(`📊 [BLOCKCHAIN] minedBlocks actuales:`, minedBlocks);
    console.log(`📊 [BLOCKCHAIN] minedBlocks.length:`, minedBlocks?.length || 0);
    console.log(`📊 [BLOCKCHAIN] round actual:`, round);
    console.log(`📊 [BLOCKCHAIN] Array.isArray(minedBlocks):`, Array.isArray(minedBlocks));

    // Usar bloques minados directamente del WebSocket
    const blocksToShow = minedBlocks
      .filter(block => {
        // Si filterByRound es null, mostrar TODOS los bloques desde el inicio de la partida
        if (filterByRound === null) {
          return true; // Mostrar todos los bloques
        }
        
        // Si filterByRound tiene un valor, filtrar por esa ronda específica
        // El servidor asigna rounds 1-indexed (1, 2, 3...), así que block.round es directamente el número de ronda
        // Entonces si filterByRound es 1, buscamos bloques con round: 1
        // Si filterByRound es 2, buscamos bloques con round: 2
        const shouldShow = block.round === filterByRound;
          console.log(`🔍 [BLOCKCHAIN] Filtrando bloques: block.round=${block.round}, filterByRound=${filterByRound}, shouldShow=${shouldShow}`);
          return shouldShow;
      })
      .sort((a, b) => a.timestamp - b.timestamp); // Ordenar por timestamp

    console.log(`🏆 Bloques minados desde WebSocket: ${blocksToShow.length}`);
    console.log(`🏆 Datos de bloques minados:`, blocksToShow);
    console.log(`📋 Bloques finales a mostrar: ${blocksToShow.length}`);
    setBlocks(blocksToShow);
  }, [gameId, filterByRound, minedBlocks, round]);


  return (
    <View style={styles.blockchainSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.blockchainContainer}>
        {blocks.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.blockchainContent}
          >
            {blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                <BlockCard block={block} index={index} showReward={showReward} currentUserId={currentUserId} currentRound={displayRound} showMiningReward={showMiningReward} />
                {index < blocks.length - 1 && <BlockConnection />}
              </React.Fragment>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.waitingText}>{t('blockchain.noBlocksMinedYet')}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  blockchainSection: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
  blockchainContainer: {
    marginTop: -18,
  },
  blockchainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  blockCard: {
    backgroundColor: '#fdf4e8',
    borderWidth: 1,
    borderColor: '#1d3d39',
    borderRadius: 8,
    padding: 15,
    minWidth: 150,
    marginVertical: 10,
    position: 'relative',
  },
  blockNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1d3d39',
  },
  blockId: {
    fontSize: 10,
    color: '#1d3d39',
    marginBottom: 8,
  },
  minedByLabel: {
    fontSize: 14,
    color: '#1d3d39',
    marginTop: 4,
  },
  minedByName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1d3d39',
  },
  blockDetails: {
    fontSize: 14,
    color: '#1d3d39',
  },
  blockConnection: {
    width: 30,
    height: 2,
    backgroundColor: '#1d3d39',
    alignSelf: 'center',
    marginHorizontal: -1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1d3d39',
  },
  waitingText: {
    fontSize: 16,
    color: '#1d3d39',
    marginTop: 8,
  },
  rewardContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#2d5a56',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rewardContainerPreviousRound: {
    backgroundColor: 'transparent',
  },
  rewardText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rewardTextPreviousRound: {
    color: '#ba5d17', // Color naranja del botón End Game
  },
  rewardTextCurrentRound: {
    color: '#feda8c', // Color amarillo para +50
  },
});

export default BlockchainComponent; 