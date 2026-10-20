<template>
  <view class="screen">
    <view class="body">
      <view v-if="error" class="card error-card">
        <text class="error-text">{{ error }}</text>
        <text class="retry" @click="load">重试</text>
      </view>

      <view class="date-row">
        <text class="date-text">{{ dateText }}</text>
        <text class="date-hint">下拉可刷新</text>
      </view>

      <!-- 经营概览 -->
      <view class="hero">
        <view class="hero-top">
          <text class="hero-label">库存总值</text>
          <text class="hero-tag">成本口径</text>
        </view>
        <view class="hero-value">
          <text class="hero-currency">¥</text>
          <text class="hero-amount num">{{ thousands(Math.round(summary.stockValue / 100)) }}</text>
        </view>
        <view class="hero-foot">
          <view class="foot-item">
            <text class="foot-v num">{{ summary.todayOutbound }}</text>
            <text class="foot-k">今日出库</text>
          </view>
          <view class="foot-line" />
          <view class="foot-item">
            <text class="foot-v num">{{ summary.todayInbound }}</text>
            <text class="foot-k">今日入库</text>
          </view>
          <view class="foot-line" />
          <view class="foot-item">
            <text class="foot-v num">{{ summary.todayOrders }}</text>
            <text class="foot-k">今日单据</text>
          </view>
        </view>
      </view>

      <!-- 功能入口 -->
      <view class="grid">
        <view v-for="g in entries" :key="g.key" class="grid-item" @click="g.action()">
          <view class="grid-icon" :style="{ background: g.bg, color: g.color }">{{ g.icon }}</view>
          <text class="grid-text">{{ g.label }}</text>
        </view>
      </view>

      <!-- 库存预警 -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">库存预警</text>
          <text class="section-more" @click="goStock">
            {{ summary.lowCount > 0 ? '共 ' + summary.lowCount + ' 项 ›' : '全部正常' }}
          </text>
        </view>

        <view v-if="!summary.lowProducts.length" class="card empty-card">
          <text class="empty-icon">✓</text>
          <text class="empty-text">所有商品都在安全库存之上</text>
        </view>

        <view v-else class="card">
          <view v-for="(p, i) in summary.lowProducts" :key="p.id" class="warn-row" :class="{ first: i === 0 }">
            <view class="warn-main">
              <text class="warn-name">{{ p.name }}</text>
              <text class="warn-meta">{{ p.sku }} · 阈值 {{ p.threshold }}</text>
            </view>
            <view class="warn-side">
              <text class="warn-stock num">{{ p.stock }}</text>
              <text class="warn-suggest">建议补 {{ p.suggest }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 最近流水 -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">最近动态</text>
          <text class="section-more" @click="goFlow">全部 ›</text>
        </view>

        <view v-if="!summary.recent.length" class="card empty-card">
          <text class="empty-text">还没有流水记录</text>
        </view>

        <view v-else class="card">
          <view v-for="(m, i) in summary.recent" :key="m.id" class="flow-row" :class="{ first: i === 0 }">
            <view class="flow-dot" :class="{ in: m.delta > 0 }" />
            <view class="flow-main">
              <text class="flow-name">{{ m.name }}</text>
              <text class="flow-meta">{{ labelOf(m.type) }} · {{ timeAgo(m.createdAt) }}</text>
            </view>
            <view class="flow-side">
              <text class="flow-delta num" :class="{ in: m.delta > 0 }">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</text>
              <text class="flow-balance">结存 {{ m.balance }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="foot-note">{{ updatedText }}</view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { api, clearToken, thousands, timeAgo, MOVEMENT_LABEL } from '../../utils/api.js';

const summary = reactive({
  productCount: 0,
  lowCount: 0,
  stockValue: 0,
  retailValue: 0,
  todayInbound: 0,
  todayOutbound: 0,
  todayOrders: 0,
  lowProducts: [],
  recent: [],
  updatedAt: '',
});
const error = ref('');

const dateText = computed(() => {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
});

const updatedText = computed(() => (summary.updatedAt ? `数据更新于 ${timeAgo(summary.updatedAt)}` : ''));

const entries = [
  { key: 'in', icon: '入', label: '采购入库', bg: 'rgba(124,224,184,0.14)', color: '#7CE0B8', action: () => scan('in') },
  { key: 'out', icon: '出', label: '销售出库', bg: 'rgba(255,180,84,0.16)', color: '#FFB454', action: () => scan('out') },
  { key: 'scan', icon: '扫', label: '扫码查货', bg: 'rgba(124,108,240,0.18)', color: '#A99BFF', action: () => scan('') },
  { key: 'stock', icon: '存', label: '库存清单', bg: 'rgba(74,168,240,0.16)', color: '#6FC3FF', action: () => goStock() },
  { key: 'flow', icon: '流', label: '库存流水', bg: 'rgba(233,120,160,0.16)', color: '#F29BC0', action: () => goFlow() },
  { key: 'mine', icon: '我', label: '我的', bg: 'rgba(255,255,255,0.08)', color: '#C9CEDA', action: () => goMine() },
];

function labelOf(type) {
  return MOVEMENT_LABEL[type] || type;
}

async function load() {
  error.value = '';
  try {
    const data = await api.summary();
    Object.assign(summary, data);
  } catch (e) {
    error.value = e.message || '加载失败';
    if (String(error.value).includes('登录')) {
      clearToken();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  }
}

onShow(() => {
  if (!uni.getStorageSync('gf_token')) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  load();
});

onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});

function goStock() {
  uni.switchTab({ url: '/pages/stock/stock' });
}

function goFlow() {
  uni.switchTab({ url: '/pages/flow/flow' });
}

function goMine() {
  uni.switchTab({ url: '/pages/mine/mine' });
}

function scan(type) {
  uni.scanCode({
    success: (res) => {
      const code = res.result || '';
      const typeParam = type ? `&type=${type}` : '';
      uni.navigateTo({ url: `/pages/stock/stock?code=${encodeURIComponent(code)}${typeParam}` });
    },
    fail: () => {
      uni.showToast({ title: '未识别到条码', icon: 'none' });
    },
  });
}
</script>

<style>
.screen {
  min-height: 100vh;
  box-sizing: border-box;
  background: radial-gradient(120% 60% at 50% 0%, rgba(124, 108, 240, 0.16), transparent 70%), #0d0e12;
}

.body {
  padding: 20rpx 28rpx calc(140rpx + env(safe-area-inset-bottom));
}

.date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6rpx 6rpx 22rpx;
}

