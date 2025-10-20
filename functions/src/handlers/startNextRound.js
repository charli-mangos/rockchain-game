const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { updateProductPrices } = require('./updateProductPrices');
const { selectWinningIndustry } = require('./selectWinningIndustry');
const { assignProductsToGame } = require('./assignProductsToGame');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.startNextRound = onCall({
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80,
  retry: false,
  ingressSettings: 'ALLOW_ALL'
}, async (request) => {
  console.log('🔄 startNextRound iniciado');
  console.log('📥 Datos recibidos:', JSON.stringify(request.data, null, 2));
  
  // Extraer datos de la petición
  const { gameId } = request.data || {};
  const userId = request.auth?.uid;

  console.log(`🎯 Iniciando siguiente ronda para juego ${gameId} por usuario ${userId}`);

  // Validaciones básicas
  if (!userId) {
    console.error('❌ Usuario no autenticado');
    throw new Error('Authentication required');
  }

  if (!gameId || gameId.trim() === '') {
    console.error('❌ Game ID requerido');
    throw new Error('Game ID is required');
  }

  try {
    const db = admin.firestore();
    const gameRef = db.collection('games').doc(gameId);

    // 1. VERIFICAR QUE EL JUEGO EXISTE Y OBTENER DATOS ACTUALES
    console.log(`🔍 Verificando juego: ${gameId}`);
    const gameDoc = await gameRef.get();
    
    if (!gameDoc || !gameDoc.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found');
    }

    const gameData = gameDoc.data();
    console.log(`📝 Datos del juego:`, gameData);
    console.log(`🔍 Estado actual del juego: ${gameData.status}`);
    console.log(`🔍 Ronda actual del juego: ${gameData.round}`);
    console.log(`🔍 Host ID: ${gameData.hostId}`);

    // 2. VERIFICAR QUE EL USUARIO ES EL HOST
    if (gameData.hostId !== userId) {
      console.error(`❌ Usuario ${userId} no es el host del juego ${gameId}`);
      throw new Error('Only the game host can start the next round');
    }

    // 3. VERIFICAR ESTADO ACTUAL DEL JUEGO
    const allowedStates = ['waiting_for_players', 'roundEnd', 'waitingForNextRound', 'WAITING_FOR_NEXT_ROUND'];
    if (!allowedStates.includes(gameData.status)) {
      console.error(`❌ El juego no está en un estado válido para iniciar siguiente ronda. Estado actual: ${gameData.status}`);
      throw new Error(`Game is not in a valid state to start next round. Current state: ${gameData.status}`);
    }

    // 4. CALCULAR SIGUIENTE RONDA
    const currentRound = gameData.round || 1;
    const nextRound = currentRound + 1;
    
    console.log(`🎮 Transicionando de ronda ${currentRound} a ronda ${nextRound}`);

    // 5. VERIFICAR LÍMITE DE RONDAS (3 rondas máximo)
    if (nextRound > 3) {
      console.log(`🏁 Juego completado después de ${currentRound} rondas`);
      throw new Error('Game completed after 3 rounds');
    }

    // 6. ACTUALIZAR PRECIOS DE PRODUCTOS PARA LA NUEVA RONDA
    console.log(`🔄 Actualizando precios para ronda ${nextRound}...`);
    try {
      await updateProductPrices({ gameId, round: nextRound });
      console.log('✅ Precios actualizados');
    } catch (error) {
      console.error('❌ Error al actualizar precios:', error);
      throw new Error('Failed to update product prices');
    }

    // 7. SELECCIONAR INDUSTRIA GANADORA PARA LA NUEVA RONDA
    console.log('🔄 Seleccionando industria ganadora...');
    try {
      await selectWinningIndustry({ gameId });
      console.log('✅ Industria ganadora seleccionada');
    } catch (error) {
      console.error('❌ Error al seleccionar industria ganadora:', error);
      throw new Error('Failed to select winning industry');
    }

    // 8. ASIGNAR PRODUCTOS AL JUEGO PARA LA NUEVA RONDA
    console.log(`🔄 Asignando productos para ronda ${nextRound}...`);
    try {
      await assignProductsToGame({ gameId, round: nextRound });
      console.log('✅ Productos asignados');
    } catch (error) {
      console.error('❌ Error al asignar productos:', error);
      throw new Error('Failed to assign products');
    }

    // 9. ACTUALIZAR ESTADO DEL JUEGO A "starting" PARA LA NUEVA RONDA
    console.log('🔄 Actualizando estado del juego a "starting"...');
    await gameRef.update({
      status: 'starting',
      round: nextRound,
      rewardsAssigned: false,
      roundRewards: null,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Ronda ${nextRound} iniciada exitosamente`);
    console.log(`✅ Estado actualizado a: starting`);
    console.log(`✅ Precios y productos actualizados para ronda ${nextRound}`);

    // 10. PREPARAR RESPUESTA CON DATOS COMPLETOS
    const response = {
      success: true,
      message: `Round ${nextRound} started successfully`,
      gameId: gameId,
      round: nextRound,
      status: 'starting',
      data: {
        round: nextRound,
        status: 'starting',
        marketUpdated: true,
        productsAssigned: true,
        winningIndustrySelected: true
      }
    };

    console.log(`✅ startNextRound completado exitosamente`);
    console.log(`📤 Respuesta:`, JSON.stringify(response, null, 2));

    return response;

  } catch (error) {
    console.error('❌ Error en startNextRound:', error);
    
    // Mensajes de error específicos
    if (error.message.includes('Game not found')) {
      throw new Error('Game not found. The game may have been deleted.');
    } else if (error.message.includes('Only the game host can start')) {
      throw new Error('Only the game host can start the next round.');
    } else if (error.message.includes('Game is not in waiting_for_players state')) {
      throw new Error('Game is not ready for the next round.');
    } else if (error.message.includes('Game completed after 3 rounds')) {
      throw new Error('Game completed after 3 rounds.');
    } else if (error.message.includes('Failed to update product prices')) {
      throw new Error('Failed to update product prices for the next round.');
    } else if (error.message.includes('Failed to select winning industry')) {
      throw new Error('Failed to select winning industry for the next round.');
    } else if (error.message.includes('Failed to assign products')) {
      throw new Error('Failed to assign products for the next round.');
    } else {
      console.error('❌ Error no manejado:', error);
      throw new Error('Failed to start next round. Please try again.');
    }
  }
});
