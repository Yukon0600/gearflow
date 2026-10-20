<template>
  <view class="page">
    <view class="filters">
      <view
        v-for="f in filters"
        :key="f.key"
        class="filter"
        :class="{ active: active === f.key }"
        @click="active = f.key"
      >
        {{ f.label }}
      </view>
    </view>

    <view v-if="error" class="error">{{ error }}</view>

    <view v-if="loading && !items.length" class="empty">加载中…</view>
    <view v-else-if="!visible.length" class="empty">没有符合条件的流水</view>

    <view v-else class="list">
      <view v-for="m in visible" :key="m.id" class="row">
        <view class="row-left">
          <view class="badge" :class="m.delta > 0 ? 'in' : 'out'">{{ m.delta > 0 ? '入' : '出' }}</view>
        </view>
        <view class="row-main">
          <view class="row-name">{{ m.name }}</view>
          <view class="row-meta">
            <text>{{ labelOf(m.type) }}</text>
            <text v-if="m.orderNumber" class="dot">·</text>
            <text v-if="m.orderNumber">{{ m.orderNumber }}</text>
          </view>
          <view class="row-time">{{ timeAgo(m.createdAt) }}<text v-if="m.partner"> · {{ m.partner }}</text></view>
        </view>
        <view class="row-side">
          <view class="delta" :class="m.delta > 0 ? 'in' : 'out'">
            {{ m.delta > 0 ? '+' : '' }}{{ m.delta }}
          </view>
          <view class="balance">结存 {{ m.balance }}</view>
        </view>
      </view>
    </view>

    <view class="footer-hint">共 {{ total }} 条流水 · 显示最近 {{ items.length }} 条</view>
  </view>

  <tab-bar current="flow" />
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import TabBar from '../../components/tab-bar.vue';
import { api, clearToken, timeAgo, MOVEMENT_LABEL } from '../../utils/api.js';

const items = ref([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const active = ref('all');

const filters = [
  { key: 'all', label: '全部' },
  { key: 'in', label: '入库' },
  { key: 'out', label: '出库' },
];

const visible = computed(() => {
  if (active.value === 'in') return items.value.filter((m) => m.delta > 0);
  if (active.value === 'out') return items.value.filter((m) => m.delta < 0);
  return items.value;
});

function labelOf(type) {
  return MOVEMENT_LABEL[type] || type;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.movements(60);
    items.value = data.items || [];
    total.value = data.total || 0;
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

onShow(() => load());

onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});
</script>

<style>
.filters {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.filter {
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #8b90a0;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.filter.active {
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

.row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 26rpx 26rpx;
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
}

.badge {
  width: 52rpx;
  height: 52rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
}

.badge.in {
  background: rgba(124, 224, 184, 0.14);
  color: #7ce0b8;
}

.badge.out {
  background: rgba(255, 180, 84, 0.16);
  color: #ffb454;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-name {
  font-size: 27rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  display: flex;
  gap: 8rpx;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #7d8394;
}

.row-time {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #5b6070;
}

.row-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.delta {
  font-size: 30rpx;
  font-weight: 700;
}

.delta.in {
  color: #7ce0b8;
}

.delta.out {
  color: #ffb454;
}

.balance {
  font-size: 20rpx;
  color: #6b7080;
}

.footer-hint {
  padding: 30rpx 0 10rpx;
  text-align: center;
  font-size: 20rpx;
  color: #5b6070;
}
</style>
