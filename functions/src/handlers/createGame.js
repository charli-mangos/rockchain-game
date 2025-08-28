const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { assignProductsToGame } = require('./assignProductsToGame');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.createGame = onCall({
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80,
  retry: false,
  ingressSettings: 'ALLOW_ALL'
}, async (request) => {
  const userId = request.auth?.uid;
  const gameCode = generateGameCode();

  if (!userId) {
    console.error('❌ User ID is missing');
    throw new Error('User ID is required.');
  }

  const gameData = {
    gameCode: gameCode,
    players: [userId],
    playerCount: 1,
    maxPlayers: 5,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'waiting',
    version: '1.0.0',
    hostId: userId,
    productList: [],
    round: 0
  };

  try {
    // Eliminar juegos existentes solo para este usuario
    const db = admin.firestore();
    const batch = db.batch();

    // Buscar juegos donde este usuario es el host
    const userGamesSnapshot = await db.collection('games')
      .where('hostId', '==', userId)
      .get();
    
    // Eliminar juegos donde el usuario es host
    userGamesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Buscar y eliminar datos de blockchain para juegos del usuario
    const userBlockchainSnapshot = await db.collection('blockchain')
      .where('hostId', '==', userId)
      .get();
    
    userBlockchainSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Buscar y eliminar productos de market para juegos del usuario
    const userMarketSnapshot = await db.collection('market')
      .where('hostId', '==', userId)
      .get();
    
    userMarketSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Ejecutar el batch
    await batch.commit();
    console.log(`✅ Datos de juegos anteriores del usuario ${userId} eliminados`);

    // Crear nuevo juego
    const gameRef = await db.collection('games').add(gameData);
    console.log('✅ Juego creado con ID:', gameRef.id);

    // Verificar si existen productos globales, si no, generarlos
    const productsRef = db.collection('products');
    const productsSnapshot = await productsRef.limit(1).get();
    
    if (productsSnapshot.empty) {
      console.log('⚠️ No se encontraron productos globales, generándolos...');
      const { generateProductsInternal } = require('./generateGlobalProducts');
      await generateProductsInternal();
      console.log('✅ Productos globales generados');
    } else {
      console.log('✅ Productos globales encontrados');
    }

    // Asignar productos al juego
    await assignProductsToGame({ gameId: gameRef.id, round: 1 });
    console.log('✅ Productos asignados al juego');

    // Actualizar datos del usuario
    await db.collection('users').doc(userId).update({
      [`games.${gameRef.id}`]: {
        rockCoins: 600,
        waste: 0,
        selectedIndustry: null,
        products: [],
        gameCode: gameCode,
        status: 'waiting',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    console.log('✅ Datos del usuario actualizados');
    return {
      success: true,
      gameId: gameRef.id,
      gameCode: gameCode
    };
  } catch (error) {
    console.error('❌ Error al crear el juego:', error);
    throw new Error(`Failed to create game: ${error.message}`);
  }
});

function generateGameCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}
