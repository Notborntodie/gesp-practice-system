<template>
  <section class="growth-pet-widget" :class="{ compact: isCompact }">
    <div class="pet-header">
      <div>
        <p class="eyebrow">成长精灵</p>
        <h3>{{ initialized ? petTitle : '选择你的成长伙伴' }}</h3>
      </div>
      <button v-if="isCompact" class="icon-action" type="button" title="查看成长精灵榜" @click="$emit('openLeaderboard')">
        <Icon name="trophy" :size="18" />
      </button>
    </div>

    <div v-if="loading" class="pet-loading">
      <Icon name="loader-2" :size="20" spin />
      <span>加载中...</span>
    </div>

    <template v-else-if="initialized && pet">
      <div class="pet-main">
        <img class="pet-image" :src="pet.current_stage_info?.image_url" :alt="petTitle" />
        <div class="pet-stats">
          <div class="pet-stage">{{ pet.current_stage_info?.stage_name || `阶段 ${pet.current_stage}` }}</div>
          <div class="pet-points">{{ pet.total_points }} 积分</div>
          <div class="pet-progress">
            <div class="pet-progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="pet-next">{{ nextStageText }}</p>
        </div>
      </div>

      <div class="pet-reminder">
        <Icon name="bell" :size="16" />
        <span>{{ me?.reminder?.message || '继续完成成长任务吧' }}</span>
      </div>

      <div v-if="!isCompact" class="pet-help">
        <Icon name="route" :size="16" />
        <span>完成成长计划内的任务可以获得积分，积分达标后就能让精灵进化。</span>
      </div>

      <button v-if="pet.can_evolve" class="evolve-btn" type="button" :disabled="evolving" @click="evolvePet">
        <Icon :name="evolving ? 'loader-2' : 'sparkles'" :size="16" :spin="evolving" />
        <span>{{ evolving ? '进化中...' : '手动进化' }}</span>
      </button>
    </template>

    <template v-else-if="props.inlineChooser">
      <div class="pet-inline-chooser">
        <p class="pet-modal-copy">首版提供火系、水系、土系三个系列。选择后，完成成长计划内的任务会获得积分，积分达标后精灵可以进化。</p>
        <div class="species-grid">
          <button
            v-for="species in speciesList"
            :key="species.id"
            class="species-card"
            type="button"
            :disabled="choosing"
            @click="chooseSpecies(species)"
          >
            <img :src="species.stages?.[0]?.image_url" :alt="species.name" />
            <strong>{{ species.name }}</strong>
            <span>{{ species.description }}</span>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="pet-empty">
        <Icon name="sparkles" :size="24" />
        <p>先选择一个火系、水系或土系精灵。完成成长计划内的任务可以获得积分，积分达标后就能让精灵进化。</p>
        <button class="choose-btn" type="button" @click="requestChoose">选择精灵</button>
      </div>
    </template>

    <div v-if="!isCompact && props.showLeaderboard" class="leaderboard-block">
      <div class="leaderboard-header">
        <h4>全站成长精灵榜</h4>
        <button class="text-action" type="button" @click="loadLeaderboard">刷新</button>
      </div>
      <div v-if="leaderboardLoading" class="pet-loading small">
        <Icon name="loader-2" :size="18" spin />
        <span>加载榜单...</span>
      </div>
      <div v-else-if="leaderboard.length === 0" class="leaderboard-empty">暂无上榜精灵</div>
      <div v-else class="leaderboard-list">
        <div v-for="(item, index) in leaderboard" :key="item.user_id" class="leaderboard-row">
          <div class="rank">{{ index + 1 }}</div>
          <img class="rank-pet" :src="item.image_url" :alt="item.nickname" />
          <div class="rank-info">
            <strong>{{ item.display_name }}</strong>
            <span>{{ item.nickname }} · {{ item.species_name }} · {{ item.stage_name }}</span>
          </div>
          <div class="rank-points">{{ item.total_points }}</div>
        </div>
      </div>
    </div>

    <div v-if="showEvolutionModal && evolutionBefore && evolutionAfter" class="evolution-overlay" @click="closeEvolutionModal">
      <div class="evolution-modal" :class="evolutionTheme" @click.stop>
        <div class="evolution-stage">
          <div class="evolution-aura"></div>
          <div class="evolution-ring"></div>
          <div
            v-for="spark in evolutionSparks"
            :key="spark.x + '-' + spark.y"
            class="evolution-spark"
            :style="{ '--tx': spark.x + 'px', '--ty': spark.y + 'px' }"
          ></div>
          <img class="evolution-pet evolution-before" :src="evolutionBefore.current_stage_info?.image_url" :alt="evolutionBefore.current_stage_info?.stage_name" />
          <img class="evolution-pet evolution-after" :src="evolutionAfter.current_stage_info?.image_url" :alt="evolutionAfter.current_stage_info?.stage_name" />
        </div>
        <div class="evolution-copy">
          <p class="eyebrow">进化完成</p>
          <h3>{{ evolutionBefore.current_stage_info?.stage_name || `阶段 ${evolutionBefore.current_stage}` }} → {{ evolutionAfter.current_stage_info?.stage_name || `阶段 ${evolutionAfter.current_stage}` }}</h3>
          <p>{{ evolutionAfter.nickname || evolutionAfter.species_name }} 进入了新的成长阶段。</p>
        </div>
        <button class="evolution-close" type="button" @click="closeEvolutionModal">太棒了</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { BASE_URL } from '@/config/api'
