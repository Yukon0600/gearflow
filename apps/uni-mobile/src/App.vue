<script>
import { getToken } from './utils/api.js';
</script>

<script setup>
import { onLaunch } from '@dcloudio/uni-app';

onLaunch(() => {
  // 已登录直接进库存页，否则留在登录页（pages.json 第一项）
  if (getToken()) {
    uni.reLaunch({ url: '/pages/stock/stock' });
  }
});
</script>

<style>
page {
  background: #0d0e12;
  color: #e8eaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.card {
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
}

.field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 32rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
}

.field input {
  flex: 1;
  color: #e8eaf0;
  font-size: 30rpx;
}

.primary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
}

.primary[disabled] {
  opacity: 0.55;
}

.muted {
  color: #8b90a0;
  font-size: 26rpx;
}
</style>
