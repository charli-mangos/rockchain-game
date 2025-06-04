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
    // Eliminar cualquier juego existente para este usuario
    const db = admin.firestore();
    const batch = db.batch();

    // Eliminar todos los documentos en la colección "games"
    const gamesSnapshot = await db.collection('games').get();
    gamesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Eliminar todos los documentos en la colección "market"
    const marketSnapshot = await db.collection('market').get();
    marketSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Eliminar todos los documentos en la colección "blockchain"
    const blockchainSnapshot = await db.collection('blockchain').get();
    blockchainSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Ejecutar el batch
    await batch.commit();
    console.log('✅ Datos de juegos anteriores eliminados');

    // Crear nuevo juego
    const gameRef = await db.collection('games').add(gameData);
    console.log('✅ Juego creado con ID:', gameRef.id);

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
