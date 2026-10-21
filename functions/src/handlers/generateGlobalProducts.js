const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { MarbleTypes, ProductTemplates } = require('../utils/marbleUtils');

if (!getApps().length) {
  initializeApp();
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
    const batch = getFirestore().batch();
    const productsRef = getFirestore().collection('products');

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

module.exports = { generateProductsInternal };
