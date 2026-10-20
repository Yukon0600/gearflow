const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require('../dist/store.js');

test('移动端库存接口：字段完整、低库存标记正确、按库存升序', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-mobile-'));
  const s = new Store(join(dir, 'mobile.sqlite'), false);
  try {
    const low = s.createProduct({
      name: '移动端测试显卡', sku: 'MOB-GPU', category: '显卡', brand: 'TEST',
      cost: 10000, price: 20000, threshold: 3,
    });
    const plenty = s.createProduct({
      name: '移动端测试内存', sku: 'MOB-RAM', category: '内存', brand: 'TEST',
      cost: 5000, price: 9000, threshold: 1,
    });
    s.createOrder({ type: 'purchase', partner: '供货商', lines: [{ productId: plenty.id, quantity: 20, unitPrice: 5000 }] });

    const data = s.mobileStock();

    assert.equal(data.total, 2);
    assert.equal(data.lowCount, 1);
    assert.equal(typeof data.updatedAt, 'string');

    const lowItem = data.products.find((p) => p.id === low.id);
    const okItem = data.products.find((p) => p.id === plenty.id);
    assert.equal(lowItem.low, true);
    assert.equal(okItem.low, false);

    // 只暴露移动端需要的字段，避免把成本价等敏感字段带出去
    assert.deepEqual(Object.keys(lowItem).sort(), [
      'brand', 'category', 'id', 'low', 'name', 'price', 'sku', 'stock', 'threshold',
    ]);
    assert.equal(lowItem.cost, undefined);

    // 库存少的排前面，方便移动端优先展示预警商品
    assert.equal(data.products[0].id, low.id);
    assert.equal(data.products[1].id, plenty.id);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
