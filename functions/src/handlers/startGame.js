const { onCall } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAuth, requireId } = require('../utils/auth');
const { selectWinningIndustry } = require('./selectWinningIndustry');

if (!getApps().length) {
  initializeApp();
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
  const userId = requireAuth(request);
  const { gameId } = request.data || {};
  requireId(gameId, 'gameId');
  console.log(`🔄 startGame llamado con gameId: ${gameId} por usuario: ${userId}`);

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required.');
  }

  if (typeof gameId !== 'string' || !gameId.trim()) {
    console.error('❌ gameId no es una cadena válida');
    throw new Error('Game ID must be a valid string.');
  }

  const gameRef = getFirestore().collection('games').doc(gameId);

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

    // Verificar que hay al menos 2 jugadores para iniciar el juego
    const playerCount = gameData.playerCount || 0;
    if (playerCount < 2) {
      console.error(`❌ No se puede iniciar el juego con menos de 2 jugadores. Jugadores actuales: ${playerCount}`);
      throw new Error('Se necesitan al menos 2 jugadores para iniciar el juego.');
    }

    // Inicializar blockchain/gameId con el número total de jugadores
    await getFirestore().collection('blockchain').doc(gameId).set({
      totalPlayers: gameData.players.length,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Seleccionar industria ganadora para la primera ronda
    console.log('🔄 Seleccionando industria ganadora para la primera ronda...');
    try {
      const winningIndustryResult = await selectWinningIndustry({ gameId });
      console.log('✅ Industria ganadora seleccionada:', winningIndustryResult);
    } catch (error) {
      console.error('❌ Error al seleccionar industria ganadora:', error);
      throw new Error('Failed to select winning industry');
    }

    // Establecer solo status: "starting" - NO roundTime (habrá fase de preparación)
    console.log(`⏰ Configurando estado starting sin roundTime`);
    console.log(`⏰ Habrá fase de preparación antes del countdown de 3 segundos`);
    
    // Actualizar el estado del juego a "starting" (solo transición)
    await gameRef.update({
      status: 'starting',
      round: 1,
      rewardsAssigned: false,
      roundRewards: null
    });

    console.log(`✅ Juego iniciado exitosamente: ${gameId}`);
    console.log(`✅ Estado actualizado a: starting (sin roundTime)`);
    console.log(`✅ WaitingRoomScreen mostrará "Preparing game..."`);
    console.log(`✅ Después se llamará a roundTimer() para preparar todo`);
    console.log(`✅ Luego se establecerá roundTime y countdown de 3s`);
    
    return { success: true, message: 'Game started successfully.' };
  } catch (error) {
    console.error('❌ Error al iniciar el juego:', error);
    throw new Error('Failed to start the game.');
  }
});