const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.joinGame = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const { gameCode } = request.data || {};
  const userId = request.auth?.uid;

  if (!userId) {
    console.error('❌ No se proporcionó userId');
    throw new Error('Authentication required');
  }

  if (!gameCode) {
    console.error('❌ No se proporcionó gameCode');
    throw new Error('Game code is required');
  }

  try {
    const gamesQuerySnapshot = await admin.firestore()
      .collection('games')
      .where('gameCode', '==', gameCode)
      .get();

    if (gamesQuerySnapshot.empty) {
      console.error('❌ Juego no encontrado');
      throw new Error('Game not found');
    }

    const gameDoc = gamesQuerySnapshot.docs[0];
    const gameData = gameDoc.data();

    if (gameData.playerCount >= gameData.maxPlayers) {
      console.error('❌ Juego lleno');
      throw new Error('Game is full');
    }

    // Añadir userId a la lista de jugadores
    await gameDoc.ref.update({
      players: admin.firestore.FieldValue.arrayUnion(userId),
      playerCount: gameData.playerCount + 1,
    });

    // Actualizar datos del usuario
    await admin.firestore().collection('users').doc(userId).update({
      [`games.${gameDoc.id}`]: {
        rockCoins: 600,
        waste: 0,
        selectedIndustry: null,
      },
    });

    console.log(`✅ Usuario ${userId} unido al juego ${gameDoc.id}`);
    return { success: true, gameId: gameDoc.id, productList: gameData.productList };
  } catch (error) {
    console.error('❌ Error al unirse al juego:', error);
    throw new Error('Failed to join the game');
  }
});
