const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

// 真启动一个服务进程，全部通过 HTTP 调用，覆盖「用户怎么用」而不是「函数怎么调」
const PORT = 3900 + (process.pid % 90);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'AdminPass123';

let server;
let dir;
let adminToken;
let clerkToken;
let productId;
let baseline;

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // 服务还没起来
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('服务在限定时间内没有启动');
}

async function api(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'gearflow-e2e-'));
  server = spawn(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      GEARFLOW_DB_PATH: join(dir, 'e2e.sqlite'),
      GEARFLOW_ADMIN_PASSWORD: ADMIN_PASSWORD,
    },
    stdio: 'ignore',
  });
  await waitForHealth();
});

after(async () => {
  if (server) {
    const exited = new Promise((resolveExit) => server.once('exit', resolveExit));
    server.kill();
    await exited;
  }
  if (dir) {
    // Windows 下进程退出后文件句柄可能还没释放，重试几次
    for (let i = 0; i < 10; i += 1) {
      try { rmSync(dir, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 150)); }
    }
  }
});

test('健康检查：返回数据库探活、版本与安全响应头', async () => {
  const { status, data, headers } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.db, 'ok');
  assert.ok(data.productCount > 0, '演示数据应已写入');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
});

test('认证：未登录 401，错误密码 401，正确密码拿到 token 与角色', async () => {
  assert.equal((await api('/api/workspace')).status, 401);
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong-pass' } })).status, 401);

  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: ADMIN_PASSWORD } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  assert.ok(login.data.token);
  adminToken = login.data.token;

  baseline = (await api('/api/reports/overview?days=30', { token: adminToken })).data;

  const me = await api('/api/auth/me', { token: adminToken });
  assert.equal(me.data.user.username, 'admin');
  assert.equal(me.data.abilities.canManageUsers, true);
});

test('商品：创建、重复 SKU 被拒、PATCH 只传单个字段也能生效', async () => {
  const created = await api('/api/products', {
    method: 'POST',
    token: adminToken,
    body: { name: 'E2E 测试显卡', sku: 'E2E-GPU-1', category: '显卡', brand: 'E2E', cost: 10000, price: 15000, threshold: 2 },
  });
  assert.equal(created.status, 201);
  productId = created.data.id;

  const dup = await api('/api/products', {
    method: 'POST',
    token: adminToken,
    body: { name: '重复', sku: 'e2e-gpu-1', category: '显卡', brand: 'E2E', cost: 1, price: 2, threshold: 1 },
  });
  assert.equal(dup.status, 409);
  assert.match(dup.data.message, /SKU/);

  const patched = await api(`/api/products/${productId}`, { method: 'PATCH', token: adminToken, body: { threshold: 9 } });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.threshold, 9);
  assert.equal(patched.data.name, 'E2E 测试显卡', '未传的字段应保持原值');
});

test('单据：采购入库 → 销售出库 → 库存与流水果同步', async () => {
  const purchase = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'purchase', partner: 'E2E 供应商', lines: [{ productId, quantity: 10, unitPrice: 10000 }] },
  });
  assert.equal(purchase.status, 201);
  assert.match(purchase.data.number, /^PO-\d{8}-\d{4}$/);


  const sale = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'sale', partner: 'E2E 客户', lines: [{ productId, quantity: 3, unitPrice: 15000 }] },
  });
  assert.equal(sale.status, 201);
  assert.match(sale.data.number, /^SO-/);

  const detail = await api(`/api/mobile/product/${productId}`, { token: adminToken });
  assert.equal(detail.data.stock, 7, '10 入库 - 3 出库 = 7');
  assert.ok(detail.data.movements.length >= 2);
});

test('库存保护：超卖被 409 拒绝，且库存不变', async () => {
  const oversell = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'sale', partner: 'E2E 客户', lines: [{ productId, quantity: 999, unitPrice: 15000 }] },
  });
  assert.equal(oversell.status, 409);
  assert.match(oversell.data.message, /库存不足/);

  const detail = await api(`/api/mobile/product/${productId}`, { token: adminToken });
  assert.equal(detail.data.stock, 7);
});

