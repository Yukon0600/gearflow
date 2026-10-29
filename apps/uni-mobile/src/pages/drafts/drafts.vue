<template>
  <view class="page">
    <view v-if="!list.length && !loading" class="card empty-card">
      <text class="empty-icon">📝</text>
      <text class="empty-text">还没有草稿</text>
      <text class="empty-hint">开单页填到一半点「存草稿」，随时回来继续</text>
    </view>

    <view v-else class="list">
      <view v-for="d in list" :key="d.id" class="card item">
        <view class="item-top">
          <view class="type-badge" :class="d.payload.type">{{ d.payload.type === 'purchase' ? '采购入库' : '销售出库' }}</view>
          <text class="item-time">{{ timeAgo(d.updatedAt) }}</text>
        </view>

        <view class="item-lines">
          <view v-for="(l, i) in d.payload.lines.slice(0, 3)" :key="i" class="line">
            <text class="line-name">{{ nameOf(l.productId) }}</text>
            <text class="line-qty">× {{ l.quantity }}</text>
          </view>
          <view v-if="d.payload.lines.length > 3" class="line">
            <text class="line-more">…共 {{ d.payload.lines.length }} 种商品</text>
          </view>
        </view>

        <view class="item-bottom">
          <text class="item-meta">
            {{ d.payload.partner ? d.payload.partner + ' · ' : '' }}合计
            <text class="item-total">¥{{ totalOf(d) }}</text>
          </text>
        </view>

        <view class="item-actions">
          <button class="btn act post" :disabled="busyId === d.id" @click="postDraft(d)">直接记账</button>
          <button class="btn act edit" @click="continueDraft(d)">继续开单</button>
        </view>
      </view>

      <view class="foot-note">记账或重新提交后，草稿会保留在列表中供核对</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api, clearToken, timeAgo, yuan } from '../../utils/api.js';

const list = ref([]);
const products = ref([]);
const loading = ref(false);
const busyId = ref('');

const DRAFT_KEY = 'gf_draft_prefill';

function nameOf(productId) {
  const hit = products.value.find((p) => String(p.id) === String(productId));
  return hit ? hit.name : '未知商品';
}

function totalOf(d) {
  return yuan(d.payload.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0));
}

async function load() {
  loading.value = true;
  try {
    const [draftRes, stockRes] = await Promise.all([api.drafts(), api.stock()]);
    list.value = draftRes || [];
    products.value = stockRes.products || [];
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' });
    if (String(e.message || '').includes('登录')) {
      clearToken();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  } finally {
    loading.value = false;
  }
}

function continueDraft(d) {
  // 把草稿内容放进本地缓存，开单页 onLoad 时回填
  uni.setStorageSync(DRAFT_KEY, JSON.stringify({ id: d.id, payload: d.payload }));
  uni.navigateTo({ url: `/pages/order/order?draft=${d.id}` });
}

function postDraft(d) {
  uni.showModal({
    title: '直接记账',
    content: `按草稿内容原样开单，库存立即变动？`,
    confirmText: '记账',
    success: async (r) => {
      if (!r.confirm) return;
      busyId.value = d.id;
      try {
        const res = await api.postDraft(d.id);
        uni.showToast({ title: `已记账 ${res.number}`, icon: 'none', duration: 2000 });
        await load();
      } catch (e) {
        uni.showModal({ title: '记账失败', content: e.message || '请稍后重试', showCancel: false });
      } finally {
        busyId.value = '';
      }
    },
  });
}

onShow(() => {
  if (!uni.getStorageSync('gf_token')) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  load();
});

onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});
</script>

<style>
.page {
  min-height: 100vh;
  padding: 20rpx 28rpx calc(60rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #0d0e12;
}

.item {
  padding: 24rpx 26rpx;
  margin-bottom: 16rpx;
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.type-badge {
  padding: 6rpx 16rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.type-badge.purchase {
  color: #7ce0b8;
  background: rgba(124, 224, 184, 0.14);
}

.type-badge.sale {
  color: #ffb454;
  background: rgba(255, 180, 84, 0.16);
}

.item-time {
  font-size: 20rpx;
  color: #6b7080;
}

.item-lines {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.line-name {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #c9ceda;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-qty {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #8b90a0;
}

.line-more {
  font-size: 20rpx;
  color: #6b7080;
}

.item-bottom {
  margin-top: 14rpx;
}

.item-meta {
  font-size: 22rpx;
  color: #8b90a0;
}

.item-total {
  margin-left: 6rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.item-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.act {
  flex: 1;
  margin: 0;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 24rpx;
  border-radius: 14rpx;
  padding: 0;
}

.act.post {
  color: #ffb454;
  background: rgba(255, 180, 84, 0.12);
  border: 1px solid rgba(255, 180, 84, 0.3);
}

.act.edit {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.act::after {
  border: none;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 44rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #b6bbca;
}

.empty-hint {
  font-size: 20rpx;
  color: #6b7080;
}

.foot-note {
  padding: 16rpx 0;
  text-align: center;
  font-size: 18rpx;
  color: #4d5262;
}
</style>
