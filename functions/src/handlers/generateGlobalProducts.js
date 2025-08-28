const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { MarbleTypes, ProductTemplates } = require('../utils/marbleUtils');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Función para generar un precio aleatorio dentro de un rango
const getRandomPrice = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Función interna para generar productos (sin onCall)
const generateProductsInternal = async () => {
  try {
    const products = [];
    let productIdCounter = 1;

    // Generar combinaciones de productos
    for (const marbleType of MarbleTypes) {
      for (const template of ProductTemplates) {
        const product = {
          productId: `product${productIdCounter.toString().padStart(3, '0')}`,
          type: template.type,
          marbleType: marbleType,
          description: `${template.type} made of ${marbleType} marble`,
        };
        products.push(product);
        productIdCounter++;
      }
    }

    // Guardar los productos en Firestore
    const batch = admin.firestore().batch();
    const productsRef = admin.firestore().collection('products');

    for (const product of products) {
      const productDoc = productsRef.doc(product.productId);
      batch.set(productDoc, product);
    }

    await batch.commit();
    console.log(`✅ Generados ${products.length} productos exitosamente`);
    return { success: true, productCount: products.length };
  } catch (error) {
    console.error('❌ Error generando productos:', error);
    throw new Error('Failed to generate products.');
  }
};

// Función HTTP callable (mantener para compatibilidad)
exports.generateGlobalProducts = onCall({
  maxInstances: 10,
  memory: '256MiB',
}, async (request) => {
  return await generateProductsInternal();
});

// Exportar la función interna para uso en otros handlers
exports.generateProductsInternal = generateProductsInternal;
