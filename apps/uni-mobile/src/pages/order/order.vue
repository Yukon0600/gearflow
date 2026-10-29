<template>
  <view class="page order-page">
    <!-- 类型选择：入库类两个 + 出库类三个 -->
    <view class="type-groups">
      <view class="type-group">
        <text class="group-label">入库</text>
        <view class="group-chips">
          <view
            v-for="t in inboundTypes"
            :key="t.key"
            class="chip"
            :class="{ active: type === t.key, inbound: type === t.key }"
            @click="type = t.key"
          >{{ t.label }}</view>
        </view>
      </view>
      <view class="type-group">
        <text class="group-label">出库</text>
        <view class="group-chips">
          <view
            v-for="t in outboundTypes"
            :key="t.key"
            class="chip"
            :class="{ active: type === t.key, outbound: type === t.key }"
            @click="type = t.key"
          >{{ t.label }}</view>
        </view>
      </view>
    </view>

    <view class="card head">
      <view class="head-row">
        <text class="head-label">{{ partnerLabel }}</text>
        <input v-model="partner" class="head-input" :placeholder="type === 'scrap' ? '默认内部损耗' : '选填'" placeholder-class="ph" maxlength="120" />
      </view>
      <view class="head-row last">
        <text class="head-label">备注</text>
        <input v-model="note" class="head-input" placeholder="选填" placeholder-class="ph" maxlength="200" />
      </view>
    </view>

    <view class="section-head">
      <text class="section-title">商品明细</text>
      <text class="add-btn" @click="openPicker">＋ 添加商品</text>
    </view>

    <view v-if="!lines.length" class="card empty-card">
      <text class="empty-text">还没有商品</text>
      <text class="empty-hint">点「添加商品」从库存里挑，支持一次开多行</text>
    </view>

    <view v-else class="lines">
      <view v-for="(line, index) in lines" :key="line.key" class="card line">
        <view class="line-top">
          <view class="line-main">
            <text class="line-name">{{ line.name }}</text>
            <text class="line-meta">{{ line.sku }} · 库存 {{ line.stock }}</text>
          </view>
          <text class="line-remove" @click="removeLine(index)">删除</text>
        </view>

        <view class="line-bottom">
          <view class="stepper">
            <view class="step" @click="dec(index)">－</view>
            <input class="step-input" type="number" :value="String(line.quantity)" @input="onQty(index, $event)" />
            <view class="step" @click="inc(index)">＋</view>
          </view>

          <view class="price-box">
            <text class="price-unit">¥</text>
            <input class="price-input" type="digit" :value="line.price" @input="onPrice(index, $event)" />
            <text class="price-each">/件</text>
          </view>

          <text class="line-total">¥{{ lineTotal(line) }}</text>
        </view>

        <view v-if="!isInbound && line.quantity > line.stock" class="line-warn">超出可用库存 {{ line.stock }} 件</view>
      </view>
    </view>

    <view v-if="error" class="error">{{ error }}</view>

    <view class="summary card">
      <view class="summary-row">
        <text class="summary-k">共 {{ lines.length }} 种商品</text>
        <text class="summary-v">合计 <text class="summary-amount">¥{{ totalText }}</text></text>
      </view>
    </view>

    <view class="btn-row">
      <button
        v-if="canDraft"
        class="btn draft"
        :disabled="busy || !lines.length"
        @click="saveAsDraft"
      >{{ draftBusy ? '保存中…' : (draftId ? '更新草稿' : '存草稿') }}</button>
      <button class="btn submit flex" :disabled="busy || !lines.length" @click="submit">
        {{ busy ? '提交中…' : `确认${typeConfig.label}` }}
      </button>
    </view>

    <view v-if="draftId" class="draft-tip">正在编辑草稿，提交开单后草稿仍会保留供核对</view>

    <view v-if="picker" class="picker-mask" @click="picker = false">
      <view class="picker" @click.stop>
        <view class="picker-head">
          <text class="picker-title">选择商品</text>
          <text class="picker-close" @click="picker = false">关闭</text>
        </view>
        <view class="search">
          <text class="search-icon">⌕</text>
          <input v-model="keyword" placeholder="搜索名称 / SKU / 品牌" placeholder-class="ph" />
        </view>
        <scroll-view scroll-y class="picker-list">
          <view v-for="p in pickerList" :key="p.id" class="picker-item" @click="addProduct(p)">
            <view class="picker-main">
              <text class="picker-name">{{ p.name }}</text>
              <text class="picker-meta">{{ p.sku }} · 库存 {{ p.stock }}</text>
            </view>
            <text class="picker-add">{{ selectedIds.has(p.id) ? '已添加' : '＋' }}</text>
          </view>
          <view v-if="!pickerList.length" class="empty">没有匹配的商品</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, yuan } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

