<template>
  <view class="tabbar">
    <view
      v-for="item in tabs"
      :key="item.key"
      class="tab"
      :class="{ active: current === item.key }"
      @click="go(item)"
    >
      <view class="indicator" />
      <text class="label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  current: { type: String, default: 'index' },
});

const tabs = [
  { key: 'index', label: '概览', url: '/pages/index/index' },
  { key: 'stock', label: '库存', url: '/pages/stock/stock' },
  { key: 'flow', label: '流水', url: '/pages/flow/flow' },
  { key: 'mine', label: '我的', url: '/pages/mine/mine' },
];

function go(item) {
  if (item.key === props.current) return;
  uni.reLaunch({ url: item.url });
}
</script>

<style>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  padding: 12rpx 0 calc(12rpx + env(safe-area-inset-bottom));
  background: rgba(13, 14, 18, 0.92);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20rpx);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 0;
}

.indicator {
  width: 28rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: transparent;
}

.tab.active .indicator {
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.label {
  font-size: 22rpx;
  color: #6b7080;
}

.tab.active .label {
  color: #e8eaf0;
  font-weight: 600;
}
</style>
