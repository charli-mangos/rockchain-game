const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Inicializa Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.deleteGame = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  const userId = request.auth?.uid;

  if (!userId) {
    console.error('❌ No se proporcionó userId');
    throw new Error('Authentication required');
  }

  try {
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

    console.log('✅ Datos del juego eliminados exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error eliminando datos del juego:', error);
    throw new Error('Failed to clear game data.');
  }
});