/** 五种单据类型：与服务端 ORDER_TYPES / INBOUND_TYPES 对应 */
const TYPE_CONFIG = {
  purchase: { label: '采购入库', partner: '供应商', inbound: true },
  sale: { label: '销售出库', partner: '客户', inbound: false },
  return_in: { label: '销售退货', partner: '客户', inbound: true },
  return_out: { label: '采购退货', partner: '供应商', inbound: false },
  scrap: { label: '报损', partner: '损耗', inbound: false },
};
const inboundTypes = [
  { key: 'purchase', label: TYPE_CONFIG.purchase.label },
  { key: 'return_in', label: TYPE_CONFIG.return_in.label },
];
const outboundTypes = [
  { key: 'sale', label: TYPE_CONFIG.sale.label },
  { key: 'return_out', label: TYPE_CONFIG.return_out.label },
  { key: 'scrap', label: TYPE_CONFIG.scrap.label },
];

const type = ref('purchase');
const partner = ref('');
const note = ref('');
const lines = ref([]);
const busy = ref(false);
const error = ref('');
const picker = ref(false);
const keyword = ref('');
const products = ref([]);
const draftId = ref('');
const draftBusy = ref(false);

const canDraft = computed(() => type.value === 'purchase' || type.value === 'sale');

const typeConfig = computed(() => TYPE_CONFIG[type.value] || TYPE_CONFIG.purchase);
const isInbound = computed(() => typeConfig.value.inbound);
const partnerLabel = computed(() => typeConfig.value.partner);

const selectedIds = computed(() => new Set(lines.value.map((l) => l.productId)));

const pickerList = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return products.value;
  return products.value.filter(
    (p) => p.name.toLowerCase().includes(k) || p.sku.toLowerCase().includes(k) || String(p.brand || '').toLowerCase().includes(k),
  );
});

const totalText = computed(() =>
  lines.value
    .reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0)
    .toFixed(2),
);

function lineTotal(line) {
  return ((Number(line.quantity) || 0) * (Number(line.price) || 0)).toFixed(2);
}

function openPicker() {
  keyword.value = '';
  picker.value = true;
}

function addProduct(p) {
  if (selectedIds.value.has(p.id)) {
    uni.showToast({ title: '已经在清单里了', icon: 'none' });
    return;
  }
  lines.value.push({
    key: `${p.id}-${Date.now()}`,
    productId: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    quantity: 1,
    price: yuan(p.price),
  });
  picker.value = false;
}

function removeLine(index) {
  lines.value.splice(index, 1);
}

function inc(index) {
  lines.value[index].quantity = (Number(lines.value[index].quantity) || 0) + 1;
}

function dec(index) {
  const next = (Number(lines.value[index].quantity) || 0) - 1;
  lines.value[index].quantity = next < 1 ? 1 : next;
}

function onQty(index, event) {
  const value = Number(event.detail.value);
  lines.value[index].quantity = Number.isFinite(value) && value > 0 ? value : 1;
}

function onPrice(index, event) {
  lines.value[index].price = event.detail.value;
}

function pushLine(p) {
  // 入参 price/unitPrice 均为分，统一转成元显示
  const fen = p.unitPrice !== undefined ? p.unitPrice : p.price;
  lines.value.push({
    key: `${p.id}-${Date.now()}-${lines.value.length}`,
    productId: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    quantity: Number(p.quantity) || 1,
    price: yuan(fen),
  });
}

function applyDraft(id, payload) {
  draftId.value = id || '';
  if (payload.type && TYPE_CONFIG[payload.type]) type.value = payload.type;
  partner.value = payload.partner || '';
  note.value = payload.note || '';
  lines.value = [];
  for (const l of payload.lines || []) {
    const hit = products.value.find((p) => String(p.id) === String(l.productId));
    if (hit) {
      pushLine({ ...hit, quantity: Number(l.quantity) || 1, price: yuan(l.unitPrice) });
    }
  }
}

