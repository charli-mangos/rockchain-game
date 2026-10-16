const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const { requireAuth, requireId, assertParticipant } = require('../utils/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.endRound = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const userId = requireAuth(request);
  const { gameId } = request.data || {};
  requireId(gameId, 'gameId');
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
    assertParticipant(gameData, userId);
    const { status, round } = gameData;

    // Solo terminar la ronda si está en progreso
    if (status !== 'in_progress' && status !== 'playing') {
      console.log(`⚠️ Juego no está en progreso: ${status}`);
      // Si ya está en waiting_for_players, no hacer nada
      if (status === 'waiting_for_players') {
        return { 
          success: true, 
          message: `Round ${round} already ended.`,
          round: round
        };
      }
      throw new Error('Game is not in progress');
    }

    console.log(`🏁 Terminando ronda ${round}`);
    console.log(`🏆 Winning Industry actual: ${gameData.winningIndustry}`);
    console.log(`📊 Estado actual: ${status}`);

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
        if (currentStatus === 'waiting_for_players') {
          return { 
            success: true, 
            message: `Round ${round} already ended.`,
            round: round
          };
        }
        throw new Error('Game state changed during transaction');
      }

      // Actualizar estado a waiting_for_players para permitir navegación a EndOfRound
      transaction.update(gameRef, {
        status: 'waiting_for_players',
        rewardsAssigned: false,
        roundRewards: null,
        // Asegurar que winningIndustry esté configurado
        winningIndustry: currentGameData.winningIndustry || null
      });

      console.log(`✅ Transacción completada - Estado actualizado a waiting_for_players`);
      console.log(`🏆 Winning Industry preservado: ${currentGameData.winningIndustry}`);

      return { 
        success: true, 
        message: `Round ${round} ended successfully.`,
        round: round
      };
    });

    console.log(`✅ Ronda ${round} terminada, estado actualizado a waiting_for_players`);
    return result;

  } catch (error) {
    console.error('❌ Error al terminar la ronda:', error);
    if (error instanceof HttpsError) throw error;
    throw new Error('Failed to end round');
  }
}); 