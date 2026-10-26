const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require('../dist/store.js');
const { Payments } = require('../dist/payments.js');

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-pay-'));
  const store = new Store(join(dir, 'pay.sqlite'), false);
  const payments = new Payments(store.db);
  return { dir, store, payments };
}

test('对账：应收 = 销售 − 退货 − 已收，超额登记被拒绝', () => {
  const { dir, store, payments } = setup();
  try {
    const p = store.createProduct({ name: '对账测试', sku: 'REC-1', category: '显卡', brand: 'T', cost: 10000, price: 20000, threshold: 1 });
    store.createOrder({ type: 'purchase', partner: '对账供应商', lines: [{ productId: p.id, quantity: 10, unitPrice: 10000 }] });
    store.createOrder({ type: 'sale', partner: '对账客户', lines: [{ productId: p.id, quantity: 2, unitPrice: 20000 }] });

    let rec = payments.reconcile();
    const customer = rec.receivables.items.find((i) => i.partner === '对账客户');
    assert.equal(customer.billed, 40000);
    assert.equal(customer.balance, 40000);
    assert.equal(rec.receivables.total, 40000);

    const supplier = rec.payables.items.find((i) => i.partner === '对账供应商');
    assert.equal(supplier.billed, 100000);
    assert.equal(supplier.balance, 100000);

    // 部分收款
    const paid = payments.create({ direction: 'in', partner: '对账客户', amount: 15000, method: 'wechat', note: '首款' }, 'admin');
    assert.equal(paid.amount, 15000);

    rec = payments.reconcile();
    assert.equal(rec.receivables.items.find((i) => i.partner === '对账客户').balance, 25000);

    // 超过余额要拒绝
    assert.throws(
      () => payments.create({ direction: 'in', partner: '对账客户', amount: 30000, method: 'bank' }, 'admin'),
      /余额/,
    );

    // 销售退货会减少应收
    store.createOrder({ type: 'return_in', partner: '对账客户', lines: [{ productId: p.id, quantity: 1, unitPrice: 20000 }] });
    rec = payments.reconcile();
    assert.equal(rec.receivables.items.find((i) => i.partner === '对账客户').balance, 5000);

    // 全额付清后从列表消失
    payments.create({ direction: 'in', partner: '对账客户', amount: 5000, method: 'cash' }, 'admin');
    rec = payments.reconcile();
    assert.equal(rec.receivables.items.some((i) => i.partner === '对账客户'), false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('收付款校验：方向、金额、方式、备注长度', () => {
  const { dir, store, payments } = setup();
  try {
    const p = store.createProduct({ name: '校验测试', sku: 'REC-2', category: '显卡', brand: 'T', cost: 100, price: 200, threshold: 1 });
    store.createOrder({ type: 'purchase', partner: '校验供应商', lines: [{ productId: p.id, quantity: 10, unitPrice: 100 }] });
    payments.create({ direction: 'out', partner: '校验供应商', amount: 200, method: 'bank' }, 'admin');

    assert.throws(() => payments.create({ direction: 'sideways', partner: 'X', amount: 100 }, 'admin'), /方向/);
    assert.throws(() => payments.create({ direction: 'out', partner: '校验供应商', amount: 0 }, 'admin'), /金额/);
    assert.throws(() => payments.create({ direction: 'out', partner: '校验供应商', amount: 1.5 }, 'admin'), /金额/);
    assert.throws(() => payments.create({ direction: 'out', partner: '', amount: 100 }, 'admin'), /不能为空/);
    assert.throws(() => payments.create({ direction: 'out', partner: '校验供应商', amount: 100, method: 'bitcoin' }, 'admin'), /方式/);
    assert.throws(
      () => payments.create({ direction: 'out', partner: '校验供应商', amount: 100, note: 'x'.repeat(501) }, 'admin'),
      /备注/,
    );

    const list = payments.list(1, 10, { direction: 'out' });
    assert.equal(list.total, 1);
    assert.equal(list.items[0].partner, '校验供应商');
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
