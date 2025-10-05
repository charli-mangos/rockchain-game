const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.evaluateRound = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const { gameId } = request.data || {};
  console.log(`🔄 evaluateRound llamado con gameId: ${gameId}`);

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required.');
  }

  const db = admin.firestore();
  const gameRef = db.collection('games').doc(gameId);
  const blocksRef = db.collection('blockchain').doc(gameId).collection('blocks');

  try {
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists) {
      throw new Error('Game not found');
    }

    const gameData = gameDoc.data();
    const { status, round, winningIndustry } = gameData;

    console.log(`📊 Evaluando ronda ${round}, estado: ${status}`);

    // Solo evaluar si el juego está en progreso
    if (status !== 'in_progress' && status !== 'playing') {
      console.log(`⚠️ Juego no está en progreso: ${status}`);
      return { 
        success: false, 
        message: 'Game is not in progress',
        status: status
      };
    }

    // Obtener todos los bloques de la ronda actual
    const blocksSnapshot = await blocksRef
      .where('round', '==', round)
      .get();

    const roundBlocks = blocksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Bloques de la ronda ${round}: ${roundBlocks.length}`);

    if (roundBlocks.length === 0) {
      console.log('⚠️ No hay bloques en esta ronda');
      return { 
        success: false, 
        message: 'No blocks found for this round',
        round: round
      };
    }

    // Verificar si todos los bloques están completados
    const completedBlocks = roundBlocks.filter(block => 
      block.isActive === false || block.winner || block.completedAt
    );

    const allBlocksCompleted = completedBlocks.length === roundBlocks.length;

    console.log(`🏁 Bloques completados: ${completedBlocks.length}/${roundBlocks.length}`);
    console.log(`🏁 Todos los bloques completados: ${allBlocksCompleted}`);

    if (allBlocksCompleted) {
      console.log('🎯 TODOS LOS BLOQUES COMPLETADOS - Finalizando ronda');
      
      // Usar transacción para actualizar el estado del juego
      const result = await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists) {
          throw new Error('Game not found during transaction');
        }

        const currentGameData = gameDoc.data();
        const currentStatus = currentGameData.status;

        // Verificar que el estado no haya cambiado
        if (currentStatus !== 'in_progress' && currentStatus !== 'playing') {
          console.log(`⚠️ Estado cambió durante transacción: ${currentStatus}`);
          return { 
            success: false, 
            message: 'Game state changed during transaction',
            status: currentStatus
          };
        }

        // Asegurar que tenemos un winningIndustry
        let finalWinningIndustry = currentGameData.winningIndustry;
        if (!finalWinningIndustry) {
          console.log(`⚠️ No hay winningIndustry, seleccionando uno por defecto`);
          const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
          finalWinningIndustry = industries[Math.floor(Math.random() * industries.length)];
        }

        // Actualizar estado a waiting_for_players
        transaction.update(gameRef, {
          status: 'waiting_for_players',
          rewardsAssigned: false,
          roundRewards: null,
          winningIndustry: finalWinningIndustry,
          roundEndTime: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Estado actualizado a waiting_for_players`);
        console.log(`🏆 Winning Industry: ${finalWinningIndustry}`);
        
        return { 
          success: true, 
          message: `Round ${round} completed successfully`,
          round: round,
          winningIndustry: finalWinningIndustry
        };
      });

      console.log(`✅ Ronda ${round} finalizada automáticamente`);
      return result;
    } else {
      console.log(`⏳ Esperando a que se completen más bloques`);
      return { 
        success: false, 
        message: 'Not all blocks completed yet',
        completedBlocks: completedBlocks.length,
        totalBlocks: roundBlocks.length,
        round: round
      };
    }

  } catch (error) {
    console.error('❌ Error en evaluateRound:', error);
    throw new Error('Failed to evaluate round');
  }
}); 