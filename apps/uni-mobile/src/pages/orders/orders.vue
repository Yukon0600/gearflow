<template>
  <view class="page">
    <!-- 搜索 -->
    <view class="search">
      <text class="search-icon">⌕</text>
      <input
        v-model="q"
        class="search-input"
        placeholder="搜索单号 / 往来单位"
        placeholder-class="ph"
        confirm-type="search"
        @confirm="reload"
      />
      <text v-if="q" class="search-clear" @click="clearSearch">清除</text>
    </view>

    <!-- 状态筛选 -->
    <view class="seg-row">
      <view
        v-for="s in statusTabs"
        :key="s.key"
        class="seg"
        :class="{ active: status === s.key }"
        @click="switchStatus(s.key)"
      >
        <text>{{ s.label }}</text>
        <text v-if="s.key === 'pending' && pendingTotal > 0" class="seg-badge">{{ segBadgeText }}</text>
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="!list.length && !loading" class="card empty-card">
      <text class="empty-icon">🗂</text>
      <text class="empty-text">{{ status === 'pending' ? '没有待审批的单据' : '暂无单据' }}</text>
      <text class="empty-hint">开单后在这里查看进度，店长可直接审批</text>
    </view>

    <view v-else class="list">
      <view v-for="o in list" :key="o.id" class="card order-card" @click="toggle(o.id)">
        <view class="card-top">
          <view class="type-badge" :class="o.type">{{ ORDER_TYPE_LABEL[o.type] || o.type }}</view>
          <text class="order-number">{{ o.number }}</text>
          <view class="status-badge" :class="o.status">{{ ORDER_STATUS_LABEL[o.status] || o.status }}</view>
        </view>

        <view class="card-mid">
          <view class="mid-main">
            <text class="partner">{{ o.partner }}</text>
            <text class="meta">
              {{ o.lines.length }} 行 · 共 {{ sumQty(o) }} 件 · {{ timeAgo(o.createdAt) }}
              <template v-if="o.createdBy"> · {{ o.createdBy }} 提交</template>
            </text>
          </view>
          <view class="mid-side">
            <text class="amount">¥{{ yuan(o.total) }}</text>
          </view>
        </view>

        <!-- 展开明细 -->
        <view v-if="isOpen(o.id)" class="detail">
          <view v-for="(l, i) in o.lines" :key="i" class="detail-line">
            <text class="detail-name">{{ l.name }}</text>
            <text class="detail-qty">× {{ l.quantity }}</text>
            <text class="detail-sub">¥{{ yuan(l.unitPrice * l.quantity) }}</text>
          </view>
          <view v-if="o.note" class="detail-note">备注：{{ o.note }}</view>
          <view v-if="o.status === 'posted' && o.approvedBy" class="detail-note ok">
            {{ o.approvedBy }} 已审批生效
          </view>
          <view v-if="o.status === 'rejected'" class="detail-note bad">
            驳回原因：{{ o.rejectReason || '未填写' }}
          </view>
        </view>

        <!-- 审批操作 -->
        <view v-if="o.status === 'pending' && canApprove" class="actions">
          <button class="btn act reject" @click.stop="rejectOrder(o)">驳回</button>
          <button class="btn act approve" @click.stop="approveOrder(o)">通过</button>
        </view>
      </view>

      <view v-if="loading" class="more">加载中…</view>
      <view v-else-if="page >= pages" class="more">没有更多了 · 共 {{ total }} 张</view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import {
  api,
  canApproveRole,
  clearToken,
  timeAgo,
  yuan,
  ORDER_STATUS_LABEL,
} from '../../utils/api.js';

// 单据类型文案 + 配色（api.js 的 MOVEMENT_LABEL 含盘点/期初，这里只保留单据类型）
const ORDER_TYPE_LABEL = {
  purchase: '采购入库',
  sale: '销售出库',
  return_in: '销售退货',
  return_out: '采购退货',
  scrap: '报损',
};

const statusTabs = [
  { key: 'pending', label: '待审批' },
  { key: 'posted', label: '已生效' },
  { key: 'rejected', label: '已驳回' },
  { key: 'all', label: '全部' },
];

const status = ref('pending');
const q = ref('');
const list = ref([]);
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const pendingTotal = ref(0);
const loading = ref(false);
const openMap = ref({});
const canApprove = ref(false);
const actedIds = ref({}); // 本次会话已处理过的单据，避免重复提交

const segBadgeText = computed(() => (pendingTotal.value > 99 ? '99+' : String(pendingTotal.value)));
const isOpen = (id) => !!openMap.value[id];

function sumQty(o) {
  return o.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
}

function toggle(id) {
  openMap.value = { ...openMap.value, [id]: !openMap.value[id] };
}

async function ensureRole() {
  if (uni.getStorageSync('gf_role')) {
    canApprove.value = canApproveRole();
    return;
  }
  try {
    const me = await api.me();
    uni.setStorageSync('gf_role', (me.user && me.user.role) || '');
  } catch (e) {
    // 角色拿不到就按无审批权限处理，不影响浏览
  }
  canApprove.value = canApproveRole();
}

async function refreshPendingTotal() {
  try {
    const res = await api.orders({ page: 1, size: 1, status: 'pending' });
    pendingTotal.value = Number(res.total || 0);
  } catch (e) {
    pendingTotal.value = 0;
  }
}

