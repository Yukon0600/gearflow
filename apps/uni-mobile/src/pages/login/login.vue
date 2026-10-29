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

      <view class="remember" @click="remember = !remember">
        <view class="check" :class="{ on: remember }">
          <text v-if="remember" class="tick">✓</text>
        </view>
        <text class="remember-text">记住密码，下次自动登录</text>
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
const REMEMBER_KEY = 'gf_login';

// 构建期注入的开发用默认值（见 vite.config.js），仓库里不保存凭据，默认空字符串
const DEV_USER = __DEV_USER__ || '';
const DEV_PWD = __DEV_PWD__ || '';

function readRemember() {
  try {
    return JSON.parse(uni.getStorageSync(REMEMBER_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

const saved = readRemember();
const username = ref(saved.username || DEV_USER || 'admin');
const password = ref(saved.password || DEV_PWD || '');
const remember = ref(saved.remember !== false);
const busy = ref(false);
const error = ref('');

onLoad(async () => {
  // 已登录直接进工作台
  if (getToken()) {
    try {
      const me = await api.me();
      uni.setStorageSync('gf_role', (me.user && me.user.role) || '');
      uni.switchTab({ url: '/pages/index/index' });
      return;
    } catch (e) {
      clearToken();
    }
  }
  // 记住了密码就自动登录，省掉一次点击
  if (remember.value && username.value && password.value) {
    setTimeout(() => submit(), 200);
  }
});

async function submit() {
  const u = String(username.value).trim();
  if (!u || !password.value) {
    error.value = '请输入账号和密码';
    return;
  }
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const res = await api.login(u, password.value);
    setToken(res.token);
    // 存角色：单据审批按钮只对店长/管理员可见
    uni.setStorageSync('gf_role', (res.user && res.user.role) || '');
    if (remember.value) {
      uni.setStorageSync(REMEMBER_KEY, JSON.stringify({ username: u, password: password.value, remember: true }));
    } else {
      uni.removeStorageSync(REMEMBER_KEY);
    }
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
  margin-top: 70rpx;
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
  margin-top: 44rpx;
}

.label {
  margin: 24rpx 0 14rpx 4rpx;
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

.remember {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 26rpx 4rpx 0;
}

.check {
  width: 32rpx;
  height: 32rpx;
  border-radius: 8rpx;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.check.on {
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  border-color: transparent;
}

.tick {
  font-size: 20rpx;
  color: #fff;
  line-height: 1;
}

.remember-text {
  font-size: 24rpx;
  color: #8b90a0;
}

.error {
  margin: 20rpx 4rpx 0;
  font-size: 24rpx;
  color: #ff7a7a;
}

.submit {
  margin-top: 34rpx;
}

.tip {
  margin-top: 22rpx;
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