import Icon from '@/components/Icon.vue'

const props = withDefaults(defineProps<{
  userId: number
  mode?: 'compact' | 'full'
  autoPrompt?: boolean
  showLeaderboard?: boolean
  inlineChooser?: boolean
}>(), {
  mode: 'compact',
  autoPrompt: true,
  showLeaderboard: true,
  inlineChooser: false
})

defineEmits<{
  openLeaderboard: []
}>()

const loading = ref(false)
const choosing = ref(false)
const evolving = ref(false)
const leaderboardLoading = ref(false)
const showEvolutionModal = ref(false)
const me = ref<any>(null)
const speciesList = ref<any[]>([])
const leaderboard = ref<any[]>([])
const evolutionBefore = ref<any>(null)
const evolutionAfter = ref<any>(null)

const evolutionSparks = [
  { x: -180, y: -128 },
  { x: -96, y: -204 },
  { x: 116, y: -196 },
  { x: 194, y: -72 },
  { x: 176, y: 124 },
  { x: 50, y: 206 },
  { x: -136, y: 156 },
  { x: -214, y: 30 }
]

const isCompact = computed(() => props.mode === 'compact')
const initialized = computed(() => Boolean(me.value?.initialized))
const pet = computed(() => me.value?.pet || null)
const petTitle = computed(() => pet.value ? `${pet.value.nickname || pet.value.species_name}` : '成长精灵')
const evolutionTheme = computed(() => {
  const speciesName = evolutionAfter.value?.species_name || evolutionBefore.value?.species_name || ''
  if (speciesName.includes('水')) return 'theme-water'
  if (speciesName.includes('土')) return 'theme-earth'
  return 'theme-fire'
})

const progressPercent = computed(() => {
  if (!pet.value) return 0
  const currentRequired = Number(pet.value.current_stage_info?.required_points || 0)
  const nextRequired = Number(pet.value.next_stage_info?.required_points || currentRequired)
  const total = Number(pet.value.total_points || 0)
  if (nextRequired <= currentRequired) return 100
  return Math.max(0, Math.min(100, Math.round(((total - currentRequired) / (nextRequired - currentRequired)) * 100)))
})

const nextStageText = computed(() => {
  if (!pet.value) return ''
  if (!pet.value.next_stage_info) return '已经进化到最高阶段'
  const need = Number(pet.value.next_stage_info.required_points || 0) - Number(pet.value.total_points || 0)
  return need <= 0 ? '已满足进化条件' : `距离 ${pet.value.next_stage_info.stage_name} 还差 ${need} 分`
})

