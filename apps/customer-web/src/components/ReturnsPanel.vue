<template>
  <div class="returns-page">
    <div class="page-title">
      <div>
        <div class="eyebrow">RETURNS & SCRAP</div>
        <h1>退货与报损<span class="title-dot"></span></h1>
        <p>客户退货、退回供应商、库存报损——三类逆向单据，库存与报表同步冲减。</p>
      </div>
      <button class="button primary" @click="openForm">新建单据</button>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="clearError">关闭</button></div>

    <section class="data-panel">
      <div class="panel-nav">
        <div class="category-tabs">
          <button
            v-for="t in tabs"
            :key="t.value"
            :class="{ active: filter === t.value }"
            @click="filter = t.value"
          >{{ t.label }}<span>{{ countOf(t.value) }}</span></button>
        </div>
      </div>

      <div v-if="!rows.length" class="empty">
        <h3>还没有{{ filter === 'all' ? '' : tabLabel(filter) }}记录</h3>
        <p>点右上角「新建单据」，选择退货或报损类型即可。</p>
      </div>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr><th>单号</th><th>类型</th><th>往来单位</th><th>商品明细</th><th>金额</th><th>时间</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in rows" :key="o.id">
              <td class="mono">{{ o.number }}</td>
              <td><span class="status" :class="tone(o.type)">{{ typeLabel(o.type) }}</span></td>
              <td>{{ o.partner }}</td>
              <td><div v-for="l in o.lines" :key="l.id" class="order-line">{{ l.name }} <span>× {{ l.quantity }}</span></div></td>
              <td class="price">{{ money(amountOf(o)) }}</td>
              <td class="muted">{{ date(o.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog ref="dialog" class="drawer" @close="reset">
      <div class="drawer-inner">
        <header class="drawer-header">
          <div>
            <div class="eyebrow">NEW DOCUMENT</div>
            <h2>新建逆向单据</h2>
          </div>
          <button class="icon-button" @click="dialog.close()" aria-label="关闭">×</button>
        </header>

        <form @submit.prevent="submit">
          <div class="form-body">
            <label>
              单据类型
              <select v-model="form.type">
                <option value="return_in">销售退货（客户退回，库存增加）</option>
                <option value="return_out">采购退货（退回供应商，库存减少）</option>
                <option value="scrap">库存报损（直接扣减，计入损耗）</option>
              </select>
            </label>

            <label v-if="form.type !== 'scrap'">
              {{ form.type === 'return_in' ? '客户' : '供应商' }}
              <input v-model="form.partner" :placeholder="form.type === 'return_in' ? '退货的客户' : '退回的供应商'" maxlength="120" />
            </label>
            <label v-else>
              损耗原因（选填）
              <input v-model="form.partner" placeholder="如：运输破损、演示损耗" maxlength="120" />
            </label>

            <label>
              商品
              <select v-model="form.productId">
                <option value="">请选择商品</option>
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}（库存 {{ p.stock }}）</option>
              </select>
            </label>

            <div class="form-grid">
              <label>
                数量
                <input v-model.number="form.quantity" type="number" min="1" />
              </label>
              <label>
                单价（元）
                <input v-model.number="form.price" type="number" min="0" step="0.01" :disabled="form.type === 'scrap'" />
              </label>
            </div>

            <p v-if="form.type === 'return_in'" class="hint">按退款金额冲减销售额与毛利，货回到仓库。</p>
            <p v-else-if="form.type === 'return_out'" class="hint">按退还金额冲减采购额，库存相应减少。</p>
            <p v-else class="hint">报损按商品成本计入损耗金额，单价不参与计算。</p>

            <p v-if="selected" class="stock-hint">
              当前库存：<b>{{ selected.stock }}</b> 件
              <span v-if="selected.stock < Number(form.quantity)" class="danger">— 数量超过库存</span>
            </p>

            <div v-if="formError" class="form-error">{{ formError }}</div>
          </div>

          <footer class="drawer-footer">
            <button type="button" class="button secondary" @click="dialog.close()">取消</button>
            <button type="submit" class="button primary" :disabled="busy">{{ busy ? '提交中…' : '确认提交' }}</button>
          </footer>
        </form>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  data: { type: Object, default: () => ({ orders: [], products: [] }) },
  notify: { type: Function, default: () => {} },
});
const emit = defineEmits(['refresh']);

