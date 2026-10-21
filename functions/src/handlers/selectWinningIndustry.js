const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp();
}

// Función auxiliar para esperar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para intentar la operación con retry
async function retryOperation(operation, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Si es un error de cuota (429) y no es el último intento
      if (error.code === 429 && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`⚠️ Error de cuota detectado. Reintentando en ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      // Si no es un error de cuota o es el último intento, lanzamos el error
      throw error;
    }
  }
  
  throw lastError;
}

const selectWinningIndustry = async ({ gameId }) => {
  console.log(`🔄 selectWinningIndustry llamado con gameId: ${gameId}`);

  if (!gameId) {
    console.error('❌ No se proporcionó gameId');
    throw new Error('Game ID is required.');
  }

  const db = getFirestore();
  const gameRef = db.collection('games').doc(gameId);

  try {
    // Verificar que el juego existe con retry
    const gameDoc = await retryOperation(async () => {
      return await gameRef.get();
    });

    if (!gameDoc.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found.');
    }

    // Seleccionar una industria aleatoria (mismas que en el frontend)
    const industries = ['Construction', 'Technology', 'Healthcare', 'Energy'];
    const winningIndustry = industries[Math.floor(Math.random() * industries.length)];
    console.log(`🎯 Industria ganadora seleccionada: ${winningIndustry}`);

    // Actualizar el documento del juego con la industria ganadora usando retry
    await retryOperation(async () => {
      await gameRef.update({
        winningIndustry
      });
    });

    console.log('✅ Industria ganadora actualizada exitosamente');
    return { 
      success: true, 
      message: 'Winning industry selected successfully.',
      winningIndustry 
    };
  } catch (error) {
    console.error('❌ Error en selectWinningIndustry:', error);
    throw new Error('Failed to select winning industry.');
  }
};

module.exports = { selectWinningIndustry }; 