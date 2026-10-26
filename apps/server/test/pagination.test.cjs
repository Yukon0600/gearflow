const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require('../dist/store.js');

test('服务端分页：单据与流水都按页返回，过滤条件生效', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-page-'));
  const s = new Store(join(dir, 'page.sqlite'), false);
  try {
    const p = s.createProduct({ name: '分页测试', sku: 'PAGE-1', category: '显卡', brand: 'T', cost: 100, price: 200, threshold: 1 });
    s.createOrder({ type: 'purchase', partner: '页测试供应商', lines: [{ productId: p.id, quantity: 30, unitPrice: 100 }] });
    for (let i = 0; i < 25; i += 1) {
      s.createOrder({ type: 'sale', partner: `客户${i}`, lines: [{ productId: p.id, quantity: 1, unitPrice: 200 }] });
    }

    const first = s.ordersPage(1, 10);
    assert.equal(first.total, 26);
    assert.equal(first.pages, 3);
    assert.equal(first.items.length, 10);

    const last = s.ordersPage(3, 10);
    assert.equal(last.items.length, 6);

    const sales = s.ordersPage(1, 5, { type: 'sale' });
    assert.equal(sales.total, 25);
    assert.ok(sales.items.every((o) => o.type === 'sale'));

    const byPartner = s.ordersPage(1, 5, { q: '客户9' });
    assert.equal(byPartner.total, 1);
    assert.equal(byPartner.items[0].partner, '客户9');

    const moves = s.movementsPage(1, 10);
    assert.equal(moves.total, 26);
    assert.equal(moves.items.length, 10);

    const inbound = s.movementsPage(1, 10, { direction: 'in' });
    assert.equal(inbound.total, 1, '只有一笔采购是入库');
    assert.ok(inbound.items.every((m) => m.delta > 0));

    // 越界页返回空数组而不是报错
    const beyond = s.ordersPage(99, 10);
    assert.equal(beyond.items.length, 0);
    assert.equal(beyond.pages, 3);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
