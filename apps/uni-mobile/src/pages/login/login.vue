<template>
  <view class="page">
    <view class="hero">
      <view class="badge">GEARFLOW</view>
      <view class="title">进销存移动端</view>
      <view class="subtitle">库存查询 · 扫码盘点 · 随手可查</view>
    </view>

    <view class="card form">
      <view class="label">账号</view>
      <view class="field">
        <input v-model="username" placeholder="请输入账号" placeholder-class="ph" maxlength="100" />
      </view>

      <view class="label">密码</view>
      <view class="field">
        <input v-model="password" password placeholder="请输入密码" placeholder-class="ph" maxlength="256" />
      </view>

      <view v-if="error" class="error">{{ error }}</view>

      <button class="primary" :disabled="busy" @click="submit">
        {{ busy ? '正在登录…' : '登录' }}
      </button>

      <view class="muted tip">登录状态有效期 8 小时</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, setToken, getToken, clearToken } from '../../utils/api.js';

const username = ref('admin');
const password = ref('');
const busy = ref(false);
const error = ref('');

onLoad(async () => {
  if (!getToken()) return;
  try {
    await api.me();
    uni.reLaunch({ url: '/pages/stock/stock' });
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
    uni.reLaunch({ url: '/pages/stock/stock' });
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
  padding: 60rpx 40rpx;
  box-sizing: border-box;
}

.hero {
  padding: 40rpx 8rpx 56rpx;
}

.badge {
  display: inline-block;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(124, 108, 240, 0.16);
  color: #a99bff;
  font-size: 22rpx;
  letter-spacing: 2rpx;
}

.title {
  margin-top: 24rpx;
  font-size: 56rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #8b90a0;
}

.form {
  padding: 40rpx 32rpx;
}

.label {
  margin: 8rpx 0 16rpx 4rpx;
  font-size: 26rpx;
  color: #9aa0b0;
}

.field + .label {
  margin-top: 32rpx;
}

.ph {
  color: #5b6070;
}

.error {
  margin: 24rpx 4rpx 0;
  color: #ff7a7a;
  font-size: 26rpx;
}

.primary {
  margin-top: 40rpx;
}

.tip {
  margin-top: 24rpx;
  text-align: center;
}
</style>
