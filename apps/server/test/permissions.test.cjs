const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Auth } = require('../dist/auth.js');
const { canAccess, requiredRole, abilities } = require('../dist/permissions.js');

test('权限矩阵：店员只能开单与查看，店长能维护资料，管理员才能管账号', () => {
  // 只读
  assert.equal(canAccess('clerk', 'GET', '/api/workspace'), true);
  assert.equal(canAccess('clerk', 'GET', '/api/mobile/stock'), true);
  // 开单 / 盘点 / 草稿：店员可做
  assert.equal(canAccess('clerk', 'POST', '/api/orders'), true);
  assert.equal(canAccess('clerk', 'POST', '/api/stocktakes'), true);
  assert.equal(canAccess('clerk', 'POST', '/api/drafts'), true);
  // 商品资料、员工、服务：店员不行，店长可以
  assert.equal(canAccess('clerk', 'POST', '/api/products'), false);
  assert.equal(canAccess('manager', 'POST', '/api/products'), true);
  assert.equal(canAccess('manager', 'PATCH', '/api/employees/u1'), true);
  // 报表：店长及以上
  assert.equal(canAccess('clerk', 'GET', '/api/reports/overview'), false);
  assert.equal(canAccess('manager', 'GET', '/api/reports/overview'), true);
  // 账号管理：仅管理员
  assert.equal(canAccess('manager', 'GET', '/api/users'), false);
  assert.equal(canAccess('admin', 'POST', '/api/users'), true);

  assert.equal(requiredRole('GET', '/api/users'), 'admin');
  assert.equal(requiredRole('POST', '/api/orders'), 'clerk');
  assert.equal(requiredRole('POST', '/api/products'), 'manager');

  assert.deepEqual(abilities('clerk'), {
    role: 'clerk', canManageUsers: false, canViewReports: false, canEditCatalog: false, canTrade: true,
  });
});

test('账号管理：创建、改角色、改密码后旧会话失效、保护最后一个管理员', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-rbac-'));
  const db = new DatabaseSync(join(dir, 'rbac.sqlite'));
  const auth = new Auth(db);
  try {
    // 初始只有一个 admin
    assert.equal(auth.list().length, 1);
    assert.equal(auth.list()[0].role, 'admin');

    const clerk = auth.create('clerk01', 'Clerk12345', 'clerk');
    assert.equal(clerk.role, 'clerk');
    assert.equal(auth.list().length, 2);

    // 重名、弱密码、非法角色都要拒绝
    assert.throws(() => auth.create('clerk01', 'Clerk12345', 'clerk'), /账号已存在/);
    assert.throws(() => auth.create('clerk02', '123', 'clerk'), /密码长度/);
    assert.throws(() => auth.create('clerk03', 'Clerk12345', 'boss'), /角色只能是/);
    assert.throws(() => auth.create('a', 'Clerk12345', 'clerk'), /账号需为/);

    // 登录后拿到角色
    const token = auth.login('clerk01', 'Clerk12345');
    assert.ok(token);
    assert.deepEqual(auth.user(token), { username: 'clerk01', role: 'clerk' });

    // 改密码后旧 token 立即失效
    auth.update('clerk01', { password: 'NewPass12345' });
    assert.equal(auth.user(token), null);
    assert.equal(auth.login('clerk01', 'Clerk12345'), null);
    assert.ok(auth.login('clerk01', 'NewPass12345'));

    // 提权
    auth.update('clerk01', { role: 'manager' });
    assert.equal(auth.list().find((u) => u.username === 'clerk01').role, 'manager');

    // 不能把最后一个管理员降级，也不能删掉自己
    assert.throws(() => auth.update('admin', { role: 'clerk' }), /至少要保留一个管理员/);
    assert.throws(() => auth.remove('admin', 'admin'), /不能删除当前登录账号/);

    // 正常删除
    auth.remove('clerk01', 'admin');
    assert.equal(auth.list().length, 1);
    assert.throws(() => auth.remove('clerk01', 'admin'), /账号不存在/);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
