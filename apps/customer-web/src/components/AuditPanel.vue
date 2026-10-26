<template>
  <div class="audit-page">
    <div class="page-title">
      <div>
        <div class="eyebrow">AUDIT TRAIL</div>
        <h1>操作日志<span class="title-dot"></span></h1>
        <p>谁在什么时候改了什么，都留痕。只记录成功的写操作，失败尝试不会混进来。</p>
      </div>
      <div class="filters">
        <input v-model="keyword" class="search-input" placeholder="按账号 / 动作筛选" />
        <button class="button secondary" @click="load">刷新</button>
      </div>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="load">重试</button></div>

    <section class="data-panel">
      <div class="panel-title">
        <h2>最近 {{ items.length }} 条</h2>
        <span>共 {{ total }} 条记录</span>
      </div>

      <div v-if="!filtered.length" class="empty-small">{{ items.length ? '没有匹配的记录' : '还没有操作记录' }}</div>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>接口</th><th class="right">结果</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id">
              <td class="muted">{{ when(row.at) }}</td>
              <td>
                <b class="who">{{ row.username }}</b>
                <span class="role" :class="row.role">{{ roleLabel(row.role) }}</span>
              </td>
              <td><span class="action">{{ row.action }}</span></td>
              <td class="mono">{{ row.target || '—' }}</td>
              <td class="mono path">{{ row.method }} {{ row.path }}</td>
              <td class="right"><span class="status" :class="{ bad: row.status >= 400 }">{{ row.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
});

const items = ref([]);
const total = ref(0);
const keyword = ref('');
const error = ref('');

const ROLE_LABEL = { admin: '管理员', manager: '店长', clerk: '店员' };

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter(
    (r) => r.username.toLowerCase().includes(k) || r.action.toLowerCase().includes(k) || r.target.toLowerCase().includes(k),
  );
});

function roleLabel(role) {
  return ROLE_LABEL[role] || role;
}

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function load() {
  error.value = '';
  try {
    const data = await props.api('audit?limit=200', null, 'GET');
    items.value = data.items || [];
    total.value = data.total || 0;
  } catch (e) {
    error.value = e.message || '日志加载失败';
  }
}

onMounted(load);
</script>

<style scoped>
.filters {
  display: flex;
  gap: 9px;
  align-items: center;
}

.search-input {
  height: 37px;
  width: 220px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  border: 1px solid #343744;
  background: #111318;
  color: #e0e7f8;
  font-size: 12px;
}

.data-panel {
  padding: 18px 20px;
}

.panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
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

.who {
  font-size: 12px;
  font-weight: 500;
  color: #e0e4ed;
}

.role {
  margin-left: 7px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  background: #2b3450;
  color: #b8c9ff;
}

.role.manager {
  background: #332c21;
  color: #d3b17c;
}

.role.clerk {
  background: #23262f;
  color: #98a0b3;
}

.action {
  font-size: 11px;
  color: #cdd4e4;
}

.mono {
  font-family: var(--font-code);
  font-size: 10px;
  color: #8f9dba;
}

.path {
  color: #7b88a4;
}

.status {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #23304a;
  color: #a9c1ff;
}

.status.bad {
  background: #3a2731;
  color: #efb0c0;
}

.empty-small {
  padding: 40px 0;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
}
</style>
