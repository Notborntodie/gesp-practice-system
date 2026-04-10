<template>
  <div class="exam-layout">
    <div class="exam-content exam-content-flex-row">
      <!-- 左侧占位，与 /plan 页面布局保持一致 -->
      <div class="sidebar-placeholder-left">
        <button
          class="back-nav-arrow"
          @click="backToTests"
          title="返回测试列表"
        >
          <Icon name="arrow-left" :size="32" />
        </button>
      </div>

      <!-- 中间主卡片区域 -->
      <div class="test-detail-layout">
        <div class="test-detail-card">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载聚合考试...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p class="error-text">{{ error }}</p>
        <button class="retry-btn" @click="load">重试加载</button>
      </div>
        <div v-else-if="test" class="test-content">
        <header class="test-header">
          <div class="test-header-main">
            <div class="test-title-block">
              <h1 class="test-title">{{ test.name }}</h1>
              <p v-if="test.description" class="test-desc">{{ test.description }}</p>
            </div>
            <div class="test-status-pill" :class="testStatus.class">
              {{ testStatus.text }}
            </div>
          </div>
          <div class="test-meta">
            <div class="meta-left">
              <span class="meta-item">
                <span class="meta-label">考试时长</span>
                <span class="meta-value">{{ test.time_limit_minutes }} 分钟</span>
              </span>
              <span v-if="test.start_time || test.end_time" class="meta-item">
                <span class="meta-label">开放时间</span>
                <span class="meta-value">
                  {{ formatTime(test.start_time) }} ～ {{ formatTime(test.end_time) }}
                </span>
              </span>
              <span v-if="test.exams && test.exams.length" class="meta-item">
                <span class="meta-label">客观题</span>
                <span class="meta-value">{{ test.exams.length }} 套</span>
              </span>
              <span v-if="test.oj_problems && test.oj_problems.length" class="meta-item">
                <span class="meta-label">编程题</span>
                <span class="meta-value">{{ test.oj_problems.length }} 题</span>
              </span>
            </div>
            <div class="meta-right" v-if="attempt">
              <span v-if="!attempt.submitted_at" class="remaining-chip">
                剩余 {{ remainingText }}
              </span>
              <span v-else class="submitted-chip">
                已交卷
              </span>
            </div>
          </div>
        </header>

        <!-- 未参与：强调规则 + 开始考试 -->
        <div v-if="!attempt" class="action-section">
          <div class="exam-notice exam-notice-start">
            <p class="notice-title"><Icon name="alert-triangle" :size="20" /> 请确认后再开始</p>
            <ul>
              <li><strong>考试只能进行一次</strong>，开始后不可重新作答。</li>
              <li><strong>限时 {{ test.time_limit_minutes }} 分钟</strong>，请预留充足时间完成答题。</li>
              <li>请勿轻易点击「开始考试」，确认准备好后再开始。</li>
            </ul>
          </div>
          <button class="btn-primary" :disabled="starting" @click="showStartConfirm = true">
            {{ starting ? '正在开始...' : '开始考试' }}
          </button>
          <!-- 开始考试确认弹窗（Teleport 放在本块内，避免打断 v-if/v-else-if 链） -->
          <Teleport to="body">
            <div v-if="showStartConfirm" class="start-confirm-overlay" @click.self="showStartConfirm = false">
              <div class="start-confirm-dialog">
                <h3 class="start-confirm-title">
                  <Icon name="alert-triangle" :size="22" /> 确认开始考试
                </h3>
                <p class="start-confirm-desc">请确保您有<strong>整段不受打扰的时间</strong>完成本次限时考试，一旦开始将无法重新作答。</p>
                <div class="start-confirm-meta">
                  <span><strong>{{ test?.name }}</strong></span>
                  <span>限时 <strong>{{ test?.time_limit_minutes }}</strong> 分钟，仅可考一次</span>
                </div>
                <div class="start-confirm-actions">
                  <button type="button" class="btn-cancel" @click="showStartConfirm = false">再想想</button>
                  <button type="button" class="btn-confirm" :disabled="starting" @click="confirmStartTest">
                    {{ starting ? '正在开始...' : '确认开始' }}
                  </button>
                </div>
              </div>
            </div>
          </Teleport>
        </div>

        <!-- 已参与未交卷：考试内容 + 交卷 -->
        <div v-else-if="!attempt.submitted_at" class="attempt-section">
          <div class="tabs">
            <button class="tab" :class="{ active: tab === 'content' }" @click="tab = 'content'">考试内容</button>
          </div>
          <div v-show="tab === 'content'" class="tab-panel">
            <section v-if="test.exams && test.exams.length" class="section">
              <h3>客观题</h3>
              <div class="link-list">
                <div v-for="e in test.exams" :key="e.exam_id" class="link-row">
                  <a href="#" class="link-item" @click.prevent="goToExam(e.exam_id)">
                    {{ e.name || '客观题 ' + e.exam_id }}
                  </a>
                  <span :class="['submit-tag', e.exam_submitted ? 'submitted' : 'not-submitted']">
                    {{ e.exam_submitted ? '已提交' : '未提交' }}
                  </span>
                </div>
              </div>
            </section>
            <section v-if="test.oj_problems && test.oj_problems.length" class="section">
              <h3>编程题</h3>
              <div class="link-list">
                <div v-for="p in test.oj_problems" :key="p.problem_id" class="link-row">
                  <a href="#" class="link-item" @click.prevent="goToOj(p.problem_id)">
                    {{ p.title || '编程题 ' + p.problem_id }}
                  </a>
                  <span v-if="p.score_obtained != null" class="score-tag">{{ p.score_obtained }}分/{{ p.score_weight }}分</span>
                  <span v-else class="submit-tag not-submitted">未提交</span>
                </div>
              </div>
            </section>
            <div class="submit-section">
              <div class="exam-notice exam-notice-submit">
                <p class="notice-title"><Icon name="info" :size="20" /> 交卷前请确认</p>
                <p><strong>交卷后无法修改</strong>，答案将永久提交。请确认所有题目已完成后再交卷。</p>
              </div>
              <button class="btn-primary" :disabled="submitting" @click="submitTest">
                {{ submitting ? '提交中...' : '交卷' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 已交卷：总分 + 排名 + 解析 -->
        <div v-else class="result-section">
          <div class="score-summary">
            <div class="score-main">
              <span class="score-label">总分</span>
              <span class="score-value">{{ formatScore(attempt.total_score) }}</span>
              <span v-if="rankingsTotal > 0 && myRank != null" class="score-rank-badge">当前 {{ rankingsTotal }} 人参与，第 {{ myRank }} 名/{{ rankingsTotal }}</span>
              <span v-else-if="rankingsLoading" class="score-rank-loading">加载排名中...</span>
            </div>
            <div class="score-breakdown">
              <span class="score-item"><span class="score-item-label">客观题</span><span class="score-item-value">{{ formatScore(attempt.exam_score) }}</span></span>
              <span class="score-item"><span class="score-item-label">编程题</span><span class="score-item-value">{{ formatScore(attempt.oj_score) }}</span></span>
            </div>
          </div>
          <div class="tabs result-tabs">
            <button class="tab" :class="{ active: tab === 'rankings' }" @click="tab = 'rankings'">排名</button>
            <button class="tab" :class="{ active: tab === 'review' }" @click="tab = 'review'">我的解析</button>
          </div>
          <div v-show="tab === 'rankings'" class="tab-panel rankings-panel">
            <div v-if="rankingsLoading" class="loading-state">加载排名中...</div>
            <p v-else-if="rankingsError" class="rankings-message error">{{ rankingsError }}</p>
            <div v-else class="rankings-list">
              <p v-if="rankings.length > 0" class="rankings-summary">共 {{ rankingsTotal }} 人交卷</p>
              <div v-for="(r, i) in rankings" :key="r.user_id" class="rank-row">
                <span class="rank-num" :class="getRankRowClass(r.rank)">{{ r.rank }}</span>
                <span class="rank-name">{{ r.real_name || r.username }}</span>
                <span class="rank-score">{{ formatScore(r.total_score) }}</span>
              </div>
              <p v-if="rankings.length === 0" class="rankings-message">您已交卷。当前暂无其他参与者排名。</p>
            </div>
          </div>
          <div v-show="tab === 'review'" class="tab-panel review-guide-panel">
            <div class="review-guide-intro">
              <p class="review-guide-title">去哪里查看提交的题目和解析？</p>
              <p class="review-guide-desc">请到<strong>计划页</strong>右侧点击<strong>「我的提交」</strong>，在编程题列表中每道题旁有<strong>「视频解析」「文字解析」</strong>按钮；客观题提交与分数也在同一页的「客观题」标签下。</p>
              <router-link to="/plan/submissions" class="btn-primary review-guide-btn">去 我的提交</router-link>
            </div>
            <div class="review-guide-images">
              <div class="review-guide-step">
                <span class="review-guide-step-label">① 计划页右侧点击「我的提交」</span>
                <img src="/guide/review-guide-1.png" alt="计划页右侧我的提交入口" class="review-guide-img" />
              </div>
              <div class="review-guide-step">
                <span class="review-guide-step-label">② 编程题：每道题旁有「视频解析」「文字解析」</span>
                <img src="/guide/review-guide-2.png" alt="我的提交编程题与解析按钮" class="review-guide-img" />
              </div>
              <div class="review-guide-step">
                <span class="review-guide-step-label">③ 客观题：可查看各次考试提交与得分</span>
                <img src="/guide/review-guide-3.png" alt="我的提交客观题列表" class="review-guide-img" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>

      <!-- 右侧占位，与 /plan 页面布局保持一致 -->
      <div class="sidebar-placeholder-right"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, watch, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { BASE_URL } from '@/config/api'
import Icon from '@/components/Icon.vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import katex from 'katex'

const route = useRoute()
const router = useRouter()
const testId = computed(() => route.params.testId as string)

const test = ref<any>(null)
const attempt = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const starting = ref(false)
const submitting = ref(false)
const tab = ref('content')
const rankings = ref<any[]>([])
const rankingsLoading = ref(false)
const rankingsError = ref<string | null>(null)
const rankingsTotal = ref(0)
const myRank = computed(() => {
  const uid = getUserId()
  if (!uid || !rankings.value.length) return null
  const r = rankings.value.find((x: any) => x.user_id === uid)
  return r?.rank ?? null
})
const review = ref<any>(null)
const reviewLoading = ref(false)
const remainingSeconds = ref(0)
const showStartConfirm = ref(false)
let remainingInterval: ReturnType<typeof setInterval> | null = null

function getUserId(): number | null {
  try {
    const s = localStorage.getItem('userInfo')
    if (!s) return null
    const u = JSON.parse(s)
    return u?.id ?? null
  } catch {
    return null
  }
}

function formatTime (v: string | null) {
  if (!v) return '-'
  return new Date(v).toLocaleString('zh-CN')
}

function formatScore (v: number | null | undefined): string {
  if (v == null) return '0'
  const n = Number(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// 渲染数学公式（与 SmartOJ / 题目解析 MD 一致）
function renderMath (mathText: string, displayMode: boolean = false): string {
  try {
    const cleanMathText = mathText.trim()
    return katex.renderToString(cleanMathText, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: false,
      macros: { '\\f': '#1f(#2)' }
    })
  } catch (err) {
    console.warn('KaTeX 渲染失败:', err, '公式:', mathText)
    return `<span class="math-error">${mathText}</span>`
  }
}

// 题目解析 Markdown 渲染（与 smartoj 题目页一致，支持公式与代码块）
function renderMarkdown (text: string): string {
  if (!text) return ''
  try {
    let processed = text
    const mathStore: Array<{ placeholder: string; html: string; original: string }> = []
    let mathIndex = 0
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
      if (match.includes('__MATH_')) return match
      const placeholder = `__MATH_BLOCK_${mathIndex}__`
      mathStore.push({ placeholder, html: `<div class="math-block">${renderMath(content, true)}</div>`, original: match })
      mathIndex++
      return placeholder
    })
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      if (match.includes('__MATH_')) return match
      const trimmed = content.trim()
      if (!trimmed) return match
      const placeholder = `__MATH_INLINE_${mathIndex}__`
      mathStore.push({ placeholder, html: `<span class="math-inline">${renderMath(trimmed, false)}</span>`, original: match })
      mathIndex++
      return placeholder
    })
    const codeBlockStore: Array<{ placeholder: string; html: string }> = []
    let codeBlockIndex = 0
    processed = processed.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`
      let html: string
      if (lang && hljs.getLanguage(lang)) {
        try {
          html = `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch {
          html = `<pre><code>${code.trim()}</code></pre>`
        }
      } else {
        html = `<pre><code>${code.trim()}</code></pre>`
      }
      codeBlockStore.push({ placeholder, html })
      codeBlockIndex++
      return placeholder
    })
    let result = processed
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
    codeBlockStore.forEach(({ placeholder, html }) => {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), html)
    })
    mathStore.forEach(({ placeholder, html }) => {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), html)
    })
    return result
  } catch (err) {
    console.error('Markdown 渲染失败:', err)
    return `<p class="render-error">渲染失败</p>`
  }
}

