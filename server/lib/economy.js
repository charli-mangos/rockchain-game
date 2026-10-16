// server/lib/economy.js
// Reglas económicas de las transacciones de producto. Los precios y residuos
// salen siempre del mercado generado por el servidor o del inventario guardado
// en el servidor, nunca de los datos que envía el cliente.

// Multiplicadores de la transformación bloque -> tabla (los mismos que muestra la app)
const TRANSFORM_PRICE_MULTIPLIER = 1.25;
const TRANSFORM_WASTE_MULTIPLIER = 1.25;

const fail = (reason, message) => ({ ok: false, reason, message });

const productKey = (p) => `${p.marbleType}:${p.type}:${p.quality}`;

const isFiniteNonNegative = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// Guarda los productos del mercado de una partida: Map(productId -> producto)
const rememberMarket = (markets, gameId, products) => {
  const byId = new Map();
  for (const p of products || []) {
    if (p && typeof p.id === 'string') byId.set(p.id, p);
  }
  markets.set(gameId, byId);
  return byId;
};

const requestedId = (requested) =>
  requested && typeof requested.id === 'string' ? requested.id : null;

// Compra: el producto debe existir en el mercado actual del servidor
const resolvePurchase = ({ inventory, market, requested }) => {
  const id = requestedId(requested);
  if (!id) return fail('invalid_data', 'Producto no válido');
  const marketProduct = market && market.get(id);
  if (!marketProduct) return fail('product_not_found', 'El producto no está en el mercado');
  const price = marketProduct.currentPrice;
  const waste = marketProduct.waste;
  if (!isFiniteNonNegative(price) || !isFiniteNonNegative(waste)) {
    return fail('invalid_data', 'Producto con valores no válidos');
  }
  if (inventory.rockCoins < price) {
    return fail('insufficient_funds', 'No tienes suficientes RockCoins');
  }
  const product = { ...marketProduct };
  return {
    ok: true,
    product,
    products: [...(inventory.products || []), product],
    rockCoins: inventory.rockCoins - price,
    waste: inventory.waste + waste,
  };
};

// Venta: el producto debe estar en el inventario del servidor. Se vende al precio
// actual de mercado de un producto equivalente (mármol, tipo y calidad) si existe,
// o al precio con el que se guardó.
const resolveSale = ({ inventory, market, requested }) => {
  const id = requestedId(requested);
  if (!id) return fail('invalid_data', 'Producto no válido');
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const index = products.findIndex((p) => p && p.id === id);
  if (index === -1) return fail('product_not_found', 'No tienes este producto');
  const owned = products[index];
  let price = owned.currentPrice;
  if (market) {
    const key = productKey(owned);
    for (const p of market.values()) {
      if (productKey(p) === key && isFiniteNonNegative(p.currentPrice)) {
        price = p.currentPrice;
        break;
      }
    }
  }
  if (!isFiniteNonNegative(price)) return fail('invalid_data', 'Producto con valores no válidos');
  const remaining = [...products];
  remaining.splice(index, 1);
  return {
    ok: true,
    product: { ...owned, currentPrice: price },
    products: remaining,
    rockCoins: inventory.rockCoins + price,
    waste: Math.max(0, inventory.waste - (owned.waste || 0)),
  };
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Transformación: solo un Block propio se convierte en Slab; precio y residuo
// se calculan aquí. Se conserva el id nuevo que propone el cliente si es seguro.
const resolveTransform = ({ inventory, requested, proposedId, generateId }) => {
  const id = requestedId(requested);
  if (!id) return fail('invalid_data', 'Producto no válido');
  const products = Array.isArray(inventory.products) ? inventory.products : [];
  const index = products.findIndex((p) => p && p.id === id);
  if (index === -1) return fail('product_not_found', 'No tienes este producto');
  const owned = products[index];
  if (owned.type !== 'Block') return fail('invalid_data', 'Solo se pueden transformar bloques');
  if (!isFiniteNonNegative(owned.currentPrice) || !isFiniteNonNegative(owned.waste)) {
    return fail('invalid_data', 'Producto con valores no válidos');
  }
  const newId = typeof proposedId === 'string' && SAFE_ID.test(proposedId) &&
    !products.some((p) => p && p.id === proposedId)
    ? proposedId
    : generateId();
  const wasteExtra = Math.ceil(owned.waste * (TRANSFORM_WASTE_MULTIPLIER - 1));
  const transformed = {
    ...owned,
    id: newId,
    type: 'Slab',
    currentPrice: Math.ceil(owned.currentPrice * TRANSFORM_PRICE_MULTIPLIER),
    waste: Math.ceil(owned.waste * TRANSFORM_WASTE_MULTIPLIER),
  };
  const updated = [...products];
  updated.splice(index, 1);
  updated.push(transformed);
  return {
    ok: true,
    product: transformed,
    products: updated,
    rockCoins: inventory.rockCoins,
    waste: inventory.waste + wasteExtra,
    wasteExtra,
  };
};

module.exports = {
  rememberMarket,
  resolvePurchase,
  resolveSale,
  resolveTransform,
  TRANSFORM_PRICE_MULTIPLIER,
  TRANSFORM_WASTE_MULTIPLIER,
};
