// Tests de product_transaction (lógica pura): cd server && npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rememberMarket, resolvePurchase, resolveSale, resolveTransform } = require('../lib/economy');

const marketProducts = [
  { id: 'p1', marbleType: 'Red', type: 'Block', quality: 'A', currentPrice: 100, waste: 10 },
  { id: 'p2', marbleType: 'Red', type: 'Slab', quality: 'A', currentPrice: 130, waste: 11 },
];
const markets = new Map();
const market = rememberMarket(markets, 'g1', marketProducts);
const inventory = () => ({ rockCoins: 600, waste: 5, products: [] });

test('purchase uses the server price, not the client one', () => {
  const r = resolvePurchase({ inventory: inventory(), market, requested: { id: 'p1', currentPrice: 0, waste: 0 } });
  assert.equal(r.ok, true);
  assert.equal(r.rockCoins, 500);
  assert.equal(r.waste, 15);
  assert.equal(r.product.currentPrice, 100);
  assert.equal(r.products.length, 1);
});

test('purchase of a product that is not in the market fails', () => {
  const r = resolvePurchase({ inventory: inventory(), market, requested: { id: 'forged', currentPrice: 1 } });
  assert.deepEqual([r.ok, r.reason], [false, 'product_not_found']);
  assert.equal(resolvePurchase({ inventory: inventory(), market: undefined, requested: { id: 'p1' } }).ok, false);
  assert.equal(resolvePurchase({ inventory: inventory(), market, requested: null }).reason, 'invalid_data');
});

test('purchase without enough coins fails', () => {
  const r = resolvePurchase({ inventory: { rockCoins: 50, waste: 0, products: [] }, market, requested: { id: 'p1' } });
  assert.deepEqual([r.ok, r.reason], [false, 'insufficient_funds']);
});

test('sale requires owning the product and uses the market price', () => {
  const owned = { ...marketProducts[0], id: 'mine', currentPrice: 1 };
  const inv = { rockCoins: 0, waste: 20, products: [owned] };
  const r = resolveSale({ inventory: inv, market, requested: { id: 'mine', currentPrice: 1e9 } });
  assert.equal(r.ok, true);
  assert.equal(r.rockCoins, 100); // precio de mercado de Red/Block/A, no el del cliente
  assert.equal(r.waste, 10);
  assert.equal(r.products.length, 0);
  const notMine = resolveSale({ inventory: inv, market, requested: { id: 'p2' } });
  assert.deepEqual([notMine.ok, notMine.reason], [false, 'product_not_found']);
});

test('sale falls back to the stored price when the market has no equivalent', () => {
  const owned = { id: 'x', marbleType: 'Black', type: 'Block', quality: 'C', currentPrice: 42, waste: 3 };
  const r = resolveSale({ inventory: { rockCoins: 0, waste: 3, products: [owned] }, market, requested: { id: 'x' } });
  assert.equal(r.rockCoins, 42);
});

test('transform computes price and waste on the server', () => {
  const owned = { id: 'b1', marbleType: 'Red', type: 'Block', quality: 'A', currentPrice: 100, waste: 10 };
  const r = resolveTransform({
    inventory: { rockCoins: 7, waste: 0, products: [owned] },
    requested: { id: 'b1' },
    proposedId: 'client-id_1',
    generateId: () => 'server-id',
  });
  assert.equal(r.ok, true);
  assert.equal(r.product.type, 'Slab');
  assert.equal(r.product.currentPrice, 125);
  assert.equal(r.product.waste, 13);
  assert.equal(r.wasteExtra, 3);
  assert.equal(r.waste, 3);
  assert.equal(r.rockCoins, 7);
  assert.equal(r.product.id, 'client-id_1');
});

test('transform rejects slabs, foreign products and unsafe ids', () => {
  const slab = { id: 's1', marbleType: 'Red', type: 'Slab', quality: 'A', currentPrice: 100, waste: 10 };
  const block = { id: 'b1', marbleType: 'Red', type: 'Block', quality: 'A', currentPrice: 100, waste: 10 };
  const inv = { rockCoins: 0, waste: 0, products: [slab, block] };
  assert.equal(resolveTransform({ inventory: inv, requested: { id: 's1' }, generateId: () => 'n' }).ok, false);
  assert.equal(resolveTransform({ inventory: inv, requested: { id: 'nope' }, generateId: () => 'n' }).reason, 'product_not_found');
  const r = resolveTransform({ inventory: inv, requested: { id: 'b1' }, proposedId: '../../evil', generateId: () => 'server-id' });
  assert.equal(r.product.id, 'server-id');
  const dup = resolveTransform({ inventory: inv, requested: { id: 'b1' }, proposedId: 's1', generateId: () => 'server-id' });
  assert.equal(dup.product.id, 'server-id');
});
