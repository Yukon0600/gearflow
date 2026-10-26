const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Store } = require('../dist/store.js');
const { Audit } = require('../dist/audit.js');

test('成本快照：出库按当时的成本记账，改价不影响历史毛利', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-cost-'));
  const s = new Store(join(dir, 'cost.sqlite'), false);
  try {
    const p = s.createProduct({
      name: '快照测试显卡', sku: 'SNAP-GPU', category: '显卡', brand: 'TEST',
      cost: 10000, price: 15000, threshold: 5,
    });
    s.createOrder({ type: 'purchase', partner: '供应商', lines: [{ productId: p.id, quantity: 10, unitPrice: 10000 }] });
    s.createOrder({ type: 'sale', partner: '客户', lines: [{ productId: p.id, quantity: 2, unitPrice: 15000 }] });

    const line = s.db.prepare("SELECT unitCost FROM order_lines l JOIN orders o ON o.id=l.orderId WHERE o.type='sale'").get();
    assert.equal(Number(line.unitCost), 10000, '出库行应记录当时的成本');

    let report = s.report(30);
    assert.equal(report.grossProfit, (15000 - 10000) * 2);
    assert.equal(report.salesTotal, 15000 * 2);

    // 把商品成本改成 12000，历史毛利不应变化
    s.createProduct({
      name: '快照测试显卡', sku: 'SNAP-GPU', category: '显卡', brand: 'TEST',
      cost: 12000, price: 15000, threshold: 5,
    }, p.id);
    report = s.report(30);
    assert.equal(report.grossProfit, (15000 - 10000) * 2, '改成本价不能影响已经发生的销售毛利');

    // 采购行的成本就是进价
    const purchaseLine = s.db.prepare("SELECT unitCost FROM order_lines l JOIN orders o ON o.id=l.orderId WHERE o.type='purchase'").get();
    assert.equal(Number(purchaseLine.unitCost), 10000);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('审计日志：记录操作人、动作与目标，按时间倒序返回', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-audit-'));
  const db = new DatabaseSync(join(dir, 'audit.sqlite'));
  const audit = new Audit(db);
  try {
    audit.record({ username: 'admin', role: 'admin', method: 'POST', path: '/api/orders', status: 201, ip: '127.0.0.1' });
    audit.record({ username: 'clerk01', role: 'clerk', method: 'PATCH', path: '/api/drafts/abc', status: 200, ip: '10.0.0.8' });
    audit.record({ username: 'admin', role: 'admin', method: 'POST', path: '/api/drafts/abc/post', status: 200, ip: '127.0.0.1' });
    audit.record({ username: 'admin', role: 'admin', method: 'DELETE', path: '/api/users/bob', status: 200, ip: '127.0.0.1' });

    const all = audit.list(10);
    assert.equal(all.total, 4);
    assert.equal(all.items.length, 4);

    const byAction = new Map(all.items.map((r) => [r.action, r]));
    assert.ok(byAction.has('开单'));
    assert.equal(byAction.get('开单').username, 'admin');
    assert.equal(byAction.get('开单').target, 'orders');
    assert.ok(byAction.has('修改草稿'));
    assert.ok(byAction.has('草稿过账'));
    assert.ok(byAction.has('删除账号'));
    assert.equal(byAction.get('删除账号').target, 'users/bob');

    const onlyClerk = audit.list(10, 'clerk01');
    assert.equal(onlyClerk.items.length, 1);
    assert.equal(onlyClerk.items[0].role, 'clerk');
    assert.equal(onlyClerk.total, 4, '总数应为全量，筛选只影响返回列表');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