onLoad((query) => {
  // 兼容旧参数 in/out（扫码、详情页跳转），也支持直接传类型 key
  const t = query && query.type;
  if (t && TYPE_CONFIG[t]) {
    type.value = t;
  } else if (t === 'out') {
    type.value = 'sale';
  } else {
    type.value = 'purchase';
  }
  products.value = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');

  if (query && query.productId) {
    const hit = products.value.find((p) => String(p.id) === String(query.productId));
    if (hit) {
      pushLine(hit);
    }
  }

  // 低库存一键补货：工作台预警区预填（数量=建议补货数，零售价预填待改）
  if (query && query.prefill === 'restock') {
    try {
      const restock = JSON.parse(uni.getStorageSync('gf_restock_prefill') || '[]');
      type.value = 'purchase';
      for (const r of restock) {
        const hit = products.value.find((p) => String(p.id) === String(r.productId));
        if (hit) {
          pushLine({ ...hit, quantity: Number(r.quantity) || 1 });
        }
      }
      if (lines.value.length) {
        setTimeout(() => uni.showToast({ title: '价格按零售价预填，请核对进价', icon: 'none', duration: 2200 }), 400);
      }
    } catch (e) {
      // 预填数据损坏时忽略，正常开单
    }
  }

  // 从草稿箱载入
  if (query && query.draft) {
    try {
      const saved = JSON.parse(uni.getStorageSync('gf_draft_prefill') || 'null');
      if (saved && saved.id === query.draft) {
        applyDraft(saved.id, saved.payload);
      }
    } catch (e) {
      // 草稿缓存缺失时忽略
    }
  }
});

function payload() {
  return {
    type: type.value,
    // 报损不填时服务端默认写「内部损耗」；其余类型用类型对应的缺省称谓
    partner:
      type.value === 'scrap'
        ? partner.value.trim()
        : partner.value.trim() || partnerLabel.value,
    note: note.value.trim(),
    lines: lines.value.map((l) => ({
      productId: l.productId,
      quantity: Number(l.quantity),
      unitPrice: Math.round(Number(l.price) * 100),
    })),
  };
}

async function saveAsDraft() {
  error.value = '';
  if (!lines.value.length) return;
  for (const line of lines.value) {
    const qty = Number(line.quantity);
    if (!qty || qty < 1) {
      error.value = `${line.name} 的数量至少为 1`;
      return;
    }
  }
  draftBusy.value = true;
  try {
    if (draftId.value) {
      await api.updateDraft(draftId.value, payload());
      uni.showToast({ title: '草稿已更新', icon: 'success' });
    } else {
      const res = await api.saveDraft(payload());
      draftId.value = res.id;
      uni.showToast({ title: '已存草稿', icon: 'success' });
    }
  } catch (e) {
    error.value = e.message || '存草稿失败';
  } finally {
    draftBusy.value = false;
  }
}

async function submit() {
  error.value = '';
  if (!lines.value.length) {
    error.value = '请至少添加一个商品';
    return;
  }
  for (const line of lines.value) {
    const qty = Number(line.quantity);
    const unit = Math.round(Number(line.price) * 100);
    if (!qty || qty < 1) {
      error.value = `${line.name} 的数量至少为 1`;
      return;
    }
    if (!Number.isFinite(unit) || unit < 0) {
      error.value = `${line.name} 的单价不正确`;
      return;
    }
    if (!isInbound.value && qty > line.stock) {
      error.value = `${line.name} 库存不足，当前可用 ${line.stock} 件`;
      return;
    }
  }

  busy.value = true;
  try {
    const res = await api.createOrder(payload());
    // 店员提交的单据进入待审批，店长/管理员提交直接生效
    if (res && res.status === 'pending') {
      uni.showToast({ title: '已提交，待店长审批', icon: 'none', duration: 2000 });
    } else {
      uni.showToast({ title: `${typeConfig.value.label}成功`, icon: 'success' });
    }
    setTimeout(() => {
      uni.switchTab({ url: '/pages/stock/stock' });
    }, 900);
  } catch (e) {
    error.value = e.message || '提交失败';
  } finally {
    busy.value = false;
  }
}
</script>

<style>
.order-page {
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
}

