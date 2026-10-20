<template>
  <view class="page">
    <view v-if="!item" class="muted center">商品不存在或已删除</view>

    <template v-else>
      <view class="card head">
        <view class="name">{{ item.name }}</view>
        <view class="sku">{{ item.sku }}</view>
        <view class="stock-line">
          <text class="stock" :class="{ low: item.low }">{{ item.stock }}</text>
          <text class="unit">件在库</text>
          <text class="tag" :class="{ low: item.low }">{{ item.low ? '低于阈值' : '库存正常' }}</text>
        </view>
      </view>

      <view class="card info">
        <view class="line"><text class="k">品牌</text><text class="v">{{ item.brand || '—' }}</text></view>
        <view class="line"><text class="k">分类</text><text class="v">{{ item.category || '—' }}</text></view>
        <view class="line"><text class="k">销售单价</text><text class="v">¥{{ priceText }}</text></view>
        <view class="line"><text class="k">补货阈值</text><text class="v">{{ item.threshold }} 件</text></view>
      </view>

      <view class="muted tip">数据来自 GearFlow 服务端，实时查询</view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { STORAGE_PRODUCTS } from '../../config.js';

const item = ref(null);

const priceText = computed(() => {
  if (!item.value) return '0.00';
  return (Number(item.value.price || 0) / 100).toFixed(2);
});

onLoad((query) => {
  const id = query && query.id;
  const list = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');
  item.value = list.find((p) => String(p.id) === String(id)) || null;
});
</script>

<style>
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.head {
  padding: 40rpx 32rpx;
}

.name {
  font-size: 40rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.sku {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #7d8394;
}

.stock-line {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 32rpx;
}

.stock {
  font-size: 64rpx;
  font-weight: 700;
  color: #7ce0b8;
}

.stock.low {
  color: #ffb454;
}

.unit {
  font-size: 24rpx;
  color: #8b90a0;
}

.tag {
  margin-left: auto;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(124, 224, 184, 0.14);
  color: #7ce0b8;
  font-size: 22rpx;
}

.tag.low {
  background: rgba(255, 180, 84, 0.16);
  color: #ffb454;
}

.info {
  margin-top: 24rpx;
  padding: 8rpx 32rpx;
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.line:last-child {
  border-bottom: none;
}

.k {
  font-size: 26rpx;
  color: #8b90a0;
}

.v {
  font-size: 28rpx;
  color: #e8eaf0;
}

.center {
  padding: 120rpx 0;
  text-align: center;
}

.tip {
  margin-top: 32rpx;
  text-align: center;
}
</style>
