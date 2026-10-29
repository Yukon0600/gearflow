<template>
  <view class="page">
    <!-- 顶部：扫码 + 搜索 -->
    <view class="toolbar">
      <view class="scan-btn" @click="scanCode">
        <text class="scan-icon">⌷</text>
        <text>扫码</text>
      </view>
      <view class="search">
        <text class="search-icon">⌕</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索名称 / SKU 定位商品"
          placeholder-class="ph"
        />
      </view>
    </view>

    <view class="hint">只填与账面不同的商品；实盘数留空表示未盘到该商品</view>

    <!-- 商品清单 -->
    <view v-if="!filteredList.length" class="card empty-card">
      <text class="empty-icon">📦</text>
      <text class="empty-text">{{ keyword ? '没有匹配的商品' : '商品清单为空' }}</text>
    </view>

    <view v-else class="list">
      <view v-for="p in filteredList" :key="p.id" class="card row" :class="{ counted: counts[p.id] !== undefined && counts[p.id] !== '' }">
        <view class="row-main">
          <text class="row-name">{{ p.name }}</text>
          <text class="row-meta">{{ p.sku }} · 账面 {{ p.stock }}</text>
        </view>
        <view class="row-count">
          <text class="row-unit">实盘</text>
          <input
            class="count-input"
            type="number"
            :value="counts[p.id]"
            placeholder="—"
            placeholder-class="ph"
            @input="onCount(p, $event)"
          />
        </view>
        <view class="row-diff">
          <text v-if="diffOf(p) > 0" class="diff up">+{{ diffOf(p) }}</text>
          <text v-else-if="diffOf(p) < 0" class="diff down">{{ diffOf(p) }}</text>
          <text v-else-if="counts[p.id] !== undefined && counts[p.id] !== ''" class="diff same">持平</text>
        </view>
      </view>
    </view>

    <!-- 差异汇总 + 提交 -->
    <view class="summary-bar" v-if="countedCount > 0">
      <view class="summary-info">
        <text class="summary-k">已盘 {{ countedCount }} 项 · 差异 {{ diffCount }} 项</text>
        <text class="summary-v">
          <text v-if="diffIn" class="up">盘盈 {{ diffIn }}</text>
          <text v-if="diffIn && diffOut"> · </text>
          <text v-if="diffOut" class="down">盘亏 {{ diffOut }}</text>
          <text v-if="!diffIn && !diffOut">无差异</text>
        </text>
      </view>
      <button class="btn submit" :disabled="busy || diffCount === 0" @click="submit">
        {{ busy ? '提交中…' : `提交盘点（${diffCount} 项差异）` }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api, clearToken } from '../../utils/api.js';

const products = ref([]);
const keyword = ref('');
const counts = ref({}); // productId -> 实盘数字符串
const busy = ref(false);

const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return products.value;
  return products.value.filter(
    (p) => p.name.toLowerCase().includes(k) || p.sku.toLowerCase().includes(k) || String(p.brand || '').toLowerCase().includes(k),
  );
});

const countedCount = computed(
  () => Object.values(counts.value).filter((v) => v !== '' && v !== undefined && v !== null).length,
);

// 与账面不一致的项
const diffItems = computed(() =>
  products.value
    .filter((p) => {
      const v = counts.value[p.id];
      return v !== '' && v !== undefined && v !== null && Number(v) !== Number(p.stock);
    })
    .map((p) => ({
      productId: p.id,
      name: p.name,
      expected: Number(p.stock),
      actual: Math.max(Number(counts.value[p.id]), 0),
    })),
);

const diffCount = computed(() => diffItems.value.length);
const diffIn = computed(() => diffItems.value.reduce((s, l) => s + Math.max(l.actual - l.expected, 0), 0));
const diffOut = computed(() => diffItems.value.reduce((s, l) => s + Math.max(l.expected - l.actual, 0), 0));

function diffOf(p) {
  const v = counts.value[p.id];
  if (v === '' || v === undefined || v === null) return 0;
  return Number(v) - Number(p.stock);
}

function onCount(p, event) {
  counts.value = { ...counts.value, [p.id]: event.detail.value };
}

