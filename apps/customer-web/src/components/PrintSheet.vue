<template>
  <div class="print-mask">
    <div class="print-actions">
      <span class="print-hint">打印预览 · A4</span>
      <div>
        <button class="button secondary" @click="$emit('close')">关闭</button>
        <button class="button primary" @click="doPrint">打印</button>
      </div>
    </div>

    <div class="print-sheet" ref="sheet">
      <header class="doc-head">
        <div class="doc-brand">
          <div class="doc-logo">G</div>
          <div>
            <b>GEARFLOW</b>
            <small>电脑配件进销存</small>
          </div>
        </div>
        <div class="doc-title">
          <h1>{{ typeLabel }}</h1>
          <span>{{ order.number }}</span>
        </div>
      </header>

      <section class="doc-meta">
        <div><label>往来单位</label><span>{{ order.partner }}</span></div>
        <div><label>单据日期</label><span>{{ date(order.createdAt) }}</span></div>
        <div><label>制单人</label><span>{{ order.createdBy || '—' }}</span></div>
        <div><label>状态</label><span>{{ statusLabel }}</span></div>
      </section>

      <table class="doc-table">
        <thead>
          <tr><th class="idx">#</th><th>商品名称</th><th>规格 / SKU</th><th class="num">数量</th><th class="num">单价</th><th class="num">金额</th></tr>
        </thead>
        <tbody>
          <tr v-for="(line, i) in order.lines" :key="line.id">
            <td class="idx">{{ i + 1 }}</td>
            <td>{{ line.name }}</td>
            <td class="mono">{{ line.sku }}</td>
            <td class="num">{{ line.quantity }}</td>
            <td class="num">{{ money(line.unitPrice) }}</td>
            <td class="num">{{ money(line.quantity * line.unitPrice) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="total-label">合计金额（含税）</td>
            <td class="num total-value">{{ money(order.total) }}</td>
          </tr>
        </tfoot>
      </table>

      <p class="capital">人民币大写：{{ capital }}</p>

      <section v-if="order.note" class="doc-note">
        <label>备注</label>
        <span>{{ order.note }}</span>
      </section>

      <footer class="doc-sign">
        <div>制单人：______________</div>
        <div>审核人：______________</div>
        <div>签收人：______________</div>
      </footer>

      <p class="doc-foot">本单据由 GearFlow 进销存系统生成 · {{ printedAt }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  order: { type: Object, required: true },
});
defineEmits(['close']);

const TYPE_LABEL = { purchase: '采购入库单', sale: '销售出库单', return_in: '销售退货单', return_out: '采购退货单', scrap: '报损单' };
const STATUS_LABEL = { posted: '已生效', pending: '待审批', rejected: '已驳回' };

const typeLabel = computed(() => TYPE_LABEL[props.order.type] || '出入库单');
const statusLabel = computed(() => STATUS_LABEL[props.order.status] || '已生效');
const printedAt = computed(() => new Date().toLocaleString('zh-CN', { hour12: false }));

function money(cents) {
  return '¥' + (Number(cents || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 人民币金额转大写 */
const capital = computed(() => toChinese(props.order.total));

function toChinese(cents) {
  const num = Math.round(Number(cents || 0));
  if (num === 0) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];
  const integer = Math.floor(num / 100);
  const jiao = Math.floor((num % 100) / 10);
  const fen = num % 10;

  let result = '';
  let groupIndex = 0;
  let n = integer;
  while (n > 0) {
    const group = n % 10000;
    if (group !== 0) {
      let groupText = '';
      let g = group;
      let unitIndex = 0;
      let zero = false;
      while (g > 0) {
        const digit = g % 10;
        if (digit === 0) {
          zero = true;
        } else {
          groupText = digits[digit] + units[unitIndex] + (zero ? '零' : '') + groupText;
          zero = false;
        }
        g = Math.floor(g / 10);
        unitIndex += 1;
      }
      result = groupText + bigUnits[groupIndex] + result;
    } else if (result && !result.startsWith('零')) {
      result = '零' + result;
    }
    n = Math.floor(n / 10000);
    groupIndex += 1;
  }

  result = result.replace(/零+/g, '零').replace(/零$/, '') || '零';
  let tail = '元';
  if (jiao === 0 && fen === 0) tail += '整';
  else {
    if (jiao > 0) tail += digits[jiao] + '角';
    else if (fen > 0) tail += '零';
    if (fen > 0) tail += digits[fen] + '分';
  }
  return result + tail;
}

function doPrint() {
  window.print();
}
</script>

<style>
.print-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(6, 7, 11, 0.72);
  backdrop-filter: blur(6px);
  overflow: auto;
  padding: 18px 18px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.print-actions {
  width: 100%;
  max-width: 800px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  color: #dfe4f2;
}

.print-hint {
  font-size: 11px;
  color: #9aa4bb;
}

.print-actions > div {
  display: flex;
  gap: 8px;
}

.print-sheet {
  width: 100%;
  max-width: 800px;
  background: #fff;
  color: #16181d;
  border-radius: 6px;
  padding: 44px 48px 32px;
  box-sizing: border-box;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  font-family: 'Noto Sans SC Variable', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.doc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 2px solid #16181d;
}

.doc-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #16181d;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
}

.doc-brand b {
  display: block;
  font-size: 15px;
  letter-spacing: 1px;
}

.doc-brand small {
  font-size: 10px;
  color: #6b7280;
}

.doc-title {
  text-align: right;
}

.doc-title h1 {
  font-size: 20px;
  margin: 0 0 4px;
  letter-spacing: 2px;
}

.doc-title span {
  font-size: 11px;
  color: #4b5563;
  font-family: ui-monospace, monospace;
}

.doc-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  padding: 18px 0;
  font-size: 12px;
}

.doc-meta label {
  display: inline-block;
  width: 72px;
  color: #6b7280;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.doc-table th,
.doc-table td {
  border: 1px solid #d1d5db;
  padding: 9px 10px;
  text-align: left;
}

.doc-table th {
  background: #f3f4f6;
  font-weight: 500;
  color: #374151;
}

.doc-table .idx {
  width: 36px;
  text-align: center;
  color: #6b7280;
}

.doc-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.doc-table .mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #4b5563;
}

.total-label {
  text-align: right;
  font-weight: 500;
}

.total-value {
  font-size: 14px;
  font-weight: 700;
}

.capital {
  margin: 12px 0 0;
  font-size: 12px;
  color: #374151;
}

.doc-note {
  margin-top: 14px;
  font-size: 12px;
  color: #374151;
}

.doc-note label {
  color: #6b7280;
  margin-right: 8px;
}

.doc-sign {
  display: flex;
  justify-content: space-between;
  margin-top: 44px;
  font-size: 12px;
  color: #374151;
}

.doc-foot {
  margin-top: 28px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
}

@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  body * {
    visibility: hidden;
  }

  .print-sheet,
  .print-sheet * {
    visibility: visible;
  }

  .print-sheet {
    position: absolute;
    inset: 0;
    max-width: none;
    width: 100%;
    box-shadow: none;
    border-radius: 0;
    padding: 0;
  }

  .print-actions,
  .print-mask {
    background: none;
    padding: 0;
    position: static;
  }
}
</style>
