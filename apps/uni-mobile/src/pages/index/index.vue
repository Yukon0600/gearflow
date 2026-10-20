<template>
  <view class="page">
    <view class="hero" :style="{ paddingTop: statusBar + 20 + 'px' }">
      <view>
        <view class="greet">{{ greeting }}</view>
        <view class="date">{{ dateText }}</view>
      </view>
      <view class="avatar" @click="go('/pages/mine/mine')">A</view>
    </view>

    <view v-if="error" class="card error-card">
      <text class="error-text">{{ error }}</text>
      <view class="retry" @click="load">重试</view>
    </view>

    <view class="value-card">
      <view class="value-head">
        <text class="value-label">库存总值</text>
        <text class="pill info">成本口径</text>
      </view>
      <view class="value">
        <text class="currency">¥</text>
        <text class="amount num">{{ thousands(Math.round(summary.stockValue / 100)) }}</text>
      </view>
      <view class="value-foot">
        零售价值 ¥{{ thousands(Math.round(summary.retailValue / 100)) }} · {{ updatedText }}
      </view>
    </view>

    <view class="metrics">
      <view class="metric">
        <text class="m-value num">{{ summary.productCount }}</text>
        <text class="m-label">在库商品</text>
      </view>
      <view class="metric">
        <text class="m-value num" :class="{ warn: summary.lowCount > 0 }">{{ summary.lowCount }}</text>
        <text class="m-label">低于阈值</text>
      </view>
      <view class="metric">
        <text class="m-value num">{{ summary.todayInbound }}</text>
        <text class="m-label">今日入库</text>
      </view>
      <view class="metric">
        <text class="m-value num">{{ summary.todayOutbound }}</text>
        <text class="m-label">今日出库</text>
      </view>
    </view>

    <view class="quick">
      <view class="quick-item" @click="scan('in')">
        <text class="quick-icon">＋</text>
        <text class="quick-text">扫码入库</text>
      </view>
      <view class="quick-item" @click="scan('out')">
        <text class="quick-icon">－</text>
        <text class="quick-text">扫码出库</text>
      </view>
      <view class="quick-item" @click="go('/pages/stock/stock')">
        <text class="quick-icon">▦</text>
        <text class="quick-text">库存清单</text>
      </view>
    </view>

    <view class="section-title">
      <text>最近流水</text>
      <text class="more" @click="go('/pages/flow/flow')">全部 ›</text>
    </view>

    <view v-if="!summary.recent.length" class="empty">还没有流水记录</view>

    <view class="card flow-card">
      <view v-for="(m, i) in summary.recent" :key="m.id" class="flow-row" :class="{ first: i === 0 }">
        <view class="flow-dot" :class="{ in: m.delta > 0 }" />
        <view class="flow-main">
          <text class="flow-name">{{ m.name }}</text>
          <text class="flow-meta">{{ labelOf(m.type) }} · {{ timeAgo(m.createdAt) }}</text>
        </view>
        <view class="flow-side">
          <text class="flow-delta" :class="{ in: m.delta > 0 }">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</text>
          <text class="flow-balance">结存 {{ m.balance }}</text>
        </view>
      </view>
    </view>
  </view>

  <tab-bar current="index" />
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import TabBar from '../../components/tab-bar.vue';
import { api, clearToken, thousands, timeAgo, MOVEMENT_LABEL } from '../../utils/api.js';

const statusBar = uni.getSystemInfoSync().statusBarHeight || 20;

const summary = reactive({
  productCount: 0,
  lowCount: 0,
  stockValue: 0,
  retailValue: 0,
  todayInbound: 0,
  todayOutbound: 0,
  recent: [],
  updatedAt: '',
});
const error = ref('');

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const dateText = computed(() => {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
});

const updatedText = computed(() => (summary.updatedAt ? timeAgo(summary.updatedAt) + '更新' : '—'));

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

function go(url) {
  uni.reLaunch({ url });
}

function scan(type) {
  uni.scanCode({
    success: (res) => {
      const code = res.result || '';
      uni.navigateTo({ url: `/pages/stock/stock?code=${encodeURIComponent(code)}&type=${type}` });
    },
    fail: () => {
      uni.showToast({ title: '未识别到条码', icon: 'none' });
    },
  });
}
</script>

<style>
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 8rpx 28rpx;
}

.greet {
  font-size: 44rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.date {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #7d8394;
}

.avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
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

.value-card {
  padding: 36rpx 32rpx;
  border-radius: 28rpx;
  background: linear-gradient(150deg, rgba(124, 108, 240, 0.22), rgba(74, 168, 240, 0.08) 60%, #171a21);
  border: 1px solid rgba(124, 108, 240, 0.25);
}

.value-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.value-label {
  font-size: 24rpx;
  color: #b9b3e8;
}

.value {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 18rpx;
}

.currency {
  font-size: 32rpx;
  color: #cfc9ff;
}

.amount {
  font-size: 72rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.1;
}

.value-foot {
  margin-top: 14rpx;
  font-size: 22rpx;
  color: #9c96c9;
}

.metrics {
  display: flex;
  margin-top: 20rpx;
  padding: 28rpx 8rpx;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.m-value {
  font-size: 38rpx;
  font-weight: 700;
  color: #eef0f6;
}

.m-value.warn {
  color: #ffb454;
}

.m-label {
  font-size: 20rpx;
  color: #7d8394;
}

.quick {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 26rpx 0;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
}

.quick-icon {
  font-size: 34rpx;
  color: #a99bff;
}

.quick-text {
  font-size: 22rpx;
  color: #b6bbca;
}

.flow-card {
  padding: 0 28rpx;
}

.flow-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.flow-row.first {
  border-top: none;
}

.flow-dot {
  width: 12rpx;
  height: 12rpx;
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
  font-size: 26rpx;
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
  gap: 6rpx;
}

.flow-delta {
  font-size: 28rpx;
  font-weight: 600;
  color: #ffb454;
}

.flow-delta.in {
  color: #7ce0b8;
}

.flow-balance {
  font-size: 20rpx;
  color: #6b7080;
}
</style>
