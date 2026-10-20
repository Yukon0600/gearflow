<template>
  <view class="page" :style="{ paddingTop: statusBar + 40 + 'px' }">
    <view class="brand">
      <view class="logo">G</view>
      <view class="brand-text">
        <view class="brand-name">GEARFLOW</view>
        <view class="brand-sub">进销存管理</view>
      </view>
    </view>

    <view class="headline">
      <view class="title">欢迎回来</view>
      <view class="desc">登录后查看库存、扫码出入库、跟踪流水</view>
    </view>

    <view class="form">
      <view class="label">账号</view>
      <view class="field">
        <input v-model="username" placeholder="请输入账号" placeholder-class="ph" maxlength="100" />
      </view>

      <view class="label">密码</view>
      <view class="field">
        <input v-model="password" password placeholder="请输入密码" placeholder-class="ph" maxlength="256" />
      </view>

      <view v-if="error" class="error">{{ error }}</view>

      <button class="btn submit" :disabled="busy" @click="submit">
        {{ busy ? '正在登录…' : '登录' }}
      </button>

      <view class="tip">登录状态有效期 8 小时</view>
    </view>

    <view class="foot">GearFlow · 进销存管理 · v1.2</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, setToken, getToken, clearToken } from '../../utils/api.js';

const statusBar = uni.getSystemInfoSync().statusBarHeight || 20;
const username = ref('admin');
const password = ref('');
const busy = ref(false);
const error = ref('');

onLoad(async () => {
  if (!getToken()) return;
  try {
    await api.me();
    uni.switchTab({ url: '/pages/index/index' });
  } catch (e) {
    clearToken();
  }
});

async function submit() {
  const u = username.value.trim();
  if (!u || !password.value) {
    error.value = '请输入账号和密码';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const res = await api.login(u, password.value);
    setToken(res.token);
    uni.switchTab({ url: '/pages/index/index' });
  } catch (e) {
    error.value = e.message || '登录失败';
  } finally {
    busy.value = false;
  }
}
</script>

<style>
.page {
  min-height: 100vh;
  padding-left: 44rpx;
  padding-right: 44rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: radial-gradient(120% 80% at 20% 0%, rgba(124, 108, 240, 0.18), transparent 60%), #0d0e12;
}

.brand {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.brand-name {
  font-size: 24rpx;
  letter-spacing: 4rpx;
  color: #cfc9ff;
  font-weight: 600;
}

.brand-sub {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #6b7080;
}

.headline {
  margin-top: 90rpx;
}

.title {
  font-size: 60rpx;
  font-weight: 700;
  color: #f5f6fa;
}

.desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #8b90a0;
  line-height: 1.6;
}

.form {
  margin-top: 60rpx;
}

.label {
  margin: 26rpx 0 14rpx 4rpx;
  font-size: 24rpx;
  color: #8b90a0;
}

.field {
  padding: 26rpx 28rpx;
  background: rgba(23, 26, 33, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
}

.field input {
  font-size: 30rpx;
  color: #e8eaf0;
}

.ph {
  color: #5b6070;
}

.error {
  margin: 24rpx 4rpx 0;
  font-size: 24rpx;
  color: #ff7a7a;
}

.submit {
  margin-top: 44rpx;
}

.tip {
  margin-top: 24rpx;
  text-align: center;
  font-size: 20rpx;
  color: #5b6070;
}

.foot {
  margin-top: auto;
  padding-bottom: 50rpx;
  text-align: center;
  font-size: 20rpx;
  color: #3f4453;
}
</style>
