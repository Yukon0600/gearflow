<template>
  <view class="page">
    <!-- 合计 -->
    <view class="hero">
      <view class="hero-item">
        <text class="hero-label">应收合计</text>
        <text class="hero-value">¥{{ thousands(Math.round(receivable / 100)) }}</text>
      </view>
      <view class="hero-divider" />
      <view class="hero-item">
        <text class="hero-label">应付合计</text>
        <text class="hero-value">¥{{ thousands(Math.round(payable / 100)) }}</text>
      </view>
    </view>

    <!-- Tab：应收 / 应付 -->
    <view class="seg-row">
      <view class="seg" :class="{ active: direction === 'in' }" @click="switchTab('in')">应收（客户欠我）</view>
      <view class="seg" :class="{ active: direction === 'out' }" @click="switchTab('out')">应付（我欠供应商）</view>
    </view>

    <!-- 搜索 -->
    <view class="search">
      <text class="search-icon">⌕</text>
      <input v-model="keyword" class="search-input" placeholder="搜索单位名称" placeholder-class="ph" />
    </view>

    <!-- 列表 -->
    <view v-if="!filteredList.length" class="card empty-card">
      <text class="empty-icon">✓</text>
      <text class="empty-text">{{ direction === 'in' ? '没有待收款的客户' : '没有待付款的供应商' }}</text>
    </view>

    <view v-else class="list">
      <view v-for="item in filteredList" :key="item.partner" class="card item">
        <view class="item-main" @click="toggle(item.partner)">
          <text class="item-name">{{ item.partner }}</text>
          <view class="item-side">
            <text class="item-balance" :class="direction">¥{{ yuan(Math.max(item.balance, 0)) }}</text>
            <text class="item-meta">开票 {{ yuan(item.billed) }} · 已结 {{ yuan(item.settled) }}</text>
          </view>
        </view>

        <view v-if="isOpen(item.partner)" class="item-detail">
          <view class="detail-row">
            <text class="detail-k">单据金额</text>
            <text class="detail-v">¥{{ yuan(item.billed) }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-k">退货冲减</text>
            <text class="detail-v">-¥{{ yuan(item.returned) }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-k">已{{ direction === 'in' ? '收款' : '付款' }}</text>
            <text class="detail-v">¥{{ yuan(item.settled) }}</text>
          </view>
          <view class="detail-row total">
            <text class="detail-k">待{{ direction === 'in' ? '收' : '付' }}余额</text>
            <text class="detail-v strong">¥{{ yuan(Math.max(item.balance, 0)) }}</text>
          </view>
        </view>

        <view v-if="canPay" class="item-actions">
          <button class="btn pay" @click="openPay(item)">
            登记{{ direction === 'in' ? '收款' : '付款' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 登记收付款弹层 -->
    <view v-if="payTarget" class="mask" @click="payTarget = null">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <text class="sheet-title">登记{{ direction === 'in' ? '收款' : '付款' }}</text>
          <text class="sheet-close" @click="payTarget = null">关闭</text>
        </view>
        <text class="sheet-partner">{{ payTarget.partner }} · 待{{ direction === 'in' ? '收' : '付' }} ¥{{ yuan(Math.max(payTarget.balance, 0)) }}</text>

        <view class="field">
          <text class="field-label">金额（元）</text>
          <input v-model="payAmount" class="field-input" type="digit" placeholder="0.00" placeholder-class="ph" />
        </view>
        <view class="quick" v-if="Math.max(payTarget.balance, 0) > 0">
          <text class="quick-btn" @click="payAmount = (Math.max(payTarget.balance, 0) / 100).toFixed(2)">全部结清</text>
        </view>

        <view class="field">
          <text class="field-label">方式</text>
          <view class="method-row">
            <view
              v-for="m in methods"
              :key="m.key"
              class="method"
              :class="{ active: payMethod === m.key }"
              @click="payMethod = m.key"
            >{{ m.label }}</view>
          </view>
        </view>
        <view class="field">
          <text class="field-label">备注</text>
          <input v-model="payNote" class="field-input" placeholder="选填" placeholder-class="ph" maxlength="200" />
        </view>

        <view v-if="payError" class="pay-error">{{ payError }}</view>
        <button class="btn submit" :disabled="payBusy" @click="submitPay">
          {{ payBusy ? '提交中…' : '确认登记' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api, canApproveRole, clearToken, thousands, yuan } from '../../utils/api.js';

const direction = ref('in'); // in=应收 / out=应付
const data = ref({ receivables: { total: 0, items: [] }, payables: { total: 0, items: [] } });
const keyword = ref('');
const openSet = ref({});
const canPay = ref(false);
const loaded = ref(false);

// 收付款弹层
const payTarget = ref(null);
const payAmount = ref('');
const payMethod = ref('wechat');
const payNote = ref('');
const payBusy = ref(false);
const payError = ref('');

const methods = [
  { key: 'cash', label: '现金' },
  { key: 'wechat', label: '微信' },
  { key: 'alipay', label: '支付宝' },
  { key: 'bank', label: '银行' },
  { key: 'other', label: '其他' },
];

const currentItems = computed(() =>
  direction.value === 'in' ? data.value.receivables.items : data.value.payables.items,
);
const receivable = computed(() => data.value.receivables.total || 0);
const payable = computed(() => data.value.payables.total || 0);

const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return currentItems.value;
  return currentItems.value.filter((i) => String(i.partner || '').toLowerCase().includes(k));
});

function isOpen(partner) {
  return !!openSet.value[partner];
}

function toggle(partner) {
  openSet.value = { ...openSet.value, [partner]: !openSet.value[partner] };
}

function switchTab(key) {
  if (direction.value === key) return;
  direction.value = key;
}

async function load() {
  try {
    data.value = await api.reconcile();
    loaded.value = true;
  } catch (e) {
    uni.showToast({ title: e.message || '加载失败', icon: 'none' });
    if (String(e.message || '').includes('登录')) {
      clearToken();
      uni.reLaunch({ url: '/pages/login/login' });
    }
  }
}

function openPay(item) {
  payTarget.value = item;
  payAmount.value = '';
  payMethod.value = 'wechat';
  payNote.value = '';
  payError.value = '';
}

async function submitPay() {
  payError.value = '';
  const amountYuan = Number(payAmount.value);
  if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
    payError.value = '请输入正确的金额';
    return;
  }
  const amount = Math.round(amountYuan * 100);
  const balance = Math.max(payTarget.value.balance, 0);
  if (amount > balance) {
    payError.value = `超出待${direction.value === 'in' ? '收' : '付'}余额（最多 ¥${(balance / 100).toFixed(2)}）`;
    return;
  }
  payBusy.value = true;
  try {
    await api.createPayment({
      direction: direction.value,
      partner: payTarget.value.partner,
      amount,
      method: payMethod.value,
      note: payNote.value.trim(),
    });
    uni.showToast({ title: '登记成功', icon: 'success' });
    payTarget.value = null;
    await load();
  } catch (e) {
    payError.value = e.message || '登记失败';
  } finally {
    payBusy.value = false;
  }
}

onShow(() => {
  if (!uni.getStorageSync('gf_token')) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  canPay.value = canApproveRole(); // 收付款登记需要店长及以上
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

/* 合计卡 */
.hero {
  display: flex;
  align-items: center;
  padding: 30rpx 32rpx;
  border-radius: 26rpx;
  background: linear-gradient(150deg, rgba(124, 108, 240, 0.22), rgba(74, 168, 240, 0.05) 60%, #171a21);
  border: 1px solid rgba(124, 108, 240, 0.22);
}

.hero-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.hero-label {
  font-size: 22rpx;
  color: #c2bcf0;
}

.hero-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.hero-divider {
  width: 1px;
  height: 70rpx;
  margin: 0 24rpx;
  background: rgba(255, 255, 255, 0.12);
}

/* Tab */
.seg-row {
  display: flex;
  gap: 12rpx;
  margin: 22rpx 0 16rpx;
}

.seg {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 23rpx;
  color: #8b90a0;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.seg.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  border-color: transparent;
  font-weight: 600;
}

/* 搜索 */
.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 24rpx;
  margin-bottom: 20rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18rpx;
}

.search-icon {
  font-size: 28rpx;
  color: #6b7080;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #e8eaf0;
}

/* 列表 */
.item {
  padding: 24rpx 26rpx;
  margin-bottom: 14rpx;
}

.item-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.item-balance {
  font-size: 30rpx;
  font-weight: 700;
}

.item-balance.in {
  color: #7ce0b8;
}

.item-balance.out {
  color: #ffb454;
}

.item-meta {
  font-size: 18rpx;
  color: #6b7080;
}

.item-detail {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0;
}

.detail-k {
  font-size: 22rpx;
  color: #6b7080;
}

.detail-v {
  font-size: 22rpx;
  color: #b6bbca;
  font-variant-numeric: tabular-nums;
}

.detail-v.strong {
  font-size: 26rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.item-actions {
  margin-top: 18rpx;
}

.pay {
  margin: 0;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 24rpx;
  border-radius: 14rpx;
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.pay::after {
  border: none;
}

/* 弹层 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(5, 6, 12, 0.6);
  display: flex;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  padding: 28rpx 30rpx calc(30rpx + env(safe-area-inset-bottom));
  background: #14161d;
  border-radius: 28rpx 28rpx 0 0;
  box-sizing: border-box;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #f2f4f8;
}

.sheet-close {
  font-size: 24rpx;
  color: #8b90a0;
}

.sheet-partner {
  display: block;
  margin-bottom: 20rpx;
  font-size: 22rpx;
  color: #8b90a0;
}

.field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.field-label {
  width: 130rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  color: #b6bbca;
}

.field-input {
  flex: 1;
  text-align: right;
  font-size: 27rpx;
  color: #e8eaf0;
}

.quick {
  display: flex;
  justify-content: flex-end;
  padding: 12rpx 0 0;
}

.quick-btn {
  font-size: 22rpx;
  color: #a99bff;
}

.method-row {
  flex: 1;
  display: flex;
  gap: 10rpx;
}

.method {
  flex: 1;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #8b90a0;
  background: #1b1e26;
}

.method.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  font-weight: 600;
}

.pay-error {
  margin-top: 14rpx;
  font-size: 22rpx;
  color: #ff7a7a;
}

.submit {
  margin-top: 26rpx;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 70rpx 0;
}

.empty-icon {
  font-size: 44rpx;
  color: #7ce0b8;
}

.empty-text {
  font-size: 26rpx;
  color: #6b7080;
}

.ph {
  color: #5b6070;
}
</style>
