const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Store } = require('../dist/store.js');

test('入库、出库、流水与重启持久化；失败单据不能改变库存', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gearflow-test-'));
  const path = join(dir, 'test.sqlite');
  let s = new Store(path, false);
  try {
    const p = s.createProduct({ name:'测试 CPU', sku:'CPU-TEST', category:'处理器', brand:'TEST', cost:10000, price:15000, threshold:2 });
    const q = s.createProduct({ name:'测试显卡', sku:'GPU-TEST', category:'显卡', brand:'TEST', cost:20000, price:25000, threshold:2 });
    assert.throws(() => s.createProduct({name:'重复',sku:'cpu-test',category:'处理器',brand:'TEST',cost:0,price:0,threshold:0}), /SKU 已存在/);
    assert.throws(() => s.createOrder({type:'purchase',partner:'供货商',lines:[{productId:p.id,quantity:-1,unitPrice:1}]}), /数量/);
    s.createOrder({type:'purchase',partner:'供货商',lines:[{productId:p.id,quantity:10,unitPrice:10000},{productId:q.id,quantity:2,unitPrice:20000}]});
    assert.equal(s.orders()[0].total, 140000);
    s.createOrder({type:'sale',partner:'客户',lines:[{productId:p.id,quantity:3,unitPrice:15000}]});
    assert.equal(s.products().find(x=>x.id===p.id).stock, 7);
    const before=JSON.stringify(s.snapshot());
    assert.throws(()=>s.createOrder({type:'sale',partner:'客户',lines:[{productId:p.id,quantity:1,unitPrice:15000},{productId:q.id,quantity:3,unitPrice:25000}]}),/库存不足/);
    assert.equal(JSON.stringify(s.snapshot()),before);
    assert.throws(()=>s.createOrder({type:'sale',partner:'客户',lines:[{productId:p.id,quantity:1,unitPrice:1},{productId:p.id,quantity:1,unitPrice:1}]}),/合并/);
    assert.equal(s.movements().filter(m=>m.productId===p.id).reduce((a,m)=>a+m.delta,0),7);
    s.close();
    s = new Store(path, false);
    assert.equal(s.products().find(x=>x.id===p.id).stock,7);
    assert.equal(s.orders().length,2);
    assert.equal(s.movements().length,3);
  } finally { s.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('商品资料修改保留库存和流水且校验编码冲突',()=>{
 const s=new Store(':memory:',false);
 try {
  const input={name:'CPU',sku:'CPU-ONE',category:'处理器',brand:'AMD',cost:100,price:200,threshold:2};
  const p=s.createProduct(input);
  s.createProduct({...input,sku:'CPU-TWO'});
  s.createOrder({type:'purchase',partner:'供应商',lines:[{productId:p.id,quantity:6,unitPrice:100}]});
  const before=JSON.stringify(s.movements());
  const updated=s.createProduct({...input,price:300,threshold:4,stock:999},p.id);
  assert.equal(updated.stock,6);
  assert.equal(updated.price,300);
  assert.equal(JSON.stringify(s.movements()),before);
  assert.throws(()=>s.createProduct({...input,sku:'CPU-TWO'},p.id),/SKU 已存在/);
  assert.throws(()=>s.createProduct(input,'missing'),/商品不存在/);
 } finally {s.close()}
});

test('往来档案、草稿确认、盘点事务及重开兼容',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gearflow-phase1-'));
 const path=join(dir,'test.sqlite');let s=new Store(path,false);
 try{
  const p=s.createProduct({name:'配件',sku:'PART',category:'处理器',brand:'AMD',cost:100,price:200,threshold:1});
  const partner=s.savePartner({kind:'customer',name:'测试客户',contact:'李经理',phone:'123'});
  s.savePartner({kind:'customer',name:'测试客户',contact:'张经理',phone:'456'},partner.id);
  assert.throws(()=>s.savePartner({kind:'customer',name:'测试客户'}),/已存在/);
  const purchase=s.saveDraft({type:'purchase',partner:'供应商',note:'',lines:[{productId:p.id,quantity:10,unitPrice:100}]});
  assert.equal(s.products()[0].stock,0);
  const posted=s.postDraft(purchase.id);
  assert.equal(s.postDraft(purchase.id).id,posted.id);
  assert.equal(s.products()[0].stock,10);
  assert.equal(s.orders().length,1);
  assert.throws(()=>s.saveDraft({type:'purchase',partner:'供应商',lines:[{productId:p.id,quantity:5,unitPrice:100}]},purchase.id),/已记账/);
  const sale=s.saveDraft({type:'sale',partner:'测试客户',lines:[{productId:p.id,quantity:11,unitPrice:200}]});
  assert.throws(()=>s.postDraft(sale.id),/库存不足/);
  assert.equal(s.drafts().length,1);
  assert.equal(s.products()[0].stock,10);
  s.saveDraft({type:'sale',partner:'测试客户',lines:[{productId:p.id,quantity:3,unitPrice:200}]},sale.id);
  s.postDraft(sale.id);
  assert.equal(s.partners()[0].total,600);
  assert.equal(s.partners()[0].transactions.length,1);
  const snapshot=JSON.stringify(s.snapshot());
  assert.throws(()=>s.createStocktake({note:'错误账面',lines:[{productId:p.id,expected:10,actual:8}]}),/已变动/);
  assert.equal(JSON.stringify(s.snapshot()),snapshot);
  const count=s.createStocktake({note:'实盘差异',lines:[{productId:p.id,expected:7,actual:6}]});
  assert.equal(s.products()[0].stock,6);
  assert.equal(s.movements()[0].orderNumber,count.number);
  assert.equal(s.movements()[0].delta,-1);
  s.close();s=new Store(path,false);
  assert.equal(s.products()[0].stock,6);
  assert.equal(s.stocktakes().length,1);
  assert.equal(s.partners()[0].contact,'张经理');
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