async function load(reset = false) {
  if (loading.value) return;
  if (!reset && page.value >= pages.value) return;
  loading.value = true;
  try {
    const next = reset ? 1 : page.value + 1;
    const res = await api.orders({
      page: next,
      size: 10,
      status: status.value,
      q: q.value.trim(),
    });
    list.value = reset ? res.items : list.value.concat(res.items);
    page.value = res.page;
    pages.value = res.pages;
    total.value = res.total;
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

function reload() {
  load(true);
}

function switchStatus(key) {
  if (status.value === key) return;
  status.value = key;
  reload();
}

function clearSearch() {
  q.value = '';
  reload();
}

onShow(() => {
  if (!uni.getStorageSync('gf_token')) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }
  ensureRole();
  refreshPendingTotal();
  reload();
});

onPullDownRefresh(async () => {
  await Promise.all([refreshPendingTotal(), load(true)]);
  uni.stopPullDownRefresh();
});

// 触底加载下一页
onReachBottom(() => load(false));

function approveOrder(order) {
  if (actedIds.value[order.id]) {
    uni.showToast({ title: '该单据已处理', icon: 'none' });
    return;
  }
  uni.showModal({
    title: '通过审批',
    content: `确认通过 ${order.number}？库存将立即变动`,
    confirmText: '通过',
    success: async (r) => {
      if (!r.confirm) return;
      actedIds.value = { ...actedIds.value, [order.id]: true };
      try {
        await api.approveOrder(order.id);
        uni.showToast({ title: '已通过', icon: 'success' });
        await Promise.all([refreshPendingTotal(), load(true)]);
      } catch (e) {
        uni.showToast({ title: e.message || '操作失败', icon: 'none' });
        actedIds.value = { ...actedIds.value };
        delete actedIds.value[order.id];
      }
    },
  });
}

function rejectOrder(order) {
  if (actedIds.value[order.id]) {
    uni.showToast({ title: '该单据已处理', icon: 'none' });
    return;
  }
  uni.showModal({
    title: '驳回单据',
    editable: true,
    placeholderText: '请填写驳回原因（可留空）',
    confirmText: '驳回',
    confirmColor: '#FF7A7A',
    success: async (r) => {
      if (!r.confirm) return;
      actedIds.value = { ...actedIds.value, [order.id]: true };
      try {
        await api.rejectOrder(order.id, r.content || '');
        uni.showToast({ title: '已驳回', icon: 'success' });
        await Promise.all([refreshPendingTotal(), load(true)]);
      } catch (e) {
        uni.showToast({ title: e.message || '操作失败', icon: 'none' });
        delete actedIds.value[order.id];
      }
    },
  });
}
</script>

<style>
.page {
  min-height: 100vh;
  padding: 20rpx 28rpx calc(60rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #0d0e12;
}

/* 搜索 */
.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
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

.search-clear {
  font-size: 22rpx;
  color: #8b90a0;
}

/* 状态筛选 */
.seg-row {
  display: flex;
  gap: 12rpx;
  margin: 20rpx 0 24rpx;
}

.seg {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
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

.seg-badge {
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 18rpx;
  color: #fff;
  background: rgba(255, 122, 122, 0.9);
  box-sizing: border-box;
}

/* 卡片 */
.order-card {
  padding: 24rpx 26rpx;
  margin-bottom: 16rpx;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.type-badge {
  flex-shrink: 0;
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

.type-badge.return_in {
  color: #a99bff;
  background: rgba(124, 108, 240, 0.18);
}

.type-badge.return_out {
  color: #6fc3ff;
  background: rgba(74, 168, 240, 0.16);
}

.type-badge.scrap {
  color: #ff8a8a;
  background: rgba(255, 138, 138, 0.14);
}

.order-number {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #b6bbca;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
}

.status-badge.pending {
  color: #ffb454;
  background: rgba(255, 180, 84, 0.14);
}

.status-badge.posted {
  color: #7ce0b8;
  background: rgba(124, 224, 184, 0.12);
}

.status-badge.rejected {
  color: #ff7a7a;
  background: rgba(255, 122, 122, 0.14);
}

.card-mid {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.mid-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.partner {
  font-size: 28rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 20rpx;
  color: #6b7080;
}

.amount {
  font-size: 32rpx;
  font-weight: 700;
  color: #f2f4f8;
  font-variant-numeric: tabular-nums;
}

.mid-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.more-link {
  font-size: 20rpx;
  color: #a99bff;
}

/* 展开明细 */
.detail {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-line {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 8rpx 0;
}

.detail-name {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #c9ceda;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-qty {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #8b90a0;
}

.detail-sub {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #b6bbca;
  font-variant-numeric: tabular-nums;
}

.detail-note {
  margin-top: 10rpx;
  font-size: 20rpx;
  color: #6b7080;
}

.detail-note.ok {
  color: #7ce0b8;
}

.detail-note.bad {
  color: #ff8a8a;
}

/* 审批按钮 */
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.act {
  flex: 1;
  margin: 0;
  height: 68rpx;
  line-height: 68rpx;
  font-size: 25rpx;
  border-radius: 16rpx;
  padding: 0;
}

.act.reject {
  color: #ff8a8a;
  background: rgba(255, 138, 138, 0.12);
  border: 1px solid rgba(255, 138, 138, 0.3);
}

.act.approve {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
}

.act::after {
  border: none;
}

/* 空态与加载 */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 70rpx 0;
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

.more {
  padding: 24rpx 0;
  text-align: center;
  font-size: 22rpx;
  color: #4d5262;
}

.ph {
  color: #5b6070;
}
</style>
