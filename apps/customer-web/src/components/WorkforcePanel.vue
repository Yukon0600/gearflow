<script setup>
import { computed, nextTick, ref } from 'vue'
import { Plus, X, Users, Wrench, Wallet, Search } from 'lucide-vue-next'
const props=defineProps({page:String,data:Object,api:Function})
const emit=defineEmits(['refresh','notify'])
const query=ref(''),filter=ref('all'),dialog=ref(),modal=ref(''),form=ref({}),busy=ref(false),error=ref(''),editing=ref(null)
const money=n=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format((n||0)/100)
const date=s=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'—'
const labels={pending:'待装机',working:'装机中',completed:'已完成',cancelled:'已取消'}
const employees=computed(()=>props.data.employees||[])
const services=computed(()=>props.data.services||[])
const commissions=computed(()=>props.data.commissions||[])
const customers=computed(()=>(props.data.partners||[]).filter(p=>p.kind==='customer'))
const sales=computed(()=>props.data.orders.filter(o=>o.type==='sale'&&o.partner===customers.value.find(p=>p.id===form.value.customerId)?.name))
const rows=computed(()=>{
 const list=props.page==='employees'?employees.value:props.page==='services'?services.value:commissions.value
 return list.filter(r=>(filter.value==='all'||(props.page==='commissions'?r.employeeId===filter.value:r.status===filter.value))&&JSON.stringify(r).toLowerCase().includes(query.value.toLowerCase()))
})
const revenue=computed(()=>services.value.filter(s=>s.status==='completed').reduce((sum,s)=>sum+s.fee,0))
const totalCommission=computed(()=>commissions.value.reduce((sum,c)=>sum+c.amount,0))
async function open(type,item){
 modal.value=type;editing.value=item?.id||null;error.value=''
 form.value=type==='employee'?(item?{...item,active:!!item.active,salesPercent:item.salesBps/100,servicePercent:item.serviceBps/100}:{code:'',name:'',role:'销售顾问',phone:'',active:true,salesPercent:2,servicePercent:30}):type==='detail'?item:{customerId:'',employeeId:'',designated:false,orderId:'',title:'整机组装与调试',feeYuan:199,note:''}
 await nextTick();dialog.value.showModal()
}
function close(){if(!busy.value){dialog.value.close();modal.value=''}}
async function save(){busy.value=true;error.value='';try{
 if(modal.value==='employee')await props.api(editing.value?`employees/${editing.value}`:'employees',{...form.value,salesBps:Math.round(Number(form.value.salesPercent)*100),serviceBps:Math.round(Number(form.value.servicePercent)*100)},editing.value?'PATCH':'POST')
 else await props.api('services',{...form.value,fee:Math.round(Number(form.value.feeYuan)*100)})
 busy.value=false;close();emit('notify','已保存');emit('refresh')
 }catch(e){error.value=e.message}finally{busy.value=false}}
async function transition(item,status){busy.value=true;error.value='';try{await props.api(`services/${item.id}/status`,{status},'PATCH');emit('refresh');emit('notify',status==='completed'?'装机已完成，服务收入与提成已记录':'服务状态已更新')}catch(e){error.value=e.message}finally{busy.value=false}}
</script>