test('逆向单据：销售退货、采购退货、报损都正确改库存并进报表', async () => {
  const back = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'return_in', partner: 'E2E 客户', lines: [{ productId, quantity: 1, unitPrice: 15000 }] },
  });
  assert.equal(back.status, 201);
  assert.match(back.data.number, /^RI-/);

  const toSupplier = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'return_out', partner: 'E2E 供应商', lines: [{ productId, quantity: 2, unitPrice: 10000 }] },
  });
  assert.equal(toSupplier.status, 201);
  assert.match(toSupplier.data.number, /^RO-/);

  const scrap = await api('/api/orders', {
    method: 'POST', token: adminToken,
    body: { type: 'scrap', partner: '运输破损', lines: [{ productId, quantity: 1, unitPrice: 0 }] },
  });
  assert.equal(scrap.status, 201);
  assert.match(scrap.data.number, /^SC-/);

  const detail = await api(`/api/mobile/product/${productId}`, { token: adminToken });
  assert.equal(detail.data.stock, 5, '7 +1 -2 -1 = 5');

  const report = await api('/api/reports/overview?days=30', { token: adminToken });
  assert.equal(report.status, 200);
  const body = report.data;
  assert.equal(body.salesTotal - baseline.salesTotal, 15000 * 3 - 15000 * 1, '销售退货应冲减销售额');
  assert.equal(body.purchaseTotal - baseline.purchaseTotal, 10000 * 10 - 10000 * 2, '采购退货应冲减采购额');
  assert.equal(body.scrapLoss - baseline.scrapLoss, 10000, '报损按成本计损耗');
  assert.ok(Array.isArray(body.trend) && body.trend.length === 30);
});

test('分页：单据与流水按页返回，越界页返回空数组', async () => {
  const first = await api('/api/orders?page=1&size=2', { token: adminToken });
  assert.equal(first.status, 200);
  assert.equal(first.data.items.length, 2);
  assert.ok(first.data.total >= 5);

  const page2 = await api('/api/orders?page=2&size=2', { token: adminToken });
  assert.notEqual(page2.data.items[0].id, first.data.items[0].id);

  const beyond = await api('/api/orders?page=999&size=2', { token: adminToken });
  assert.equal(beyond.data.items.length, 0);

  const moves = await api('/api/movements?page=1&size=3', { token: adminToken });
  assert.equal(moves.data.items.length, 3);

  const inbound = await api('/api/movements?direction=in&size=50', { token: adminToken });
  assert.ok(inbound.data.items.every((m) => m.delta > 0));
});

test('对账：应收应付按往来单位汇总，登记收款后余额下降、超额被拒', async () => {
  const rec = await api('/api/reconcile', { token: adminToken });
  assert.equal(rec.status, 200);
  assert.ok(Array.isArray(rec.data.receivables.items));
  assert.ok(Array.isArray(rec.data.payables.items));

  const customer = rec.data.receivables.items.find((i) => i.partner === 'E2E 客户');
  assert.ok(customer, 'E2E 客户应有应收');
  const balance = customer.balance;
  assert.ok(balance > 0);

  const pay = await api('/api/payments', {
    method: 'POST', token: adminToken,
    body: { direction: 'in', partner: 'E2E 客户', amount: 1000, method: 'wechat', note: 'e2e 收款' },
  });
  assert.equal(pay.status, 201);

  const after = await api('/api/reconcile', { token: adminToken });
  const updated = after.data.receivables.items.find((i) => i.partner === 'E2E 客户');
  assert.equal(updated.balance, balance - 1000);

  const tooMuch = await api('/api/payments', {
    method: 'POST', token: adminToken,
    body: { direction: 'in', partner: 'E2E 客户', amount: 99999999, method: 'bank' },
  });
  assert.equal(tooMuch.status, 409);
  assert.match(tooMuch.data.message, /余额/);

  const list = await api('/api/payments?page=1&size=5', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.total >= 1);
  assert.equal(list.data.items[0].partner, 'E2E 客户');
});

