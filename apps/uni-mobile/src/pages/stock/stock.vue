<template>
  <view class="wrap">
    <view class="search-bar">
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

    <view v-if="error" class="error">{{ error }}</view>

    <view v-if="loading && !products.length" class="loading">加载中…</view>

    <view v-else class="layout">
      <!-- 左侧分类 -->
      <scroll-view scroll-y class="aside" :scroll-into-view="asideInto">
        <view
          v-for="(g, i) in groups"
          :id="'aside-' + i"
          :key="g.name"
          class="aside-item"
          :class="{ active: active === i }"
          @click="pick(i)"
        >
          <text class="aside-name">{{ g.name }}</text>
          <text class="aside-count" :class="{ warn: g.low > 0 }">{{ g.items.length }}</text>
        </view>
        <view class="aside-pad" />
      </scroll-view>

      <!-- 右侧商品 -->
      <scroll-view
        scroll-y
        class="main"
        :scroll-into-view="mainInto"
        :scroll-with-animation="true"
        @scroll="onScroll"
      >
        <view v-for="(g, i) in groups" :id="'sec-' + i" :key="g.name" class="section">
          <view class="section-head">
            <text class="section-name">{{ g.name }}</text>
            <text class="section-count">{{ g.items.length }} 件</text>
          </view>

          <view
            v-for="p in g.items"
            :key="p.id"
            class="item"
            :class="{ low: p.low }"
            @click="open(p)"
          >
            <view class="item-top">
              <text class="item-name">{{ p.name }}</text>
              <text class="item-stock num" :class="{ low: p.low }">{{ p.stock }}</text>
            </view>
            <view class="item-meta">
              <text>{{ p.sku }}</text>
              <text class="sep">·</text>
              <text>{{ p.brand }}</text>
            </view>
            <view class="item-foot">
              <text class="item-price">¥{{ yuan(p.price) }}</text>
              <view v-if="p.low" class="tag-warn">库存偏低</view>
            </view>
          </view>
        </view>

        <view v-if="!groups.length" class="empty">没有匹配的商品</view>
        <view class="main-pad" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { onShow, onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api, clearToken, yuan } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const products = ref([]);
const categories = ref([]);
const keyword = ref('');
const loading = ref(false);
const error = ref('');
const active = ref(0);
const mainInto = ref('');
const asideInto = ref('');

// 布局常量（rpx），用于滚动位置与左侧高亮联动
const HEAD_RPX = 76;
const ROW_RPX = 150;
let pendingType = '';

const groups = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  const match = (p) =>
    !k ||
    String(p.name).toLowerCase().includes(k) ||
    String(p.sku).toLowerCase().includes(k) ||
    String(p.brand || '').toLowerCase().includes(k);

  if (k) {
    const hits = products.value.filter(match);
    return hits.length ? [{ name: '搜索结果', low: 0, items: hits }] : [];
  }

  const map = new Map();
  for (const p of products.value) {
    const key = p.category || '未分类';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }

  // 顺序优先跟随后端返回，保证左右两侧一致
  const order = categories.value.map((c) => c.name).filter((n) => map.has(n));
  for (const key of map.keys()) if (!order.includes(key)) order.push(key);

  return order.map((name) => {
    const items = map.get(name) || [];
    return { name, items, low: items.filter((p) => p.low).length };
  });
});

const offsets = computed(() => {
  const list = [];
  let acc = 0;
  for (const g of groups.value) {
    list.push(acc);
    acc += HEAD_RPX + g.items.length * ROW_RPX;
  }
  return list;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.stock();
    products.value = data.products || [];
    categories.value = data.categories || [];
    uni.setStorageSync(STORAGE_PRODUCTS, JSON.stringify(products.value));
    if (active.value >= groups.value.length) active.value = 0;
    autoOrder();
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

/** 扫码进入：SKU 唯一命中时直接进开单页 */
function autoOrder() {
  const code = keyword.value.trim();
  if (!code || !pendingType) return;
  const hit = products.value.filter((p) => String(p.sku).toLowerCase() === code.toLowerCase());
  if (hit.length === 1) {
    const type = pendingType;
    pendingType = '';
    uni.navigateTo({ url: `/pages/order/order?productId=${hit[0].id}&type=${type}` });
  }
}

function pick(i) {
  active.value = i;
  mainInto.value = '';
  setTimeout(() => { mainInto.value = `sec-${i}`; }, 10);
  asideInto.value = `aside-${Math.max(i - 2, 0)}`;
}

function onScroll(e) {
  if (keyword.value.trim()) return;
  const pxPerRpx = uni.upx2px(1) || 1;
  const scrollRpx = e.detail.scrollTop / pxPerRpx;
  const list = offsets.value;
  let idx = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] <= scrollRpx + 8) idx = i;
  }
  if (idx !== active.value) {
    active.value = idx;
    asideInto.value = `aside-${Math.max(idx - 2, 0)}`;
  }
}

onLoad((query) => {
  if (query && query.code) keyword.value = decodeURIComponent(query.code);
  if (query && query.type) pendingType = query.type;
});

watch(keyword, () => {
  active.value = 0;
  mainInto.value = '';
  setTimeout(() => { mainInto.value = 'sec-0'; }, 10);
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
.wrap {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0d0e12;
  box-sizing: border-box;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: #0d0e12;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18rpx;
}

.search-icon {
  font-size: 28rpx;
  color: #6b7080;
}

.search input {
  flex: 1;
  font-size: 26rpx;
  color: #e8eaf0;
}

.clear {
  font-size: 30rpx;
  color: #6b7080;
  padding: 0 6rpx;
}

.ph {
  color: #5b6070;
}

.error {
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  color: #ff7a7a;
}

.loading {
  padding: 120rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #6b7080;
}

.layout {
  flex: 1;
  display: flex;
  min-height: 0;
}

.aside {
  width: 200rpx;
  flex-shrink: 0;
  background: #101218;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.aside-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 18rpx 28rpx 22rpx;
  border-left: 6rpx solid transparent;
}

.aside-item.active {
  background: #171a21;
  border-left-color: #7c6cf0;
}

.aside-name {
  font-size: 24rpx;
  color: #8b90a0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aside-item.active .aside-name {
  color: #f2f4f8;
  font-weight: 600;
}

.aside-count {
  font-size: 18rpx;
  color: #5b6070;
}

.aside-count.warn {
  color: #ffb454;
}

.aside-pad {
  height: 160rpx;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 22rpx 6rpx 14rpx;
}

.section-name {
  font-size: 24rpx;
  font-weight: 600;
  color: #b6bbca;
}

.section-count {
  font-size: 18rpx;
  color: #5b6070;
}

.item {
  padding: 24rpx 24rpx;
  margin-bottom: 14rpx;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20rpx;
}

.item.low {
  border-color: rgba(255, 180, 84, 0.28);
}

.item-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-stock {
  font-size: 30rpx;
  font-weight: 700;
  color: #7ce0b8;
}

.item-stock.low {
  color: #ffb454;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  font-size: 18rpx;
  color: #6b7080;
}

.sep {
  color: #3f4453;
}

.item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.item-price {
  font-size: 22rpx;
  color: #8b90a0;
}

.tag-warn {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  color: #ffb454;
  background: rgba(255, 180, 84, 0.14);
}

.main-pad {
  height: 180rpx;
}

.empty {
  padding: 120rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #6b7080;
}
</style>
