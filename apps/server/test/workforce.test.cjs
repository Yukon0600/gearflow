const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Store}=require('../dist/store.js');
test('销售归属、提成比例快照、装机完成幂等和取消不计收入',()=>{
 const s=new Store(':memory:',false),w=s.workforce;
 try{
  const employee=w.saveEmployee({code:'E1',name:'测试员工',role:'装机销售',phone:'',active:true,salesBps:250,serviceBps:3000});
  const customer=s.savePartner({kind:'customer',name:'测试客户'});
  const product=s.createProduct({name:'CPU',sku:'CPU1',category:'处理器',brand:'Test',cost:10000,price:20000,threshold:1});
  s.createOrder({type:'purchase',partner:'供应商',lines:[{productId:product.id,quantity:10,unitPrice:10000}]});
  const before=JSON.stringify(s.snapshot());
  assert.throws(()=>s.createOrder({type:'sale',partner:customer.name,employeeId:'invalid',lines:[{productId:product.id,quantity:1,unitPrice:20000}]}),/员工不存在/);
  assert.equal(JSON.stringify(s.snapshot()),before);
  const draft=s.saveDraft({type:'sale',partner:customer.name,employeeId:employee.id,lines:[{productId:product.id,quantity:2,unitPrice:20000}]});
  const order=s.postDraft(draft.id);s.postDraft(draft.id);
  assert.equal(w.commissions().length,1);assert.equal(w.commissions()[0].amount,1000);assert.match(w.commissions()[0].description,/CPU × 2/);
  const service=w.createService({customerId:customer.id,employeeId:employee.id,designated:true,orderId:order.id,title:'装机',fee:19900,note:''});
  assert.throws(()=>w.transitionService(service.id,'completed'),/先开始装机/);
  w.transitionService(service.id,'working');w.transitionService(service.id,'completed');w.transitionService(service.id,'completed');
  assert.equal(w.commissions().length,2);assert.equal(w.commissions().find(c=>c.type==='service').amount,5970);
  assert.equal(s.products()[0].stock,8);
  w.saveEmployee({...employee,active:false,name:'改名',salesBps:1000,serviceBps:5000},employee.id);
  assert.equal(w.commissions().find(c=>c.type==='service').rateBps,3000);
  assert.equal(w.commissions().find(c=>c.type==='sale').employeeName,'测试员工');
  assert.throws(()=>w.createService({customerId:customer.id,employeeId:employee.id,designated:false,title:'装机',fee:100}),/停用/);
  w.saveEmployee({...employee,active:true},employee.id);
  const cancelled=w.createService({customerId:customer.id,employeeId:employee.id,designated:false,title:'取消测试',fee:100});
  w.transitionService(cancelled.id,'cancelled');assert.throws(()=>w.transitionService(cancelled.id,'working'),/不可再次变更/);
  assert.equal(w.commissions().length,2);
  const other=s.savePartner({kind:'customer',name:'其他客户'});
  assert.throws(()=>w.createService({customerId:other.id,employeeId:employee.id,designated:true,orderId:order.id,title:'错配',fee:100}),/属于当前客户/);
 }finally{s.close()}
});