function getRankRowClass (rank: number): string {
  if (rank === 1) return 'rank-first'
  if (rank === 2) return 'rank-second'
  if (rank === 3) return 'rank-third'
  return ''
}

const remainingText = computed(() => {
  const s = remainingSeconds.value
  if (s <= 0) return '0 分钟'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m} 分 ${sec} 秒`
})

const testStatus = computed(() => {
  if (attempt.value?.submitted_at) {
    return { text: '已完成', class: 'status-finished' }
  }
  if (attempt.value) {
    return { text: '进行中', class: 'status-running' }
  }
  return { text: '未开始', class: 'status-not-started' }
})

function examLink (examId: number) {
  const aid = attempt.value?.id
  const tid = testId.value
  if (!aid || !tid) return `/exam/${examId}`
  return `/exam/${examId}?testAttemptId=${aid}&testId=${tid}`
}

function ojLink (problemId: number) {
  const aid = attempt.value?.id
  const tid = testId.value
  if (!aid || !tid) return `/smartoj/${problemId}`
  return `/smartoj/${problemId}?testAttemptId=${aid}&testId=${tid}`
}

function goToExam (examId: number) {
  router.push(examLink(examId))
}

function goToOj (problemId: number) {
  router.push(ojLink(problemId))
}

function backToTests () {
  router.push('/plan/tests')
}

async function load () {
  const uid = getUserId()
  if (!uid) {
    error.value = '请先登录'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const [detailRes, attemptRes] = await Promise.all([
      fetch(`${BASE_URL}/tests/${testId.value}?user_id=${uid}`),
      fetch(`${BASE_URL}/tests/${testId.value}/attempt?user_id=${uid}`)
    ])
    if (detailRes.status === 403) {
      const attemptData = await attemptRes.json().catch(() => ({}))
      if (attemptData.has_attempt && attemptData.attempt_id != null) {
        attempt.value = { ...attemptData, id: attemptData.attempt_id }
      } else {
        attempt.value = attemptData.has_attempt ? attemptData : null
      }
      const listRes = await fetch(`${BASE_URL}/tests?user_id=${uid}`)
      const listData = await listRes.json()
      const t = listData.list?.find((x: any) => x.id === parseInt(testId.value, 10))
      if (t) test.value = { ...t, exams: [], oj_problems: [] }
      else test.value = { id: testId.value, name: '测试' }
      loading.value = false
      return
    }
    if (!detailRes.ok) {
      error.value = '无法加载考试信息'
      loading.value = false
      return
    }
    test.value = await detailRes.json()
    const attemptData = await attemptRes.json()
    if (attemptData.has_attempt && attemptData.attempt_id != null) {
      attempt.value = { ...attemptData, id: attemptData.attempt_id }
    } else {
      attempt.value = attemptData.has_attempt ? attemptData : null
    }
    if (attempt.value && !attempt.value.submitted_at && attempt.value.remaining_seconds != null) {
      remainingSeconds.value = attempt.value.remaining_seconds
      if (remainingInterval) clearInterval(remainingInterval)
      remainingInterval = setInterval(() => {
        if (remainingSeconds.value > 0) remainingSeconds.value--
      }, 1000)
    }
    if (attempt.value?.submitted_at) await fetchRankings()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function startTest () {
  const uid = getUserId()
  if (!uid) return
  starting.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/${testId.value}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid })
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error || '开始失败'
      return
    }
    await load()
  } finally {
    starting.value = false
  }
}

async function confirmStartTest () {
  showStartConfirm.value = false
  await startTest()
}

async function submitTest () {
  const uid = getUserId()
  if (!attempt.value?.id || !uid) return
  submitting.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/attempts/${attempt.value.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid })
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.error || '交卷失败'
      error.value = msg
      alert(msg)
      return
    }
    await load()
    tab.value = 'rankings'
  } catch (e) {
    const msg = e instanceof Error ? e.message : '交卷请求异常'
    alert(msg)
  } finally {
    submitting.value = false
  }
}

async function fetchRankings () {
  const uid = getUserId()
  if (!uid) return
  rankingsError.value = null
  rankingsLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/${testId.value}/rankings?user_id=${uid}`)
    const data = await res.json()
    if (!res.ok) {
      rankingsError.value = data.error || '仅已交卷可查看排名'
      rankings.value = []
      rankingsTotal.value = 0
      return
    }
    rankings.value = data.list || []
    rankingsTotal.value = data.total ?? rankings.value.length
  } catch (e) {
    rankingsError.value = '加载排名失败'
    rankings.value = []
    rankingsTotal.value = 0
  } finally {
    rankingsLoading.value = false
  }
}