.date-text {
  font-size: 24rpx;
  color: #8b90a0;
}

.date-hint {
  font-size: 20rpx;
  color: #4d5262;
}

.error-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  border-color: rgba(255, 122, 122, 0.3);
}

.error-text {
  font-size: 24rpx;
  color: #ff7a7a;
}

.retry {
  font-size: 24rpx;
  color: #a99bff;
}

/* 概览卡 */
.hero {
  padding: 34rpx 32rpx 26rpx;
  border-radius: 30rpx;
  background: linear-gradient(150deg, rgba(124, 108, 240, 0.26), rgba(74, 168, 240, 0.06) 55%, #171a21);
  border: 1px solid rgba(124, 108, 240, 0.24);
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.hero-label {
  font-size: 24rpx;
  color: #c2bcf0;
}

.hero-tag {
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 18rpx;
  color: #9c96c9;
  background: rgba(255, 255, 255, 0.06);
}

.hero-value {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 16rpx;
}

.hero-currency {
  font-size: 30rpx;
  color: #cfc9ff;
}

.hero-amount {
  font-size: 76rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1.05;
}

.hero-foot {
  display: flex;
  align-items: center;
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.foot-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.foot-v {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.foot-k {
  font-size: 20rpx;
  color: #9c96c9;
}

.foot-line {
  width: 1px;
  height: 44rpx;
  background: rgba(255, 255, 255, 0.1);
}

/* 功能宫格 */
.grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 22rpx;
  padding: 12rpx 0;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28rpx;
}

.grid-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 0;
}

.grid-icon {
  width: 84rpx;
  height: 84rpx;
  border-radius: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 600;
}

.grid-text {
  font-size: 22rpx;
  color: #b6bbca;
}

/* 区块 */
.section {
  margin-top: 34rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 6rpx 18rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #eef0f6;
}

.section-more {
  font-size: 22rpx;
  color: #7d8394;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 44rpx 0;
}

.empty-icon {
  font-size: 40rpx;
  color: #7ce0b8;
}

.empty-text {
  font-size: 22rpx;
  color: #6b7080;
}

/* 预警行 */
.warn-row {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.warn-row.first {
  border-top: none;
}

.warn-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.warn-name {
  font-size: 26rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warn-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.warn-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.warn-stock {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffb454;
}

.warn-suggest {
  font-size: 18rpx;
  color: #6b7080;
}

/* 流水行 */
.flow-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 28rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.flow-row.first {
  border-top: none;
}

.flow-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: #ffb454;
  flex-shrink: 0;
}

.flow-dot.in {
  background: #7ce0b8;
}

.flow-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.flow-name {
  font-size: 25rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.flow-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}

.flow-delta {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffb454;
}

.flow-delta.in {
  color: #7ce0b8;
}

.flow-balance {
  font-size: 18rpx;
  color: #6b7080;
}

.foot-note {
  padding: 30rpx 0 10rpx;
  text-align: center;
  font-size: 18rpx;
  color: #4d5262;
}
</style>