const TYPES = ['return_in', 'return_out', 'scrap'];
const LABEL = { return_in: '销售退货', return_out: '采购退货', scrap: '报损' };

const tabs = [
  { value: 'all', label: '全部' },
  { value: 'return_in', label: '销售退货' },
  { value: 'return_out', label: '采购退货' },
  { value: 'scrap', label: '报损' },
];

const filter = ref('all');
const dialog = ref(null);
const busy = ref(false);
const error = ref('');
const formError = ref('');
const form = reactive({ type: 'return_in', partner: '', productId: '', quantity: 1, price: 0 });

const orders = computed(() => (props.data.orders || []).filter((o) => TYPES.includes(o.type)));
const products = computed(() => props.data.products || []);
const selected = computed(() => products.value.find((p) => p.id === form.productId) || null);

const rows = computed(() => (filter.value === 'all' ? orders.value : orders.value.filter((o) => o.type === filter.value)));

function countOf(value) {
  return value === 'all' ? orders.value.length : orders.value.filter((o) => o.type === value).length;
}

function tabLabel(value) {
  return LABEL[value] || value;
}

function typeLabel(type) {
  return LABEL[type] || type;
}

function tone(type) {
  if (type === 'scrap') return 'low';
  if (type === 'return_out') return 'out';
  return '';
}

// 报损没有交易金额，展示按成本计算的损失金额更有意义
function amountOf(o) {
  if (o.type !== 'scrap') return o.total;
  return (o.lines || []).reduce((s, l) => s + Number(l.unitCost || 0) * Number(l.quantity || 0), 0);
}

function money(cents) {
  return '¥' + (Number(cents || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clearError() {
  error.value = '';
}

function reset() {
  form.type = 'return_in';
  form.partner = '';
  form.productId = '';
  form.quantity = 1;
  form.price = 0;
  formError.value = '';
}

function openForm() {
  reset();
  dialog.value?.showModal();
}

async function submit() {
  formError.value = '';
  if (!form.productId) {
    formError.value = '请选择商品';
    return;
  }
  const qty = Number(form.quantity);
  if (!qty || qty < 1) {
    formError.value = '数量至少为 1';
    return;
  }
  if (form.type !== 'scrap' && !form.partner.trim()) {
    formError.value = form.type === 'return_in' ? '请填写退货客户' : '请填写供应商';
    return;
  }
  if (selected.value && form.type !== 'return_in' && selected.value.stock < qty) {
    formError.value = `库存不足，当前可用 ${selected.value.stock} 件`;
    return;
  }

  busy.value = true;
  try {
    await props.api('orders', {
      type: form.type,
      partner: form.partner.trim(),
      lines: [{
        productId: form.productId,
        quantity: qty,
        unitPrice: form.type === 'scrap' ? 0 : Math.round(Number(form.price) * 100),
      }],
    });
    props.notify?.(`${typeLabel(form.type)} 已提交，库存已更新`);
    dialog.value?.close();
    emit('refresh');
  } catch (e) {
    formError.value = e.message || '提交失败';
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.data-panel {
  padding: 0 0 8px;
}

.panel-nav {
  padding: 0 19px;
  border-bottom: 1px solid var(--border);
}

.category-tabs {
  display: flex;
  gap: 25px;
}

.category-tabs button {
  height: 53px;
  color: #8b92a2;
  font-size: 12px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
}

.category-tabs button.active {
  color: #cedcff;
}

.category-tabs button.active::after {
  position: absolute;
  content: '';
  height: 2px;
  background: #8da9ff;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 2px;
}

.category-tabs span {
  font-size: 9px;
  border-radius: 4px;
  padding: 2px 5px;
  background: #2c3449;
  color: #afc1f3;
}

.status.low {
  background: #332c21;
  border: 1px solid #4b3d29;
  color: #d3b17c;
}

.status.out {
  background: #33232a;
  border: 1px solid #52313d;
  color: #d598a8;
}

.hint {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin: 0;
}

.stock-hint {
  font-size: 11px;
  color: #a9b4c9;
  margin: 0;
}

.stock-hint b {
  color: #dfe6f5;
}

.danger {
  color: #efb0c0;
}
</style>
