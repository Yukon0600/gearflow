<template>
  <view class="page">
    <view class="switch">
      <view class="seg" :class="{ active: type === 'in' }" @click="type = 'in'">入库</view>
      <view class="seg" :class="{ active: type === 'out' }" @click="type = 'out'">出库</view>
    </view>

    <view v-if="!product" class="empty">商品不存在</view>

    <template v-else>
      <view class="card product">
        <view class="p-name">{{ product.name }}</view>
        <view class="p-meta">{{ product.sku }} · {{ product.brand }}</view>
        <view class="p-stock">
          当前库存 <text class="num" :class="{ low: product.low }">{{ product.stock }}</text> 件
        </view>
      </view>

      <view class="card form">
        <view class="field">
          <text class="label">数量</text>
          <view class="stepper">
            <view class="step" @click="dec">－</view>
            <input class="step-input" type="number" v-model="quantity" />
            <view class="step" @click="inc">＋</view>
          </view>
        </view>

        <view class="field">
          <text class="label">单价（元）</text>
          <input class="text-input" type="digit" v-model="price" />
        </view>

        <view class="field">
          <text class="label">{{ type === 'in' ? '供应商' : '客户' }}</text>
          <input class="text-input" v-model="partner" :placeholder="type === 'in' ? '选填' : '选填'" placeholder-class="ph" />
        </view>

        <view class="field last">
          <text class="label">备注</text>
          <input class="text-input" v-model="note" placeholder="选填" placeholder-class="ph" />
        </view>
      </view>

      <view class="total">
        <text class="total-k">合计</text>
        <text class="total-v">¥{{ totalText }}</text>
      </view>

      <view v-if="error" class="error">{{ error }}</view>

      <button class="btn submit" :disabled="busy" @click="submit">
        {{ busy ? '提交中…' : (type === 'in' ? '确认入库' : '确认出库') }}
      </button>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, yuan } from '../../utils/api.js';
import { STORAGE_PRODUCTS } from '../../config.js';

const product = ref(null);
const type = ref('in');
const quantity = ref(1);
const price = ref('0.00');
const partner = ref('');
const note = ref('');
const busy = ref(false);
const error = ref('');

const totalText = computed(() => {
  const q = Number(quantity.value) || 0;
  const p = Number(price.value) || 0;
  return (q * p).toFixed(2);
});

onLoad(async (query) => {
  type.value = query && query.type === 'out' ? 'out' : 'in';
  const id = query && query.productId;
  const cached = JSON.parse(uni.getStorageSync(STORAGE_PRODUCTS) || '[]');
  product.value = cached.find((p) => String(p.id) === String(id)) || null;
  if (product.value) {
    price.value = yuan(product.value.price);
  }
});

function inc() {
  quantity.value = (Number(quantity.value) || 0) + 1;
}

function dec() {
  const q = (Number(quantity.value) || 0) - 1;
  quantity.value = q < 1 ? 1 : q;
}

async function submit() {
  error.value = '';
  const qty = Number(quantity.value);
  const unit = Math.round(Number(price.value) * 100);
  if (!qty || qty < 1) {
    error.value = '数量至少为 1';
    return;
  }
  if (!Number.isFinite(unit) || unit < 0) {
    error.value = '单价格式不正确';
    return;
  }
  busy.value = true;
  try {
    await api.createOrder({
      type: type.value === 'in' ? 'purchase' : 'sale',
      partner: partner.value.trim() || (type.value === 'in' ? '供应商' : '客户'),
      note: note.value.trim(),
      lines: [{ productId: product.value.id, quantity: qty, unitPrice: unit }],
    });
    uni.showToast({ title: type.value === 'in' ? '入库成功' : '出库成功', icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/stock/stock' });
    }, 800);
  } catch (e) {
    error.value = e.message || '提交失败';
  } finally {
    busy.value = false;
  }
}
</script>

<style>
.switch {
  display: flex;
  padding: 6rpx;
  margin-bottom: 24rpx;
  background: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18rpx;
}

.seg {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  font-size: 28rpx;
  color: #8b90a0;
}

.seg.active {
  color: #fff;
  background: linear-gradient(135deg, #7c6cf0, #4aa8f0);
  font-weight: 600;
}

.product {
  padding: 30rpx;
}

.p-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #f2f4f8;
}

.p-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #7d8394;
}

.p-stock {
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #8b90a0;
}

.p-stock .num {
  font-size: 32rpx;
  font-weight: 700;
  color: #7ce0b8;
}

.p-stock .num.low {
  color: #ffb454;
}

.form {
  margin-top: 20rpx;
  padding: 0 30rpx;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.field.last {
  border-bottom: none;
}

.label {
  font-size: 26rpx;
  color: #b6bbca;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.step {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 32rpx;
  color: #e8eaf0;
  background: #22252e;
}

.step-input {
  width: 120rpx;
  height: 64rpx;
  text-align: center;
  font-size: 30rpx;
  color: #f2f4f8;
  background: #12141a;
  border-radius: 16rpx;
}

.text-input {
  flex: 1;
  margin-left: 24rpx;
  text-align: right;
  font-size: 28rpx;
  color: #e8eaf0;
}

.ph {
  color: #5b6070;
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 30rpx 8rpx 10rpx;
}

.total-k {
  font-size: 24rpx;
  color: #8b90a0;
}

.total-v {
  font-size: 44rpx;
  font-weight: 700;
  color: #f2f4f8;
}

.error {
  margin: 8rpx 8rpx;
  font-size: 24rpx;
  color: #ff7a7a;
}

.submit {
  margin-top: 20rpx;
}
</style>
