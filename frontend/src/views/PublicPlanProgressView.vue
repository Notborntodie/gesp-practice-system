<template>
  <div class="public-result-page">
    <div class="public-result-card">
      <div v-if="configLoading" class="state">加载中...</div>
      <div v-else-if="!config?.allow_query" class="state">
        <p>{{ config?.reason === 'NOT_ENABLED' ? '该计划暂未开放成长进度查询' : '链接无效或已关闭' }}</p>
      </div>
      <div v-else class="content">
        <h1 class="test-title">{{ config.plan_name }}</h1>
        <p v-if="config.description" class="test-desc">{{ config.description }}</p>

        <div v-if="!result && !queryLoading" class="form-section">
          <div class="form-group">
            <label>姓名</label>
            <input v-model="form.name" type="text" placeholder="请输入姓名或用户名" />
          </div>
          <button class="submit-btn" :disabled="queryLoading || !form.name.trim()" @click="query">
            {{ queryLoading ? '查询中...' : '查看成长计划进度' }}
          </button>
        </div>

        <div v-else-if="queryLoading" class="state">查询中...</div>
        <div v-else-if="result?.found" class="result-section">
          <p class="result-name">{{ result.name }}</p>
          <p class="result-plan">{{ result.plan_name }}</p>
          <div class="progress-block">
            <p class="result-score">已完成 <strong>{{ result.completed_tasks }}</strong> / {{ result.total_tasks }} 个任务</p>
            <div class="progress-bar-wrap">
              <div class="progress-bar" :style="{ width: `${result.progress || 0}%` }"></div>
            </div>
            <p class="result-percent">{{ result.progress || 0 }}%</p>
          </div>

          <div v-if="result.tasks?.length" class="task-detail-list">
            <div v-for="task in result.tasks" :key="task.id" class="task-detail-card">
              <div class="task-detail-header">
                <div class="task-title-group">
                  <span class="task-order">任务 {{ task.task_order ?? '-' }}</span>
                  <h2 class="task-title">{{ task.name }}</h2>
                </div>
                <span class="task-status" :class="{ completed: task.is_completed }">
                  {{ task.is_completed ? '已完成' : '进行中' }}
                </span>
              </div>

              <p v-if="task.description" class="task-desc">{{ task.description }}</p>

              <div class="task-metrics">
                <div class="task-metric">
                  <span class="metric-label">客观题</span>
                  <strong>{{ task.exam_progress?.completed || 0 }}/{{ task.exam_progress?.total || 0 }}</strong>
                </div>
                <div class="task-metric">
                  <span class="metric-label">编程题</span>
                  <strong>{{ task.oj_progress?.completed || 0 }}/{{ task.oj_progress?.total || 0 }}</strong>
                </div>
              </div>

              <div v-if="task.exam_progress?.exams?.length" class="exercise-section">
                <h3 class="exercise-title">客观题分数</h3>
                <div class="exercise-list">
                  <div v-for="exam in task.exam_progress.exams" :key="`exam-${task.id}-${exam.id}`" class="exercise-row">
                    <div class="exercise-main">
                      <span class="exercise-name">{{ exam.name }}</span>
                      <span class="exercise-meta">尝试 {{ exam.attempt_count || 0 }} 次</span>
                    </div>
                    <div class="exercise-score">
                      <span class="score-value">{{ formatScore(exam.best_score) }}分</span>
                      <span class="score-status" :class="{ completed: exam.is_completed }">
                        {{ exam.is_completed ? '完成' : '未完成' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="task.oj_progress?.problems?.length" class="exercise-section">
                <h3 class="exercise-title">编程题分数</h3>
                <div class="exercise-list">
                  <div v-for="problem in task.oj_progress.problems" :key="`oj-${task.id}-${problem.id}`" class="exercise-row">
                    <div class="exercise-main">
                      <span class="exercise-name">{{ problem.title }}</span>
                      <span class="exercise-meta">尝试 {{ problem.attempt_count || 0 }} 次</span>
                    </div>
                    <div class="exercise-score">
                      <span v-if="!problem.is_completed" class="score-value">{{ formatScore(problem.score ?? problem.best_pass_rate) }}分</span>
                      <span class="score-status" :class="{ completed: problem.is_completed }">
                        {{ problem.is_completed ? '完成' : '未完成' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!task.exam_progress?.exams?.length && !task.oj_progress?.problems?.length" class="empty-exercises">
                该任务暂无题目
              </div>
            </div>
          </div>

          <button class="again-btn" @click="result = null">再查一次</button>
        </div>
        <div v-else class="state">
          <p>{{ queryError || '未查到该姓名/用户名在本计划中的进度，请确认输入与是否已加入该计划' }}</p>
          <button class="again-btn" @click="result = null; queryError = null">重新输入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { BASE_URL } from '@/config/api'

const route = useRoute()
const token = ref(route.params.token as string)

const config = ref<{ allow_query: boolean; plan_name?: string; description?: string; reason?: string } | null>(null)
const configLoading = ref(true)
const form = ref({ name: '' })

interface PublicPlanExercise {
  id: number
  name?: string
  title?: string
  is_completed?: boolean
  best_score?: number
  best_pass_rate?: number
  score?: number
  best_verdict?: string | null
  attempt_count?: number
}

interface PublicPlanTask {
  id: number
  name: string
  description?: string | null
  task_order?: number
  is_completed?: boolean
  exam_progress?: {
    total: number
    completed: number
    progress_rate?: number
    exams: PublicPlanExercise[]
  }
  oj_progress?: {
    total: number
    completed: number
    progress_rate?: number
    problems: PublicPlanExercise[]
  }
}

const result = ref<{
  found: boolean
  name?: string
  plan_name?: string
  completed_tasks?: number
  total_tasks?: number
  progress?: number
  tasks?: PublicPlanTask[]
} | null>(null)
const queryLoading = ref(false)
const queryError = ref<string | null>(null)

function formatScore (value: unknown): string {
  const score = Number(value)
  if (!Number.isFinite(score)) return '0'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

async function loadConfig () {
  configLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/public-plans/${token.value}/config`)
    config.value = await res.json()
  } catch {
    config.value = null
  } finally {
    configLoading.value = false
  }
}

async function query () {
  if (!form.value.name.trim()) return
  queryLoading.value = true
  queryError.value = null
  result.value = null
  try {
    const res = await fetch(`${BASE_URL}/public-plans/${token.value}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.value.name.trim() })
    })
    const data = await res.json()
    result.value = data
  } catch {
    queryError.value = '网络错误，请稍后重试'
  } finally {
    queryLoading.value = false
  }
}