test('审计：写操作留下记录，未登录/失败请求不记录', async () => {
  // 审计在响应 finish 之后写入，稍等一下再查
  await new Promise((r) => setTimeout(r, 300));
  const audit = await api('/api/audit?limit=50', { token: adminToken });
  assert.equal(audit.status, 200);
  const actions = audit.data.items.map((a) => a.action);
  assert.ok(actions.includes('开单'), '开单应进审计');
  assert.ok(actions.includes('新建商品'));
  assert.ok(actions.includes('修改商品'));
  assert.ok(audit.data.items.every((a) => a.status < 400), '失败请求不应入审计');
});

test('权限：店员能开单但改不了商品、看不到报表和账号', async () => {
  const created = await api('/api/users', {
    method: 'POST', token: adminToken,
    body: { username: 'e2eclerk', password: 'Clerk12345', role: 'clerk' },
  });
  assert.equal(created.status, 201);

  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'e2eclerk', password: 'Clerk12345' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'clerk');
  clerkToken = login.data.token;

  assert.equal((await api('/api/workspace', { token: clerkToken })).status, 200);
  assert.equal((await api('/api/reports/overview', { token: clerkToken })).status, 403);
  assert.equal((await api('/api/users', { token: clerkToken })).status, 403);
  assert.equal((await api('/api/audit', { token: clerkToken })).status, 403);
  assert.equal((await api('/api/products', {
    method: 'POST', token: clerkToken,
    body: { name: '越权', sku: 'NOPE-1', category: '显卡', brand: 'X', cost: 1, price: 2, threshold: 1 },
  })).status, 403);


  assert.equal((await api('/api/reconcile', { token: clerkToken })).status, 200, '店员可以看对账');
  assert.equal((await api('/api/payments', {
    method: 'POST', token: clerkToken,
    body: { direction: 'in', partner: 'E2E 客户', amount: 100, method: 'cash' },
  })).status, 403, '店员不能登记收付款');
  const sale = await api('/api/orders', {
    method: 'POST', token: clerkToken,
    body: { type: 'sale', partner: '店员客户', lines: [{ productId, quantity: 1, unitPrice: 15000 }] },
  });
  assert.equal(sale.status, 201, '店员可以开单');
});

test('账号：改角色生效、重置密码后旧 token 失效、最后一个管理员受保护', async () => {
  const promoted = await api('/api/users/e2eclerk', { method: 'PATCH', token: adminToken, body: { role: 'manager' } });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.role, 'manager');

  assert.equal((await api('/api/reports/overview', { token: clerkToken })).status, 200, '升为店长后能看报表');

  const reset = await api('/api/users/e2eclerk', { method: 'PATCH', token: adminToken, body: { password: 'NewPass12345' } });
  assert.equal(reset.status, 200);
  assert.equal((await api('/api/workspace', { token: clerkToken })).status, 401, '改密码后旧会话立刻失效');
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { username: 'e2eclerk', password: 'Clerk12345' } })).status, 401);
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { username: 'e2eclerk', password: 'NewPass12345' } })).status, 200);

  const demoteSelf = await api('/api/users/admin', { method: 'PATCH', token: adminToken, body: { role: 'clerk' } });
  assert.equal(demoteSelf.status, 400);
  assert.match(demoteSelf.data.message, /管理员/);

  const deleteSelf = await api('/api/users/admin', { method: 'DELETE', token: adminToken });
  assert.equal(deleteSelf.status, 409);
});

test('退出登录：token 立即失效', async () => {
  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: ADMIN_PASSWORD } });
  const token = login.data.token;
  assert.equal((await api('/api/auth/logout', { method: 'POST', token })).status, 200);
  assert.equal((await api('/api/workspace', { token })).status, 401);
});
