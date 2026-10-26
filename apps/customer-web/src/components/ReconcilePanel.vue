<template>
  <div class="reconcile-page">
    <div class="page-title">
      <div>
        <div class="eyebrow">ACCOUNTS</div>
        <h1>应收应付<span class="title-dot"></span></h1>
        <p>按往来单位汇总开单、退货与已收付，余额一目了然；登记收付款后余额实时刷新。</p>
      </div>
      <button class="button secondary" @click="load">刷新</button>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="error=''">关闭</button></div>

    <section v-if="data" class="metrics">
      <article>
        <div class="metric-label">应收合计</div>
        <strong>{{ money(data.receivables.total) }}</strong>
        <div class="metric-bottom">{{ data.receivables.items.length }} 个客户有余额</div>
      </article>
      <article>
        <div class="metric-label">应付合计</div>
        <strong>{{ money(data.payables.total) }}</strong>
        <div class="metric-bottom">{{ data.payables.items.length }} 个供应商有余额</div>
      </article>
      <article>
        <div class="metric-label">净头寸</div>
        <strong>{{ money(data.receivables.total - data.payables.total) }}</strong>
        <div class="metric-bottom">应收 − 应付</div>
      </article>
      <article>
        <div class="metric-label">更新时间</div>
        <strong class="time-strong">{{ when(data.updatedAt) }}</strong>
        <div class="metric-bottom">数据实时来自单据与收付款记录</div>
      </article>
    </section>

    <section class="data-panel">
      <div class="panel-nav">
        <div class="category-tabs">
          <button :class="{ active: tab === 'in' }" @click="tab = 'in'">客户应收 <span>{{ rows.length }}</span></button>
          <button :class="{ active: tab === 'out' }" @click="tab = 'out'">供应商应付 <span>{{ rows.length }}</span></button>
        </div>
      </div>

      <div v-if="!rows.length" class="empty">
        <h3>没有未结清的{{ tab === 'in' ? '客户' : '供应商' }}</h3>
        <p>{{ tab === 'in' ? '所有销售单都已收款，或还没有销售记录。' : '所有采购单都已付款，或还没有采购记录。' }}</p>
      </div>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr><th>{{ tab === 'in' ? '客户' : '供应商' }}</th><th>已开单</th><th>退货</th><th>已{{ tab === 'in' ? '收' : '付' }}</th><th>余额</th><th class="right">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.partner">
              <td><b class="who">{{ row.partner }}</b></td>
              <td class="num">{{ money(row.billed) }}</td>
              <td class="num muted">{{ row.returned ? money(row.returned) : '—' }}</td>
              <td class="num">{{ row.settled ? money(row.settled) : '—' }}</td>
              <td class="num balance" :class="{ negative: row.balance < 0 }">
                {{ money(row.balance) }}
                <span v-if="row.balance < 0" class="tag-odd">{{ tab === 'in' ? '多退' : '多付' }}</span>
              </td>
              <td class="right">
                <button class="button secondary small" @click="openForm(row)">登记{{ tab === 'in' ? '收款' : '付款' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="recent.length" class="data-panel history">
      <div class="panel-title"><h2>最近收付款</h2><span>最新 {{ recent.length }} 条</span></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>时间</th><th>方向</th><th>往来单位</th><th>方式</th><th>金额</th><th>备注</th><th>经办</th></tr></thead>
          <tbody>
            <tr v-for="p in recent" :key="p.id">
              <td class="muted">{{ when(p.createdAt) }}</td>
              <td><span class="status" :class="p.direction === 'in' ? '' : 'low'">{{ p.direction === 'in' ? '收款' : '付款' }}</span></td>
              <td>{{ p.partner }}</td>
              <td class="muted">{{ methodLabel(p.method) }}</td>
              <td class="num">{{ money(p.amount) }}</td>
              <td class="muted">{{ p.note || '—' }}</td>
              <td class="muted">{{ p.createdBy }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog ref="dialog" class="drawer" @close="reset">
      <div class="drawer-inner">
        <header class="drawer-header">
          <div>
            <div class="eyebrow">{{ tab === 'in' ? 'RECEIPT' : 'PAYMENT' }}</div>
            <h2>登记{{ tab === 'in' ? '收款' : '付款' }}</h2>
          </div>
          <button class="icon-button" aria-label="关闭" @click="dialog.close()">×</button>
        </header>

        <form @submit.prevent="submit">
          <div class="form-body">
            <p class="form-intro">
              {{ form.partner }} 当前{{ tab === 'in' ? '应收' : '应付' }}余额
              <b>{{ money(currentBalance) }}</b>，本次登记不能超过该金额。
            </p>

            <label>
              金额（元）
              <input v-model.number="form.amount" type="number" min="0.01" step="0.01" required />
            </label>

            <label>
              方式
              <select v-model="form.method">
                <option value="cash">现金</option>
                <option value="wechat">微信</option>
                <option value="alipay">支付宝</option>
                <option value="bank">银行转账</option>
                <option value="other">其他</option>
              </select>
            </label>

            <label>
              备注
              <input v-model="form.note" maxlength="200" placeholder="选填，例如：首付款" />
            </label>

            <div v-if="formError" class="form-error">{{ formError }}</div>
          </div>

          <footer class="drawer-footer">
            <button type="button" class="button secondary" @click="dialog.close()">取消</button>
            <button type="submit" class="button primary" :disabled="busy">{{ busy ? '提交中…' : '确认登记' }}</button>
          </footer>
        </form>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  notify: { type: Function, default: () => {} },
});

const data = ref(null);
const recent = ref([]);
const tab = ref('in');
const error = ref('');
const formError = ref('');
const busy = ref(false);
const dialog = ref(null);
const form = reactive({ partner: '', amount: 0, method: 'bank', note: '' });
const currentBalance = ref(0);

const rows = computed(() => {
  if (!data.value) return [];
  return tab.value === 'in' ? data.value.receivables.items : data.value.payables.items;
});

function money(cents) {
  const v = Number(cents || 0) / 100;
  return (v < 0 ? '-¥' : '¥') + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const METHOD_LABEL = { cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行转账', other: '其他' };
function methodLabel(method) {
  return METHOD_LABEL[method] || method;
}

async function load() {
  error.value = '';
  try {
    const [reconcile, payments] = await Promise.all([
      props.api('reconcile', null, 'GET'),
      props.api('payments?page=1&size=8', null, 'GET'),
    ]);
    data.value = reconcile;
    recent.value = payments.items || [];
  } catch (e) {
    error.value = e.message || '加载失败';
  }
}

function openForm(row) {
  form.partner = row.partner;
  form.amount = Math.round((row.balance / 100) * 100) / 100;
  form.method = 'bank';
  form.note = '';
  formError.value = '';
  currentBalance.value = row.balance;
  dialog.value?.showModal();
}

function reset() {
  form.partner = '';
  form.amount = 0;
  form.note = '';
  formError.value = '';
}

async function submit() {
  formError.value = '';
  const amountCents = Math.round(Number(form.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    formError.value = '金额必须大于 0';
    return;
  }
  busy.value = true;
  try {
    await props.api('payments', {
      direction: tab.value,
      partner: form.partner,
      amount: amountCents,
      method: form.method,
      note: form.note.trim(),
    });
    props.notify?.(`已登记${tab.value === 'in' ? '收款' : '付款'} ${money(amountCents)}`);
    dialog.value?.close();
    await load();
  } catch (e) {
    formError.value = e.message || '登记失败';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.metrics {
  margin-bottom: 18px;
}

.time-strong {
  font-size: 20px !important;
}

.data-panel {
  padding: 0 0 6px;
  margin-bottom: 18px;
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

.who {
  font-size: 12px;
  font-weight: 500;
  color: #e0e4ed;
}

.num {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.balance {
  color: #cfd7ea;
  font-weight: 500;
}

.balance.negative {
  color: #e5b98a;
}

.tag-odd {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  color: #e5b98a;
  background: rgba(255, 180, 84, 0.12);
}

.small {
  height: 28px;
  font-size: 10px;
  padding: 0 10px;
}

.history .panel-title {
  padding: 16px 20px 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.history .panel-title h2 {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
}

.history .panel-title span {
  font-size: 10px;
  color: var(--muted);
}

.status.low {
  background: #332c21;
  border: 1px solid #4b3d29;
  color: #d3b17c;
}
</style>
