<template>
  <view class="page">
    <!-- 周期切换 -->
    <view class="seg-row">
      <view class="seg" :class="{ active: days === 7 }" @click="switchDays(7)">近 7 天</view>
      <view class="seg" :class="{ active: days === 30 }" @click="switchDays(30)">近 30 天</view>
      <view class="seg" :class="{ active: days === 90 }" @click="switchDays(90)">近 90 天</view>
    </view>

    <view v-if="error" class="card error-card">
      <text class="error-text">{{ error }}</text>
      <text class="retry" @click="load">重试</text>
    </view>

    <!-- 核心指标 -->
    <view class="metrics" v-if="report">
      <view class="metric card">
        <view class="metric-top">
          <text class="metric-label">销售额</text>
          <text v-if="growthText" class="growth" :class="{ up: report.comparison.salesGrowth >= 0 }">{{ growthText }}</text>
        </view>
        <text class="metric-value num">¥{{ thousands(Math.round(report.salesTotal / 100)) }}</text>
        <text class="metric-foot">环比 {{ report.days }} 天前同期</text>
      </view>

      <view class="metric-row">
        <view class="metric half card">
          <text class="metric-label">毛利</text>
          <text class="metric-value sm num">¥{{ thousands(Math.round(report.grossProfit / 100)) }}</text>
          <text class="metric-foot">毛利率 {{ marginText }}</text>
        </view>
        <view class="metric half card">
          <text class="metric-label">客单价</text>
          <text class="metric-value sm num">¥{{ thousands(Math.round(report.avgOrder / 100)) }}</text>
          <text class="metric-foot">销售单 {{ report.salesOrderCount }} 张</text>
        </view>
      </view>

      <view class="metric-row">
        <view class="metric half card">
          <text class="metric-label">库存总值</text>
          <text class="metric-value sm num">¥{{ thousands(Math.round(report.stockValue / 100)) }}</text>
          <text class="metric-foot">共 {{ report.productCount }} 种商品</text>
        </view>
        <view class="metric half card">
          <text class="metric-label">周转天数</text>
          <text class="metric-value sm num">{{ report.turnover.days ?? '—' }}</text>
          <text class="metric-foot">{{ report.days }} 天出库 {{ report.turnover.soldQty }} 件</text>
        </view>
      </view>
    </view>

    <!-- 销量排行 -->
    <view v-if="report && report.topProducts.length" class="section">
      <view class="section-head">
        <text class="section-title">热销商品</text>
      </view>
      <view class="card">
        <view v-for="(p, i) in report.topProducts.slice(0, 5)" :key="p.id" class="rank-row" :class="{ first: i === 0 }">
          <text class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</text>
          <view class="rank-main">
            <text class="rank-name">{{ p.name }}</text>
            <text class="rank-meta">卖出 {{ p.qty }} 件</text>
          </view>
          <text class="rank-amount num">¥{{ thousands(Math.round(p.amount / 100)) }}</text>
        </view>
      </view>
    </view>

    <!-- 滞销占用 -->
    <view v-if="report && report.slowMovers.length" class="section">
      <view class="section-head">
        <text class="section-title">滞销提醒</text>
        <text class="section-more">{{ report.days }} 天无出库</text>
      </view>
      <view class="card">
        <view v-for="(p, i) in report.slowMovers.slice(0, 5)" :key="p.id" class="rank-row" :class="{ first: i === 0 }">
          <view class="rank-main">
            <text class="rank-name">{{ p.name }}</text>
            <text class="rank-meta">库存 {{ p.stock }} 件</text>
          </view>
          <text class="rank-amount warn num">占用 ¥{{ thousands(Math.round(p.tied / 100)) }}</text>
        </view>
      </view>
    </view>

    <!-- 客户排行 -->
    <view v-if="report && report.topPartners.length" class="section">
      <view class="section-head">
        <text class="section-title">客户排行</text>
      </view>
      <view class="card">
        <view v-for="(p, i) in report.topPartners.slice(0, 5)" :key="p.name" class="rank-row" :class="{ first: i === 0 }">
          <text class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</text>
          <view class="rank-main">
            <text class="rank-name">{{ p.name }}</text>
            <text class="rank-meta">{{ p.orders }} 张销售单</text>
          </view>
          <text class="rank-amount num">¥{{ thousands(Math.round(p.amount / 100)) }}</text>
        </view>
      </view>
    </view>

    <view v-if="report" class="foot-note">数据区间 {{ report.from }} ~ {{ report.to }}</view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api, clearToken, thousands } from '../../utils/api.js';

const days = ref(30);
const report = ref(null);
const error = ref('');

const growthText = computed(() => {
  const g = report.value && report.value.comparison && report.value.comparison.salesGrowth;
  if (g === null || g === undefined) return '';
  return `${g >= 0 ? '↑' : '↓'} ${Math.abs(g)}%`;
});

const marginText = computed(() => {
  const bps = report.value ? report.value.grossMarginBps : 0;
  return `${(bps / 100).toFixed(1)}%`;
});

function switchDays(d) {
  if (days.value === d) return;
  days.value = d;
  load();
}

async function load() {
  error.value = '';
  try {
    report.value = await api.report(days.value);
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
</script>

<style>
.page {
  min-height: 100vh;
  padding: 20rpx 28rpx calc(60rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #0d0e12;
}

.seg-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.seg {
  flex: 1;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 23rpx;
  color: #8b90a0;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.seg.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  border-color: transparent;
  font-weight: 600;
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

/* 指标卡 */
.metrics {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.metric {
  padding: 24rpx 28rpx;
}

.metric-row {
  display: flex;
  gap: 14rpx;
}

.metric.half {
  flex: 1;
  margin: 0;
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-label {
  font-size: 22rpx;
  color: #8b90a0;
}

.metric-value {
  display: block;
  margin-top: 12rpx;
  font-size: 46rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
}

.metric-value.sm {
  font-size: 34rpx;
}

.growth {
  font-size: 22rpx;
  font-weight: 600;
  color: #ff8a8a;
}

.growth.up {
  color: #7ce0b8;
}

.metric-foot {
  display: block;
  margin-top: 10rpx;
  font-size: 19rpx;
  color: #6b7080;
}

/* 排行 */
.section {
  margin-top: 30rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 6rpx 16rpx;
}

.section-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #eef0f6;
}

.section-more {
  font-size: 20rpx;
  color: #6b7080;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 26rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.rank-row.first {
  border-top: none;
}

.rank-no {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  font-size: 22rpx;
  color: #6b7080;
  background: rgba(255, 255, 255, 0.06);
}

.rank-no.top {
  color: #ffd685;
  background: rgba(255, 180, 84, 0.16);
}

.rank-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.rank-name {
  font-size: 25rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-meta {
  font-size: 19rpx;
  color: #6b7080;
}

.rank-amount {
  flex-shrink: 0;
  font-size: 25rpx;
  font-weight: 600;
  color: #f2f4f8;
}

.rank-amount.warn {
  color: #ffb454;
}

.foot-note {
  padding: 26rpx 0 10rpx;
  text-align: center;
  font-size: 18rpx;
  color: #4d5262;
}
</style>
