const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { assignProductsToGame } = require('./assignProductsToGame');

if (!admin.apps.length) {
  admin.initializeApp();
}

const maxPrice = 200;
const minPrice = 80;
const maxWaste = 70;
const minWaste = 30;

// Función para generar un precio base aleatorio para cada tipo de mármol
const getRandomBasePrice = () => Math.floor(Math.random() * (maxPrice - minPrice + 1)) + minPrice;
const getBaseTrash = () => Math.floor(Math.random() * (maxWaste - minWaste + 1)) + minWaste;
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];

// Generar calidad aleatoria
const getRandomQuality = () => {
  const qualities = ['A', 'B', 'C'];
  return getRandomElement(qualities);
};

const updateProductPrices = async ({ gameId, round }) => {
  console.log(`🔄 updateProductPrices llamado con gameId: ${gameId}, round: ${round}`);

  if (!gameId || !round) {
    console.error('❌ Faltan parámetros requeridos');
    throw new Error('Game ID and round are required.');
  }

  const db = admin.firestore();
  const gameRef = db.collection('games').doc(gameId);
  const marketRef = db.collection('market').doc(gameId);

  try {
    // Verificar que el juego existe
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists) {
      console.error(`❌ Juego no encontrado: ${gameId}`);
      throw new Error('Game not found.');
    }

    console.log('📊 Generando datos de mercado...');
    const gameData = gameDoc.data();
    const basePrices = {
      Red: 100,
      White: 120,
      Gray: 90,
      Black: 150,
      Cream: 110
    };

    const baseWaste = {
      Red: 20,
      White: 25,
      Gray: 15,
      Black: 30,
      Cream: 22
    };

    const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
    const productTypes = ['Block', 'Slab'];
    const qualities = ['A', 'B', 'C'];

    const qualityMultipliers = {
      A: { price: 1.3, waste: 0.8 },
      B: { price: 1.0, waste: 1.0 },
      C: { price: 0.8, waste: 1.1 }
    };

    // Calcular precios y residuos para la nueva ronda
    const marketData = {};
    marbleTypes.forEach((marbleType) => {
      marketData[marbleType] = {};
      productTypes.forEach((productType) => {
        marketData[marbleType][productType] = {};
        qualities.forEach((quality) => {
          const priceMultiplier = qualityMultipliers[quality].price;
          const wasteMultiplier = qualityMultipliers[quality].waste;

          // Calcular precio base según el tipo de producto
          let basePrice = basePrices[marbleType];
          if (productType === 'Slab') {
            basePrice = Math.round(basePrice * 1.25);
          }

          // Calcular residuo base según el tipo de producto
          let baseWasteAmount = baseWaste[marbleType];
          if (productType === 'Slab') {
            baseWasteAmount = Math.round(baseWasteAmount * 1.1);
          }

          // Aplicar multiplicadores de calidad
          const finalPrice = Math.ceil(basePrice * priceMultiplier);
          const finalWaste = Math.ceil(baseWasteAmount * wasteMultiplier);

          marketData[marbleType][productType][quality] = {
            price: finalPrice,
            waste: finalWaste
          };
        });
      });
    });

    console.log('📊 Datos de mercado generados:', JSON.stringify(marketData, null, 2));

    // Verificar si ya existe el documento de mercado
    const marketDoc = await marketRef.get();
    const existingData = marketDoc.exists ? marketDoc.data() : { rounds: {} };

    // Actualizar el documento de mercado
    console.log('🔄 Actualizando documento de mercado...');
    await marketRef.set({
      rounds: {
        ...existingData.rounds,
        [round]: marketData
      }
    }, { merge: true });

    // Verificar que los cambios se guardaron
    const updatedMarketDoc = await marketRef.get();
    console.log('✅ Datos de mercado actualizados:', JSON.stringify(updatedMarketDoc.data(), null, 2));

    return { 
      success: true, 
      message: 'Product prices updated successfully.',
      data: marketData
    };
  } catch (error) {
    console.error('❌ Error en updateProductPrices:', error);
    throw new Error('Failed to update product prices.');
  }
};

module.exports = { updateProductPrices };