<template>
 <section class="business-page workforce-page">
  <header class="business-heading"><div><span class="eyebrow">PEOPLE & SERVICES</span><h1>{{page==='employees'?'员工档案':page==='services'?'装机服务':'员工提成'}}</h1><p>{{page==='employees'?'管理接待与装机员工，设置各自的提成比例。':page==='services'?'记录客户指定技师、服务进度与装机费用。':'按成交时比例记录应计提成，可追踪销售商品及装机服务。'}}</p></div><button v-if="page!=='commissions'" class="button primary" @click="open(page==='employees'?'employee':'service')"><Plus :size="16"/>{{page==='employees'?'新增员工':'新建装机服务'}}</button></header>
  <div class="business-summary"><article><Users :size="20"/><span>在职员工<b>{{employees.filter(e=>e.active).length}} 人</b></span></article><article><Wrench :size="20"/><span>已完成装机服务收入<b>{{money(revenue)}}</b></span></article><article><Wallet :size="20"/><span>累计应计提成 · 未标记发放<b>{{money(totalCommission)}}</b></span></article></div>
  <p v-if="error&&!modal" class="form-error" role="alert">{{error}}</p>
  <section class="data-panel"><div class="toolbar"><label class="search"><Search :size="16"/><input v-model="query" placeholder="搜索姓名、工号、客户或单据…" aria-label="搜索员工业务"/></label><label v-if="page==='services'" class="select-wrap"><select v-model="filter" aria-label="装机状态"><option value="all">全部服务状态</option><option v-for="(label,key) in labels" :key="key" :value="key">{{label}}</option></select></label><label v-if="page==='commissions'" class="select-wrap"><select v-model="filter" aria-label="提成员工"><option value="all">全部员工</option><option v-for="e in employees" :key="e.id" :value="e.id">{{e.name}}</option></select></label><span class="muted">{{rows.length}} 条记录</span></div>
   <div class="table-scroll"><table v-if="page==='employees'"><thead><tr><th>员工 / 工号</th><th>岗位 / 电话</th><th>销售提成</th><th>装机提成</th><th>累计应计</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="e in rows" :key="e.id"><td>{{e.name}}<small class="brand-text">{{e.code}}</small></td><td>{{e.role}}<small class="brand-text">{{e.phone||'未填写电话'}}</small></td><td>{{e.salesBps/100}}%<small class="brand-text">{{e.salesCount}} 笔销售</small></td><td>{{e.serviceBps/100}}%<small class="brand-text">{{e.serviceCount}} 次服务</small></td><td class="price">{{money(e.salesCommission+e.serviceCommission)}}</td><td><span :class="['status',{'out':!e.active}]">{{e.active?'在职':'停用'}}</span></td><td><button class="text-button" @click="open('employee',e)">编辑员工</button></td></tr></tbody></table>
   <table v-else-if="page==='services'"><thead><tr><th>服务单 / 项目</th><th>客户</th><th>装机员工</th><th>服务费</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="s in rows" :key="s.id"><td><button class="order-link" @click="open('detail',s)">{{s.number}}</button><small class="brand-text">{{s.title}}</small></td><td>{{s.customer}}</td><td>{{s.employeeName}}<small class="brand-text">{{s.designated?'客户点名':'门店安排'}}</small></td><td class="price">{{money(s.fee)}}</td><td><span :class="['status',{'low':s.status==='pending','out':s.status==='cancelled'}]">{{labels[s.status]}}</span></td><td><div class="row-actions"><button :disabled="busy" v-if="s.status==='pending'" @click="transition(s,'working')">开始装机</button><button :disabled="busy" v-if="s.status==='working'" @click="transition(s,'completed')">确认完成</button><button :disabled="busy" v-if="['pending','working'].includes(s.status)" @click="transition(s,'cancelled')">取消服务</button><button @click="open('detail',s)">详情</button></div></td></tr></tbody></table>
   <table v-else><thead><tr><th>员工</th><th>来源单据 / 客户</th><th>商品或服务</th><th>计提基数</th><th>成交比例</th><th>应计提成</th><th>时间</th></tr></thead><tbody><tr v-for="c in rows" :key="c.id"><td>{{c.employeeName}}<small class="brand-text">{{c.type==='sale'?'销售提成':'装机提成'}}</small></td><td class="mono">{{c.sourceNumber}}<small class="brand-text">{{c.customer}}</small></td><td class="commission-description">{{c.description}}</td><td>{{money(c.base)}}</td><td>{{c.rateBps/100}}%</td><td class="price">{{money(c.amount)}}</td><td class="muted">{{date(c.createdAt)}}</td></tr></tbody></table></div>
   <div v-if="!rows.length" class="empty">暂无匹配记录</div>
  </section>
  <p class="form-intro workforce-note">销售按整张单据销售额计提；装机按完成时服务费计提。配件销售与装机服务分别记账，装机单不重复扣库存；服务收入不等于净利润，提成明细不代表已发放工资。</p>
  <dialog ref="dialog" class="drawer" @cancel.prevent="close"><div v-if="modal" class="drawer-inner"><header class="drawer-header"><h2>{{modal==='employee'?(editing?'编辑员工':'新增员工'):modal==='detail'?'装机服务详情':'新建装机服务'}}</h2><button class="icon-button" aria-label="关闭员工业务弹窗" :disabled="busy" @click="close"><X :size="20"/></button></header>
   <form v-if="modal!=='detail'" @submit.prevent="save"><div class="form-body">
    <template v-if="modal==='employee'"><div class="form-grid"><label>工号<input v-model="form.code" required maxlength="30"/></label><label>员工姓名<input v-model="form.name" required maxlength="50"/></label><label>岗位<input v-model="form.role" required maxlength="50"/></label><label>联系电话<input v-model="form.phone" maxlength="40"/></label><label>销售提成比例（%）<input v-model="form.salesPercent" type="number" min="0" max="100" step="0.01" required/></label><label>装机提成比例（%）<input v-model="form.servicePercent" type="number" min="0" max="100" step="0.01" required/></label></div><label>员工状态<select v-model="form.active"><option :value="true">在职</option><option :value="false">停用</option></select></label><p class="form-intro">修改比例仅影响以后确认的业务，历史提成保留原比例与姓名。员工档案独立于登录账号。</p></template>
    <template v-else><label>装机客户<select aria-label="装机客户" v-model="form.customerId" required @change="form.orderId=''"><option value="" disabled>选择客户档案</option><option v-for="c in customers" :key="c.id" :value="c.id">{{c.name}}</option></select></label><label>装机员工<select aria-label="装机员工" v-model="form.employeeId" required><option value="" disabled>选择在职员工</option><option v-for="e in employees.filter(e=>e.active)" :key="e.id" :value="e.id">{{e.name}} · {{e.role}}</option></select></label><label>指派方式<select aria-label="指派方式" v-model="form.designated"><option :value="false">门店安排</option><option :value="true">客户点名</option></select></label><label>服务项目<input v-model="form.title" required maxlength="120"/></label><label>装机服务费（元）<input v-model="form.feeYuan" type="number" min="0" max="1000000" step="0.01" required/></label><label>关联销售单（选填）<select v-model="form.orderId"><option value="">无关联 · 客户自带配件</option><option v-for="o in sales" :key="o.id" :value="o.id">{{o.number}} · {{money(o.total)}}</option></select></label><label>服务说明<textarea v-model="form.note" maxlength="500" rows="3"/></label><p class="form-intro">先建立待装机服务单，开始装机并确认完成后，才计入服务收入和员工提成。零收费服务也可以记录。</p></template>
    <p v-if="error" class="form-error" role="alert">{{error}}</p></div><footer class="drawer-footer"><button class="button secondary" type="button" :disabled="busy" @click="close">取消</button><button class="button primary" type="submit" :disabled="busy">{{busy?'保存中…':modal==='employee'?'保存员工':'创建装机单'}}</button></footer></form>
   <div v-else class="form-body"><h3>{{form.number}}</h3><div class="detail-facts"><div><span>客户</span><b>{{form.customer}}</b></div><div><span>装机员工</span><b>{{form.employeeName}}</b></div><div><span>指派方式</span><b>{{form.designated?'客户点名':'门店安排'}}</b></div><div><span>项目</span><b>{{form.title}}</b></div><div><span>状态</span><b>{{labels[form.status]}}</b></div><div><span>配件销售单</span><b>{{form.orderNumber||'客户自带配件 / 未关联'}}</b></div><div><span>完成时间</span><b>{{date(form.completedAt)}}</b></div><div><span>已计提</span><b>{{form.commission==null?'未计提':money(form.commission)+'（'+form.rateBps/100+'%）'}}</b></div></div><div class="order-total"><span>服务费</span><strong>{{money(form.fee)}}</strong></div><p class="form-intro">{{form.note||'无补充说明'}}</p></div>
  </div></dialog>
 </section>
</template>

<style scoped>
.workforce-note{margin:18px 0}.commission-description{white-space:normal;min-width:220px;max-width:330px;line-height:1.8}.detail-facts b{text-align:right;overflow-wrap:anywhere}.workforce-page .table-scroll{max-height:65vh;overflow:auto}.workforce-page .drawer .form-body{overflow-wrap:anywhere}
@media(max-width:700px){.workforce-page .business-summary{grid-template-columns:minmax(0,1fr)}.workforce-page .business-summary article{padding:14px 18px}.workforce-page .business-summary article>svg{display:block}.workforce-page .business-summary article>span{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-width:0}.workforce-page .business-summary b{font-size:20px;margin:0}.workforce-page .search{min-width:0;max-width:100%}}
</style>
