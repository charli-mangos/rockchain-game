const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.endRound = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const { gameId } = request.data;
  console.log(`🔄 endRound llamado con gameId: ${gameId}`);

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required.');
  }

  const db = admin.firestore();
  const gameRef = db.collection('games').doc(gameId);

  try {
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists) {
      throw new Error('Game not found');
    }

    const gameData = gameDoc.data();
    const { status, round } = gameData;

    // Solo terminar la ronda si está en progreso
    if (status !== 'in_progress' && status !== 'playing') {
      console.log(`⚠️ Juego no está en progreso: ${status}`);
      // Si ya está en roundEnd, no hacer nada
      if (status === 'roundEnd') {
        return { 
          success: true, 
          message: `Round ${round} already ended.`,
          round: round
        };
      }
      throw new Error('Game is not in progress');
    }

    console.log(`🏁 Terminando ronda ${round}`);

    // PROTECCIÓN: Usar transacción para evitar conflictos
    const result = await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists) {
        throw new Error('Game not found during transaction');
      }

      const currentGameData = gameDoc.data();
      const currentStatus = currentGameData.status;

      // Verificar que el estado no haya cambiado durante la transacción
      if (currentStatus !== 'in_progress' && currentStatus !== 'playing') {
        console.log(`⚠️ Estado cambió durante transacción: ${currentStatus}`);
        if (currentStatus === 'roundEnd') {
          return { 
            success: true, 
            message: `Round ${round} already ended.`,
            round: round
          };
        }
        throw new Error('Game state changed during transaction');
      }

      // Actualizar estado a roundEnd para permitir asignación de recompensas
      transaction.update(gameRef, {
        status: 'roundEnd',
        rewardsAssigned: false,
        roundRewards: null
      });

      return { 
        success: true, 
        message: `Round ${round} ended successfully.`,
        round: round
      };
    });

    console.log(`✅ Ronda ${round} terminada, estado actualizado a roundEnd`);
    return result;

  } catch (error) {
    console.error('❌ Error al terminar la ronda:', error);
    throw new Error('Failed to end round');
  }
}); 