/* 类型分组选择 */
.type-groups {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 18rpx 22rpx;
  margin-bottom: 20rpx;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18rpx;
}

.type-group {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.group-label {
  width: 64rpx;
  flex-shrink: 0;
  font-size: 22rpx;
  color: #6b7080;
}

.group-chips {
  flex: 1;
  display: flex;
  gap: 12rpx;
}

.chip {
  flex: 1;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  font-size: 23rpx;
  color: #8b90a0;
  background: #1b1e26;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.chip.active.inbound {
  color: #0d281e;
  background: linear-gradient(135deg, #7ce0b8, #4ad0f0);
  border-color: transparent;
  font-weight: 600;
}

.chip.active.outbound {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  border-color: transparent;
  font-weight: 600;
}

.head {
  padding: 0 28rpx;
}

.head-row {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.head-row.last {
  border-bottom: none;
}

.head-label {
  width: 120rpx;
  font-size: 26rpx;
  color: #b6bbca;
}

.head-input {
  flex: 1;
  text-align: right;
  font-size: 27rpx;
  color: #e8eaf0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 32rpx 6rpx 16rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #eef0f6;
}

.add-btn {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #a99bff;
  background: rgba(124, 108, 240, 0.16);
}

.lines {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.line {
  padding: 24rpx 26rpx;
}

.line-top {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.line-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.line-name {
  font-size: 27rpx;
  color: #eef0f6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.line-remove {
  font-size: 22rpx;
  color: #ff8a8a;
}

.line-bottom {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.step {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  font-size: 28rpx;
  color: #e8eaf0;
  background: #22252e;
}

.step-input {
  width: 96rpx;
  height: 56rpx;
  text-align: center;
  font-size: 26rpx;
  color: #f2f4f8;
  background: #12141a;
  border-radius: 14rpx;
}

.price-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 10rpx 16rpx;
  background: #12141a;
  border-radius: 14rpx;
}

.price-unit,
.price-each {
  font-size: 20rpx;
  color: #6b7080;
}

.price-input {
  flex: 1;
  font-size: 26rpx;
  color: #e8eaf0;
  text-align: right;
}

.line-total {
  font-size: 28rpx;
  font-weight: 600;
  color: #f2f4f8;
  font-variant-numeric: tabular-nums;
}

.line-warn {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #ffb454;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 50rpx 0;
}

.empty-text {
  font-size: 26rpx;
  color: #b6bbca;
}

.empty-hint {
  font-size: 20rpx;
  color: #6b7080;
}

.error {
  margin: 20rpx 8rpx 0;
  font-size: 24rpx;
  color: #ff7a7a;
}

.summary {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
}

.summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.summary-k {
  font-size: 24rpx;
  color: #8b90a0;
}

.summary-v {
  font-size: 24rpx;
  color: #b6bbca;
}

.summary-amount {
  margin-left: 8rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.submit {
  margin-top: 24rpx;
}

.btn-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.btn-row .submit {
  margin-top: 0;
}

.draft {
  flex-shrink: 0;
  width: 220rpx;
  margin: 0;
  color: #a99bff;
  background: rgba(124, 108, 240, 0.14);
  border: 1px solid rgba(124, 108, 240, 0.3);
}

.flex {
  flex: 1;
}

.draft-tip {
  margin-top: 14rpx;
  text-align: center;
  font-size: 20rpx;
  color: #6b7080;
}

.picker-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(5, 6, 12, 0.6);
  display: flex;
  align-items: flex-end;
}

.picker {
  width: 100%;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: #14161d;
  border-radius: 28rpx 28rpx 0 0;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.picker-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #f2f4f8;
}

.picker-close {
  font-size: 24rpx;
  color: #8b90a0;
}

.search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 16rpx;
  background: #12141a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18rpx;
}

.search-icon {
  font-size: 28rpx;
  color: #6b7080;
}

.search input {
  flex: 1;
  font-size: 26rpx;
  color: #e8eaf0;
}

.picker-list {
  flex: 1;
  max-height: 56vh;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 12rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.picker-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.picker-name {
  font-size: 26rpx;
  color: #e8eaf0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-meta {
  font-size: 20rpx;
  color: #6b7080;
}

.picker-add {
  font-size: 26rpx;
  color: #a99bff;
}

.ph {
  color: #5b6070;
}

.empty {
  padding: 60rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #6b7080;
}
</style>