onMounted(() => loadConfig())
watch(() => route.params.token, (t) => {
  token.value = t as string
  loadConfig()
  result.value = null
  form.value = { name: '' }
})
</script>

<style scoped>
/* PC 与移动端共用：安全区、触控友好；缩小浏览器时避免横向溢出 */
.public-result-page {
  min-height: 100vh;
  min-height: calc(100vh - env(safe-area-inset-bottom, 0px));
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
  padding: 24px;
  padding-left: max(24px, env(safe-area-inset-left));
  padding-right: max(24px, env(safe-area-inset-right));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  background: linear-gradient(135deg, #e0f2fe 0%, #f8fafc 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  box-sizing: border-box;
}
.public-result-card {
  width: 100%;
  min-width: 0;
  max-width: 760px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 24px;
  box-sizing: border-box;
}
.state {
  text-align: center;
  padding: 32px 0;
  color: #64748b;
}
.test-title {
  font-size: 1.35rem;
  margin: 0 0 8px 0;
  text-align: center;
  word-break: break-word;
}
.test-desc {
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 24px 0;
  word-break: break-word;
}
.form-section {
  margin-top: 16px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
  color: #475569;
}
.form-group input {
  width: 100%;
  padding: 12px 14px;
  min-height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
}
.submit-btn {
  width: 100%;
  padding: 14px 16px;
  min-height: 48px;
  margin-top: 8px;
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.result-section {
  text-align: left;
  padding: 24px 0;
}
.result-name { font-size: 1.1rem; margin: 0 0 8px 0; word-break: break-word; text-align: center; }
.result-plan { color: #64748b; font-size: 0.95rem; margin: 0 0 16px 0; word-break: break-word; text-align: center; }
.progress-block { margin: 16px 0 20px 0; }
.result-score { font-size: 1.25rem; margin: 0 0 12px 0; text-align: center; }
.progress-bar-wrap {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  border-radius: 6px;
  transition: width 0.3s ease;
}
.result-percent { font-size: 1.1rem; font-weight: 600; color: #0ea5e9; margin: 0; text-align: center; }
.task-detail-list {
  display: grid;
  gap: 14px;
  margin: 22px 0;
}
.task-detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #f8fafc;
}
.task-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.task-title-group {
  min-width: 0;
}
.task-order {
  display: block;
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.task-title {
  color: #0f172a;
  font-size: 1rem;
  line-height: 1.35;
  margin: 0;
  word-break: break-word;
}
.task-status {
  flex: 0 0 auto;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 5px 9px;
}
.task-status.completed {
  background: #dcfce7;
  color: #166534;
}
.task-desc {
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 10px 0 0;
  word-break: break-word;
}
.task-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.task-metric {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.metric-label {
  display: block;
  color: #64748b;
  font-size: 0.78rem;
  margin-bottom: 4px;
}
.task-metric strong {
  color: #0f172a;
  font-size: 1.05rem;
}
.exercise-section {
  margin-top: 16px;
}
.exercise-title {
  color: #0f172a;
  font-size: 0.92rem;
  margin: 0 0 8px;
}
.exercise-list {
  display: grid;
  gap: 8px;
}
.exercise-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.exercise-main {
  min-width: 0;
}
.exercise-name {
  display: block;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}
.exercise-meta {
  display: block;
  color: #64748b;
  font-size: 0.78rem;
  margin-top: 3px;
}
.exercise-score {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.score-value {
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 800;
}
.score-status {
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 8px;
}
.score-status.completed {
  background: #dbeafe;
  color: #1d4ed8;
}
.empty-exercises {
  color: #64748b;
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  font-size: 0.88rem;
  margin-top: 14px;
  padding: 12px;
  text-align: center;
}
.again-btn {
  padding: 12px 24px;
  min-height: 44px;
  background: #e2e8f0;
  color: #475569;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  -webkit-tap-highlight-color: transparent;
  display: block;
  margin: 0 auto;
}

/* 中等窄屏（缩小浏览器）：留白缩小，避免挤压 */
@media (max-width: 900px) {
  .public-result-page {
    padding: 20px;
    padding-left: max(20px, env(safe-area-inset-left));
    padding-right: max(20px, env(safe-area-inset-right));
  }
  .public-result-card {
    padding: 22px 20px;
  }
}

/* 移动端：更紧凑留白、更大触控区 */
@media (max-width: 600px) {
  .public-result-page {
    padding: 16px;
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    align-items: flex-start;
    padding-top: max(16px, env(safe-area-inset-top));
  }
  .public-result-card {
    padding: 20px 18px;
    border-radius: 12px;
  }
  .test-title {
    font-size: 1.25rem;
  }
  .form-group input {
    min-height: 48px;
    font-size: 16px;
  }
  .submit-btn {
    min-height: 48px;
    font-size: 1rem;
  }
  .again-btn {
    min-height: 48px;
    padding: 14px 28px;
  }
  .progress-bar-wrap {
    height: 14px;
  }
  .task-detail-card {
    padding: 14px;
  }
  .task-detail-header {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }
  .task-status {
    align-self: flex-start;
  }
  .task-metrics {
    grid-template-columns: 1fr;
  }
  .exercise-row {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .exercise-score {
    justify-content: space-between;
    width: 100%;
  }
}
</style>
