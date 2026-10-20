<template>
  <view class="page">
    <view v-if="!item" class="empty">商品不存在或已删除</view>

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
        </view>
        <view class="bar">
          <view class="bar-fill" :style="{ width: ratio + '%' }" :class="{ low: item.low }" />
        </view>
        <view class="bar-text">补货阈值 {{ item.threshold }} 件</view>
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
          <text class="k">库存金额</text>
          <text class="v">¥{{ yuan(item.price * item.stock) }}</text>
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
import { onLoad } from '@dcloudio/uni-app';
import { api, yuan } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const item = ref(null);

const ratio = computed(() => {
  if (!item.value) return 0;
  const target = Math.max(Number(item.value.threshold) * 3, 1);
  const pct = Math.round((Number(item.value.stock) / target) * 100);
  return Math.min(Math.max(pct, 4), 100);
});

onLoad(async (query) => {
  const id = query && query.id;
  const cached = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');
  item.value = cached.find((p) => String(p.id) === String(id)) || null;
  if (item.value) return;
  try {
    const data = await api.stock();
    item.value = data.products.find((p) => String(p.id) === String(id)) || null;
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
});

function go(type) {
  uni.navigateTo({ url: `/pages/order/order?productId=${item.value.id}&type=${type}` });
}
</script>

<style>
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
  font-size: 80rpx;
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

.bar {
  height: 10rpx;
  margin-top: 24rpx;
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

.actions {
  display: flex;
  gap: 18rpx;
  margin-top: 40rpx;
}

.actions .btn {
  flex: 1;
}
</style>
