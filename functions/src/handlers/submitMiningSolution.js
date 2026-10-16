const { onCall } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const { requireAuth, requireId, assertParticipant } = require('../utils/auth');
const { evaluateRound } = require('./evaluateRound');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.submitMiningSolution = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  // Log para depuración
  console.log('🔄 Request data recibida:', request.data);
  
  // isCorrect ya no se acepta del cliente: el resultado se calcula en el servidor
  const { gameId, blockId, response, responseTime, timestamp } = request.data || {};
  const userId = requireAuth(request);
  requireId(gameId, 'gameId');
  requireId(blockId, 'blockId');

  console.log('📊 Datos extraídos:', { gameId, blockId, response, responseTime, userId, timestamp });

  // Validación de parámetros
  if (!userId) {
    console.error('❌ No se proporcionó userId');
    throw new Error('Authentication required');
  }

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required');
  }

  if (!blockId) {
    console.error('❌ No se proporcionó blockId');
    throw new Error('Block ID is required');
  }

  if (response === undefined) {
    console.error('❌ No se proporcionó response');
    throw new Error('Response is required');
  }

  const db = admin.firestore();
  const batch = db.batch();

  try {
    // Verificar que el juego existe en 'blockchain'
    console.log('🔍 Verificando existencia del juego en blockchain:', gameId);
    const gameRef = db.collection('blockchain').doc(gameId);
    const gameDoc = await gameRef.get();
    
    if (!gameDoc.exists) {
      console.error('❌ Juego no encontrado en colección blockchain:', gameId);
      throw new Error('Game not found');
    }

    // Verificar que el bloque existe en 'blockchain/{gameId}/blocks/{blockId}'
    console.log('🔍 Buscando bloque:', blockId);
    const blockRef = db.collection('blockchain').doc(gameId).collection('blocks').doc(blockId);
    const blockDoc = await blockRef.get();
    
    if (!blockDoc.exists) {
      console.error('❌ Bloque no encontrado:', blockId);
      throw new Error('Block not found');
    }

    const blockData = blockDoc.data();
    console.log('📄 Datos del bloque:', blockData);

    if (!blockData || !blockData.activeProblem) {
      console.error('❌ No hay problema activo en el bloque:', blockId);
      throw new Error('No active problem found in block');
    }

    // --- NUEVO: Inicializar responses si no existe ---
    if (!Array.isArray(blockData.responses)) {
      console.log('🛠️ Inicializando campo responses como array vacío');
      await blockRef.update({ responses: [] });
      blockData.responses = [];
    }
    // --- FIN NUEVO ---

    // Verificar si el usuario ya ha respondido
    const existingResponses = blockData.responses || [];
    const hasUserResponded = existingResponses.some(r => r.userId === userId);
    if (hasUserResponded) {
      console.error('❌ Usuario ya ha respondido:', userId);
      throw new Error('User has already submitted a response');
    }

    const { activeProblem } = blockData;
    const userResponse = parseFloat(response);
    const correctAnswer = parseFloat(activeProblem.solution);

    if (isNaN(userResponse)) {
      console.error('❌ Respuesta inválida:', response);
      throw new Error('Invalid response format');
    }

    const isWinner = userResponse === correctAnswer;
    console.log('✅ Verificación de respuesta:', {
      userResponse,
      correctAnswer,
      isWinner
    });

    const responseData = {
      userId,
      response: userResponse,
      responseTime,
      isWinner,
      timestamp: timestamp || Date.now()
    };

    // Actualiza las respuestas en el bloque
    console.log('📝 Añadiendo respuesta al bloque');
    batch.update(blockRef, {
      responses: admin.firestore.FieldValue.arrayUnion(responseData)
    });

    // Obtener el número total de jugadores
    console.log('👥 Obteniendo número total de jugadores');
    // Puede estar en totalPlayers o en players.length
    const gameData = gameDoc.data();
    let totalPlayers = 0;
    if (Array.isArray(gameData.players)) {
      totalPlayers = gameData.players.length;
    } else if (typeof gameData.totalPlayers === 'number') {
      totalPlayers = gameData.totalPlayers;
    }
    if (!totalPlayers) totalPlayers = 1;
    
    // Si todos los jugadores han respondido o hay un ganador, marcar como no activo
    if (isWinner || existingResponses.length + 1 >= totalPlayers) {
      console.log('🏁 Marcando bloque como completado');
      batch.update(blockRef, {
        winner: isWinner ? {
          userId,
          responseTime,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        } : null,
        isActive: false,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // NUEVO: Verificar si todos los bloques de la ronda están completados
      console.log('🔍 Verificando si todos los bloques de la ronda están completados...');
      try {
        const blocksRef = db.collection('blockchain').doc(gameId).collection('blocks');
        const blocksSnapshot = await blocksRef
          .where('round', '==', blockData.round)
          .get();
        
        const roundBlocks = blocksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log(`📊 Bloques de la ronda ${blockData.round}: ${roundBlocks.length}`);
        console.log(`📋 Estado de bloques:`, roundBlocks.map(b => ({
          id: b.id,
          isActive: b.isActive,
          hasWinner: !!b.winner,
          completedAt: b.completedAt
        })));
        
        // Verificar si todos los bloques de la ronda están completados
        const completedBlocks = roundBlocks.filter(block => 
          block.isActive === false || block.winner || block.completedAt
        );
        
        const allBlocksCompleted = completedBlocks.length === roundBlocks.length;
        
        console.log(`🏁 Bloques completados: ${completedBlocks.length}/${roundBlocks.length}`);
        console.log(`🏁 Todos los bloques completados: ${allBlocksCompleted}`);
        
        if (allBlocksCompleted && roundBlocks.length > 0) {
          console.log('🎯 TODOS LOS BLOQUES DE LA RONDA COMPLETADOS - Llamando a evaluateRound');
          
          // Llamar a evaluateRound para finalizar la ronda de manera más robusta
          try {
            const evaluateResult = await evaluateRound({ gameId });
            console.log('✅ evaluateRound resultado:', evaluateResult);
          } catch (error) {
            console.error('❌ Error llamando a evaluateRound:', error);
            // Si falla evaluateRound, usar la lógica anterior como respaldo
            console.log('🔄 Usando lógica de respaldo para finalizar ronda');
            
            // Usar una transacción para evitar conflictos
            await db.runTransaction(async (transaction) => {
              const gameDoc = await transaction.get(gameRef);
              if (!gameDoc.exists) {
                throw new Error('Game not found during end round transaction');
              }
              
              const currentGameData = gameDoc.data();
              const currentStatus = currentGameData.status;
              
              console.log(`🎮 Estado actual del juego: ${currentStatus}, ronda: ${currentGameData.round}`);
              
              // Solo terminar la ronda si está en progreso
              if (currentStatus === 'in_progress' || currentStatus === 'playing') {
                console.log(`🏁 Actualizando estado del juego a waiting_for_players`);
                
                // NUEVO: Asegurar que tenemos un winningIndustry
                let winningIndustry = currentGameData.winningIndustry;
                if (!winningIndustry) {
                  console.log(`⚠️ No hay winningIndustry, seleccionando uno por defecto`);
                  // Seleccionar industria por defecto si no hay una
                  const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
                  winningIndustry = industries[Math.floor(Math.random() * industries.length)];
                }
                
                transaction.update(gameRef, {
                  status: 'waiting_for_players',
                  rewardsAssigned: false,
                  roundRewards: null,
                  winningIndustry: winningIndustry,
                  roundEndTime: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`✅ Ronda ${currentGameData.round} terminada automáticamente`);
                console.log(`🏆 Winning Industry: ${winningIndustry}`);
              } else {
                console.log(`⚠️ Juego no está en progreso: ${currentStatus}`);
              }
            });
          }
        } else {
          console.log(`⏳ Esperando a que se completen más bloques (${completedBlocks.length}/${roundBlocks.length})`);
        }
      } catch (error) {
        console.error('❌ Error verificando finalización de ronda:', error);
        // No fallar la respuesta del usuario por este error
      }
    }

    // Ejecutar todas las actualizaciones en una sola transacción
    console.log('💾 Ejecutando actualizaciones en batch');
    await batch.commit();

    console.log('✅ Respuesta procesada exitosamente');
    return { 
      success: true, 
      responseData,
      isWinner,
      responsesCount: existingResponses.length + 1,
      totalPlayers
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('❌ Error procesando respuesta:', {
      error,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      stack: error.stack
    });
    throw new Error(`Failed to process response: ${error.message}`);
  }
});
