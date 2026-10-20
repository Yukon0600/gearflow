<script>
import { getToken } from './utils/api.js';
</script>

<script setup>
import { onLaunch } from '@dcloudio/uni-app';

onLaunch(() => {
  if (getToken()) {
    uni.switchTab({ url: '/pages/index/index' });
  }
});
</script>

<style>
page {
  background: #0d0e12;
  color: #e8eaf0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 通用容器 */
.page {
  min-height: 100vh;
  padding: 24rpx 28rpx 40rpx;
  box-sizing: border-box;
}

.card {
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
}

.muted {
  color: #8b90a0;
  font-size: 24rpx;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 36rpx 4rpx 20rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #e8eaf0;
}

.section-title .more {
  font-size: 22rpx;
  color: #7d8394;
  font-weight: 400;
}

/* 状态胶囊 */
.pill {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  line-height: 1.6;
}

.pill.ok {
  background: rgba(124, 224, 184, 0.14);
  color: #7ce0b8;
}

.pill.warn {
  background: rgba(255, 180, 84, 0.16);
  color: #ffb454;
}

.pill.info {
  background: rgba(124, 108, 240, 0.18);
  color: #a99bff;
}

/* 按钮 */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.btn[disabled] {
  opacity: 0.5;
}

.btn-ghost {
  background: #171a21;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e8eaf0;
}

.empty {
  padding: 80rpx 0;
  text-align: center;
  color: #6b7080;
  font-size: 26rpx;
}

/* 数字用等宽，视觉更整齐 */
.num {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5rpx;
}
</style>
