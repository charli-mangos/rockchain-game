const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { selectWinningIndustry } = require('./selectWinningIndustry');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.startGame = onCall({
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80,
  retry: false,
  ingressSettings: 'ALLOW_ALL'
}, async (request) => {
  // Verificar autenticación
  if (!request.auth) {
    console.error('❌ No se proporcionó autenticación');
    throw new Error('Authentication required');
  }

  const userId = request.auth.uid;
  const { gameId } = request.data;
  console.log(`🔄 startGame llamado con gameId: ${gameId} por usuario: ${userId}`);

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required.');
  }

  if (typeof gameId !== 'string' || !gameId.trim()) {
    console.error('❌ gameId no es una cadena válida');
    throw new Error('Game ID must be a valid string.');
  }

  const gameRef = admin.firestore().collection('games').doc(gameId);

  try {
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found.');
    }

    const gameData = gameDoc.data();

    // Verificar que el usuario es el host del juego
    if (gameData.hostId !== userId) {
      console.error(`❌ Usuario ${userId} no es el host del juego ${gameId}`);
      throw new Error('Only the game host can start the game.');
    }

    if (gameData.status !== 'waiting') {
      console.error(`❌ El juego no puede iniciarse. Estado actual: ${gameData.status}`);
      throw new Error('Game is already started or finished.');
    }

    // Inicializar blockchain/gameId con el número total de jugadores
    await admin.firestore().collection('blockchain').doc(gameId).set({
      totalPlayers: gameData.players.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Seleccionar la industria ganadora inicial
    await selectWinningIndustry({ gameId });
    console.log('✅ Industria ganadora inicial seleccionada');

    // Programar el inicio del juego en 3 segundos
    const roundStartTime = new Date(Date.now() + 3000);
    
    // Actualizar el estado del juego a "starting"
    await gameRef.update({
      status: 'starting',
      roundTime: admin.firestore.Timestamp.fromDate(roundStartTime),
      round: 1
    });

    console.log(`✅ Juego iniciado exitosamente: ${gameId}`);
    return { success: true, message: 'Game started successfully.' };
  } catch (error) {
    console.error('❌ Error al iniciar el juego:', error);
    throw new Error('Failed to start the game.');
  }
});