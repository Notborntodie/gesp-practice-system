<template>
  <Teleport to="body">
    <div
      v-if="shouldShow"
      class="growth-pet-floating"
    >
      <button
        class="floating-trigger"
        :class="{ initialized }"
        type="button"
        :aria-label="initialized ? '打开成长精灵' : '选择成长精灵'"
        @click="openPanel"
        @keydown.enter.prevent="openPanel"
        @keydown.space.prevent="openPanel"
      >
        <template v-if="loading">
          <Icon name="loader-2" :size="20" spin />
          <span>加载中</span>
        </template>
        <template v-else-if="initialized && pet">
          <img class="floating-pet-image" :src="pet.current_stage_info?.image_url" :alt="petTitle" />
          <span class="floating-pet-meta">
            <strong>{{ petTitle }}</strong>
            <small>{{ pet.can_evolve ? '可以进化' : `${pet.total_points} 分` }}</small>
          </span>
          <span v-if="pet.can_evolve" class="floating-evolve-badge">进化</span>
        </template>
        <template v-else>
          <span class="floating-spark">
            <Icon name="sparkles" :size="18" />
          </span>
          <span class="floating-launch-copy">成长精灵上线啦！</span>
        </template>
      </button>
    </div>

    <div v-if="panelOpen" class="floating-panel-overlay" @click="closePanel">
      <div class="floating-panel" @click.stop>
        <div class="floating-panel-header">
          <div>
            <p class="floating-eyebrow">成长精灵</p>
            <h3>{{ initialized ? '我的成长精灵' : '选择你的成长精灵' }}</h3>
          </div>
          <button class="floating-close" type="button" aria-label="关闭" @click="closePanel">
            <Icon name="x" :size="18" />
          </button>
        </div>
        <GrowthPetWidget
          :key="widgetKey"
          :user-id="userId"
          mode="full"
          :auto-prompt="false"
          :inline-chooser="!initialized"
          :show-leaderboard="false"
          @open-leaderboard="panelOpen = true"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { BASE_URL } from '@/config/api'
import Icon from '@/components/Icon.vue'
import GrowthPetWidget from '@/components/plan/GrowthPetWidget.vue'

const route = useRoute()

const loading = ref(false)
const panelOpen = ref(false)
const me = ref<any>(null)
const userInfo = ref<any>(null)
const widgetKey = ref(0)

const userId = computed(() => Number(userInfo.value?.id || 0))
const initialized = computed(() => Boolean(me.value?.initialized))
const pet = computed(() => me.value?.pet || null)
const petTitle = computed(() => pet.value ? `${pet.value.nickname || pet.value.species_name}` : '成长精灵')

const hiddenRoutePrefixes = [
  '/login',
  '/register',
  '/admin',
  '/teacher',
  '/animation/',
  '/public-tests/',
  '/public-plans/',
  '/practice/',
  '/exam/',
  '/plan-exam/',
  '/smartoj',
  '/plan-smartoj',
  '/tests/',
  '/oj-submissions',
  '/exam-submissions/'
]

const shouldShow = computed(() => {
  if (!userId.value) return false
  if (hiddenRoutePrefixes.some(prefix => route.path === prefix || route.path.startsWith(prefix))) return false
  return true
})

function readUserInfo() {
  if (localStorage.getItem('isLoggedIn') !== 'true') {
    userInfo.value = null
    me.value = null
    return
  }

  const raw = localStorage.getItem('userInfo')
  if (!raw) {
    userInfo.value = null
    me.value = null
    return
  }

  try {
    userInfo.value = JSON.parse(raw)
  } catch {
    userInfo.value = null
    me.value = null
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || '请求失败')
  }
  return data.data
}

async function loadMe() {
  if (!userId.value) return
  loading.value = true
  try {
    me.value = await fetchJson(`${BASE_URL}/growth-pets/me?user_id=${userId.value}`)
  } catch (error) {
    console.error('加载全局成长精灵失败:', error)
  } finally {
    loading.value = false
  }
}

function openPanel() {
  panelOpen.value = true
  widgetKey.value += 1
}

function closePanel() {
  panelOpen.value = false
  loadMe()
}

function handleRefresh() {
  readUserInfo()
  loadMe()
}

function handleStorage(event: StorageEvent) {
  if (event.key === 'userInfo' || event.key === 'isLoggedIn') {
    handleRefresh()
  }
}

function handleOpenRequest() {
  readUserInfo()
  loadMe()
  openPanel()
}

