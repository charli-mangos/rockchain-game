// functions/src/utils/marbleUtils.js

// Definición de tipos de mármol
const MarbleTypes = ['Red', 'White', 'Gray', 'Black', 'Cream'];

// Definición de plantillas de productos
const ProductTemplates = [
  { type: 'Block', minPrice: 100, maxPrice: 200 },
  { type: 'Slab', minPrice: 150, maxPrice: 300 },
];

// Exportar los valores
module.exports = { MarbleTypes, ProductTemplates };


// // Función para obtener un elemento aleatorio de un array
// const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];

// // Función para generar un precio aleatorio dentro de un rango
// const getRandomPrice = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// // Función para generar productos aleatorios entre 15 y 20
// const generateRandomProducts = () => {
//   const products = [];
//   const numberOfProducts = Math.floor(Math.random() * 6) + 15; // Genera entre 15 y 20 productos

//   for (let i = 0; i < numberOfProducts; i++) {
//     const template = getRandomElement(ProductTemplates); // Obtener una plantilla aleatoria
//     const product = {
//       type: template.type,
//       marbleType: getRandomElement(MarbleTypes),
//       price: getRandomPrice(template.minPrice, template.maxPrice),

//     };
//     products.push(product);
//   }

//   return products;
// };

// // Exportar la función
// module.exports = { generateRandomProducts };