async function fetchReview () {
  if (!attempt.value?.id) return
  const uid = getUserId()
  if (!uid) return
  reviewLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/attempts/${attempt.value.id}/review?user_id=${uid}`)
    const data = await res.json()
    review.value = data
  } finally {
    reviewLoading.value = false
  }
}

watch(tab, (t) => {
  if (t === 'rankings' && attempt.value?.submitted_at) fetchRankings()
  /* 我的解析 仅展示引导图，不再请求解析接口 */
})

onBeforeRouteLeave((to, from, next) => {
  if (!attempt.value || attempt.value.submitted_at) {
    next()
    return
  }
  const stayInTestFlow = to.path.startsWith('/exam/') || to.path.startsWith('/smartoj/')
  if (stayInTestFlow) {
    next()
    return
  }
  if (!window.confirm('一旦退出，将失去答卷机会。确定离开将自动交卷。是否离开？')) {
    next(false)
    return
  }
  submitting.value = true
  const uid = getUserId()
  if (!uid) {
    submitting.value = false
    next()
    return
  }
  fetch(`${BASE_URL}/tests/attempts/${attempt.value.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: uid })
  })
    .then(res => res.json())
    .then(() => { next() })
    .catch(() => { next() })
    .finally(() => { submitting.value = false })
})

