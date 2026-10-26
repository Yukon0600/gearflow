const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Store } = require('../dist/store.js');

test('单据类型：退货冲减、报损计损耗、库存不能为负', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-types-'));
  const s = new Store(join(dir, 'types.sqlite'), false);
  try {
    const p = s.createProduct({
      name: '类型测试显卡', sku: 'TYPE-GPU', category: '显卡', brand: 'TEST',
      cost: 10000, price: 15000, threshold: 2,
    });

    const purchase = s.createOrder({ type: 'purchase', partner: '供货商', lines: [{ productId: p.id, quantity: 10, unitPrice: 10000 }] });
    assert.match(purchase.number, /^PO-\d{8}-\d{4}$/);

    const sale = s.createOrder({ type: 'sale', partner: '客户', lines: [{ productId: p.id, quantity: 3, unitPrice: 15000 }] });
    assert.match(sale.number, /^SO-/);

    const back = s.createOrder({ type: 'return_in', partner: '客户', lines: [{ productId: p.id, quantity: 1, unitPrice: 15000 }] });
    assert.match(back.number, /^RI-/);

    const toSupplier = s.createOrder({ type: 'return_out', partner: '供货商', lines: [{ productId: p.id, quantity: 2, unitPrice: 10000 }] });
    assert.match(toSupplier.number, /^RO-/);

    const scrap = s.createOrder({ type: 'scrap', lines: [{ productId: p.id, quantity: 1, unitPrice: 0 }] });
    assert.match(scrap.number, /^SC-/);

    // 10 采购 + 1 退货入库 - 3 销售 - 2 退供应商 - 1 报损 = 5
    assert.equal(s.products().find((x) => x.id === p.id).stock, 5);

    const report = s.report(30);
    assert.equal(report.salesTotal, 15000 * 3 - 15000 * 1, '销售退货要冲减销售额');
    assert.equal(report.purchaseTotal, 10000 * 10 - 10000 * 2, '采购退货要冲减采购额');
    assert.equal(report.grossProfit, (15000 - 10000) * 3 - (15000 - 10000) * 1, '退货要冲减毛利');
    assert.equal(report.scrapLoss, 10000, '报损按成本计算损耗');
    assert.equal(report.salesOrderCount, 1, '退货单不计入销售单数');

    assert.throws(
      () => s.createOrder({ type: 'scrap', lines: [{ productId: p.id, quantity: 999, unitPrice: 0 }] }),
      /库存不足/,
    );
    assert.throws(
      () => s.createOrder({ type: 'transfer', lines: [{ productId: p.id, quantity: 1, unitPrice: 1 }] }),
      /无效单据类型/,
    );

    const types = new Set(s.movements().filter((m) => m.productId === p.id).map((m) => m.type));
    for (const t of ['purchase', 'sale', 'return_in', 'return_out', 'scrap']) {
      assert.ok(types.has(t), `流水缺少 ${t}`);
    }
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('老库迁移：两类型单据表升级为五类型，历史数据保留', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-migrate-'));
  const file = join(dir, 'legacy.sqlite');

  const legacy = new DatabaseSync(file);
  legacy.exec(`CREATE TABLE orders (
      id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('purchase','sale')),
      partner TEXT NOT NULL, note TEXT NOT NULL, total INTEGER NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO orders VALUES('o1','PO-20260101-0001','purchase','老供应商','',1000,'2026-01-01T00:00:00.000Z');`);
  legacy.close();

  const s = new Store(file, false);
  try {
    assert.equal(s.orders().length, 1, '迁移不能丢历史单据');

    const p = s.createProduct({ name: '迁移测试', sku: 'MIG-1', category: '显卡', brand: 'T', cost: 100, price: 200, threshold: 1 });
    s.createOrder({ type: 'purchase', partner: '供货商', lines: [{ productId: p.id, quantity: 2, unitPrice: 100 }] });
    const scrap = s.createOrder({ type: 'scrap', lines: [{ productId: p.id, quantity: 1, unitPrice: 0 }] });
    assert.match(scrap.number, /^SC-/, '迁移后应能开新类型单据');
    assert.equal(s.orders().length, 3);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
