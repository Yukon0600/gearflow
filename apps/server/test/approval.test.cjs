const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require('../dist/store.js');

test('审批流：待审批不动库存，通过后才生效，驳回留原因', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-approval-'));
  const s = new Store(join(dir, 'approval.sqlite'), false);
  try {
    const p = s.createProduct({ name: '审批测试', sku: 'APR-1', category: '显卡', brand: 'T', cost: 10000, price: 20000, threshold: 1 });
    s.createOrder({ type: 'purchase', partner: '供应商A', lines: [{ productId: p.id, quantity: 10, unitPrice: 10000 }] });

    const pending = s.createOrder(
      { type: 'sale', partner: '客户A', lines: [{ productId: p.id, quantity: 2, unitPrice: 20000 }] },
      { status: 'pending', createdBy: 'clerk01' },
    );
    assert.equal(pending.status, 'pending');

    // 待审批：库存不动、无流水、不进报表
    assert.equal(s.products().find((x) => x.id === p.id).stock, 10);
    assert.equal(s.movements().filter((m) => m.orderId === pending.id).length, 0);
    const beforeApprove = s.report(30);
    assert.equal(beforeApprove.salesTotal, 0);

    // 通过后：库存扣减、流水与报表都出现
    const approved = s.approveOrder(pending.id, 'manager01');
    assert.equal(approved.status, 'posted');
    assert.equal(approved.approvedBy, 'manager01');
    assert.equal(s.products().find((x) => x.id === p.id).stock, 8);
    assert.equal(s.movements().filter((m) => m.orderId === pending.id).length, 1);
    assert.equal(s.report(30).salesTotal, 40000);

    // 不能重复审批
    assert.throws(() => s.approveOrder(pending.id, 'manager01'), /已处理/);

    // 驳回：状态变更、库存不变
    const second = s.createOrder(
      { type: 'sale', partner: '客户B', lines: [{ productId: p.id, quantity: 1, unitPrice: 20000 }] },
      { status: 'pending', createdBy: 'clerk01' },
    );
    const rejected = s.rejectOrder(second.id, '价格需要重新确认', 'manager01');
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.rejectReason, '价格需要重新确认');
    assert.equal(s.products().find((x) => x.id === p.id).stock, 8, '驳回不会动库存');
    assert.throws(() => s.rejectOrder(second.id, 'x', 'manager01'), /已处理/);
    assert.throws(() => s.approveOrder('not-exist', 'manager01'), /单据不存在/);

    // 分页按状态过滤
    assert.equal(s.ordersPage(1, 10, { status: 'pending' }).total, 0);
    assert.equal(s.ordersPage(1, 10, { status: 'rejected' }).total, 1);
    assert.equal(s.ordersPage(1, 10, { status: 'posted' }).total, 2);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
