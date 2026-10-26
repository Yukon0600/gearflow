<template>
  <div class="approval-page">
    <div class="page-title">
      <div>
        <div class="eyebrow">APPROVALS</div>
        <h1>单据审批<span class="title-dot"></span></h1>
        <p>店员提交的单据先进入待审批，通过后才扣减库存、计入报表；驳回会保留原因。</p>
      </div>
      <button class="button secondary" @click="load">刷新</button>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="error=''">关闭</button></div>

    <section v-if="pending.length" class="data-panel">
      <div class="panel-title"><h2>待审批 {{ pending.length }} 张</h2><span>来自店员的提交</span></div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>单号</th><th>类型</th><th>往来单位</th><th>商品明细</th><th>金额</th><th>提交人</th><th>时间</th><th class="right">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in pending" :key="o.id">
              <td class="mono">{{ o.number }}</td>
              <td><span class="status">{{ typeLabel(o.type) }}</span></td>
              <td>{{ o.partner }}</td>
              <td><div v-for="l in o.lines" :key="l.id" class="order-line">{{ l.name }} <span>× {{ l.quantity }}</span></div></td>
              <td class="price">{{ money(o.total) }}</td>
              <td class="muted">{{ o.createdBy || '—' }}</td>
              <td class="muted">{{ date(o.createdAt) }}</td>
              <td class="right">
                <div class="row-actions">
                  <button class="approve" :disabled="busy" @click="approve(o)">通过</button>
                  <button :disabled="busy" @click="reject(o)">驳回</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-else class="empty">
      <h3>没有待审批的单据</h3>
      <p>店员开单后会出现在这里，店长与管理员提交的单据直接生效。</p>
    </div>

    <section v-if="recent.length" class="data-panel history">
      <div class="panel-title"><h2>最近审批记录</h2><span>最新 {{ recent.length }} 条</span></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>单号</th><th>结果</th><th>处理人</th><th>时间</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="o in recent" :key="o.id">
              <td class="mono">{{ o.number }}</td>
              <td><span class="status" :class="o.status === 'rejected' ? 'out' : 'normal'">{{ o.status === 'rejected' ? '已驳回' : '已通过' }}</span></td>
              <td class="muted">{{ o.approvedBy || '—' }}</td>
              <td class="muted">{{ date(o.approvedAt) }}</td>
              <td class="muted">{{ o.rejectReason || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  notify: { type: Function, default: () => {} },
});

const TYPE_LABEL = { purchase: '采购入库', sale: '销售出库', return_in: '销售退货', return_out: '采购退货', scrap: '报损' };

const pending = ref([]);
const recent = ref([]);
const error = ref('');
const busy = ref(false);

function typeLabel(type) {
  return TYPE_LABEL[type] || type;
}

function money(cents) {
  return '¥' + (Number(cents || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function load() {
  error.value = '';
  try {
    const [pendingData, posted, rejected] = await Promise.all([
      props.api('orders?status=pending&size=50', null, 'GET'),
      props.api('orders?status=posted&size=5', null, 'GET'),
      props.api('orders?status=rejected&size=5', null, 'GET'),
    ]);
    pending.value = pendingData.items || [];
    recent.value = [...(posted.items || []), ...(rejected.items || [])]
      .filter((o) => o.approvedAt)
      .sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))
      .slice(0, 6);
  } catch (e) {
    error.value = e.message || '加载失败';
  }
}

async function approve(order) {
  busy.value = true;
  try {
    await props.api(`orders/${order.id}/approve`, {}, 'POST');
    props.notify?.(`${order.number} 已通过，库存已更新`);
    await load();
  } catch (e) {
    error.value = e.message || '审批失败';
  } finally {
    busy.value = false;
  }
}

async function reject(order) {
  const reason = window.prompt(`驳回 ${order.number}，请填写原因`, '库存不足，请核实后重提');
  if (reason === null) return;
  busy.value = true;
  try {
    await props.api(`orders/${order.id}/reject`, { reason }, 'POST');
    props.notify?.(`${order.number} 已驳回`);
    await load();
  } catch (e) {
    error.value = e.message || '驳回失败';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.data-panel {
  padding: 0 0 6px;
  margin-bottom: 18px;
}

.panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 16px 20px 0;
}

.panel-title h2 {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
}

.panel-title span {
  font-size: 10px;
  color: var(--muted);
}

.row-actions {
  display: inline-flex;
  gap: 6px;
}

.row-actions button {
  padding: 6px 12px;
  font-size: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #333b4c;
  color: #9daac3;
}

.row-actions button.approve {
  border-color: #3f6b58;
  color: #9fdcbf;
  background: rgba(124, 224, 184, 0.08);
}

.row-actions button:hover:not(:disabled) {
  background: #303c58;
  color: #d7e3ff;
}

.status.out {
  background: #33232a;
  border: 1px solid #52313d;
  color: #d598a8;
}
</style>
