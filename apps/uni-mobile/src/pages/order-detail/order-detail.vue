<template>
  <view class="page">
    <view v-if="!order" class="card empty-card">
      <text class="empty-text">单据数据不存在</text>
    </view>

    <template v-else>
      <!-- 头部：类型 + 单号 + 状态 -->
      <view class="card head">
        <view class="head-top">
          <view class="type-badge" :class="order.type">{{ typeLabel }}</view>
          <view class="status-badge" :class="order.status">{{ statusLabel }}</view>
        </view>
        <text class="head-number">{{ order.number }}</text>
        <view class="head-grid">
          <view class="grid-cell">
            <text class="cell-k">{{ partnerLabel }}</text>
            <text class="cell-v">{{ order.partner }}</text>
          </view>
          <view class="grid-cell">
            <text class="cell-k">创建时间</text>
            <text class="cell-v">{{ fmtDate(order.createdAt) }}</text>
          </view>
          <view class="grid-cell">
            <text class="cell-k">提交人</text>
            <text class="cell-v">{{ order.createdBy || '—' }}</text>
          </view>
          <view class="grid-cell">
            <text class="cell-k">商品行数</text>
            <text class="cell-v">{{ order.lines.length }} 行 · {{ totalQty }} 件</text>
          </view>
        </view>
        <view v-if="order.note" class="head-note">备注：{{ order.note }}</view>
      </view>

      <!-- 审批时间线 -->
      <view class="card timeline">
        <view class="tl-row done">
          <view class="tl-dot" />
          <view class="tl-main">
            <text class="tl-title">提交单据</text>
            <text class="tl-meta">{{ order.createdBy || '—' }} · {{ fmtDate(order.createdAt) }}</text>
          </view>
        </view>

        <view v-if="order.status === 'posted'" class="tl-row done">
          <view class="tl-dot" />
          <view class="tl-main">
            <text class="tl-title">审批通过，已生效</text>
            <text class="tl-meta">{{ order.approvedBy || '—' }} · {{ fmtDate(order.approvedAt) }}</text>
          </view>
        </view>

        <view v-else-if="order.status === 'rejected'" class="tl-row done bad">
          <view class="tl-dot" />
          <view class="tl-main">
            <text class="tl-title">已驳回</text>
            <text class="tl-meta">{{ order.approvedBy || '—' }} · {{ fmtDate(order.approvedAt) }}</text>
            <text v-if="order.rejectReason" class="tl-reason">原因：{{ order.rejectReason }}</text>
          </view>
        </view>

        <view v-else class="tl-row pending">
          <view class="tl-dot" />
          <view class="tl-main">
            <text class="tl-title">待审批</text>
            <text class="tl-meta">等待店长或管理员处理</text>
          </view>
        </view>
      </view>

      <!-- 明细 -->
      <view class="card lines">
        <view v-for="(l, i) in order.lines" :key="i" class="line" :class="{ first: i === 0 }">
          <view class="line-main">
            <text class="line-name">{{ l.name }}</text>
            <text class="line-sku">{{ l.sku }}</text>
          </view>
          <view class="line-side">
            <text class="line-qty">× {{ l.quantity }}</text>
            <text class="line-sub">¥{{ yuan(l.unitPrice * l.quantity) }}</text>
          </view>
        </view>
      </view>

      <!-- 合计 -->
      <view class="card total">
        <text class="total-k">单据合计</text>
        <text class="total-v num">¥{{ yuan(order.total) }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { yuan, ORDER_STATUS_LABEL } from '../../utils/api.js';

const TYPE_TEXT = {
  purchase: { label: '采购入库', partner: '供应商' },
  sale: { label: '销售出库', partner: '客户' },
  return_in: { label: '销售退货', partner: '客户' },
  return_out: { label: '采购退货', partner: '供应商' },
  scrap: { label: '报损', partner: '损耗' },
};

const order = ref(null);

const typeLabel = computed(() => (order.value ? TYPE_TEXT[order.value.type]?.label || order.value.type : ''));
const partnerLabel = computed(() => (order.value ? TYPE_TEXT[order.value.type]?.partner || '往来单位' : ''));
const statusLabel = computed(() => (order.value ? ORDER_STATUS_LABEL[order.value.status] || order.value.status : ''));
const totalQty = computed(() => (order.value ? order.value.lines.reduce((s, l) => s + Number(l.quantity || 0), 0) : 0));

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onLoad(() => {
  // 单据中心通过本地缓存传递完整单据对象（含明细行）
  try {
    order.value = JSON.parse(uni.getStorageSync('gf_order_detail') || 'null');
  } catch (e) {
    order.value = null;
  }
});
</script>

<style>
.page {
  min-height: 100vh;
  padding: 20rpx 28rpx calc(60rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #0d0e12;
}

.head {
  padding: 26rpx 28rpx;
}

.head-top {
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

.status-badge {
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

.head-number {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: #b6bbca;
}

.head-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20rpx;
}

.grid-cell {
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 10rpx 0;
  box-sizing: border-box;
}

.cell-k {
  font-size: 19rpx;
  color: #6b7080;
}

.cell-v {
  font-size: 23rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-note {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 22rpx;
  color: #8b90a0;
}

/* 时间线 */
.timeline {
  margin-top: 16rpx;
  padding: 24rpx 28rpx;
}

.tl-row {
  display: flex;
  gap: 18rpx;
  padding: 10rpx 0;
}

.tl-dot {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  margin-top: 8rpx;
  border-radius: 999rpx;
  background: #7ce0b8;
}

.tl-row.pending .tl-dot {
  background: #ffb454;
}

.tl-row.bad .tl-dot {
  background: #ff7a7a;
}

.tl-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.tl-title {
  font-size: 24rpx;
  color: #eef0f6;
}

.tl-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.tl-reason {
  font-size: 20rpx;
  color: #ff8a8a;
}

/* 明细 */
.lines {
  margin-top: 16rpx;
  padding: 10rpx 28rpx;
}

.line {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.line.first {
  border-top: none;
}

.line-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.line-name {
  font-size: 25rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-sku {
  font-size: 19rpx;
  color: #6b7080;
}

.line-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.line-qty {
  font-size: 22rpx;
  color: #8b90a0;
}

.line-sub {
  font-size: 24rpx;
  color: #f2f4f8;
  font-variant-numeric: tabular-nums;
}

/* 合计 */
.total {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
}

.total-k {
  font-size: 24rpx;
  color: #8b90a0;
}

.total-v {
  font-size: 40rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.empty-card {
  padding: 80rpx 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  font-size: 26rpx;
  color: #6b7080;
}
</style>