watch(() => route.path, () => {
  readUserInfo()
  if (!shouldShow.value) {
    panelOpen.value = false
  }
  if (shouldShow.value) {
    loadMe()
  }
}, { immediate: true })

watch(userId, () => {
  if (shouldShow.value) {
    loadMe()
  }
})

onMounted(() => {
  readUserInfo()
  if (shouldShow.value) {
    loadMe()
  }
  window.addEventListener('growth-pet-refresh', handleRefresh)
  window.addEventListener('growth-pet-open', handleOpenRequest)
  window.addEventListener('storage', handleStorage)
})

onUnmounted(() => {
  window.removeEventListener('growth-pet-refresh', handleRefresh)
  window.removeEventListener('growth-pet-open', handleOpenRequest)
  window.removeEventListener('storage', handleStorage)
})
</script>

<style scoped>
.growth-pet-floating {
  position: fixed;
  left: 22px;
  bottom: 22px;
  z-index: 8000;
  user-select: none;
  width: max-content;
  height: max-content;
  pointer-events: none;
}

.floating-trigger {
  position: relative;
  min-width: 154px;
  min-height: 136px;
  max-width: min(230px, calc(100vw - 24px));
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #172033;
  cursor: pointer;
  pointer-events: auto;
  filter: drop-shadow(0 16px 22px rgba(15, 23, 42, 0.2));
  transition: transform 0.18s ease, filter 0.18s ease;
}

.growth-pet-floating .floating-trigger:hover {
  transform: translateY(-3px) scale(1.03);
  filter: drop-shadow(0 20px 28px rgba(15, 23, 42, 0.26));
}

.floating-trigger.initialized {
  padding: 6px 10px 8px;
}

.floating-spark {
  width: 72px;
  height: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #25b7a5, #2864d8);
  color: #fff;
  box-shadow: 0 12px 28px rgba(37, 183, 165, 0.34);
}

.floating-launch-copy {
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
}

.floating-pet-image {
  width: 112px;
  height: 112px;
  object-fit: contain;
}

.floating-pet-meta {
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  text-align: center;
}

.floating-pet-meta strong,
.floating-pet-meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-pet-meta strong {
  max-width: 154px;
  font-size: 13px;
  line-height: 1.2;
}

.floating-pet-meta small {
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
}

.floating-evolve-badge {
  position: absolute;
  right: 4px;
  top: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #ff8a1f;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(255, 138, 31, 0.34);
  animation: evolveBadgePulse 1.4s ease-in-out infinite;
}

@keyframes evolveBadgePulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

.floating-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  padding: 24px 24px 168px 24px;
  background: rgba(15, 23, 42, 0.28);
  pointer-events: auto;
}

.floating-panel {
  position: relative;
  width: min(720px, calc(100vw - 48px));
  max-height: min(760px, calc(100vh - 48px));
  overflow: auto;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.3);
  transform-origin: 74px 100%;
  animation: growthPetPanelGrow 220ms cubic-bezier(.2, .85, .2, 1) both;
}

.floating-panel::after {
  content: "";
  position: absolute;
  left: 56px;
  bottom: -10px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: #fff;
  transform: rotate(45deg);
  box-shadow: 10px 10px 22px rgba(15, 23, 42, 0.12);
}

@keyframes growthPetPanelGrow {
  from {
    opacity: 0;
    transform: translate(-8px, 18px) scale(0.84);
  }
  to {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

.floating-panel-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(87, 106, 137, 0.14);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.floating-panel-header h3,
.floating-eyebrow {
  margin: 0;
}

.floating-eyebrow {
  color: #667085;
  font-size: 12px;
}

.floating-panel-header h3 {
  margin-top: 2px;
  font-size: 18px;
  color: #172033;
}

.floating-close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: #eef4ff;
  color: #2f5ca8;
  cursor: pointer;
}

.floating-panel :deep(.growth-pet-widget) {
  padding: 20px;
}

@media (max-width: 760px) {
  .growth-pet-floating {
    left: 14px;
    bottom: 14px;
  }

  .floating-trigger {
    min-width: 128px;
    min-height: 118px;
    padding: 6px 8px;
  }

  .floating-pet-image {
    width: 92px;
    height: 92px;
  }

  .floating-launch-copy {
    max-width: 156px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .floating-panel-overlay {
    justify-content: flex-start;
    align-items: flex-end;
    padding: 10px 10px 142px 10px;
  }

  .floating-panel {
    width: min(100%, calc(100vw - 20px));
    max-height: calc(100vh - 20px);
    transform-origin: 64px 100%;
  }
}
</style>
