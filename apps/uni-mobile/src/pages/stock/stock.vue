<template>
  <view class="page stock-page">
    <view class="search-wrap">
      <view class="search">
        <text class="search-icon">⌕</text>
        <input
          v-model="keyword"
          placeholder="搜索名称 / SKU / 品牌"
          placeholder-class="ph"
          confirm-type="search"
        />
        <text v-if="keyword" class="clear" @click="keyword = ''">×</text>
      </view>
    </view>

    <scroll-view scroll-x class="chips" :show-scrollbar="false">
      <view
        v-for="c in categoryList"
        :key="c"
        class="chip"
        :class="{ active: category === c }"
        @click="category = c"
      >
        {{ c }}
      </view>
    </scroll-view>

    <view v-if="error" class="error">{{ error }}</view>

    <view v-if="loading && !products.length" class="empty">加载中…</view>
    <view v-else-if="!filtered.length" class="empty">没有匹配的商品</view>

    <view v-else class="list">
      <view v-for="p in filtered" :key="p.id" class="item" @click="open(p)">
        <view class="item-main">
          <view class="item-name">{{ p.name }}</view>
          <view class="item-sub">
            <text>{{ p.sku }}</text>
            <text class="dot">·</text>
            <text>{{ p.brand }}</text>
          </view>
        </view>
        <view class="item-side">
          <view class="stock-line">
            <text class="stock num" :class="{ low: p.low }">{{ p.stock }}</text>
            <text class="unit">件</text>
          </view>
          <view class="price">¥{{ yuan(p.price) }}</view>
        </view>
      </view>
    </view>

    <view class="footer-hint">共 {{ filtered.length }} 件商品 · 下拉可刷新</view>
  </view>

  <tab-bar current="stock" />
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow, onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import TabBar from '../../components/tab-bar.vue';
import { api, clearToken, yuan } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const products = ref([]);
const keyword = ref('');
const category = ref('全部');
const loading = ref(false);
const error = ref('');
let pendingType = '';

const categoryList = computed(() => {
  const set = new Set(products.value.map((p) => p.category).filter(Boolean));
  return ['全部', ...Array.from(set)];
});

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  return products.value.filter((p) => {
    if (category.value !== '全部' && p.category !== category.value) return false;
    if (!k) return true;
    return (
      String(p.name).toLowerCase().includes(k) ||
      String(p.sku).toLowerCase().includes(k) ||
      String(p.brand || '').toLowerCase().includes(k)
    );
  });
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.stock();
    products.value = data.products || [];
    uni.setStorageSync(STORAGE_PRODUCTS, JSON.stringify(products.value));
    tryAutoOrder();
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

/** 扫码进来时：如果扫到的 SKU 唯一命中，直接跳到开单页 */
function tryAutoOrder() {
  const code = keyword.value.trim();
  if (!code || !pendingType) return;
  const hit = products.value.filter((p) => String(p.sku).toLowerCase() === code.toLowerCase());
  if (hit.length === 1) {
    const type = pendingType;
    pendingType = '';
    uni.navigateTo({ url: `/pages/order/order?productId=${hit[0].id}&type=${type}` });
  }
}

onLoad((query) => {
  if (query && query.code) keyword.value = decodeURIComponent(query.code);
  if (query && query.type) pendingType = query.type;
});

onShow(() => load());

onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});

function open(p) {
  uni.navigateTo({ url: `/pages/stock/detail?id=${p.id}` });
}
</script>

<style>
.stock-page {
  padding-top: 12rpx;
}

.search-wrap {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 4rpx 0 12rpx;
  background: #0d0e12;
}

.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 26rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
}

.search-icon {
  font-size: 30rpx;
  color: #6b7080;
}

.search input {
  flex: 1;
  font-size: 28rpx;
  color: #e8eaf0;
}

.clear {
  font-size: 32rpx;
  color: #6b7080;
  padding: 0 8rpx;
}

.ph {
  color: #5b6070;
}

.chips {
  display: flex;
  white-space: nowrap;
  margin-bottom: 16rpx;
}

.chip {
  display: inline-block;
  padding: 10rpx 24rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #8b90a0;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.chip.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  border-color: transparent;
}

.error {
  margin: 8rpx 4rpx 16rpx;
  font-size: 24rpx;
  color: #ff7a7a;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.item {
  display: flex;
  align-items: center;
  padding: 26rpx 28rpx;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sub {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #6b7080;
}

.item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
  margin-left: 20rpx;
}

.stock-line {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.stock {
  font-size: 34rpx;
  font-weight: 700;
  color: #7ce0b8;
}

.stock.low {
  color: #ffb454;
}

.unit {
  font-size: 20rpx;
  color: #6b7080;
}

.price {
  font-size: 20rpx;
  color: #7d8394;
}

.footer-hint {
  padding: 30rpx 0 10rpx;
  text-align: center;
  font-size: 20rpx;
  color: #5b6070;
}
</style>
