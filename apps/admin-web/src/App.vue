<script setup>
import { computed, ref } from 'vue'
import {
  Activity, Bell, Boxes, ChevronDown, CircleHelp, ClipboardList, Cpu, FileChartColumn,
  LayoutDashboard, Menu, Package, Search, Settings, ShoppingCart, SlidersHorizontal,
  Truck, Users, WalletCards, X, ArrowUpRight, ArrowDownRight, MoreHorizontal
} from 'lucide-vue-next'

const active = ref('dashboard')
const sidebarOpen = ref(false)
const range = ref('近 30 天')
const query = ref('')

const navGroups = [
  { title: '总览', items: [{ id: 'dashboard', label: '经营看板', icon: LayoutDashboard }] },
  { title: '业务管理', items: [
    { id: 'purchase', label: '采购入库', icon: Truck },
    { id: 'sale', label: '销售出库', icon: ShoppingCart },
    { id: 'inventory', label: '库存管理', icon: Boxes },
    { id: 'products', label: '商品资料', icon: Package },
    { id: 'partners', label: '客户与供应商', icon: Users }
  ] },
  { title: '分析报表', items: [
    { id: 'reports', label: '经营报表', icon: FileChartColumn },
    { id: 'logs', label: '库存流水', icon: ClipboardList }
  ] }
]

const metrics = [
  { label: '进行中的订单', value: '3', change: '+1', hint: '较昨日', icon: ShoppingCart, tone: 'teal' },
  { label: '库存总量', value: '1,284', change: '+32', hint: '较上月', icon: Boxes, tone: 'amber' },
  { label: '库存周转率', value: '73%', change: '+4.8%', hint: '较上月', icon: Activity, tone: 'violet' }
]

const lowStock = [
  { name: '影驰 RTX 4060 金属大师', sku: 'GPU-4060-GALAX', stock: 3, level: '紧急', color: 'danger' },
  { name: '金士顿 Fury 32GB DDR5', sku: 'RAM-DDR5-32', stock: 7, level: '偏低', color: 'warning' },
  { name: '西部数据 SN770 1TB', sku: 'SSD-SN770-1T', stock: 9, level: '偏低', color: 'warning' },
  { name: '罗技 G502 HERO', sku: 'MOUSE-G502-H', stock: 12, level: '关注', color: 'info' }
]

const filteredStock = computed(() => lowStock.filter((item) =>
  `${item.name}${item.sku}`.toLowerCase().includes(query.value.toLowerCase())
))

function selectNav(id) {
  active.value = id
  sidebarOpen.value = false
}
</script>