function scrollToTop() {
  nextTick(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  })
}

onMounted(() => {
  load()
  scrollToTop()
  window.addEventListener('focus', onFocusRefetch)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onActivated(() => {
  scrollToTop()
})
onUnmounted(() => {
  window.removeEventListener('focus', onFocusRefetch)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

function onBeforeUnload (e: BeforeUnloadEvent) {
  if (attempt.value && !attempt.value.submitted_at) {
    e.preventDefault()
    e.returnValue = '一旦退出将失去答卷机会，确定离开将自动交卷。是否离开？'
  }
}

function onFocusRefetch () {
  if (testId.value && attempt.value && !attempt.value.submitted_at) load()
}

watch(testId, () => load())
</script>

<style scoped>
.exam-layout {
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  font-family:
    'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial,
    sans-serif;
}

.exam-content-flex-row {
  display: flex;
  flex-direction: row;
  gap: 32px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px 40px 20px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: center;
}

.sidebar-placeholder-left {
  width: 50px;
  flex-shrink: 0;
}

.sidebar-placeholder-right {
  width: 50px;
  flex-shrink: 0;
}

.test-detail-layout {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 24px;
  box-sizing: border-box;
}

.test-detail-card {
  width: 100%;
  max-width: 1080px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 20px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
  padding: 24px 28px 28px;
  border: 2px solid #e0f2fe;
  backdrop-filter: blur(12px);
}
.loading-state,
.error-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 4px solid #e2e8f0;
  border-top-color: #38bdf8;
  animation: spin 0.9s linear infinite;
}
.error-text {
  color: #dc2626;
  font-weight: 500;
}
.retry-btn {
  margin-top: 4px;
  padding: 8px 18px;
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid #0ea5e9;
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: #ffffff;
  font-size: 0.9rem;
}
.retry-btn:hover {
  opacity: 0.9;
}
.test-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}
.test-header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}
.test-title-block {
  flex: 1;
  min-width: 0;
}
.test-title {
  font-size: 1.6rem;
  margin: 0 0 6px 0;
  color: #0f172a;
  font-weight: 700;
}
.test-desc {
  color: #64748b;
  margin: 0;
  font-size: 0.95rem;
}
.test-status-pill {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  white-space: nowrap;
}
.test-status-pill.status-finished {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #ecfdf3;
}
.test-status-pill.status-running {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: #fff7ed;
}
.test-status-pill.status-not-started {
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  color: #0f172a;
}
.test-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  color: #64748b;
  flex-wrap: wrap;
}
.meta-left {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
}
.meta-item {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}
.meta-label {
  font-size: 0.78rem;
  color: #94a3b8;
}
.meta-value {
  font-size: 0.9rem;
  color: #0f172a;
  font-weight: 500;
}
.meta-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.remaining-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.12);
  color: #92400e;
  font-size: 0.85rem;
  border: 1px solid rgba(234, 179, 8, 0.5);
}
.submitted-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.08);
  color: #166534;
  font-size: 0.85rem;
  border: 1px solid rgba(34, 197, 94, 0.5);
}
.action-section { margin: 24px 0; }

