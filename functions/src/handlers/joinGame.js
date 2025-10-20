const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.joinGame = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  console.log('🔄 joinGame iniciado');
  console.log('📥 Datos recibidos:', JSON.stringify(request.data, null, 2));
  
  // Extraer datos de la petición
  const { gameId } = request.data || {};
  const userId = request.auth?.uid;

  console.log(`🎯 Intentando unir usuario ${userId} al juego ${gameId}`);

  // Validaciones básicas
  if (!userId) {
    console.error('❌ Usuario no autenticado');
    throw new Error('Authentication required');
  }

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required');
  }

  try {
    // 1. VERIFICAR QUE EL JUEGO EXISTE
    console.log(`🔍 Verificando existencia del juego: ${gameId}`);
    
    const gameRef = admin.firestore().collection('games').doc(gameId);
    const gameSnapshot = await gameRef.get();
    
    // Verificar existencia de forma segura
    if (!gameSnapshot || !gameSnapshot.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found. Please check the code and try again.');
    }

    const gameData = gameSnapshot.data();
    console.log(`✅ Juego encontrado: ${gameId}`);
    console.log(`📊 Estado: ${gameData.status}, Jugadores: ${gameData.playerCount}/${gameData.maxPlayers}`);

    // 2. VERIFICAR ESTADO DEL JUEGO
    if (gameData.status !== 'waiting') {
      console.error(`❌ Juego no está en estado waiting: ${gameData.status}`);
      throw new Error('Game is not accepting new players');
    }

    // 3. VERIFICAR SI HAY ESPACIO
    const currentPlayers = gameData.playerCount || 0;
    const maxPlayers = gameData.maxPlayers || 4;
    
    if (currentPlayers >= maxPlayers) {
      console.error(`❌ Juego lleno: ${currentPlayers}/${maxPlayers}`);
      throw new Error('No caben más jugadores en esta sala. La sala está llena.');
    }

    // 4. VERIFICAR SI EL USUARIO YA ESTÁ EN EL JUEGO
    const players = gameData.players || [];
    if (players.includes(userId)) {
      console.log(`✅ Usuario ya está en el juego`);
      return {
        success: true,
        gameId: gameId,
        message: 'Already in game',
        productList: gameData.productList || []
      };
    }

    // 5. VERIFICAR QUE EL USUARIO EXISTE
    console.log(`🔍 Verificando usuario: ${userId}`);
    const userRef = admin.firestore().collection('users').doc(userId);
    const userSnapshot = await userRef.get();
    
    if (!userSnapshot || !userSnapshot.exists) {
      console.error(`❌ Usuario no encontrado: ${userId}`);
      throw new Error('User not found');
    }

    // 6. ACTUALIZAR EL JUEGO (AÑADIR JUGADOR)
    console.log(`🔄 Añadiendo usuario ${userId} al juego ${gameId}`);
    
    const gameUpdate = {
      players: admin.firestore.FieldValue.arrayUnion(userId),
      playerCount: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    await gameRef.update(gameUpdate);
    console.log(`✅ Juego actualizado`);

    // 7. ACTUALIZAR DATOS DEL USUARIO
    console.log(`🔄 Actualizando datos del usuario ${userId}`);
    
    const userGameData = {
      rockCoins: 600,
      waste: 0,
      selectedIndustry: null,
      gameCode: gameData.gameCode,
      status: 'waiting',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    const userUpdate = {
      [`games.${gameId}`]: userGameData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
      await userRef.update(userUpdate);
      console.log(`✅ Datos del usuario actualizados`);
    } catch (userUpdateError) {
      console.error(`⚠️ Error actualizando usuario:`, userUpdateError);
      // No fallar si no se puede actualizar el usuario
    }

    // 8. PREPARAR RESPUESTA
    const response = {
      success: true,
      gameId: gameId,
      gameCode: gameData.gameCode,
      productList: gameData.productList || [],
      message: 'Successfully joined game',
      playerCount: currentPlayers + 1,
      maxPlayers: maxPlayers
    };

    console.log(`✅ Usuario ${userId} unido exitosamente al juego ${gameId}`);
    console.log(`📤 Respuesta:`, JSON.stringify(response, null, 2));

    return response;

  } catch (error) {
    console.error('❌ Error en joinGame:', error);
    
    // Mensajes de error específicos
    if (error.message.includes('Game not found')) {
      throw new Error('Game not found. Please check the code and try again.');
    } else if (error.message.includes('Game is full') || error.message.includes('No caben más jugadores')) {
      throw new Error('No caben más jugadores en esta sala. La sala está llena.');
    } else if (error.message.includes('not accepting new players')) {
      throw new Error('Game has already started. Please try another game.');
    } else if (error.message.includes('User not found')) {
      throw new Error('User not found. Please try logging in again.');
    } else {
      console.error('❌ Error no manejado:', error);
      throw new Error('Failed to join the game. Please try again.');
    }
  }
});
