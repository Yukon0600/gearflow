<template>
  <div class="reports">
    <div class="page-title">
      <div>
        <div class="eyebrow">BUSINESS INSIGHTS</div>
        <h1>经营报表<span class="title-dot"></span></h1>
        <p>按日汇总销售与采购，观察毛利、商品排行与品类结构，判断生意真实走向。</p>
      </div>
      <div class="range-switch">
        <button
          v-for="r in ranges"
          :key="r"
          class="button"
          :class="days === r ? 'primary' : 'secondary'"
          @click="setDays(r)"
        >{{ r }} 天</button>
      </div>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="load">重试</button></div>

    <section v-if="report" class="metrics">
      <article>
        <div class="metric-label">销售额</div>
        <strong>{{ money(report.salesTotal) }}</strong>
        <div class="metric-bottom">{{ report.salesOrderCount }} 笔销售 · 客单价 {{ money(report.avgOrder) }}</div>
      </article>
      <article>
        <div class="metric-label">采购额</div>
        <strong>{{ money(report.purchaseTotal) }}</strong>
        <div class="metric-bottom">{{ report.purchaseOrderCount }} 笔采购入库</div>
      </article>
      <article>
        <div class="metric-label">毛利</div>
        <strong>{{ money(report.grossProfit) }}</strong>
        <div class="metric-bottom">毛利率 <b>{{ (report.grossMarginBps / 100).toFixed(1) }}%</b></div>
      </article>
      <article class="warning-metric">
        <div class="metric-label">库存占用</div>
        <strong>{{ money(report.stockValue) }}</strong>
        <div class="metric-bottom">{{ report.productCount }} 个 SKU · {{ report.lowCount }} 项待补货</div>
      </article>
    </section>

    <section v-if="report" class="data-panel trend-panel">
      <div class="panel-title">
        <h2>销售 / 采购趋势</h2>
        <span class="legend"><i class="dot sale" />销售 <i class="dot purchase" />采购</span>
      </div>
      <div class="chart">
        <div class="bars" :class="{ dense: report.trend.length > 45 }">
          <div
            v-for="d in report.trend"
            :key="d.date"
            class="bar-group"
            :title="`${d.date}  销售 ${money(d.sales)}  采购 ${money(d.purchase)}`"
          >
            <i class="bar sale" :style="{ height: heightOf(d.sales) }" />
            <i class="bar purchase" :style="{ height: heightOf(d.purchase) }" />
          </div>
        </div>
        <div class="axis"><span>{{ report.from }}</span><span>{{ report.to }}</span></div>
      </div>
    </section>

    <div v-if="report" class="split">
      <section class="data-panel">
        <div class="panel-title"><h2>商品排行</h2><span>按销售金额</span></div>
        <div v-if="!report.topProducts.length" class="empty-small">这段时间还没有销售记录</div>
        <ul v-else class="rank-list">
          <li v-for="(p, i) in report.topProducts" :key="p.id">
            <span class="rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <div class="rank-main">
              <b>{{ p.name }}</b>
              <div class="rank-bar"><i :style="{ width: ratioOf(p.amount) }" /></div>
            </div>
            <div class="rank-side">
              <strong>{{ money(p.amount) }}</strong>
              <small>{{ p.qty }} 件 · 毛利 {{ money(p.profit) }}</small>
            </div>
          </li>
        </ul>
      </section>

      <section class="data-panel">
        <div class="panel-title"><h2>品类占比</h2><span>按销售金额</span></div>
        <div v-if="!report.categoryShare.length" class="empty-small">暂无数据</div>
        <ul v-else class="share-list">
          <li v-for="c in report.categoryShare" :key="c.name">
            <div class="share-head"><b>{{ c.name }}</b><span>{{ c.ratio }}%</span></div>
            <div class="share-bar"><i :style="{ width: c.ratio + '%' }" /></div>
            <small>{{ money(c.amount) }}</small>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="loading && !report" class="loading">正在汇总数据…</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
});

const ranges = [7, 30, 90];
const days = ref(30);
const report = ref(null);
const loading = ref(false);
const error = ref('');

function money(cents) {
  const v = Number(cents || 0) / 100;
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function maxOfTrend() {
  if (!report.value) return 1;
  let max = 1;
  for (const d of report.value.trend) max = Math.max(max, d.sales, d.purchase);
  return max;
}

function heightOf(value) {
  const pct = Math.round((Number(value) / maxOfTrend()) * 100);
  return Math.max(pct, value > 0 ? 3 : 0) + '%';
}

function ratioOf(amount) {
  const top = report.value?.topProducts?.[0]?.amount || 1;
  return Math.max(Math.round((amount / top) * 100), 2) + '%';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    report.value = await props.api(`reports/overview?days=${days.value}`, null, 'GET');
  } catch (e) {
    error.value = e.message || '报表加载失败';
  } finally {
    loading.value = false;
  }
}

function setDays(v) {
  if (days.value === v) return;
  days.value = v;
  load();
}

onMounted(load);
</script>

<style scoped>
.range-switch {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.trend-panel {
  margin-bottom: 18px;
  padding: 18px 20px 14px;
}

.panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
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

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  display: inline-block;
}

.dot.sale {
  background: #8da9ff;
}

.dot.purchase {
  background: #d9b780;
}

.chart {
  padding-top: 4px;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 168px;
  padding-bottom: 2px;
}

.bars.dense {
  gap: 2px;
}

.bar-group {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: 100%;
  min-width: 0;
}

.bar {
  width: 46%;
  max-width: 14px;
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.bars.dense .bar {
  max-width: 6px;
}

.bar.sale {
  background: linear-gradient(180deg, #a9beff, #5b78cc);
}

.bar.purchase {
  background: linear-gradient(180deg, #e6c79b, #a5824e);
}

.axis {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  color: var(--muted);
}

.split {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 18px;
}

.split .data-panel {
  padding: 18px 20px;
}

.rank-list,
.share-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.rank-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid #23262f;
}

.rank-list li:last-child {
  border-bottom: 0;
}

.rank {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 10px;
  color: #8b93a6;
  background: #23262f;
  flex-shrink: 0;
}

.rank.top {
  background: #2b3450;
  color: #b8c9ff;
}

.rank-main {
  flex: 1;
  min-width: 0;
}

.rank-main b {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #e0e4ed;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-bar {
  height: 3px;
  margin-top: 7px;
  background: #23262f;
  border-radius: 2px;
  overflow: hidden;
}

.rank-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #6f8bda, #a9beff);
  border-radius: 2px;
}

.rank-side {
  text-align: right;
  flex-shrink: 0;
}

.rank-side strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.rank-side small {
  font-size: 9px;
  color: var(--muted);
}

.share-list li {
  padding: 10px 0;
  border-bottom: 1px solid #23262f;
}

.share-list li:last-child {
  border-bottom: 0;
}

.share-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #c8cede;
}

.share-bar {
  height: 5px;
  margin: 7px 0 5px;
  border-radius: 3px;
  background: #23262f;
  overflow: hidden;
}

.share-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #6f8bda, #d9b780);
}

.share-list small {
  font-size: 9px;
  color: var(--muted);
}

.empty-small {
  padding: 30px 0;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
}

.loading {
  padding: 60px 0;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 980px) {
  .split {
    grid-template-columns: 1fr;
  }
  .bars {
    height: 130px;
  }
}
</style>
