<template>
  <div class="help-mask" @click="$emit('close')">
    <aside class="help-drawer" @click.stop>
      <header class="help-head">
        <div>
          <div class="eyebrow">GUIDE</div>
          <h2>使用指南</h2>
        </div>
        <button class="icon-button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>

      <div class="help-body">
        <section>
          <h3>三步上手</h3>
          <ol class="steps">
            <li>
              <b>1. 建商品</b>
              <p>在「商品与库存」右上角点「新建商品」，填名称、SKU、进价售价和预警值。SKU 是内部编码，自己定就行。</p>
            </li>
            <li>
              <b>2. 进货</b>
              <p>点「采购入库」，选供应商、挑商品、填数量和进价，确认后库存自动增加。</p>
            </li>
            <li>
              <b>3. 卖货</b>
              <p>点「销售出库」，选客户和商品。库存不足会直接拦下，不会让你卖成负数。</p>
            </li>
          </ol>
        </section>

        <section>
          <h3>每个模块能做什么</h3>
          <ul class="modules">
            <li v-for="m in modules" :key="m.id">
              <button class="module-link" @click="$emit('jump', m.id)">
                <span class="module-name">{{ m.label }}</span>
                <span class="module-desc">{{ m.desc }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h3>几个常见疑问</h3>
          <dl class="faq">
            <dt>为什么我开的单没扣库存？</dt>
            <dd>店员提交的单据要等店长在「单据审批」里通过后才生效。</dd>
            <dt>库存和金额对不上？</dt>
            <dd>报表里的毛利按出库当时锁定的成本算，之后改商品成本不会影响历史。</dd>
            <dt>怎么导出数据？</dt>
            <dd>每个列表右上角都有「导出数据」，导出当前筛选结果（CSV，Excel 可直接打开）。</dd>
            <dt>怎么打印单据？</dt>
            <dd>点单据编号打开详情，底部有「打印单据」，出 A4 格式。</dd>
          </dl>
        </section>
      </div>
    </aside>
  </div>
</template>

<script setup>
defineEmits(['close', 'jump']);

const modules = [
  { id: 'inventory', label: '商品与库存', desc: '建商品、看库存、改价格预警' },
  { id: 'purchase', label: '采购入库', desc: '向供应商进货，库存增加' },
  { id: 'sale', label: '销售出库', desc: '卖货给客户，库存减少' },
  { id: 'returns', label: '退货与报损', desc: '客户退货、退回供应商、报损' },
  { id: 'ledger', label: '库存流水', desc: '每一次出入库的时间线' },
  { id: 'partners', label: '客户与供应商', desc: '往来档案与历史交易' },
  { id: 'stocktake', label: '库存盘点', desc: '实盘数量与账面差异调整' },
  { id: 'reconcile', label: '应收应付', desc: '谁欠我钱、我欠谁钱，登记收付款' },
  { id: 'approvals', label: '单据审批', desc: '通过或驳回店员提交的单据' },
  { id: 'employees', label: '员工档案', desc: '员工与提成比例' },
  { id: 'services', label: '装机服务', desc: '整机装配工单与进度' },
  { id: 'commissions', label: '员工提成', desc: '按成交比例自动计提' },
  { id: 'reports', label: '经营报表', desc: '销售趋势、毛利、排行、滞销' },
  { id: 'users', label: '用户权限', desc: '账号与角色（仅管理员）' },
  { id: 'audit', label: '操作日志', desc: '谁在什么时候改了什么' },
];
</script>

<style>
.help-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(6, 7, 11, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}

.help-drawer {
  width: 420px;
  max-width: 92vw;
  height: 100%;
  background: #14161c;
  border-left: 1px solid #262a35;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.help-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 22px 14px;
  border-bottom: 1px solid #23262f;
}

.help-head h2 {
  margin: 6px 0 0;
  font-size: 17px;
  font-weight: 600;
  color: #eef1f8;
}

.help-head .icon-button {
  color: #8b93a6;
  font-size: 18px;
  width: 30px;
  height: 30px;
}

.help-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px 32px;
}

.help-body h3 {
  font-size: 13px;
  font-weight: 500;
  color: #dbe2f2;
  margin: 0 0 12px;
}

.help-body section + section {
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid #21242c;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.steps li {
  background: #191c24;
  border: 1px solid #262a35;
  border-radius: 10px;
  padding: 12px 14px;
}

.steps b {
  font-size: 12px;
  color: #cfd8ea;
  font-weight: 500;
}

.steps p {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.75;
  color: #8b93a6;
}

.modules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.module-link {
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.module-link:hover {
  background: #1d2130;
}

.module-name {
  font-size: 12px;
  color: #c8d4ea;
}

.module-desc {
  font-size: 10px;
  color: #7c8496;
}

.faq {
  margin: 0;
}

.faq dt {
  font-size: 11px;
  color: #b9c4d8;
  margin-top: 12px;
}

.faq dd {
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.75;
  color: #7f8798;
}
</style>
