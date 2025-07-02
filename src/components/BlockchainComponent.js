import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserName } from '../hooks/useUserName';

const BlockCard = ({ block, index, showReward }) => {
  const minerId = block.winner?.userId;
  const minerName = useUserName(minerId);
  
  return (
    <View style={styles.blockCard}>
      <Text style={styles.blockNumber}>{`Block #${index + 1}`}</Text>
      <Text style={styles.blockId}>ID: {block.id}</Text>
      <Text style={styles.minedByLabel}>Mined by:</Text>
      <Text style={styles.minedByName}>{minerName || 'Unknown'}</Text>
      <Text style={styles.blockDetails}>
        Time: {((block.winner?.responseTime || 0) / 1000).toFixed(2)}s
      </Text>
      {showReward && block.winner && (
        <View style={styles.rewardContainer}>
          <Text style={styles.rewardText}>+50</Text>
        </View>
      )}
    </View>
  );
};

const BlockConnection = () => (
  <View style={styles.blockConnection} />
);

const BlockchainComponent = ({ gameId, title = "Blockchain", showReward = false, filterByRound = null }) => {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!gameId) {
      console.log('❌ No hay gameId, no se pueden cargar bloques');
      return;
    }

    console.log(`⛓️ BlockchainComponent - Cargando bloques para gameId: ${gameId}, filterByRound: ${filterByRound}`);

    const blocksRef = collection(db, 'blockchain', gameId, 'blocks');
    console.log(`🔍 Consultando colección: blockchain/${gameId}/blocks`);
    
    const unsubscribe = onSnapshot(blocksRef, (snapshot) => {
      console.log(`📊 Snapshot recibido, docs count: ${snapshot.docs.length}`);
      console.log(`📊 Snapshot empty: ${snapshot.empty}`);
      
      if (snapshot.empty) {
        console.log('📭 No hay documentos en la colección de bloques');
        setBlocks([]);
        return;
      }
      
      const allDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`📦 Total de bloques encontrados: ${allDocs.length}`);
      console.log(`📋 Datos de bloques:`, allDocs);
      
      // Filtrar solo los bloques que tienen un winner (minados correctamente)
      let minedBlocks = allDocs.filter(block => {
        const hasWinner = !!block.winner;
        console.log(`🔍 Bloque ${block.id}: tiene winner = ${hasWinner}`, block.winner);
        return hasWinner;
      });
      
      console.log(`🏆 Bloques minados (con winner): ${minedBlocks.length}`);
      console.log(`🏆 Datos de bloques minados:`, minedBlocks);
      
      // Si se especifica un filtro de ronda, aplicar el filtro
      if (filterByRound !== null) {
        minedBlocks = minedBlocks.filter(block => {
          const matchesRound = block.round === filterByRound;
          console.log(`🔍 Bloque ${block.id}: ronda ${block.round} vs ${filterByRound} = ${matchesRound}`);
          return matchesRound;
        });
        console.log(`🔍 Bloques filtrados por ronda ${filterByRound}: ${minedBlocks.length}`);
      } else {
        console.log(`🌐 Mostrando todos los bloques sin filtro de ronda`);
      }
      
      // Ordenar los bloques por timestamp (usando el ID que contiene el timestamp)
      minedBlocks.sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[1]);
        const bTime = parseInt(b.id.split('-')[1]);
        return aTime - bTime;
      });

      console.log(`📋 Bloques finales a mostrar: ${minedBlocks.length}`);
      setBlocks(minedBlocks);
    }, (error) => {
      console.error('❌ Error fetching blocks:', error);
      console.error('❌ Error details:', error.message, error.code);
    });

    return () => {
      console.log('🧹 Limpiando suscripción de bloques');
      unsubscribe();
    };
  }, [gameId, filterByRound]);

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
                <BlockCard block={block} index={index} showReward={showReward} />
                {index < blocks.length - 1 && <BlockConnection />}
              </React.Fragment>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.waitingText}>No blocks mined yet</Text>
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
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'black',
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
  },
  blockId: {
    fontSize: 10,
    color: '#999',
    marginBottom: 8,
  },
  minedByLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  minedByName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blockDetails: {
    fontSize: 14,
    color: '#666',
  },
  blockConnection: {
    width: 30,
    height: 2,
    backgroundColor: 'black',
    alignSelf: 'center',
    marginHorizontal: -1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  waitingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  rewardContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rewardText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BlockchainComponent; 