async function fetchJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || '请求失败')
  }
  return data.data
}

async function loadSpecies() {
  speciesList.value = await fetchJson(`${BASE_URL}/growth-pets/species`)
}

async function loadMe() {
  if (!props.userId) return
  loading.value = true
  try {
    me.value = await fetchJson(`${BASE_URL}/growth-pets/me?user_id=${props.userId}`)
    if (!me.value.initialized && props.autoPrompt) {
      requestChoose()
    }
  } catch (error) {
    console.error('加载成长精灵失败:', error)
  } finally {
    loading.value = false
  }
}

async function chooseSpecies(species: any) {
  choosing.value = true
  try {
    me.value = await fetchJson(`${BASE_URL}/growth-pets/choose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: props.userId,
        species_id: species.id,
        nickname: species.name
      })
    })
    window.dispatchEvent(new CustomEvent('growth-pet-refresh'))
    await loadLeaderboard()
  } catch (error) {
    alert(error instanceof Error ? error.message : '选择成长精灵失败')
  } finally {
    choosing.value = false
  }
}

async function evolvePet() {
  evolving.value = true
  try {
    const beforePet = pet.value ? JSON.parse(JSON.stringify(pet.value)) : null
    const nextMe = await fetchJson(`${BASE_URL}/growth-pets/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: props.userId })
    })
    const afterPet = nextMe?.pet || null
    me.value = nextMe
    if (beforePet && afterPet && Number(afterPet.current_stage) > Number(beforePet.current_stage)) {
      evolutionBefore.value = beforePet
      evolutionAfter.value = afterPet
      showEvolutionModal.value = true
    }
    window.dispatchEvent(new CustomEvent('growth-pet-refresh'))
    await loadLeaderboard()
  } catch (error) {
    alert(error instanceof Error ? error.message : '成长精灵进化失败')
  } finally {
    evolving.value = false
  }
}

async function loadLeaderboard() {
  if (isCompact.value || !props.showLeaderboard) return
  leaderboardLoading.value = true
  try {
    leaderboard.value = await fetchJson(`${BASE_URL}/growth-pets/leaderboard?limit=50`)
  } catch (error) {
    console.error('加载成长精灵榜失败:', error)
  } finally {
    leaderboardLoading.value = false
  }
}

function requestChoose() {
  if (props.inlineChooser) return
  window.dispatchEvent(new CustomEvent('growth-pet-open'))
}

function closeEvolutionModal() {
  showEvolutionModal.value = false
}

function handleRewardRefresh() {
  loadMe()
  loadLeaderboard()
}

watch(() => props.userId, () => {
  loadMe()
  loadLeaderboard()
})

onMounted(async () => {
  await loadSpecies()
  await loadMe()
  await loadLeaderboard()
  window.addEventListener('growth-pet-refresh', handleRewardRefresh)
})

onUnmounted(() => {
  window.removeEventListener('growth-pet-refresh', handleRewardRefresh)
})
</script>

<style scoped>
.growth-pet-widget {
  width: 100%;
  color: #172033;
}

.growth-pet-widget.compact {
  width: 188px;
  padding: 12px;
  border: 1px solid rgba(87, 106, 137, 0.18);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(20, 34, 56, 0.1);
}

.pet-header,
.leaderboard-header,
.pet-main,
.leaderboard-row {
  display: flex;
  align-items: center;
}

.pet-header,
.leaderboard-header {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 12px;
  color: #667085;
}

.pet-header h3,
.leaderboard-header h4 {
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
}

.icon-action,
.text-action {
  border: 0;
  background: #eef4ff;
  color: #2f5ca8;
  cursor: pointer;
}

.icon-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.text-action {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
}

.pet-loading,
.pet-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 13px;
}

