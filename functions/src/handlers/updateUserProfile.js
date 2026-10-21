const { onCall } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { requireAuth, sanitizeUserName, sanitizeImageUrl } = require('../utils/auth');

if (!getApps().length) {
  initializeApp();
}

exports.updateUserProfile = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  console.log('🔄 updateUserProfile iniciado');
  console.log('📥 Datos recibidos:', JSON.stringify(request.data, null, 2));
  
  // Extraer datos de la petición
  const { userName, imageUrl } = request.data || {};
  const userId = requireAuth(request);

  console.log(`🎯 Actualizando perfil del usuario ${userId}`);

  // Validaciones básicas
  const cleanUserName = sanitizeUserName(userName);
  const cleanImageUrl = sanitizeImageUrl(imageUrl);

  try {
    // 1. VERIFICAR QUE EL USUARIO EXISTE
    console.log(`🔍 Verificando usuario: ${userId}`);
    const userRef = getFirestore().collection('users').doc(userId);
    const userSnapshot = await userRef.get();
    
    if (!userSnapshot || !userSnapshot.exists) {
      console.error(`❌ Usuario no encontrado: ${userId}`);
      throw new Error('User not found');
    }

    // 2. ACTUALIZAR DATOS DEL USUARIO
    console.log(`🔄 Actualizando perfil del usuario ${userId}`);
    
    const updateData = {
      userName: cleanUserName,
      lastUpdated: FieldValue.serverTimestamp()
    };

    // Solo agregar imageUrl si se proporciona
    if (cleanImageUrl) {
      updateData.imageUrl = cleanImageUrl;
    }

    await userRef.update(updateData);
    console.log(`✅ Perfil del usuario actualizado en Firestore`);

    // 3. ACTUALIZAR DATOS DEL USUARIO EN TODOS LOS JUEGOS ACTIVOS
    console.log(`🔄 Actualizando datos del usuario en todos los juegos activos...`);
    
    try {
      // Obtener todos los juegos donde participa el usuario
      const gamesQuery = await getFirestore()
        .collection('games')
        .where('players', 'array-contains', userId)
        .get();

      const batch = getFirestore().batch();
      let gamesUpdated = 0;

      for (const gameDoc of gamesQuery.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        
        // Actualizar el array de players con el nuevo userName
        const updatedPlayers = gameData.players.map(playerId => {
          if (playerId === userId) {
            return userId; // Mantener el userId, el userName se actualiza en el contexto
          }
          return playerId;
        });

        // Actualizar el documento del juego
        const gameRef = getFirestore().collection('games').doc(gameId);
        batch.update(gameRef, {
          lastUpdated: FieldValue.serverTimestamp()
        });

        // Actualizar datos del usuario en el juego específico
        const userGameRef = getFirestore()
          .collection('users')
          .doc(userId)
          .collection('games')
          .doc(gameId);
        
        batch.set(userGameRef, {
          userName: cleanUserName,
          imageUrl: cleanImageUrl,
          lastUpdated: FieldValue.serverTimestamp()
        }, { merge: true });

        gamesUpdated++;
        console.log(`✅ Datos actualizados para juego ${gameId}`);
      }

      await batch.commit();
      console.log(`✅ Datos del usuario actualizados en ${gamesUpdated} juegos`);

    } catch (updateError) {
      console.error(`⚠️ Error actualizando datos en juegos:`, updateError);
      // No fallar la operación principal si hay error en la actualización de juegos
    }

    // 4. PREPARAR RESPUESTA
    const response = {
      success: true,
      message: 'User profile updated successfully',
      userName: cleanUserName,
      imageUrl: cleanImageUrl
    };

    console.log(`✅ Perfil del usuario ${userId} actualizado exitosamente`);
    console.log(`📤 Respuesta:`, JSON.stringify(response, null, 2));

    return response;

  } catch (error) {
    console.error('❌ Error en updateUserProfile:', error);
    
    // Mensajes de error específicos
    if (error.message.includes('User not found')) {
      throw new Error('User not found. Please try logging in again.');
    } else if (error.message.includes('User name is required')) {
      throw new Error('User name is required.');
    } else {
      console.error('❌ Error no manejado:', error);
      throw new Error('Failed to update user profile. Please try again.');
    }
  }
});
