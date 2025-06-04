const admin = require('firebase-admin');

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

exports.assignProductsToGame = async ({ gameId, round }) => {
  const productsRef = admin.firestore().collection('products');
  const gameRef = admin.firestore().collection('games').doc(gameId);
  const marketRef = admin.firestore().collection('market').doc(gameId);

  const marbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];
  const productTypes = ['Block', 'Slab'];
  const qualities = ['A', 'B', 'C'];

  const qualityMultipliers = {
    A: { price: 1.3, waste: 0.8 },
    B: { price: 1.0, waste: 1.0 },
    C: { price: 0.8, waste: 1.1 },
  };

  const calculateProductPrice = (basePrice, productType) => {
    switch (productType) {
      case 'Block':
        return basePrice;
      case 'Slab':
        return Math.round(basePrice * 1.25);
      default:
        return basePrice;
    }
  };

  const calculateProductWaste = (baseWaste, productType) => {
    switch (productType) {
      case 'Block':
        return baseWaste;
      case 'Slab':
        return Math.round(baseWaste * 1.1);
      default:
        return baseWaste;
    }
  };

  try {
    const productsSnapshot = await productsRef.get();
    const products = productsSnapshot.docs.map((doc) => doc.data());

    // Generar precios base y waste base para mármol
    const marbleBasePrices = marbleTypes.reduce((acc, type) => {
      acc[type] = getRandomBasePrice();
      return acc;
    }, {});

    const marbleWaste = marbleTypes.reduce((acc, type) => {
      acc[type] = getBaseTrash();
      return acc;
    }, {});

    const productList = [];

    // Generar productos aleatorios (manteniendo lógica existente)
    for (let i = 0; i < 20; i++) {
      const randomProduct = getRandomElement(products);
      const basePrice = marbleBasePrices[randomProduct.marbleType] || 100;
      const waste = marbleWaste[randomProduct.marbleType];
      const productQuality = getRandomQuality(); // Generar calidad aleatoria

      const priceMultiplier = qualityMultipliers[productQuality].price;
      const wasteMultiplier = qualityMultipliers[productQuality].waste;

      const productPrice = Math.ceil(calculateProductPrice(basePrice, randomProduct.type) * priceMultiplier);
      const productWaste = Math.ceil(calculateProductWaste(waste, randomProduct.type) * wasteMultiplier);

      productList.push({
        id: `${randomProduct.productId}-${i}`,
        productType: randomProduct.productId,
        currentPrice: productPrice,
        waste: productWaste,
        marbleType: randomProduct.marbleType,
        type: randomProduct.type,
        quality: productQuality,
      });
    }

    // Actualizar la lista de productos en `games`
    await gameRef.update({ productList });
    console.log(`Assigned ${productList.length} products to game ${gameId}`);

    // Generar tabla completa para `market`
    const marketData = {};

    marbleTypes.forEach((marbleType) => {
      productTypes.forEach((productType) => {
        qualities.forEach((quality) => {
          const priceMultiplier = qualityMultipliers[quality].price;
          const wasteMultiplier = qualityMultipliers[quality].waste;

          const finalPrice = Math.ceil(
            calculateProductPrice(marbleBasePrices[marbleType], productType) * priceMultiplier
          );
          const finalWaste = Math.ceil(
            calculateProductWaste(marbleWaste[marbleType], productType) * wasteMultiplier
          );

          if (!marketData[marbleType]) {
            marketData[marbleType] = {};
          }
          if (!marketData[marbleType][productType]) {
            marketData[marbleType][productType] = {};
          }

          marketData[marbleType][productType][quality] = {
            price: finalPrice,
            waste: finalWaste,
          };
        });
      });
    });

    // Guardar datos en `market`
    await marketRef.set(
      {
        rounds: {
          [round]: marketData,
        },
      },
      { merge: true }
    );

    console.log(`Market data for round ${round} stored successfully.`);
    return { success: true };
  } catch (error) {
    console.error('Error assigning products to game:', error);
    throw new Error('Failed to assign products to game');
  }
};