<template>
  <div class="app-shell">
    <div class="mobile-backdrop" :class="{ visible: sidebarOpen }" @click="sidebarOpen = false"></div>
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <div class="brand-mark"><Cpu :size="19" /></div>
        <div><strong>GearFlow</strong><span>硬件库存中心</span></div>
        <button class="icon-button close-sidebar" @click="sidebarOpen = false"><X :size="18" /></button>
      </div>
      <div class="workspace-switch">
        <div class="workspace-avatar">G</div>
        <div><b>GearFlow 旗舰店</b><span>运营工作区</span></div>
        <ChevronDown :size="15" />
      </div>
      <nav class="nav-area">
        <div v-for="group in navGroups" :key="group.title" class="nav-group">
          <div class="nav-title">{{ group.title }}</div>
          <button v-for="item in group.items" :key="item.id" class="nav-item" :class="{ active: active === item.id }" @click="selectNav(item.id)">
            <component :is="item.icon" :size="17" stroke-width="1.9" /><span>{{ item.label }}</span>
            <em v-if="item.id === 'inventory'">6</em>
          </button>
        </div>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-item"><Settings :size="17" /><span>系统设置</span></button>
        <button class="nav-item"><CircleHelp :size="17" /><span>帮助与支持</span></button>
        <div class="profile">
          <div class="profile-avatar">林</div><div><b>林晓峰</b><span>超级管理员</span></div><MoreHorizontal :size="18" />
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <button class="icon-button menu-button" @click="sidebarOpen = true"><Menu :size="20" /></button>
        <div class="breadcrumb"><span>工作台</span><b>/</b><strong>{{ navGroups.flatMap(g => g.items).find(i => i.id === active)?.label || '经营看板' }}</strong></div>
        <div class="top-actions">
          <label class="global-search"><Search :size="17" /><input v-model="query" placeholder="搜索商品、单据或客户" /><kbd>⌘ K</kbd></label>
          <button class="icon-button"><Bell :size="18" /><i></i></button>
          <button class="icon-button"><CircleHelp :size="18" /></button>
          <div class="top-avatar">林</div>
        </div>
      </header>

      <div class="page-content">
        <section class="page-heading">
          <div><p class="eyebrow">周二，2026 年 9 月 16 日</p><h1>早上好，林晓峰 <span>👋</span></h1><p class="subheading">这是今天的经营概览，愿你有高效的一天。</p></div>
          <div class="heading-actions"><button class="secondary-button"><SlidersHorizontal :size="16" />筛选</button><button class="primary-button"><ShoppingCart :size="16" />新建销售单</button></div>
        </section>

        <section class="metric-grid">
          <article v-for="metric in metrics" :key="metric.label" class="metric-card">
            <div class="metric-top"><span>{{ metric.label }}</span><div class="metric-icon" :class="metric.tone"><component :is="metric.icon" :size="17" /></div></div>
            <strong>{{ metric.value }}</strong><div class="metric-foot"><span class="change positive"><ArrowUpRight v-if="!metric.change.startsWith('-')" :size="14" /><ArrowDownRight v-else :size="14" />{{ metric.change }}</span><span>{{ metric.hint }}</span></div>
          </article>
        </section>

        <section class="dashboard-grid">
          <article class="panel sales-panel">
            <div class="panel-heading"><div><h2>销售趋势</h2><p>过去 30 天的销售额变化</p></div><select v-model="range"><option>近 30 天</option><option>近 90 天</option><option>今年以来</option></select></div>
            <div class="chart-legend"><span><i class="dot teal-dot"></i>销售额</span><b>¥ 386,920</b><span class="change positive">+8.6%</span></div>
            <div class="line-chart"><div class="y-labels"><span>40万</span><span>30万</span><span>20万</span><span>10万</span><span>0</span></div><div class="chart-area"><div class="grid-line" v-for="n in 5" :key="n" :style="{ top: `${(n - 1) * 25}%` }"></div><svg viewBox="0 0 720 220" preserveAspectRatio="none" aria-label="销售趋势图"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5267a8" stop-opacity=".2"/><stop offset="1" stop-color="#5267a8" stop-opacity="0"/></linearGradient></defs><path d="M0 185 C35 165 45 175 75 148 S120 170 150 132 S190 148 220 117 S260 140 290 105 S325 125 360 96 S405 126 440 83 S480 105 515 72 S550 98 585 59 S625 86 660 45 S690 64 720 30 L720 220 L0 220 Z" fill="url(#fill)"/><path d="M0 185 C35 165 45 175 75 148 S120 170 150 132 S190 148 220 117 S260 140 290 105 S325 125 360 96 S405 126 440 83 S480 105 515 72 S550 98 585 59 S625 86 660 45 S690 64 720 30" fill="none" stroke="#5267a8" stroke-width="3" stroke-linecap="round"/></svg><div class="x-labels"><span>8/18</span><span>8/24</span><span>8/30</span><span>9/5</span><span>9/11</span><span>9/16</span></div></div></div>
          </article>
          <article class="panel live-panel"><div class="panel-heading"><div><h2>实时库存监控</h2><p>仓库当前状态</p></div><button class="circle-arrow"><ArrowUpRight :size="15" /></button></div><div class="live-card"><div class="live-card-icon"><Boxes :size="16" /></div><div><b>主仓 · A 区硬件库</b><span><i></i>库存状态良好</span></div><strong>1,032<span>件</span></strong></div><div class="live-card pale"><div class="live-card-icon"><Package :size="16" /></div><div><b>外设 · B 区周转库</b><span><i></i>有 6 件待补货</span></div><strong>252<span>件</span></strong></div><div class="mini-monitor"><div><span>库存准确率</span><b>98.6%</b></div><div class="mini-progress"><i style="width: 86%"></i></div><small>较上月 <em>+2.4%</em></small></div></article>
        </section>

        <section class="dashboard-grid lower-grid">
          <article class="panel table-panel"><div class="panel-heading"><div><h2>库存预警</h2><p>以下商品库存低于安全库存</p></div><button class="text-button" @click="selectNav('inventory')">管理库存 <ArrowUpRight :size="14" /></button></div><div class="table-wrap"><table><thead><tr><th>商品名称</th><th>SKU</th><th>现有库存</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="item in filteredStock" :key="item.sku"><td><div class="product-cell"><div class="product-thumb"><Cpu :size="16" /></div><b>{{ item.name }}</b></div></td><td class="muted">{{ item.sku }}</td><td><b>{{ item.stock }}</b> 件</td><td><span class="status-pill" :class="item.color">{{ item.level }}</span></td><td><button class="row-more"><MoreHorizontal :size="17" /></button></td></tr></tbody></table><div v-if="!filteredStock.length" class="empty-state">没有匹配的库存商品</div></div></article>
          <article class="panel result-panel"><div class="panel-heading"><div><h2>库存结果概览</h2><p>各仓库商品状态占比</p></div><button class="circle-arrow"><ArrowUpRight :size="15" /></button></div><div class="result-content"><div class="result-ring"><div><strong>231</strong><span>可售商品</span></div></div><div class="result-list"><div><i class="dot-teal"></i><span>库存正常</span><b>75%</b></div><div><i class="dot-amber"></i><span>库存预警</span><b>18%</b></div><div><i class="dot-red"></i><span>缺货商品</span><b>7%</b></div></div></div><div class="result-footer"><span>安全库存覆盖率</span><b>92.4%</b><em>+4.7% ~</em></div></article>
        </section>
      </div>
    </main>
  </div>
</template>
