<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePagination } from './vendor/vben/use-pagination'
import BusinessPanel from './components/BusinessPanel.vue'
import WorkforcePanel from './components/WorkforcePanel.vue'
import ReportsPanel from './components/ReportsPanel.vue'
import UsersPanel from './components/UsersPanel.vue'
import AuditPanel from './components/AuditPanel.vue'
import ReturnsPanel from './components/ReturnsPanel.vue'
import ReconcilePanel from './components/ReconcilePanel.vue'
import ApprovalPanel from './components/ApprovalPanel.vue'
import PrintSheet from './components/PrintSheet.vue'
import ThemePicker from './components/ThemePicker.vue'
import AdminLayout from './vendor/soybean/libs/admin-layout/index.vue'
import { Boxes, ArrowDownLeft, ArrowUpRight, ArrowRight, Plus, Search, ChevronDown, ChevronLeft, ChevronRight, Download, SlidersHorizontal, Cpu, CircuitBoard, MemoryStick, HardDrive, Mouse, Zap, Monitor, X, Check, RefreshCw, Package, Layers, Activity, Command, Menu, CircleAlert, ExternalLink, LayoutGrid, List, Pencil, ArrowDownUp, Users, ClipboardCheck, FileText, Save, HandCoins } from 'lucide-vue-next'