async function load() {
  try {
    const res = await api.stock();
    products.value = (res.products || []).map((p) => ({ ...p, stock: Number(p.stock) }));
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' });
    if (String(e.message || '').includes('登录')) {
      clearToken();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  }
}

function scanCode() {
  uni.scanCode({
    success: (res) => {
      const code = String(res.result || '').trim().toLowerCase();
      const hit = products.value.find((p) => String(p.sku).toLowerCase() === code);
      if (!hit) {
        uni.showToast({ title: '没有找到该条码对应的商品', icon: 'none' });
        return;
      }
      keyword.value = '';
      // 定位：清空筛选后直接聚焦该项（自动滚动靠 input focus，这里简单置顶提示）
      uni.showToast({ title: `已定位：${hit.name}`, icon: 'none' });
      counts.value = { ...counts.value, [hit.id]: counts.value[hit.id] ?? String(hit.stock) };
    },
    fail: () => {
      uni.showToast({ title: '未识别到条码', icon: 'none' });
    },
  });
}

function submit() {
  if (!diffItems.value.length) return;
  const linesText = diffItems.value
    .slice(0, 3)
    .map((l) => `${l.name} ${l.expected}→${l.actual}`)
    .join('、');
  uni.showModal({
    title: `确认提交 ${diffItems.value.length} 项差异？`,
    content: `${linesText}${diffItems.value.length > 3 ? ' 等' : ''}\n提交后库存立即按实盘更新`,
    confirmText: '提交',
    success: async (r) => {
      if (!r.confirm) return;
      busy.value = true;
      try {
        const res = await api.stocktake({
          note: `移动端盘点 · ${new Date().toLocaleString()}`,
          lines: diffItems.value.map(({ productId, expected, actual }) => ({ productId, expected, actual })),
        });
        uni.showToast({ title: `盘点单 ${res.number} 已生效`, icon: 'none', duration: 2000 });
        counts.value = {};
        await load();
      } catch (e) {
        // 409：盘点期间库存被别的单据改了
        uni.showModal({ title: '提交失败', content: e.message || '库存已变动，请刷新重试', showCancel: false });
        await load();
      } finally {
        busy.value = false;
      }
    },
  });
}

onLoad(() => {});

onShow(() => {
  if (!uni.getStorageSync('gf_token')) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  load();
});
</script>

<style>
.page {
  min-height: 100vh;
  padding: 20rpx 28rpx calc(80rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #0d0e12;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.scan-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 26rpx;
  border-radius: 18rpx;
  font-size: 25rpx;
  color: #a99bff;
  background: rgba(124, 108, 240, 0.16);
  border: 1px solid rgba(124, 108, 240, 0.3);
}

.scan-icon {
  font-size: 30rpx;
}

.search {
  flex: 1;
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

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #e8eaf0;
}

.hint {
  margin: 0 6rpx 20rpx;
  font-size: 20rpx;
  color: #4d5262;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 12rpx;
}

.row.counted {
  border-color: rgba(124, 224, 184, 0.35);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.row-name {
  font-size: 25rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.row-count {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.row-unit {
  font-size: 20rpx;
  color: #6b7080;
}

.count-input {
  width: 110rpx;
  height: 60rpx;
  text-align: center;
  font-size: 26rpx;
  color: #f2f4f8;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
}

.row-diff {
  flex-shrink: 0;
  width: 96rpx;
  text-align: right;
}

.diff {
  font-size: 24rpx;
  font-weight: 600;
}

.diff.up {
  color: #7ce0b8;
}

.diff.down {
  color: #ff8a8a;
}

.diff.same {
  color: #6b7080;
  font-weight: 400;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 70rpx 0;
}

.empty-icon {
  font-size: 44rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #6b7080;
}

/* 底部汇总条 */
.summary-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(13, 14, 18, 0.96);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.summary-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-k {
  font-size: 22rpx;
  color: #8b90a0;
}

.summary-v {
  font-size: 22rpx;
  color: #b6bbca;
}

.submit {
  margin: 0;
}

.ph {
  color: #5b6070;
}

.up {
  color: #7ce0b8;
}

.down {
  color: #ff8a8a;
}
</style>
