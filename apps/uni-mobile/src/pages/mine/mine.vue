<template>
  <view class="page">
    <view class="profile">
      <view class="avatar">A</view>
      <view class="who">
        <view class="who-name">{{ user.username || 'admin' }}</view>
        <view class="who-role">{{ roleText }}</view>
      </view>
    </view>

    <view class="card group">
      <view class="row">
        <text class="row-k">服务地址</text>
        <text class="row-v">{{ baseUrl }}</text>
      </view>
      <view class="row">
        <text class="row-k">接口状态</text>
        <text class="row-v" :class="online ? 'ok' : 'bad'">{{ online ? '正常' : '不可用' }}</text>
      </view>
      <view class="row" @click="refresh">
        <text class="row-k">数据刷新</text>
        <text class="row-v muted-v">{{ lastCheck || '点击刷新' }}</text>
      </view>
    </view>

    <view class="card group">
      <view class="row">
        <text class="row-k">应用版本</text>
        <text class="row-v">1.1.0</text>
      </view>
      <view class="row">
        <text class="row-k">运行环境</text>
        <text class="row-v">{{ platformText }}</text>
      </view>
    </view>

    <view class="logout" @click="logout">退出登录</view>

    <view class="foot">GearFlow · 进销存管理</view>
  </view>

    <view class="beian-wrap">
      <text class="beian" @click="openBeian">粤ICP备2026167701号</text>
    </view></template>

<script setup>
function openBeian() {
  // 小程序不能直接打开外部浏览器，复制链接提示用户
  uni.setClipboardData({ data: 'https://beian.miit.gov.cn/', showToast: false });
  uni.showToast({ title: '已复制工信部备案查询地址', icon: 'none' });
}
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api, clearToken, getToken } from '../../utils/api.js';
import { BASE_URL } from '../../config.js';

const user = ref({ username: '' });
const online = ref(false);
const lastCheck = ref('');
const baseUrl = BASE_URL;

const ROLE_TEXT = { clerk: '店员', manager: '店长', admin: '系统管理员' };
const roleText = computed(() => ROLE_TEXT[user.value.role] || '店员');

const platformText = ref('小程序');

onShow(async () => {
  if (!getToken()) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  try {
    const info = uni.getSystemInfoSync();
    platformText.value = `${info.platform} · ${info.system}`;
  } catch (e) {
    platformText.value = '小程序';
  }
  refresh();
});

async function refresh() {
  try {
    const me = await api.me();
    user.value = me.user || { username: 'admin' };
    // 同步最新角色，保证单据审批按钮的显示与权限一致
    uni.setStorageSync('gf_role', (me.user && me.user.role) || '');
    online.value = true;
    const d = new Date();
    lastCheck.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    online.value = false;
    lastCheck.value = '';
  }
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: (res) => {
      if (!res.confirm) return;
      clearToken();
      uni.removeStorageSync('gf_role'); // 角色随登录态一起清掉
      uni.reLaunch({ url: '/pages/login/login' });
    },
  });
}
</script>

<style>
.profile {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 8rpx 36rpx;
}

.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.who-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.who-role {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #7d8394;
}

.group {
  margin-bottom: 20rpx;
  padding: 0 28rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.row:last-child {
  border-bottom: none;
}

.row-k {
  font-size: 26rpx;
  color: #b6bbca;
}

.row-v {
  font-size: 24rpx;
  color: #e8eaf0;
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-v.ok {
  color: #7ce0b8;
}

.row-v.bad {
  color: #ff7a7a;
}

.muted-v {
  color: #6b7080;
}

.logout {
  margin-top: 40rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  font-size: 28rpx;
  color: #ff7a7a;
  background: rgba(255, 122, 122, 0.08);
  border: 1px solid rgba(255, 122, 122, 0.22);
}

.foot {
  margin-top: 40rpx;
  text-align: center;
  font-size: 20rpx;
  color: #4d5262;
}
.beian-wrap{padding:32rpx 0 48rpx;text-align:center}
.beian{font-size:20rpx;color:#5f6577}
</style>