.exam-notice {
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  color: #92400e;
}
.exam-notice-submit {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1e40af;
}
.exam-notice .notice-title {
  margin: 0 0 10px 0;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.exam-notice ul {
  margin: 0;
  padding-left: 20px;
  font-size: 0.95rem;
  line-height: 1.7;
}
.exam-notice p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.btn-primary {
  padding: 12px 24px;
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(56, 189, 248, 0.4);
  transition: all 0.2s ease;
}
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-primary:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(56, 189, 248, 0.5);
}
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab { padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; }
.tab.active { background: #1e90ff; color: #fff; border-color: #1e90ff; }
.tab-panel { margin-top: 12px; }
.section { margin-bottom: 20px; }
.section h3 { font-size: 1.1rem; margin-bottom: 8px; }
.link-list { display: flex; flex-direction: column; gap: 8px; }
.link-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.link-item { color: #1e90ff; text-decoration: none; flex: 1; min-width: 0; cursor: pointer; }
.link-item:hover { text-decoration: underline; }
.submit-tag { font-size: 0.85rem; flex-shrink: 0; }
.submit-tag.submitted { color: #16a34a; }
.submit-tag.not-submitted { color: #94a3b8; }
.score-tag { font-size: 0.9rem; color: #1e293b; font-weight: 500; flex-shrink: 0; }
.submit-section { margin-top: 24px; }

.score-summary {
  margin-bottom: 24px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
}
.score-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.score-label { font-size: 0.9rem; color: #64748b; }
.score-value { font-size: 1.75rem; font-weight: 700; color: #0ea5e9; }
.score-rank-badge {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0c4a6e;
  margin-top: 6px;
}
.score-rank-loading {
  font-size: 0.9rem;
  color: #64748b;
  margin-top: 6px;
}
.score-breakdown {
  display: flex;
  gap: 24px;
  align-items: center;
}
.score-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.score-item-label { font-size: 0.85rem; color: #64748b; }
.score-item-value { font-size: 1.1rem; font-weight: 600; color: #0f172a; }

.result-tabs { margin-bottom: 16px; }
.result-tabs .tab {
  padding: 10px 20px;
  font-size: 1rem;
  border-radius: 10px;
}
.rankings-panel { padding-top: 8px; }
.rankings-summary { margin: 0 0 12px 0; font-size: 0.9rem; color: #64748b; }
.rankings-list { display: flex; flex-direction: column; gap: 6px; }
.rankings-message { margin: 16px 0; color: #64748b; font-size: 0.95rem; }
.rankings-message.error { color: #dc2626; }
.rank-row {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.rank-num {
  font-weight: 700;
  width: 44px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 1rem;
}
.rank-num.rank-first { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; }
.rank-num.rank-second { background: linear-gradient(135deg, #e2e8f0, #cbd5e1); color: #475569; }
.rank-num.rank-third { background: linear-gradient(135deg, #fed7aa, #fdba74); color: #9a3412; }
.rank-name { flex: 1; font-weight: 500; color: #0f172a; }
.rank-score { font-weight: 600; color: #0ea5e9; font-size: 1.05rem; }
.review-section { margin-bottom: 24px; }
.review-section h4 { margin-bottom: 12px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #0f172a; }
.section-score { font-size: 0.9rem; font-weight: normal; color: #64748b; }
.question-review-card { margin: 12px 0; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
.question-review-title { font-weight: 600; color: #475569; margin-bottom: 8px; font-size: 0.9rem; }
.question-text { margin: 0 0 12px 0; color: #1e293b; line-height: 1.5; }
.answer-row { margin: 6px 0; font-size: 0.95rem; }
.answer-row .label { color: #64748b; margin-right: 6px; }
.answer-row .value.correct { color: #16a34a; font-weight: 600; }
.answer-row .value.incorrect { color: #dc2626; font-weight: 600; }
.explanation-block { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.explanation-title { font-weight: 600; color: #475569; margin-bottom: 6px; font-size: 0.9rem; }
.explanation-text { margin: 0; color: #555; font-size: 0.95rem; line-height: 1.5; }
.oj-analysis-block { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.oj-analysis-title { font-weight: 600; color: #0f172a; margin-bottom: 6px; font-size: 0.9rem; }
.oj-analysis-text { margin: 0; color: #111827; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; }
.oj-analysis-text.markdown-content { white-space: normal; line-height: 1.8; word-wrap: break-word; overflow-wrap: break-word; }
.oj-analysis-text.markdown-content strong, .oj-analysis-text.markdown-content b { color: #1e293b; font-weight: 700; }
.oj-analysis-text.markdown-content em, .oj-analysis-text.markdown-content i { font-style: italic; color: #475569; }
.oj-analysis-text.markdown-content code { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #dc2626; padding: 3px 8px; border-radius: 6px; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.9em; font-weight: 600; border: 1px solid #cbd5e1; }
.oj-analysis-text.markdown-content pre { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 12px 0; overflow-x: auto; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.9em; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
.oj-analysis-text.markdown-content pre code { background: none; color: #374151; padding: 0; border: none; font-weight: normal; display: block; }
.oj-analysis-text.markdown-content .math-inline { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 2px 6px; border-radius: 4px; border: 1px solid #bae6fd; display: inline-block; margin: 0 2px; }
.oj-analysis-text.markdown-content .math-block { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px; border-radius: 8px; border: 2px solid #e2e8f0; text-align: center; margin: 12px 0; }
.oj-analysis-text.markdown-content .math-error { background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecaca; font-family: monospace; }
.oj-analysis-text.markdown-content .render-error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; border: 1px solid #fecaca; }
.oj-analysis-text.markdown-content .hljs { background: transparent; color: #374151; }
.btn-video-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 8px 16px; background: linear-gradient(135deg, #1e90ff, #38bdf8); color: #fff; border-radius: 8px; text-decoration: none; font-size: 0.95rem; }
.btn-video-link:hover { opacity: 0.9; }
.btn-video-icon { font-size: 0.85rem; }
.no-video-hint { margin: 8px 0 0 0; font-size: 0.9rem; color: #94a3b8; }

/* 我的解析：引导去「我的提交」查看题目与解析 */
.review-guide-panel { padding: 20px 0; }
.review-guide-intro {
  margin-bottom: 28px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 2px solid #bae6fd;
  border-radius: 16px;
}
.review-guide-title {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #0c4a6e;
}
.review-guide-desc {
  margin: 0 0 20px 0;
  font-size: 1rem;
  line-height: 1.7;
  color: #075985;
}
.review-guide-btn {
  display: inline-block;
  padding: 12px 24px;
  background: linear-gradient(135deg, #1e90ff, #0ea5e9);
  color: #fff;
  border-radius: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: opacity 0.2s;
}
.review-guide-btn:hover { opacity: 0.9; }
.review-guide-images { display: flex; flex-direction: column; gap: 24px; }
.review-guide-step { display: flex; flex-direction: column; gap: 10px; }
.review-guide-step-label {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
}
.review-guide-img {
  max-width: 100%;
  width: 100%;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 开始考试确认弹窗 */
.start-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.start-confirm-dialog {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  padding: 24px 28px;
  max-width: 420px;
  width: 100%;
  border: 1px solid #e2e8f0;
}
.start-confirm-title {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}
.start-confirm-desc {
  margin: 0 0 16px 0;
  font-size: 0.95rem;
  color: #475569;
  line-height: 1.6;
}
.start-confirm-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 0.9rem;
  color: #64748b;
}
.start-confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.start-confirm-actions .btn-cancel {
  padding: 10px 20px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #64748b;
  border-radius: 10px;
  font-size: 0.95rem;
  cursor: pointer;
}
.start-confirm-actions .btn-cancel:hover {
  background: #f1f5f9;
  color: #475569;
}
.start-confirm-actions .btn-confirm {
  padding: 10px 24px;
  border: none;
  background: linear-gradient(135deg, #1e90ff, #0ea5e9);
  color: #fff;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.start-confirm-actions .btn-confirm:hover:not(:disabled) {
  opacity: 0.95;
}
.start-confirm-actions .btn-confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.back-nav-arrow {
  position: fixed;
  left: 20px;
  top: 80px;
  background: rgba(30, 144, 255, 0.15);
  backdrop-filter: blur(10px);
  color: #1e90ff;
  border: 2px solid rgba(30, 144, 255, 0.3);
  border-radius: 12px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
  z-index: 100;
}

.back-nav-arrow:hover {
  background: rgba(30, 144, 255, 0.2);
  border-color: rgba(30, 144, 255, 0.5);
  color: #0c7cd5;
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.back-nav-arrow:active {
  transform: scale(0.95);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .exam-content-flex-row {
    gap: 16px;
    padding: 0 12px 24px 12px;
  }
  .sidebar-placeholder-left {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
  .sidebar-placeholder-right {
    width: 160px;
    min-width: 160px;
    max-width: 160px;
  }
}

@media (max-width: 768px) {
  .exam-content-flex-row {
    flex-direction: column;
    gap: 12px;
    padding: 0 10px 20px 10px;
  }
  .sidebar-placeholder-left,
  .sidebar-placeholder-right {
    display: none;
  }
  .test-detail-layout {
    padding-top: 16px;
  }
  .test-detail-card {
    padding: 18px 16px 20px;
    border-radius: 16px;
  }
  .test-header-main {
    flex-direction: column;
    align-items: flex-start;
  }
  .test-meta {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
