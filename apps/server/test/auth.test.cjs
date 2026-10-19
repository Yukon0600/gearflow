const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {Auth}=require('../dist/auth.js');
const {Store}=require('../dist/store.js');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

test('密码散列、会话过期与注销',()=>{
 const db=new DatabaseSync(':memory:');const auth=new Auth(db);
 try {
  assert.equal(auth.login('admin','incorrect'),null);
  assert.equal(auth.login('nobody','GearFlow@2026'),null);
  const token=auth.login('admin','GearFlow@2026');assert.ok(token);
  assert.equal(auth.user(token).username,'admin');
  assert.notEqual(db.prepare('SELECT passwordHash FROM users').get().passwordHash,'GearFlow@2026');
  assert.notEqual(db.prepare('SELECT tokenHash FROM sessions').get().tokenHash,token);
  db.prepare('UPDATE sessions SET expires=0').run();assert.equal(auth.user(token),null);
  const next=auth.login('admin','GearFlow@2026');auth.logout(next);assert.equal(auth.user(next),null);
 } finally {db.close()}
});
test('演示数据全品类覆盖，重启不重复且保留编辑与库存',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gearflow-seed-'));let store;
 try{
  store=new Store(join(dir,'test.sqlite'));
  const data=store.snapshot();assert.equal(data.products.length,36);assert.equal(data.partners.length,12);
  for(const c of data.categories)assert.ok(data.products.filter(p=>p.category===c).length>=4);
  assert.equal(data.orders.filter(o=>o.type==='purchase').length,24);
  assert.equal(data.orders.filter(o=>o.type==='sale').length,24);
  assert.equal(data.stocktakes.length,12);
  assert.ok(data.stocktakes.some(c=>c.lines.every(l=>l.delta===0)));
  assert.ok(data.stocktakes.some(c=>c.lines.some(l=>l.delta>0)&&c.lines.some(l=>l.delta<0)));
  for(const partner of data.partners){assert.equal(partner.transactions.length,4);assert.ok(partner.total>0)}
  for(const product of data.products){
   let balance=0;
   for(const movement of store.db.prepare('SELECT * FROM movements WHERE productId=? ORDER BY rowid').all(product.id)){
    balance+=movement.delta;assert.equal(movement.balance,balance);assert.ok(balance>=0);
   }
   assert.equal(balance,product.stock);
  }
  for(const order of data.orders)assert.equal(order.total,order.lines.reduce((sum,l)=>sum+l.quantity*l.unitPrice,0));
  const p=data.products[0];store.createProduct({...p,name:'已修改商品'},p.id);
  store.createOrder({type:'purchase',partner:'测试单位',lines:[{productId:p.id,quantity:3,unitPrice:p.cost}]});
  const beforeRestart=JSON.stringify(store.snapshot());
  store.close();store=new Store(join(dir,'test.sqlite'));
  assert.equal(store.products().length,36);assert.equal(store.partners().length,12);
  assert.equal(JSON.stringify(store.snapshot()),beforeRestart);
  const updated=store.products().find(row=>row.id===p.id);assert.equal(updated.name,'已修改商品');assert.equal(updated.stock,p.stock+3);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true})}
});
