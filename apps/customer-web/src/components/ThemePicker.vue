<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { Palette, Check } from 'lucide-vue-next'

const themes = [
  { id: 'violet', name: '星云紫', note: '电光紫 × 冰蓝', colors: ['#a998ff', '#82cfff', '#171523'] },
  { id: 'blue', name: '深海蓝', note: '钴蓝 × 冰青', colors: ['#80b1ff', '#7cdaee', '#111a27'] },
  { id: 'amber', name: '曜石金', note: '香槟金 × 暖铜', colors: ['#edc58c', '#e9a990', '#211c18'] },
  { id: 'rose', name: '暮光玫瑰', note: '烟粉 × 雾紫', colors: ['#efa6c3', '#b7adf6', '#22171f'] },
  { id: 'silver', name: '月岩银', note: '冷银 × 钢蓝', colors: ['#c9d2e3', '#91accb', '#191c21'] },
]
const current = ref('violet'), opened = ref(false), picker = ref()
try {
  const saved = localStorage.getItem('gearflow-theme')
  if (themes.some(theme => theme.id === saved)) current.value = saved
} catch { /* Theme selection also works when browser storage is unavailable. */ }
function apply(id) {
  current.value = id
  document.documentElement.dataset.theme = id
  try { localStorage.setItem('gearflow-theme', id) } catch { /* Session-only fallback. */ }
}
apply(current.value)
function dismiss(event) {
  if (event.type === 'keydown') {
    if (event.key === 'Escape' && opened.value) {
      opened.value = false
      picker.value?.querySelector('button')?.focus()
    }
  } else if (!picker.value?.contains(event.target)) opened.value = false
}
onMounted(() => { document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss) })
onUnmounted(() => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) })
</script>

<template>
  <div ref="picker" class="theme-picker" @focusout="event => { if (!picker.contains(event.relatedTarget)) opened = false }">
    <button class="theme-trigger" aria-label="切换配色" :aria-expanded="opened" aria-controls="theme-options" @click="opened = !opened">
      <Palette :size="16"/><span>外观</span><i aria-hidden="true"/>
    </button>
    <div v-if="opened" id="theme-options" class="theme-options" role="group" aria-label="工作区配色">
      <div class="theme-heading"><b>工作区配色</b><small>一点色彩，专注如常</small></div>
      <button v-for="theme in themes" :key="theme.id" class="theme-option" :aria-pressed="current === theme.id" @click="apply(theme.id)">
        <span class="theme-swatches" aria-hidden="true"><i v-for="color in theme.colors" :key="color" :style="{ background: color }"/></span>
        <span class="theme-description"><b>{{ theme.name }}</b><small>{{ theme.note }}</small></span>
        <Check v-if="current === theme.id" :size="16"/>
      </button>
      <p>自动记住你的选择</p>
    </div>
  </div>
</template>
