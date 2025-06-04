import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUserName } from '../hooks/useUserName';

const BlockCard = ({ block, index }) => {
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
    </View>
  );
};

const BlockConnection = () => (
  <View style={styles.blockConnection} />
);

const BlockchainComponent = ({ gameId, title = "Blockchain" }) => {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!gameId) return;

    const blocksRef = collection(db, 'blockchain', gameId, 'blocks');
    
    const unsubscribe = onSnapshot(blocksRef, (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar solo los bloques que tienen un winner (minados correctamente)
      const minedBlocks = allDocs.filter(block => block.winner);
      
      // Ordenar los bloques por timestamp (usando el ID que contiene el timestamp)
      minedBlocks.sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[1]);
        const bTime = parseInt(b.id.split('-')[1]);
        return aTime - bTime;
      });

      setBlocks(minedBlocks);
    }, (error) => {
      console.error('Error fetching blocks:', error);
    });

    return () => unsubscribe();
  }, [gameId]);

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
                <BlockCard block={block} index={index} />
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
    marginTop: 0,
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
});

export default BlockchainComponent; 