const draftId=ref(null), orderTab=ref('posted'), changed=ref([])
const emit = defineEmits(['logout', 'session-expired'])
const props = defineProps({ user: { type: Object, default: () => ({ username: '', role: 'clerk' }) } })
const ROLE_RANK = { clerk: 1, manager: 2, admin: 3 }
const meRole = computed(() => props.user?.role || 'clerk')
const navVisible = computed(() => nav.filter(n => !n.minRole || ROLE_RANK[meRole.value] >= ROLE_RANK[n.minRole]))
const canEditCatalog = computed(() => ROLE_RANK[meRole.value] >= ROLE_RANK.manager)
const view=ref('table'), sort=ref('newest'), pageSize=ref(10)
const nav = [ {id:'inventory',label:'商品与库存',icon:Boxes}, {id:'purchase',label:'采购入库',icon:ArrowDownLeft}, {id:'sale',label:'销售出库',icon:ArrowUpRight}, {id:'ledger',label:'库存流水',icon:Activity}, {id:'partners',label:'客户与供应商',icon:Users}, {id:'stocktake',label:'库存盘点',icon:ClipboardCheck}, {id:'employees',label:'员工档案',icon:Users}, {id:'services',label:'装机服务',icon:Cpu}, {id:'returns',label:'退货与报损',icon:ArrowDownUp}, {id:'reconcile',label:'应收应付',icon:HandCoins,minRole:'manager'}, {id:'approvals',label:'单据审批',icon:ClipboardCheck,minRole:'manager'}, {id:'commissions',label:'员工提成',icon:FileText}, {id:'reports',label:'经营报表',icon:Activity,minRole:'manager'}, {id:'users',label:'用户权限',icon:Users,minRole:'admin'}, {id:'audit',label:'操作日志',icon:ClipboardCheck,minRole:'admin'} ]
const isMobile=ref(window.innerWidth <= 700), collapsed=ref(false)
const siderCollapse=computed({get:()=>isMobile.value?!mobile.value:collapsed.value,set:v=>{if(isMobile.value)mobile.value=!v;else collapsed.value=v}})
function resize(){isMobile.value=window.innerWidth<=700}
onMounted(()=>window.addEventListener('resize',resize))
onUnmounted(()=>window.removeEventListener('resize',resize))
const page=ref('inventory'), search=ref(''), category=ref('全部商品'), status=ref('all'), mobile=ref(false)
const data=ref({products:[],orders:[],movements:[],categories:[],partners:[],drafts:[],stocktakes:[]}), loading=ref(true), error=ref(''), toast=ref(''), saving=ref(false)
const dialog=ref(), modal=ref(''), formError=ref(''), selected=ref(null)
const product=ref({}), order=ref({}), connection=ref(false)
let toastTimer
const money=n=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:2}).format(n/100)
const date=s=>new Date(s).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
// 商品插图：优先用商品自己的图片，否则按分类回退到内置矢量图
const ART_BY_CATEGORY = { '处理器': 'cpu', '显卡': 'gpu', '内存': 'ram', '存储': 'ssd', '主板': 'mb', '电源 / 散热': 'psu', '外设': 'peripheral' }
function artOf(p) { return (p && p.image) || '/art/' + (ART_BY_CATEGORY[p && p.category] || 'cpu') + '.svg' }
const icon=p=>p.category==='处理器'?Cpu:p.category==='显卡'||p.category==='主板'?CircuitBoard:p.category==='内存'?MemoryStick:p.category==='存储'?HardDrive:p.category==='电源 / 散热'?Zap:p.name.includes('OLED')?Monitor:Mouse
const tone=p=>p.category==='处理器'?'orange':p.category==='显卡'?'blue':p.category==='内存'?'violet':p.category==='存储'?'silver':'blue'
const stockLabel=p=>p.stock===0?'已缺货':p.stock<=p.threshold?'库存偏低':'库存充足'
const low=computed(()=>data.value.products.filter(p=>p.stock<=p.threshold))
const totalStock=computed(()=>data.value.products.reduce((s,p)=>s+p.stock,0))
const inventoryValue=computed(()=>data.value.products.reduce((s,p)=>s+p.stock*p.cost,0))
const salesValue=computed(()=>data.value.orders.filter(o=>o.type==='sale').reduce((s,o)=>s+o.total,0))
const filtered=computed(()=>data.value.products.filter(p=>(category.value==='全部商品'||category.value===p.category)&&(status.value==='all'||(status.value==='low'&&p.stock<=p.threshold)||(status.value==='ok'&&p.stock>p.threshold))&&`${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(search.value.toLowerCase())))
const orders=computed(()=>data.value.orders.filter(o=>o.type===page.value&&`${o.number} ${o.partner}`.toLowerCase().includes(search.value.toLowerCase())))
const movements=computed(()=>data.value.movements.filter(m=>`${m.name} ${m.sku} ${m.orderNumber||''}`.toLowerCase().includes(search.value.toLowerCase())))
const sortedProducts=computed(()=>[...filtered.value].sort((a,b)=>sort.value==='stock'?a.stock-b.stock:sort.value==='price'?b.price-a.price:sort.value==='name'?a.name.localeCompare(b.name,'zh-CN'):0))
const currentRows=computed(()=>page.value==='inventory'?sortedProducts.value:page.value==='ledger'?movements.value:orders.value)
const {paginationList,currentPage,total,setCurrentPage,setPageSize}=usePagination(currentRows,10)
const pageCount=computed(()=>Math.max(1,Math.ceil(total.value/pageSize.value)))
watch([search,category,status,sort,page],()=>setCurrentPage(1))
watch(pageSize,n=>setPageSize(Number(n)))
function resetFilters(){search.value='';category.value='全部商品';status.value='all';sort.value='newest'}
function keyboard(e){if(e.key==='/'&&!modal.value&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();document.querySelector('.search input')?.focus()}}
onMounted(()=>window.addEventListener('keydown',keyboard))
onUnmounted(()=>{window.removeEventListener('keydown',keyboard);clearTimeout(toastTimer)})
const drafts=computed(()=>(data.value.drafts||[]).filter(d=>d.payload.type===page.value))
const partnerOptions=computed(()=>(data.value.partners||[]).filter(p=>p.kind===(modal.value==='purchase'?'supplier':'customer')))
const title=computed(()=>nav.find(n=>n.id===page.value).label)
const amount=computed(()=>(order.value.lines||[]).reduce((s,l)=>s+(Number(l.quantity)||0)*Math.round((Number(l.price)||0)*100),0))
const detailMovements=computed(()=>selected.value?data.value.movements.filter(m=>m.productId===selected.value.id):[])
async function api(path,body,method) {
  const init={method:method||(body?'POST':'GET')};if(body){init.headers={'Content-Type':'application/json'};init.body=JSON.stringify(body)}
  const response=await fetch(`/api/${path}`,init)
  const result=await response.json()
  if(response.status===401) { emit('session-expired'); throw new Error('登录已过期，请重新登录') }
  if(!response.ok) throw new Error(Array.isArray(result.message)?result.message.join('；'):result.message||'请求失败')
  return result
}
async function load(){loading.value=true;error.value='';try{const fresh=await api('workspace');changed.value=fresh.products.filter(p=>{const old=data.value.products.find(o=>o.id===p.id);return old&&old.stock!==p.stock}).map(p=>p.id);data.value=fresh;connection.value=true}catch(e){error.value='无法连接服务器，请确认服务已启动后重试。';connection.value=false}finally{loading.value=false}}
// 库存流水走服务端分页，避免一次性把全部流水拉到前端
// 单据与流水类型的中文名，新增类型只改这一处
const TYPE_LABEL = { purchase: '采购入库', sale: '销售出库', return_in: '销售退货', return_out: '采购退货', scrap: '报损', stocktake: '盘点调整', opening: '期初建账' }
function typeLabel(type) { return TYPE_LABEL[type] || type }
const ledgerRows = ref([]), ledgerTotal = ref(0), ledgerPage = ref(1), ledgerLoading = ref(false)
async function loadLedger(reset = true) {
  if (reset) { ledgerPage.value = 1; ledgerRows.value = [] }
  ledgerLoading.value = true
  try {
    const query = encodeURIComponent(search.value.trim())
    const result = await api('movements?page=' + ledgerPage.value + '&size=20&q=' + query, null, 'GET')
    ledgerRows.value = reset ? result.items : [...ledgerRows.value, ...result.items]
    ledgerTotal.value = result.total
  } catch (e) { notify(e.message || '流水加载失败') } finally { ledgerLoading.value = false }
}
function loadMoreLedger() { ledgerPage.value += 1; loadLedger(false) }
watch([page, search], () => { if (page.value === 'ledger') loadLedger(true) })
// 单据打印：弹出 A4 预览，点打印走浏览器打印
const printOrder = ref(null)
function startPrint(order) { if (!order) return; dialog.value?.close(); modal.value = ''; printOrder.value = order }
function notify(s){toast.value=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',4500)}
function navigate(id){page.value=id;search.value='';mobile.value=false}
async function open(type,p){if((type==='edit'||type==='product')&&!canEditCatalog.value){notify('当前角色没有修改商品资料的权限');return}draftId.value=null;modal.value=type;formError.value='';selected.value=p||null;if(type==='edit')product.value={...p,cost:p.cost/100,price:p.price/100};if(type==='product')product.value={name:'',sku:'',brand:'',category:'处理器',cost:'',price:'',threshold:5};if(type==='purchase'||type==='sale'){order.value={partner:'',note:'',employeeId:'',lines:[{productId:p?.id||'',quantity:1,price:p?(type==='purchase'?p.cost:p.price)/100:''}]}}await nextTick();dialog.value.showModal()}
function close(){if(!saving.value){dialog.value.close();modal.value=''}}
function updateLine(line){const p=data.value.products.find(p=>p.id===line.productId);line.price=p?(modal.value==='purchase'?p.cost:p.price)/100:''}
function orderBody(){return {type:modal.value,partner:order.value.partner,note:order.value.note,employeeId:order.value.employeeId||'',lines:order.value.lines.map(l=>({productId:l.productId,quantity:Number(l.quantity),unitPrice:Math.round(Number(l.price)*100)}))}}
async function saveDraft(){saving.value=true;formError.value='';try{const r=await api(draftId.value?`drafts/${draftId.value}`:'drafts',orderBody(),draftId.value?'PATCH':'POST');draftId.value=r.id;saving.value=false;close();notify('草稿已保存，库存未发生变化');await load()}catch(e){formError.value=e.message}finally{saving.value=false}}
async function editDraft(d){await open(d.payload.type);draftId.value=d.id;order.value={...d.payload,lines:d.payload.lines.map(l=>({...l,price:l.unitPrice/100}))}}
async function submit(){saving.value=true;formError.value='';try{if(modal.value==='product'||modal.value==='edit'){const editing=modal.value==='edit';await api(editing?`products/${selected.value.id}`:'products',{...product.value,cost:Math.round(Number(product.value.cost)*100),price:Math.round(Number(product.value.price)*100),threshold:Number(product.value.threshold)},editing?'PATCH':'POST');notify(editing?'商品资料已更新，库存数量保持不变':'商品已创建，可继续办理采购入库')}else{
// Save first so retrying confirmation cannot post the same draft twice.
const draft=await api(draftId.value?`drafts/${draftId.value}`:'drafts',orderBody(),draftId.value?'PATCH':'POST');draftId.value=draft.id;
const r=await api(`drafts/${draft.id}/post`,{});notify(`${r.number} 已完成，库存已同步更新`)}saving.value=false;close();await load()}catch(e){formError.value=e.message}finally{saving.value=false}}
function exportCsv(){const rows=(orderTab.value==='draft'&&(page.value==='purchase'||page.value==='sale'))?[['往来单位','商品行数','状态','保存时间'],...drafts.value.map(d=>[d.payload.partner,d.payload.lines.length,'草稿',d.updatedAt])]:page.value==='inventory'?[['SKU','商品','分类','品牌','采购参考价','销售价','库存'],...filtered.value.map(p=>[p.sku,p.name,p.category,p.brand,p.cost/100,p.price/100,p.stock])]:page.value==='ledger'?[['商品','单据','类型','变动','结余','时间'],...movements.value.map(m=>[m.name,m.orderNumber||'期初',m.type,m.delta,m.balance,m.createdAt])]:[['单据','往来单位','金额','时间'],...orders.value.map(o=>[o.number,o.partner,o.total/100,o.createdAt])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+\-@]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`GearFlow-${page.value}.csv`;a.click();URL.revokeObjectURL(url);notify('已导出当前筛选结果')}
onMounted(load)
</script>

<template>
 <div :class="['shell soy-workspace', {'is-collapsed':collapsed&&!isMobile}]">
  <AdminLayout v-model:sider-collapse="siderCollapse" :is-mobile="isMobile" :sider-width="216" :sider-collapsed-width="68" :header-height="54" :tab-height="42" :footer-visible="false" common-class="soy-transition" content-class="soy-content" mobile-sider-class="soy-mobile-sider">
  <template #sider>

  <aside :class="['sidebar',{open:mobile}]">
   <a class="brand" href="#" @click.prevent="navigate('inventory')"><span class="logo"><Layers :size="22"/></span>GEAR<span>FLOW</span><small>WORKSPACE</small></a>
   <div class="workspace"><span class="workspace-icon"><Cpu :size="17"/></span><div><b>电脑配件工作区</b><small>本地体验版</small></div><span class="workspace-badge">01</span></div>
   <div class="nav-caption">WORKSPACE <span>工作空间</span></div>
   <nav><button v-for="n in navVisible" :key="n.id" :title="n.label" :aria-label="n.label" :class="{active:page===n.id}" @click="navigate(n.id)"><component :is="n.icon" :size="18"/><span>{{n.label}}</span><span v-if="n.id==='inventory'" class="nav-count">{{data.products.length}}</span></button></nav>
   <div class="sidebar-note"><span class="tiny-square"></span> 从一件配件，到每一笔生意。<div class="wire-cube"><Boxes :size="58" stroke-width=".7"/></div></div>
   <div class="sidebar-foot"><span :class="['connection',{online:connection}]"></span>{{connection?'服务器已连接':'服务器未连接'}}<small>LOCAL</small></div>
  </aside>
  </template>
  <template #header>
   <header class="topbar"><button class="icon-button layout-toggle" :aria-label="isMobile?'打开导航':collapsed?'展开侧栏':'折叠侧栏'" @click="siderCollapse=!siderCollapse"><Menu :size="20"/></button><div class="breadcrumbs">工作空间 <ChevronRight :size="13"/><b>{{title}}</b></div><div class="top-right"><ThemePicker/><span class="demo-label">本地演示 · 单工作区</span><button class="icon-button" aria-label="刷新数据" @click="load"><RefreshCw :size="16" :class="{spin:loading}"/></button><button class="icon-button" style="width:auto;padding:0 6px;font-size:11px" @click="emit('logout')" aria-label="退出登录">退出</button><span class="avatar">GF</span></div></header>
  </template>
  <template #tab><div class="workspace-tabs"><button v-for="n in navVisible" :key="n.id" :class="{selected:page===n.id}" @click="navigate(n.id)"><component :is="n.icon" :size="13"/>{{n.label}}</button><span>GEARFLOW / 工作台</span></div></template>
   <div class="content">
    <WorkforcePanel v-if="['employees','services','commissions'].includes(page)" :key="page" :page="page" :data="data" :api="api" @refresh="load" @notify="notify"/>
    <BusinessPanel v-else-if="page==='partners'||page==='stocktake'" :key="page" :page="page" :data="data" :api="api" @refresh="load" @notify="notify"/>
    <ReportsPanel v-else-if="page==='reports'" :api="api" @notify="notify"/>
    <UsersPanel v-else-if="page==='users'" :api="api" :me="props.user?.username || ''" @notify="notify"/>
    <AuditPanel v-else-if="page==='audit'" :api="api" @notify="notify"/>
    <ReturnsPanel v-else-if="page==='returns'" :api="api" :data="data" @refresh="load" @notify="notify"/>
    <ReconcilePanel v-else-if="page==='reconcile'" :api="api" @notify="notify"/>
    <ApprovalPanel v-else-if="page==='approvals'" :api="api" @notify="notify" @refresh="load"/>
    <template v-else>
    <div class="page-title"><div><div class="eyebrow">{{page==='inventory'?'INVENTORY MANAGEMENT':page==='purchase'?'PURCHASE MANAGEMENT':page==='sale'?'SALES MANAGEMENT':'INVENTORY ACTIVITY'}}</div><h1>{{title}}<span class="title-dot"></span></h1><p>{{page==='inventory'?'管理硬件档案与可用库存，采购、销售一步完成。':page==='purchase'?'记录采购商品与供应商，确认后同步增加可用库存。':page==='sale'?'选择商品与客户，确认出库后同步扣减库存。':'追踪每一次入库与出库，让库存变化有据可查。'}}</p></div><div class="title-actions"><button class="button secondary" @click="exportCsv"><Download :size="15"/>导出数据</button><button class="button primary" v-if="page!=='ledger'&&(page!=='inventory'||canEditCatalog)" :disabled="!connection" @click="open(page==='inventory'?'product':page)"><Plus :size="17"/>{{page==='inventory'?'新建商品':page==='purchase'?'采购入库':'销售出库'}}</button></div></div>
    <div v-if="error" class="error-banner" role="alert"><CircleAlert :size="17"/>{{error}}<button @click="load">重试</button></div>
    <section v-if="page==='inventory'" class="metrics"><article><div class="metric-label">库存资产价值 <Layers :size="16"/></div><strong>{{money(inventoryValue)}}</strong><div class="metric-bottom"><span class="blue-mark"></span>按商品采购参考价估算</div></article><article><div class="metric-label">在库商品总量 <Boxes :size="16"/></div><strong>{{totalStock.toLocaleString()}}<small>件</small></strong><div class="metric-bottom">覆盖 <b>{{data.products.length}}</b> 个商品 SKU</div></article><article><div class="metric-label">累计销售金额 <ArrowUpRight :size="16"/></div><strong>{{money(salesValue)}}</strong><div class="metric-bottom">已完成 <b>{{data.orders.filter(o=>o.type==='sale').length}}</b> 笔销售出库</div></article><article class="warning-metric" @click="navigate('inventory');category='全部商品';status='low'"><div class="metric-label">需要关注 <CircleAlert :size="16"/></div><strong>{{low.length.toString().padStart(2,'0')}}<small>项</small></strong><button class="metric-bottom">查看低库存商品 <ArrowRight :size="13"/></button></article></section>
    <div v-if="loading&&!data.products.length" class="skeleton-panel" aria-label="正在加载数据"><div v-for="i in 6" :key="i"></div></div>
    <Transition name="page" mode="out-in"><section :key="page" class="data-panel">
     <template v-if="page==='inventory'">
      <div class="panel-nav"><div class="category-tabs"><button v-for="c in ['全部商品',...data.categories]" :key="c" :class="{active:category===c}" @click="category=c">{{c}}<span v-if="c==='全部商品'">{{data.products.length}}</span></button></div></div>
      <div class="toolbar"><label class="search"><Search :size="16"/><input v-model="search" aria-label="搜索商品" placeholder="搜索商品名称、SKU 或品牌…"/><kbd>/</kbd></label><div class="filter-controls"><label class="select-wrap"><SlidersHorizontal :size="14"/><select v-model="status" aria-label="库存状态"><option value="all">所有库存状态</option><option value="low">低库存 / 缺货</option><option value="ok">库存充足</option></select></label><label class="select-wrap"><ArrowDownUp :size="14"/><select v-model="sort" aria-label="商品排序"><option value="newest">最近创建</option><option value="stock">库存从低到高</option><option value="price">价格从高到低</option><option value="name">商品名称</option></select></label><div class="view-switch" v-if="!isMobile"><button :class="{active:view==='table'}" aria-label="表格视图" @click="view='table'"><List :size="16"/></button><button :class="{active:view==='cards'}" aria-label="卡片视图" @click="view='cards'"><LayoutGrid :size="16"/></button></div></div></div>
      <div v-if="search||category!=='全部商品'||status!=='all'" class="active-filters"><span>筛选结果 {{filtered.length}} 项</span><span v-if="category!=='全部商品'">{{category}}</span><span v-if="status!=='all'">{{status==='low'?'低库存 / 缺货':'库存充足'}}</span><button @click="resetFilters"><X :size="12"/>清除筛选</button></div>
      <div v-if="isMobile||view==='cards'" class="catalog-grid"><article v-for="p in paginationList" :key="p.id" class="catalog-card" :class="{'stock-updated':changed.includes(p.id)}"><div class="catalog-top"><span :class="['product-art',tone(p)]"><img :src="artOf(p)" alt="" loading="lazy"/></span><span :class="['status',p.stock===0?'out':p.stock<=p.threshold?'low':'normal']"><i></i>{{stockLabel(p)}}</span></div><button class="catalog-name" @click="open('detail',p)">{{p.name}}</button><small>{{p.sku}}</small><div class="catalog-meta"><span>{{p.brand}} · {{p.category}}</span><b>{{money(p.price)}}</b></div><div class="catalog-stock"><span>可用库存 <b>{{p.stock}}</b> 件</span><button @click="open('edit',p)" aria-label="修改商品"><Pencil :size="14"/></button></div><div class="catalog-actions"><button @click="open('purchase',p)"><ArrowDownLeft :size="14"/>入库</button><button @click="open('sale',p)" :disabled="!p.stock"><ArrowUpRight :size="14"/>出库</button></div></article></div>
      <div v-else class="table-scroll"><table class="product-table"><thead><tr><th class="number-col">#</th><th>商品信息</th><th>分类 / 品牌</th><th>销售单价</th><th>可用库存</th><th>库存状态</th><th class="right">快捷操作</th></tr></thead><tbody><tr v-for="(p,i) in paginationList" :key="p.id" :class="{'stock-updated':changed.includes(p.id)}" :style="{'--row':Math.min(i,9)}"><td class="row-number">{{String((currentPage-1)*pageSize+i+1).padStart(2,'0')}}</td><td><button class="product-name" @click="open('detail',p)"><span :class="['product-art',tone(p)]"><img :src="artOf(p)" alt="" loading="lazy"/><span class="art-grid"></span></span><span><b>{{p.name}}</b><small>{{p.sku}}</small></span></button></td><td><span class="category-text">{{p.category}}</span><small class="brand-text">{{p.brand}}</small></td><td class="price">{{money(p.price)}}</td><td><div class="stock-cell"><b>{{p.stock}}</b><span>件</span><div class="stock-track"><i :class="{low:p.stock<=p.threshold}" :style="{width:Math.min(100,p.stock/Math.max(1,p.threshold*8)*100)+'%'}"></i></div></div></td><td><span :class="['status',p.stock===0?'out':p.stock<=p.threshold?'low':'normal']"><i></i>{{stockLabel(p)}}</span></td><td><div class="row-actions"><button @click="open('purchase',p)" :aria-label="p.name+'入库'"><ArrowDownLeft :size="13"/>入库</button><button @click="open('sale',p)" :disabled="!p.stock" :aria-label="p.name+'出库'"><ArrowUpRight :size="13"/>出库</button><button class="detail-arrow" @click="open('edit',p)" :aria-label="p.name+'修改商品'"><Pencil :size="14"/></button></div></td></tr></tbody></table></div>
      <div v-if="!filtered.length" class="empty"><Package :size="34"/><h3>{{loading?'正在读取商品…':'没有找到商品'}}</h3><p>可以调整筛选条件，或新建第一个商品。</p></div>
      
     </template>
     <template v-else-if="page==='purchase'||page==='sale'">
      <div class="order-tabs"><button :class="{active:orderTab==='posted'}" @click="orderTab='posted'">已完成单据 <span>{{orders.length}}</span></button><button :class="{active:orderTab==='draft'}" @click="orderTab='draft'">草稿箱 <span>{{drafts.length}}</span></button></div>
      <div v-if="orderTab==='draft'" class="draft-list"><article v-for="d in drafts" :key="d.id" class="draft-card"><span class="draft-icon"><FileText :size="22"/></span><div><h3>{{d.payload.partner||'待填写往来单位'}}</h3><p>{{d.payload.lines.length}} 项商品 · {{date(d.updatedAt)}}</p><small>{{d.payload.note||'未填写备注'}}</small></div><span class="status low">未记账</span><button class="button secondary" @click="editDraft(d)"><Pencil :size="14"/>继续编辑</button></article><div class="empty" v-if="!drafts.length"><FileText :size="32"/><h3>草稿箱为空</h3><p>开单时可先保存草稿，确认后再更新库存。</p></div></div>
      <template v-else>
      <div class="toolbar"><div class="panel-heading"><h2>{{page==='purchase'?'采购记录':'销售记录'}}</h2><span>{{orders.length}} 笔单据</span></div><label class="search"><Search :size="16"/><input v-model="search" aria-label="搜索单据" placeholder="搜索单号或往来单位…"/></label></div>
      <div class="table-scroll"><table><thead><tr><th>单据编号</th><th>{{page==='purchase'?'供应商':'客户'}}</th><th>商品明细</th><th>合计金额</th><th>完成时间</th><th>状态</th></tr></thead><tbody><tr v-for="o in paginationList" :key="o.id"><td><button class="order-link" @click="open('order-detail',o)">{{o.number}} <ArrowRight :size="12"/></button></td><td>{{o.partner}}</td><td><div v-for="l in o.lines" :key="l.id" class="order-line">{{l.name}} <span>× {{l.quantity}}</span></div><small v-if="o.note" class="brand-text">{{o.note}}</small></td><td class="price">{{money(o.total)}}</td><td class="muted">{{date(o.createdAt)}}</td><td><span v-if="o.status==='pending'" class="status low">待审批</span><span v-else-if="o.status==='rejected'" class="status out">已驳回</span><span v-else class="status normal"><Check :size="12"/>已{{page==='purchase'?'入库':'出库'}}</span></td></tr></tbody></table></div><div v-if="!orders.length" class="empty"><component :is="page==='purchase'?ArrowDownLeft:ArrowUpRight" :size="36"/><h3>还没有{{page==='purchase'?'采购':'销售'}}记录</h3><p>新建一笔单据，商品库存和流水将自动更新。</p><button class="button primary" @click="open(page)"><Plus :size="15"/>创建第一笔单据</button></div>
      </template>
     </template>
     <template v-else><div class="toolbar"><div class="panel-heading"><h2>库存变动记录</h2><span>{{ledgerTotal}} 条记录</span></div><label class="search"><Search :size="16"/><input v-model="search" aria-label="搜索库存流水" placeholder="搜索商品、SKU 或单号…"/></label></div><div class="table-scroll"><table><thead><tr><th>商品</th><th>业务类型</th><th>关联单据</th><th>数量变化</th><th>变动后库存</th><th>时间</th></tr></thead><tbody><tr v-for="m in ledgerRows" :key="m.id"><td>{{m.name}}<small class="brand-text">{{m.sku}}</small></td><td>{{typeLabel(m.type)}}</td><td class="mono">{{m.orderNumber||'—'}}</td><td :class="m.delta>=0?'text-blue':'text-amber'">{{m.delta>0?'+':''}}{{m.delta}}</td><td>{{m.balance}} 件</td><td class="muted">{{date(m.createdAt)}}</td></tr></tbody></table></div><div v-if="!ledgerRows.length" class="empty">没有匹配的库存流水</div><div class="table-footer ledger-footer"><span>共 {{ledgerTotal}} 条 · 已加载 {{ledgerRows.length}}</span><button v-if="ledgerLoading" class="button secondary" disabled>加载中…</button><button v-else-if="ledgerRows.length<ledgerTotal" class="button secondary" @click="loadMoreLedger">加载更多</button></div></template>
    <div v-if="!(orderTab==='draft'&&(page==='purchase'||page==='sale'))&&page!=='ledger'" class="table-footer pagination"><span>共 {{total}} 条<span class="desktop-only"> · 当前 {{total?((currentPage-1)*pageSize+1):0}}–{{Math.min(currentPage*pageSize,total)}}</span></span><div><select v-model.number="pageSize" aria-label="每页数量"><option :value="10">10 条 / 页</option><option :value="20">20 条 / 页</option><option :value="50">50 条 / 页</option></select><button :disabled="currentPage<=1" @click="setCurrentPage(currentPage-1)" aria-label="上一页"><ChevronLeft :size="16"/></button><b>{{currentPage}} / {{pageCount}}</b><button :disabled="currentPage>=pageCount" @click="setCurrentPage(currentPage+1)" aria-label="下一页"><ChevronRight :size="16"/></button></div></div>
    </section></Transition>
    <footer class="page-footer"><span>GEARFLOW <i>/</i> 每一笔流转，清晰可见。</span><span>本地体验 · 初始商品为演示数据</span></footer>
    </template>
   </div>
  </AdminLayout>
  <Transition name="toast"><div v-if="toast" role="status" class="toast"><span><Check :size="16"/></span>{{toast}}</div></Transition>
  <dialog ref="dialog" :class="['drawer',{'wide':modal==='purchase'||modal==='sale'||modal==='order-detail'}]" @cancel.prevent="close" @click="e=>{if(e.target===dialog)close()}">
   <div class="drawer-inner" v-if="modal" :key="modal"><header class="drawer-header"><div><div class="eyebrow">{{modal==='order-detail'?'TRANSACTION DETAILS':modal==='edit'?'EDIT PRODUCT':modal==='product'?'NEW PRODUCT':modal==='detail'?'PRODUCT DETAILS':'NEW TRANSACTION'}}</div><h2>{{modal==='order-detail'?'单据详情':modal==='edit'?'编辑商品资料':modal==='product'?'新建商品':modal==='detail'?'商品详情':modal==='purchase'?'采购入库':'销售出库'}}</h2></div><button class="icon-button" aria-label="关闭弹窗" @click="close" :disabled="saving"><X :size="20"/></button></header>
    <template v-if="modal==='order-detail'"><div class="form-body order-details"><span v-if="selected.status==='pending'" class="status low">待审批</span><span v-else-if="selected.status==='rejected'" class="status out">已驳回</span><span v-else class="status normal"><Check :size="12"/>已记账</span><h2>{{selected.number}}</h2><div class="detail-facts"><div><span>业务类型</span><b>{{typeLabel(selected.type)}}</b></div><div><span>往来单位</span><b>{{selected.partner}}</b></div><div><span>完成时间</span><b>{{date(selected.createdAt)}}</b></div></div><div class="table-scroll"><table><thead><tr><th>商品</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody><tr v-for="l in selected.lines" :key="l.id"><td>{{l.name}}<small class="brand-text">{{l.sku}}</small></td><td>{{l.quantity}}</td><td>{{money(l.unitPrice)}}</td><td>{{money(l.quantity*l.unitPrice)}}</td></tr></tbody></table></div><div class="order-total"><span>单据合计</span><strong>{{money(selected.total)}}</strong></div><p class="form-intro">接待员工：{{(data.commissions||[]).find(c=>c.orderId===selected.id)?.employeeName||'未指定'}}<br/>备注：{{selected.note||'无'}}</p></div><div class="drawer-footer"><button class="button secondary" @click="startPrint(selected)"><Download :size="14"/>打印单据</button></div></template>
    <template v-else-if="modal==='detail'"><div class="detail-product"><span :class="['product-art',tone(selected)]"><img :src="artOf(selected)" alt="" loading="lazy"/></span><h3>{{selected.name}}</h3><p>{{selected.sku}} · {{selected.brand}}</p></div><div class="detail-stats"><div><small>可用库存</small><b>{{selected.stock}} 件</b></div><div><small>销售单价</small><b>{{money(selected.price)}}</b></div><div><small>采购参考价</small><b>{{money(selected.cost)}}</b></div></div><h3 class="detail-heading">库存流水</h3><div class="detail-history"><div v-for="m in detailMovements" :key="m.id"><span>{{typeLabel(m.type)}}<small>{{date(m.createdAt)}}</small></span><b>{{m.delta>0?'+':''}}{{m.delta}} 件</b></div></div><div class="drawer-footer"><button class="button secondary" @click="open('edit',selected)"><Pencil :size="14"/>编辑资料</button><button class="button secondary" @click="open('purchase',selected)">采购入库</button><button class="button primary" :disabled="!selected.stock" @click="open('sale',selected)">销售出库</button></div></template>
    <form v-else @submit.prevent="submit"><div class="form-body"><p class="form-intro">{{modal==='edit'?'修改价格、品牌和预警值。库存数量只能通过业务单据变更。':modal==='product'?'建立商品档案，初始库存为 0。创建后通过采购入库增加库存。':'确认后立即记账，单据、库存和流水将同步更新。'}}</p><template v-if="modal==='product'||modal==='edit'"><label>商品名称<input v-model="product.name" required maxlength="120" placeholder="例如：AMD Ryzen 7 9700X"/></label><div class="form-grid"><label>SKU 编码<input v-model="product.sku" required maxlength="50" placeholder="CPU-AMD-9700X"/></label><label>品牌<input v-model="product.brand" required maxlength="40" placeholder="例如：AMD"/></label><label>商品分类<select v-model="product.category"><option v-for="c in data.categories" :key="c">{{c}}</option></select></label><label>预警库存<input v-model="product.threshold" type="number" min="0" max="1000000" step="1" required/></label><label>采购参考价（元）<input v-model="product.cost" type="number" min="0" max="1000000" step="0.01" required placeholder="0.00"/></label><label>销售价（元）<input v-model="product.price" type="number" min="0" max="1000000" step="0.01" required placeholder="0.00"/></label><label>图片地址（选填）<input v-model="product.image" maxlength="500" placeholder="/art/gpu.svg 或 https://..."/></label></div></template><template v-else><label>{{modal==='purchase'?'供应商名称':'客户名称'}}<input list="partner-options" v-model="order.partner" required maxlength="120" :placeholder="modal==='purchase'?'例如：深圳联强电子':'例如：极客装机工作室'"/></label><datalist id="partner-options"><option v-for="p in partnerOptions" :key="p.id" :value="p.name"/></datalist><label v-if="modal==='sale'">接待销售员工<select v-model="order.employeeId"><option value="">不指定 · 不计员工提成</option><option v-for="e in (data.employees||[]).filter(e=>e.active)" :key="e.id" :value="e.id">{{e.name}} · 销售提成 {{e.salesBps/100}}%</option></select></label><div class="line-title">商品明细 <button type="button" class="text-button" @click="order.lines.push({productId:'',quantity:1,price:''})" :disabled="order.lines.length>=50"><Plus :size="14"/>添加一行</button></div><div v-for="(l,i) in order.lines" :key="i" class="form-line"><label class="line-product">商品<select aria-label="商品" v-model="l.productId" @change="updateLine(l)" required><option disabled value="">选择商品</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{p.name}} · 库存 {{p.stock}}</option></select></label><label>数量<input v-model="l.quantity" type="number" required min="1" max="1000000" step="1"/></label><label>单价（元）<input v-model="l.price" type="number" required min="0" max="1000000" step="0.01"/></label><button type="button" class="icon-button remove-line" aria-label="删除商品行" :disabled="order.lines.length===1" @click="order.lines.splice(i,1)"><X :size="16"/></button></div><label>备注（选填）<textarea v-model="order.note" maxlength="500" placeholder="补充本次交易说明" rows="3"></textarea></label><div class="order-total"><span>单据合计</span><strong>{{money(amount)}}</strong></div></template><p v-if="formError" class="form-error" role="alert"><CircleAlert :size="16"/>{{formError}}</p></div><div class="drawer-footer"><button type="button" class="button secondary" @click="close" :disabled="saving">取消</button><button v-if="modal==='purchase'||modal==='sale'" class="button secondary" type="button" :disabled="saving" @click="saveDraft"><Save :size="15"/>保存草稿</button><button class="button primary" type="submit" :disabled="saving"><RefreshCw v-if="saving" :size="15" class="spin"/><Check v-else :size="15"/>{{saving?'正在保存…':modal==='edit'?'保存修改':modal==='product'?'创建商品':modal==='purchase'?'确认入库':'确认出库'}}</button></div></form>
   </div>
  </dialog>
  <PrintSheet v-if="printOrder" :order="printOrder" @close="printOrder=null" />
 </div>
</template>


