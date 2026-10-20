<template>
  <view class="page detail-page">
    <view v-if="loading && !item" class="empty">加载中…</view>
    <view v-else-if="!item" class="empty">商品不存在或已删除</view>

    <template v-else>
      <view class="head">
        <view class="name">{{ item.name }}</view>
        <view class="sub">
          <text>{{ item.sku }}</text>
          <text class="pill" :class="item.low ? 'warn' : 'ok'">{{ item.low ? '低于阈值' : '库存正常' }}</text>
        </view>
      </view>

      <view class="stock-card">
        <view class="stock-label">当前在库</view>
        <view class="stock-value">
          <text class="num" :class="{ low: item.low }">{{ item.stock }}</text>
          <text class="stock-unit">件</text>
          <text class="stock-price">货值 ¥{{ yuan(item.price * item.stock) }}</text>
        </view>
        <view class="bar">
          <view class="bar-fill" :style="{ width: ratio + '%' }" :class="{ low: item.low }" />
        </view>
        <view class="bar-text">补货阈值 {{ item.threshold }} 件 · {{ item.low ? '建议尽快补货' : '库存充足' }}</view>
      </view>

      <view class="grid">
        <view class="cell">
          <text class="k">分类</text>
          <text class="v">{{ item.category || '—' }}</text>
        </view>
        <view class="cell">
          <text class="k">品牌</text>
          <text class="v">{{ item.brand || '—' }}</text>
        </view>
        <view class="cell">
          <text class="k">销售单价</text>
          <text class="v">¥{{ yuan(item.price) }}</text>
        </view>
        <view class="cell">
          <text class="k">补货阈值</text>
          <text class="v">{{ item.threshold }} 件</text>
        </view>
      </view>

      <view class="section-title">
        <text>最近出入库</text>
        <text class="more" @click="goFlow">全部流水 ›</text>
      </view>

      <view v-if="!item.movements || !item.movements.length" class="card empty-card">
        <text class="empty-text">该商品还没有出入库记录</text>
      </view>

      <view v-else class="card">
        <view v-for="(m, i) in item.movements" :key="m.id" class="log-row" :class="{ first: i === 0 }">
          <view class="log-badge" :class="m.delta > 0 ? 'in' : (m.delta < 0 ? 'out' : 'neutral')">
            {{ m.delta > 0 ? '入' : (m.delta < 0 ? '出' : '调') }}
          </view>
          <view class="log-main">
            <text class="log-title">{{ labelOf(m.type) }}<text v-if="m.partner" class="log-partner"> · {{ m.partner }}</text></text>
            <text class="log-meta">{{ m.orderNumber || '手工调整' }} · {{ timeAgo(m.createdAt) }}</text>
          </view>
          <view class="log-side">
            <text class="log-delta num" :class="m.delta > 0 ? 'in' : (m.delta < 0 ? 'out' : 'neutral')">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</text>
            <text class="log-balance">结存 {{ m.balance }}</text>
          </view>
        </view>
      </view>

      <view class="actions">
        <button class="btn btn-ghost" @click="go('in')">入库</button>
        <button class="btn" @click="go('out')">出库</button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api, yuan, timeAgo, MOVEMENT_LABEL } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const item = ref(null);
const loading = ref(false);
let productId = '';

const ratio = computed(() => {
  if (!item.value) return 0;
  const target = Math.max(Number(item.value.threshold) * 3, 1);
  const pct = Math.round((Number(item.value.stock) / target) * 100);
  return Math.min(Math.max(pct, 4), 100);
});

function labelOf(type) {
  return MOVEMENT_LABEL[type] || type;
}

async function load() {
  loading.value = true;
  try {
    item.value = await api.product(productId);
  } catch (e) {
    // 网络失败时退回本地缓存，至少能显示基础信息
    const cached = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');
    item.value = cached.find((p) => String(p.id) === String(productId)) || null;
    if (!item.value) uni.showToast({ title: e.message || '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

onLoad((query) => {
  productId = (query && query.id) || '';
  if (!productId) return;
  const cached = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');
  const hit = cached.find((p) => String(p.id) === String(productId));
  if (hit) item.value = hit;
});

// 从开单页返回时刷新库存
onShow(() => {
  if (productId) load();
});

function go(type) {
  uni.navigateTo({ url: `/pages/order/order?productId=${item.value.id}&type=${type}` });
}

function goFlow() {
  uni.switchTab({ url: '/pages/flow/flow' });
}
</script>

<style>
.detail-page {
  padding-bottom: calc(190rpx + env(safe-area-inset-bottom));
}

.head {
  padding: 8rpx 4rpx 28rpx;
}

.name {
  font-size: 40rpx;
  font-weight: 700;
  color: #f2f4f8;
  line-height: 1.35;
}

.sub {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #7d8394;
}

.stock-card {
  padding: 32rpx;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 26rpx;
}

.stock-label {
  font-size: 22rpx;
  color: #7d8394;
}

.stock-value {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 10rpx;
}

.stock-value .num {
  font-size: 76rpx;
  font-weight: 700;
  color: #7ce0b8;
  line-height: 1.1;
}

.stock-value .num.low {
  color: #ffb454;
}

.stock-unit {
  font-size: 24rpx;
  color: #6b7080;
}

.stock-price {
  margin-left: auto;
  font-size: 22rpx;
  color: #8b90a0;
}

.bar {
  height: 10rpx;
  margin-top: 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #4aa8f0, #7ce0b8);
}

.bar-fill.low {
  background: linear-gradient(90deg, #ff9d5c, #ffb454);
}

.bar-text {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #6b7080;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.cell {
  width: calc(50% - 7rpx);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 26rpx 28rpx;
  box-sizing: border-box;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
}

.k {
  font-size: 20rpx;
  color: #6b7080;
}

.v {
  font-size: 28rpx;
  color: #e8eaf0;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 36rpx 4rpx 18rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #eef0f6;
}

.more {
  font-size: 22rpx;
  font-weight: 400;
  color: #7d8394;
}

.empty-card {
  padding: 40rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 22rpx;
  color: #6b7080;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx 26rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.log-row.first {
  border-top: none;
}

.log-badge {
  width: 48rpx;
  height: 48rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.log-badge.in {
  background: rgba(124, 224, 184, 0.14);
  color: #7ce0b8;
}

.log-badge.out {
  background: rgba(255, 180, 84, 0.16);
  color: #ffb454;
}

.log-badge.neutral {
  background: rgba(255, 255, 255, 0.07);
  color: #8b90a0;
}

.log-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.log-title {
  font-size: 24rpx;
  color: #e8eaf0;
}

.log-partner {
  color: #8b90a0;
}

.log-meta {
  font-size: 18rpx;
  color: #5b6070;
}

.log-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}

.log-delta {
  font-size: 28rpx;
  font-weight: 700;
}

.log-delta.in {
  color: #7ce0b8;
}

.log-delta.out {
  color: #ffb454;
}

.log-delta.neutral {
  color: #8b90a0;
}

.log-balance {
  font-size: 18rpx;
  color: #5b6070;
}

.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 18rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(13, 14, 18, 0.94);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20rpx);
}

.actions .btn {
  flex: 1;
}
</style>