.pet-loading.small {
  padding: 12px 0;
}

.pet-empty {
  align-items: flex-start;
  flex-direction: column;
}

.pet-empty p {
  margin: 0;
  line-height: 1.5;
}

.choose-btn,
.evolve-btn {
  border: 0;
  border-radius: 8px;
  background: #2864d8;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.choose-btn {
  padding: 8px 12px;
}

.evolve-btn {
  width: 100%;
  margin-top: 10px;
  padding: 9px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.pet-main {
  gap: 10px;
}

.pet-image {
  width: 74px;
  height: 74px;
  object-fit: contain;
  flex: 0 0 auto;
}

.pet-stats {
  min-width: 0;
  flex: 1;
}

.pet-stage {
  font-size: 13px;
  font-weight: 700;
  color: #24324b;
}

.pet-points {
  margin-top: 2px;
  font-size: 18px;
  font-weight: 800;
  color: #1d4ed8;
}

.pet-progress {
  height: 7px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7edf7;
}

.pet-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #25b7a5, #2864d8);
}

.pet-next,
.pet-reminder {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.pet-next {
  margin: 6px 0 0;
}

.pet-reminder {
  margin-top: 10px;
  padding: 8px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  border-radius: 8px;
  background: #f7f9fc;
}

.pet-help {
  margin-top: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid rgba(37, 183, 165, 0.18);
  border-radius: 8px;
  background: rgba(37, 183, 165, 0.07);
  color: #0f766e;
  font-size: 13px;
  line-height: 1.5;
}

.leaderboard-block {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid rgba(87, 106, 137, 0.16);
  border-radius: 8px;
  background: #fff;
}

.leaderboard-empty {
  color: #667085;
  padding: 18px 0;
}

.leaderboard-list {
  display: grid;
  gap: 10px;
}

.leaderboard-row {
  gap: 12px;
  min-height: 68px;
  padding: 10px 12px;
  border: 1px solid rgba(87, 106, 137, 0.12);
  border-radius: 8px;
  background: #fbfcff;
}

.rank {
  width: 32px;
  font-size: 18px;
  font-weight: 800;
  color: #2f5ca8;
  text-align: center;
}

.rank-pet {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.rank-info {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.rank-info strong,
.rank-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-info span {
  color: #667085;
  font-size: 13px;
}

.rank-points {
  font-size: 18px;
  font-weight: 800;
  color: #1d4ed8;
}

.pet-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
}

.pet-modal {
  width: min(780px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 22px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 22px 70px rgba(15, 23, 42, 0.28);
}

.pet-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.pet-modal-header h3 {
  margin: 0;
}

.modal-close {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.pet-modal-copy {
  margin: 8px 0 18px;
  color: #667085;
}

.species-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.species-card {
  min-height: 220px;
  padding: 14px;
  border: 1px solid rgba(87, 106, 137, 0.16);
  border-radius: 8px;
  background: #fbfcff;
  cursor: pointer;
  text-align: left;
}

.species-card:hover {
  border-color: #2864d8;
}

.species-card img {
  width: 100%;
  height: 120px;
  object-fit: contain;
}

.species-card strong,
.species-card span {
  display: block;
}

.species-card strong {
  margin-top: 8px;
  color: #172033;
}

.species-card span {
  margin-top: 6px;
  color: #667085;
  font-size: 13px;
  line-height: 1.45;
}

.evolution-overlay {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.52);
}

.evolution-modal {
  --evolution-accent: #ff8a1f;
  --evolution-soft: rgba(255, 138, 31, 0.22);
  width: min(560px, 100%);
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 26px 90px rgba(15, 23, 42, 0.34);
}

.evolution-modal.theme-water {
  --evolution-accent: #0ea5e9;
  --evolution-soft: rgba(14, 165, 233, 0.22);
}

.evolution-modal.theme-earth {
  --evolution-accent: #65a30d;
  --evolution-soft: rgba(101, 163, 13, 0.22);
}

.evolution-stage {
  position: relative;
  height: 390px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.88), transparent 34%),
    radial-gradient(circle at 50% 50%, var(--evolution-soft), transparent 68%);
}

.evolution-aura,
.evolution-ring,
.evolution-spark,
.evolution-pet {
  position: absolute;
  left: 50%;
  top: 50%;
  pointer-events: none;
}

.evolution-aura {
  width: 320px;
  height: 320px;
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.92) 0 14%, var(--evolution-soft) 26%, transparent 68%),
    conic-gradient(from 20deg, transparent, var(--evolution-soft), transparent, var(--evolution-soft), transparent);
  animation: evolutionAura 1700ms ease both;
}

