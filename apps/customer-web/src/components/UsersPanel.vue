<template>
  <div class="users-page">
    <div class="page-title">
      <div>
        <div class="eyebrow">ACCESS CONTROL</div>
        <h1>用户与权限<span class="title-dot"></span></h1>
        <p>管理员管账号，店长管资料，店员只负责开单——不同岗位看到和能操作的内容不同。</p>
      </div>
      <button class="button secondary" @click="load">刷新</button>
    </div>

    <div v-if="error" class="error-banner" role="alert">{{ error }}<button @click="load">重试</button></div>

    <div class="split">
      <section class="data-panel">
        <div class="panel-title"><h2>账号列表</h2><span>{{ items.length }} 个账号</span></div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>账号</th><th>角色</th><th>创建时间</th><th class="right">操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in items" :key="u.username">
                <td>
                  <b class="who">{{ u.username }}</b>
                  <span v-if="u.username === me" class="self">当前登录</span>
                </td>
                <td>
                  <select class="role-select" :value="u.role" :disabled="busy || u.username === me" @change="changeRole(u, $event.target.value)">
                    <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
                  </select>
                </td>
                <td class="muted">{{ date(u.createdAt) }}</td>
                <td class="right">
                  <div class="row-actions">
                    <button @click="resetPassword(u)">重置密码</button>
                    <button :disabled="busy || u.username === me" @click="remove(u)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="data-panel create">
        <div class="panel-title"><h2>新建账号</h2></div>
        <form @submit.prevent="create">
          <label>
            账号
            <input v-model="form.username" placeholder="3–32 位字母、数字、下划线" maxlength="32" autocomplete="off" />
          </label>
          <label>
            初始密码
            <input v-model="form.password" type="password" placeholder="至少 8 位" maxlength="128" autocomplete="new-password" />
          </label>
          <label>
            角色
            <select v-model="form.role">
              <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </label>
          <p class="hint">{{ roleHint }}</p>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <button class="button primary" type="submit" :disabled="busy">{{ busy ? '处理中…' : '创建账号' }}</button>
        </form>
      </section>
    </div>

    <section class="legend-panel">
      <h3>角色能做什么</h3>
      <ul>
        <li><b>管理员</b><span>全部权限，含账号管理</span></li>
        <li><b>店长</b><span>商品、往来单位、员工、服务、报表</span></li>
        <li><b>店员</b><span>查看数据、开单、盘点</span></li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  me: { type: String, default: '' },
  notify: { type: Function, default: () => {} },
});

const items = ref([]);
const roles = ref([
  { value: 'admin', label: '管理员' },
  { value: 'manager', label: '店长' },
  { value: 'clerk', label: '店员' },
]);
const busy = ref(false);
const error = ref('');
const formError = ref('');
const form = reactive({ username: '', password: '', role: 'clerk' });

const roleHint = computed(() => ({
  admin: '管理员可以管理其他账号，请谨慎授予。',
  manager: '店长可维护商品资料、往来单位与员工，并查看报表。',
  clerk: '店员只能查看数据、开单与盘点，不能改商品资料。',
})[form.role] || '');

function date(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function load() {
  error.value = '';
  try {
    const data = await props.api('users', null, 'GET');
    items.value = data.items || [];
    if (data.roles?.length) roles.value = data.roles;
  } catch (e) {
    error.value = e.message || '加载失败';
  }
}

async function create() {
  formError.value = '';
  if (!form.username.trim() || !form.password) {
    formError.value = '请填写账号和初始密码';
    return;
  }
  busy.value = true;
  try {
    await props.api('users', { username: form.username.trim(), password: form.password, role: form.role });
    props.notify?.(`已创建账号 ${form.username.trim()}`);
    form.username = '';
    form.password = '';
    form.role = 'clerk';
    await load();
  } catch (e) {
    formError.value = e.message || '创建失败';
  } finally {
    busy.value = false;
  }
}

async function changeRole(u, role) {
  if (role === u.role) return;
  busy.value = true;
  try {
    await props.api(`users/${encodeURIComponent(u.username)}`, { role }, 'PATCH');
    props.notify?.(`${u.username} 已改为${roleLabel(role)}`);
    await load();
  } catch (e) {
    error.value = e.message || '修改角色失败';
    await load();
  } finally {
    busy.value = false;
  }
}

async function resetPassword(u) {
  const pwd = window.prompt(`为 ${u.username} 设置新密码（至少 8 位）`);
  if (!pwd) return;
  busy.value = true;
  try {
    await props.api(`users/${encodeURIComponent(u.username)}`, { password: pwd }, 'PATCH');
    props.notify?.(`${u.username} 的密码已重置，旧会话已失效`);
  } catch (e) {
    error.value = e.message || '重置密码失败';
  } finally {
    busy.value = false;
  }
}

async function remove(u) {
  if (!window.confirm(`确定删除账号 ${u.username}？该账号将立即无法登录。`)) return;
  busy.value = true;
  try {
    await props.api(`users/${encodeURIComponent(u.username)}`, null, 'DELETE');
    props.notify?.(`已删除账号 ${u.username}`);
    await load();
  } catch (e) {
    error.value = e.message || '删除失败';
  } finally {
    busy.value = false;
  }
}

function roleLabel(role) {
  return roles.value.find((r) => r.value === role)?.label || role;
}

onMounted(load);
</script>

<style scoped>
.split {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
  align-items: start;
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

.self {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  color: #a9beff;
  background: #2b3450;
}

.role-select {
  background: #111318;
  border: 1px solid #343b4b;
  border-radius: var(--radius-sm);
  color: #dbe2f2;
  font-size: 11px;
  padding: 4px 6px;
}

.create form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 11px;
  color: #acb6ca;
}

.create input,
.create select {
  background: #111318;
  border: 1px solid #343b4b;
  border-radius: var(--radius-md);
  padding: 10px 12px;
  color: #e0e7f8;
  font-size: 12px;
}

.hint {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.7;
  margin: 0;
}

.form-error {
  font-size: 11px;
  color: #efb0c0;
  background: #38252f;
  border: 1px solid #593848;
  border-radius: var(--radius-md);
  padding: 9px 11px;
}

.legend-panel {
  margin-top: 18px;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: #16171b;
}

.legend-panel h3 {
  font-size: 12px;
  font-weight: 500;
  margin: 0 0 12px;
}

.legend-panel ul {
  display: flex;
  gap: 26px;
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
}

.legend-panel li {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend-panel b {
  font-size: 11px;
  color: #dbe2f2;
  font-weight: 500;
}

.legend-panel span {
  font-size: 10px;
  color: var(--muted);
}

@media (max-width: 980px) {
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
