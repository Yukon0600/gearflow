<script setup>
import { onMounted, ref } from 'vue'
import { Layers, ArrowRight, Eye, EyeOff, LockKeyhole, UserRound, Boxes, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-vue-next'
import App from './App.vue'
import ThemePicker from './components/ThemePicker.vue'

const user = ref(null), checking = ref(true), busy = ref(false), error = ref('')
const username = ref(''), password = ref(''), reveal = ref(false)
async function request(path, body) {
  const response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  let result
  try { result = await response.json() } catch { throw new Error('服务暂时不可用，请稍后重试') }
  if (!response.ok) throw new Error(result.message || '请求失败')
  return result
}
onMounted(async () => {
  try { const response = await fetch('/api/auth/me'); if (response.ok) user.value = (await response.json()).user; else if (response.status !== 401) error.value = '暂时无法连接服务，请确认后端已启动' }
  catch { error.value = '无法连接服务器，请确认后端已启动' }
  finally { checking.value = false }
})
async function login() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { user.value = (await request('login', { username: username.value.trim(), password: password.value })).user; password.value = '' }
  catch (e) { error.value = e.message === 'Failed to fetch' ? '无法连接服务器，请确认后端已启动' : e.message }
  finally { busy.value = false }
}
async function logout() {
  try { await request('logout', {}); user.value = null; error.value = ''; password.value = '' }
  catch { window.alert('退出失败，请检查网络后重试') }
}
function expired() { user.value = null; password.value = ''; error.value = '登录已过期，请重新登录' }
</script>

<template>
  <div v-if="checking" class="auth-check" role="status"><RefreshCw class="spin" :size="22"/>正在连接工作区…</div>
  <App v-else-if="user" @logout="logout" @session-expired="expired"/>
  <div v-else class="login-page">
    <header class="login-header"><a href="#" class="login-brand"><Layers :size="25"/><b>GEAR<span>FLOW</span></b></a><ThemePicker/></header>
    <main class="login-main">
      <section class="login-story">
        <div class="login-kicker"><span/> YOUR HARDWARE WORKSPACE</div>
        <h1>每一件配件，<br/><em>都井然有序。</em></h1>
        <p>从采购到交付，连接商品、库存与生意。<br/>让日常经营，清晰而从容。</p>
        <div class="login-visual" aria-hidden="true">
          <div class="login-orbit orbit-one"/><div class="login-orbit orbit-two"/>
          <div class="login-cube"><Boxes :size="70" :stroke-width="1"/></div>
          <div class="login-float float-in"><ArrowDownLeft :size="20"/><span>采购入库<small>每一次补货，有据可查</small></span></div>
          <div class="login-float float-out"><ArrowUpRight :size="20"/><span>销售出库<small>库存与单据，同步更新</small></span></div>
        </div>
        <div class="login-tags"><span>商品管理</span><i/><span>库存追踪</span><i/><span>客户协作</span></div>
      </section>
      <section class="login-card">
        <div class="login-mark"><LockKeyhole :size="23"/></div>
        <div class="login-kicker">WELCOME TO GEARFLOW</div>
        <h2>登录你的工作区</h2><p class="login-subtitle">开始今天的经营管理</p>
        <form @submit.prevent="login">
          <label for="login-username">账号</label>
          <div class="login-input"><UserRound :size="17"/><input id="login-username" v-model="username" autocomplete="username" placeholder="请输入账号" required maxlength="100" :disabled="busy"/></div>
          <label for="login-password">密码</label>
          <div class="login-input"><LockKeyhole :size="17"/><input id="login-password" v-model="password" :type="reveal ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" required maxlength="256" :disabled="busy"/><button type="button" :aria-label="reveal ? '隐藏密码' : '显示密码'" :aria-pressed="reveal" @click="reveal = !reveal"><EyeOff v-if="reveal" :size="17"/><Eye v-else :size="17"/></button></div>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <button class="login-submit" type="submit" :disabled="busy"><RefreshCw v-if="busy" :size="18" class="spin"/>{{ busy ? '正在登录…' : '登录工作区' }}<ArrowRight v-if="!busy" :size="18"/></button>
        </form>
        <div class="login-footnote"><LockKeyhole :size="13"/>登录状态有效期 8 小时</div>
      </section>
    </main>
    <footer class="login-footer"><span>GEARFLOW · 电脑配件进销存</span><span>让库存有序，让经营有数。</span></footer>
  </div>
</template>
