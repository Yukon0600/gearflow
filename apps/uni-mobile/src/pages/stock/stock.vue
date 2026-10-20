<template>
  <view class="page">
    <view class="summary card">
      <view class="stat">
        <view class="stat-value">{{ summary.total }}</view>
        <view class="stat-label">商品总数</view>
      </view>
      <view class="divider" />
      <view class="stat">
        <view class="stat-value warn">{{ summary.lowCount }}</view>
        <view class="stat-label">低于阈值</view>
      </view>
      <view class="divider" />
      <view class="stat">
        <view class="stat-value">{{ updatedText }}</view>
        <view class="stat-label">更新时间</view>
      </view>
    </view>

    <view class="search">
      <input
        v-model="keyword"
        placeholder="搜索名称 / SKU / 品牌"
        placeholder-class="ph"
        confirm-type="search"
      />
      <view class="scan" @click="scan">扫码</view>
    </view>

    <view v-if="error" class="error">{{ error }}</view>

    <view v-if="loading && !products.length" class="muted center">加载中…</view>

    <view v-else-if="!filtered.length" class="muted center">没有匹配的商品</view>

    <view v-else class="list">
      <view v-for="p in filtered" :key="p.id" class="row card" @click="open(p)">
        <view class="row-main">
          <view class="row-title">{{ p.name }}</view>
          <view class="row-sub">{{ p.sku }} · {{ p.brand }}</view>
        </view>
        <view class="row-side">
          <view class="stock" :class="{ low: p.low }">{{ p.stock }}</view>
          <view class="unit">件</view>
        </view>
      </view>
    </view>

    <view class="footer">
      <view class="muted" @click="logout">退出登录</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { api, clearToken } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const products = ref([]);
const keyword = ref('');
const loading = ref(false);
const error = ref('');
const summary = ref({ total: 0, lowCount: 0, updatedAt: '' });

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return products.value;
  return products.value.filter(
    (p) =>
      String(p.name).toLowerCase().includes(k) ||
      String(p.sku).toLowerCase().includes(k) ||
      String(p.brand || '').toLowerCase().includes(k)
  );
});

const updatedText = computed(() => {
  if (!summary.value.updatedAt) return '—';
  const d = new Date(summary.value.updatedAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.stock();
    products.value = data.products || [];
    summary.value = { total: data.total, lowCount: data.lowCount, updatedAt: data.updatedAt };
    uni.setStorageSync(STORAGE_PRODUCTS, JSON.stringify(products.value));
  } catch (e) {
    error.value = e.message || '加载失败';
    if (String(e.message).includes('登录')) {
      clearToken();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  } finally {
    loading.value = false;
  }
}

onShow(() => {
  load();
});

onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});

function open(p) {
  uni.navigateTo({ url: `/pages/stock/detail?id=${p.id}` });
}

function scan() {
  uni.scanCode({
    success: (res) => {
      keyword.value = res.result || '';
    },
    fail: () => {
      uni.showToast({ title: '未识别到条码', icon: 'none' });
    },
  });
}

function logout() {
  clearToken();
  uni.reLaunch({ url: '/pages/login/login' });
}
</script>

<style>
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx 60rpx;
  box-sizing: border-box;
}

.summary {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.stat-value.warn {
  color: #ffb454;
}

.stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8b90a0;
}

.divider {
  width: 1px;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.08);
}

.search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 24rpx 0;
  padding: 20rpx 28rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
}

.search input {
  flex: 1;
  color: #e8eaf0;
  font-size: 28rpx;
}

.scan {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(124, 108, 240, 0.18);
  color: #a99bff;
  font-size: 24rpx;
}

.ph {
  color: #5b6070;
}

.error {
  margin: 8rpx 8rpx 16rpx;
  color: #ff7a7a;
  font-size: 26rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.row {
  display: flex;
  align-items: center;
  padding: 28rpx;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  font-size: 30rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #7d8394;
}

.row-side {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  margin-left: 20rpx;
}

.stock {
  font-size: 36rpx;
  font-weight: 700;
  color: #7ce0b8;
}

.stock.low {
  color: #ffb454;
}

.unit {
  font-size: 22rpx;
  color: #7d8394;
}

.center {
  padding: 80rpx 0;
  text-align: center;
}

.footer {
  margin-top: 48rpx;
  text-align: center;
}
</style>
