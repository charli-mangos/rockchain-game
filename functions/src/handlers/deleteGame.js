const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Inicializa Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.deleteGame = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const { gameId } = request.data || {};
  const userId = request.auth?.uid;

  console.log(`🗑️ deleteGame llamado con gameId: ${gameId} por usuario: ${userId}`);

  if (!userId) {
    console.error('❌ No se proporcionó userId');
    throw new Error('Authentication required');
  }

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required');
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();

    // Verificar que el juego existe y que el usuario es el host
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found');
    }

    const gameData = gameDoc.data();
    if (gameData.hostId !== userId) {
      console.error(`❌ Usuario ${userId} no es el host del juego ${gameId}`);
      throw new Error('Only the host can delete the game');
    }

    console.log(`✅ Verificado: usuario ${userId} es el host del juego ${gameId}`);

    // Eliminar el juego específico
    batch.delete(gameRef);

    // Eliminar datos de market para este juego específico
    const marketSnapshot = await db.collection('market')
      .where('gameId', '==', gameId)
      .get();
    
    marketSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Eliminar datos de blockchain para este juego específico
    const blockchainSnapshot = await db.collection('blockchain')
      .where('gameId', '==', gameId)
      .get();
    
    blockchainSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Eliminar datos del usuario para este juego específico
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      [`games.${gameId}`]: admin.firestore.FieldValue.delete()
    });

    // Ejecutar el batch
    await batch.commit();

    console.log(`✅ Juego ${gameId} eliminado exitosamente`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error eliminando datos del juego:', error);
    throw new Error(`Failed to delete game: ${error.message}`);
  }
});