.evolution-ring {
  width: 220px;
  height: 220px;
  border: 3px solid var(--evolution-accent);
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7);
  animation: evolutionRing 1700ms ease both;
}

.evolution-spark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0;
  background: #fff;
  box-shadow: 0 0 16px var(--evolution-accent);
  transform: translate(-50%, -50%);
  animation: evolutionSpark 900ms ease-out both;
  animation-delay: 540ms;
}

.evolution-pet {
  width: 300px;
  height: 300px;
  object-fit: contain;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 18px 24px rgba(15, 23, 42, 0.18));
}

.evolution-before {
  animation: evolutionOldPet 1700ms cubic-bezier(.2, .8, .2, 1) both;
}

.evolution-after {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.74);
  animation: evolutionNewPet 1700ms cubic-bezier(.2, .8, .2, 1) both;
}

.evolution-copy {
  padding: 18px 22px 0;
  text-align: center;
}

.evolution-copy h3 {
  margin: 4px 0 8px;
  font-size: 20px;
  color: #172033;
}

.evolution-copy p:last-child {
  margin: 0;
  color: #667085;
  line-height: 1.5;
}

.evolution-close {
  width: calc(100% - 44px);
  margin: 18px 22px 22px;
  padding: 11px 14px;
  border: 0;
  border-radius: 8px;
  background: var(--evolution-accent);
  color: #fff;
  cursor: pointer;
  font-weight: 800;
}

@keyframes evolutionOldPet {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 18px 24px rgba(15, 23, 42, 0.18)) brightness(1);
  }
  38% {
    opacity: 1;
    transform: translate(-50%, -53%) scale(0.92);
    filter: drop-shadow(0 16px 22px rgba(15, 23, 42, 0.16)) brightness(1.18) saturate(1.16);
  }
  58% {
    opacity: 0.18;
    transform: translate(-50%, -50%) scale(0.5);
    filter: blur(8px) brightness(1.8) saturate(1.3);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.45);
    filter: blur(12px) brightness(1.6);
  }
}

@keyframes evolutionNewPet {
  0%,
  48% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.62);
    filter: blur(10px) brightness(1.9);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -52%) scale(1.08);
    filter: blur(0) brightness(1.18) saturate(1.08);
  }
  86% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.98);
    filter: drop-shadow(0 18px 24px rgba(15, 23, 42, 0.18)) brightness(1.04);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    filter: drop-shadow(0 18px 24px rgba(15, 23, 42, 0.18)) brightness(1);
  }
}

@keyframes evolutionAura {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
  }
  40% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.9) rotate(90deg);
  }
  72% {
    opacity: 0.55;
    transform: translate(-50%, -50%) scale(1.22) rotate(180deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.5) rotate(260deg);
  }
}

@keyframes evolutionRing {
  0%,
  30% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.66);
  }
  48% {
    opacity: 0.68;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.95);
  }
}

@keyframes evolutionSpark {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6);
  }
  24% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.15);
  }
}

@media (max-width: 760px) {
  .growth-pet-widget.compact {
    width: 100%;
  }

  .species-grid {
    grid-template-columns: 1fr;
  }

  .evolution-stage {
    height: 330px;
  }

  .evolution-pet {
    width: 240px;
    height: 240px;
  }
}
</style>
