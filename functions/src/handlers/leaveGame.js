const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.leaveGame = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  console.log('🚪 leaveGame iniciado');
  console.log('📥 Datos recibidos:', JSON.stringify(request.data, null, 2));
  
  // Extraer datos de la petición
  const { gameId } = request.data || {};
  const userId = request.auth?.uid;

  console.log(`🎯 Jugador ${userId} saliendo del juego ${gameId}`);

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
    const batch = db.batch();

    // 1. VERIFICAR QUE EL JUEGO EXISTE
    console.log(`🔍 Verificando juego: ${gameId}`);
    const gameRef = db.collection('games').doc(gameId);
    const gameSnapshot = await gameRef.get();
    
    if (!gameSnapshot || !gameSnapshot.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found');
    }

    const gameData = gameSnapshot.data();
    console.log(`📝 Datos del juego:`, gameData);

    // 2. VERIFICAR QUE EL JUGADOR ESTÁ EN EL JUEGO
    if (!gameData.players || !gameData.players.includes(userId)) {
      console.error(`❌ Jugador ${userId} no está en el juego ${gameId}`);
      throw new Error('Player not in game');
    }

    // 3. ACTUALIZAR EL JUEGO - REMOVER JUGADOR
    console.log(`🔄 Removiendo jugador ${userId} del juego ${gameId}`);
    
    const updatedPlayers = gameData.players.filter(playerId => playerId !== userId);
    const newPlayerCount = updatedPlayers.length;
    
    // Si era el host, asignar nuevo host
    let newHostId = gameData.hostId;
    if (gameData.hostId === userId && updatedPlayers.length > 0) {
      newHostId = updatedPlayers[0];
      console.log(`👑 Nuevo host asignado: ${newHostId}`);
    }

    // Actualizar el documento del juego
    batch.update(gameRef, {
      players: updatedPlayers,
      playerCount: newPlayerCount,
      hostId: newHostId,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. ELIMINAR DATOS DEL JUGADOR EN EL JUEGO
    console.log(`🗑️ Eliminando datos del jugador en el juego`);
    
    // Eliminar subcolección del usuario en el juego
    const userGameRef = db.collection('users').doc(userId).collection('games').doc(gameId);
    batch.delete(userGameRef);

    // 5. ELIMINAR DATOS DEL JUEGO EN EL USUARIO
    console.log(`🗑️ Eliminando datos del juego en el usuario`);
    
    // Eliminar datos del juego en el perfil del usuario
    const userRef = db.collection('users').doc(userId);
    const userSnapshot = await userRef.get();
    
    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      if (userData.gameData && userData.gameData.gameId === gameId) {
        // Limpiar gameData del usuario
        batch.update(userRef, {
          gameData: null,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Datos del juego eliminados del perfil del usuario`);
      }
    }

    // 6. SI ES EL ÚLTIMO JUGADOR, ELIMINAR EL JUEGO COMPLETAMENTE
    if (newPlayerCount === 0) {
      console.log(`🗑️ Último jugador saliendo, eliminando juego ${gameId}`);
      
      // Eliminar el juego completo
      batch.delete(gameRef);
      
      // Eliminar subcolecciones del juego (rounds, etc.)
      const roundsRef = db.collection('games').doc(gameId).collection('rounds');
      const roundsSnapshot = await roundsRef.get();
      roundsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      console.log(`✅ Juego ${gameId} eliminado completamente`);
    }

    // 7. EJECUTAR BATCH
    await batch.commit();
    console.log(`✅ Batch ejecutado exitosamente`);

    // 8. PREPARAR RESPUESTA
    const response = {
      success: true,
      message: 'Player left game successfully',
      gameId: gameId,
      remainingPlayers: newPlayerCount,
      gameDeleted: newPlayerCount === 0
    };

    console.log(`✅ Jugador ${userId} salió del juego ${gameId} exitosamente`);
    console.log(`📤 Respuesta:`, JSON.stringify(response, null, 2));

    return response;

  } catch (error) {
    console.error('❌ Error en leaveGame:', error);
    
    // Mensajes de error específicos
    if (error.message.includes('Game not found')) {
      throw new Error('Game not found. The game may have been deleted.');
    } else if (error.message.includes('Player not in game')) {
      throw new Error('Player is not in this game.');
    } else if (error.message.includes('Game ID is required')) {
      throw new Error('Game ID is required.');
    } else {
      console.error('❌ Error no manejado:', error);
      throw new Error('Failed to leave game. Please try again.');
    }
  }
});
