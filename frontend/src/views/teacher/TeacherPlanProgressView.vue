<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import {
  CalendarDays,
  ArrowLeft,
  Filter,
  Users,
  Trophy
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

// 用户信息
const userInfo = ref<any>(null)

// 计划列表
const plans = ref<any[]>([])
const loading = ref(false)
const selectedLevel = ref('')
const aggregationMode = ref<'plan' | 'student'>('student')

// 选中计划的任务列表
const selectedPlan = ref<any>(null)
const tasks = ref<any[]>([])
const tasksLoading = ref(false)

// 按学生聚合
const studentPlanRows = ref<any[]>([])
const studentPlanLoading = ref(false)
const selectedStudentPlan = ref<any>(null)
const selectedStudentPlanDetail = ref<any>(null)
const studentPlanDetailLoading = ref(false)

// 筛选后的计划
const filteredPlans = computed(() => {
  if (!selectedLevel.value) return plans.value
  return plans.value.filter(p => p.level === Number(selectedLevel.value))
})

// 获取用户信息
async function fetchUserInfo() {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

// 获取计划列表
async function fetchPlans() {
  loading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/all`, {
      params: { is_active: 1, level: selectedLevel.value || undefined }
    })
    plans.value = res.data.data || res.data || []
  } catch (e) {
    console.error('获取计划列表失败:', e)
  } finally {
    loading.value = false
  }
}

async function fetchStudentPlanProgress() {
  if (!userInfo.value) return
  studentPlanLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/teacher/${userInfo.value.id}/student-plans-progress`, {
      params: { is_active: 1, level: selectedLevel.value || undefined }
    })
    studentPlanRows.value = res.data.data?.students || []
  } catch (e) {
    console.error('获取学生计划完成概览失败:', e)
    studentPlanRows.value = []
  } finally {
    studentPlanLoading.value = false
  }
}

function resetDrilldown() {
  selectedPlan.value = null
  tasks.value = []
  selectedStudentPlan.value = null
  selectedStudentPlanDetail.value = null
}

function handleAggregationModeChange() {
  resetDrilldown()
  if (aggregationMode.value === 'student') {
    fetchStudentPlanProgress()
  } else {
    fetchPlans()
  }
}

function setAggregationMode(mode: 'plan' | 'student') {
  if (aggregationMode.value === mode) return
  aggregationMode.value = mode
  handleAggregationModeChange()
}

async function viewStudentPlanDetail(student: any, plan: any) {
  if (!userInfo.value) return
  selectedStudentPlan.value = { student, plan }
  selectedStudentPlanDetail.value = null
  studentPlanDetailLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/${plan.id}/students/${student.student_id}/progress`, {
      params: { teacher_id: userInfo.value.id }
    })
    selectedStudentPlanDetail.value = res.data.data
  } catch (e) {
    console.error('获取学生计划明细失败:', e)
  } finally {
    studentPlanDetailLoading.value = false
  }
}

function backToStudentList() {
  selectedStudentPlan.value = null
  selectedStudentPlanDetail.value = null
}

// 查看计划任务
async function viewPlanTasks(plan: any) {
  selectedPlan.value = plan
  tasksLoading.value = true
  try {
    // 获取任务列表
    const res = await axios.get(`${BASE_URL}/learning-plans/${plan.id}/tasks`, {
      params: { user_id: userInfo.value?.id }
    })
    tasks.value = res.data.data?.tasks || res.data.tasks || res.data.data || []
  } catch (e) {
    // 尝试备用方法
    try {
      const studentsRes = await axios.get(`${BASE_URL}/learning-plans/${plan.id}/students-progress`, {
        params: { teacher_id: userInfo.value?.id }
      })
      const students = studentsRes.data.data?.students || []
      if (students.length > 0) {
        const progressRes = await axios.get(`${BASE_URL}/learning-plans/${plan.id}/students/${students[0].student_id}/progress`, {
          params: { teacher_id: userInfo.value?.id }
        })
        tasks.value = (progressRes.data.data?.tasks || []).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          is_exam_mode: t.is_exam_mode,
          start_time: t.start_time,
          end_time: t.end_time,
          exam_count: t.exam_progress?.total || 0,
          oj_count: t.oj_progress?.total || 0
        }))
      }
    } catch (e2) {
      console.error('备用方法也失败:', e2)
      tasks.value = []
    }
  } finally {
    tasksLoading.value = false
  }
}

// 查看任务学生完成情况
function viewTaskStudents(planId: number, taskId: number) {
  router.push(`/teacher/plan-progress/${planId}/tasks/${taskId}`)
}

// 返回计划列表
function goBack() {
  selectedPlan.value = null
  tasks.value = []
}

// 状态判定
function getStatusClass(plan: any): string {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'active'
}

function getStatusText(plan: any): string {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  if (now < start) return '未开始'
  if (now > end) return '已结束'
  return '进行中'
}

// 格式化日期
function formatDate(date: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('zh-CN')
}

function isCompleted(value: any): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function formatScore(score: any): string {
  const n = Number(score)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

onMounted(async () => {
  await fetchUserInfo()
  if (aggregationMode.value === 'student') {
    await fetchStudentPlanProgress()
  } else {
    await fetchPlans()
  }
})

watch(selectedLevel, () => {
  if (!userInfo.value) return
  resetDrilldown()
  if (aggregationMode.value === 'student') fetchStudentPlanProgress()
  else fetchPlans()
})
</script>

<template>
  <div class="plan-progress">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <CalendarDays :size="24" class="header-icon" />
        <h1 class="page-title">计划完成概览</h1>
      </div>
      <div class="header-right">
        <div class="aggregation-switch" :class="`mode-${aggregationMode}`" aria-label="聚合方式">
          <span class="switch-slider"></span>
          <button
            type="button"
            class="switch-option"
            :class="{ active: aggregationMode === 'plan' }"
            @click="setAggregationMode('plan')"
          >
            按计划
          </button>
          <button
            type="button"
            class="switch-option"
            :class="{ active: aggregationMode === 'student' }"
            @click="setAggregationMode('student')"
          >
            按学生
          </button>
        </div>
        <div class="level-filter">
          <Filter :size="16" />
          <select v-model="selectedLevel" class="level-select">
            <option value="">全部级别</option>
            <option value="1">GESP 1级</option>
            <option value="2">GESP 2级</option>
            <option value="3">GESP 3级</option>
            <option value="4">GESP 4级</option>
            <option value="5">GESP 5级</option>
            <option value="6">GESP 6级</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 按学生聚合视图 -->
    <div v-if="aggregationMode === 'student'">
      <div v-if="selectedStudentPlan || studentPlanDetailLoading">
        <div class="plan-info">
          <div class="plan-info-header">
            <button class="btn-back" @click="backToStudentList">
              <ArrowLeft :size="16" />
              返回学生列表
            </button>
            <div class="plan-info-title">
              <h2>
                {{ selectedStudentPlan?.student?.real_name || selectedStudentPlan?.student?.username }}
                -
                {{ selectedStudentPlan?.plan?.name }}
              </h2>
              <span class="level-badge">GESP {{ selectedStudentPlan?.plan?.level }}级</span>
            </div>
          </div>
          <div class="plan-info-meta">
            <span>开始: {{ formatDate(selectedStudentPlan?.plan?.start_time) }}</span>
            <span>结束: {{ formatDate(selectedStudentPlan?.plan?.end_time) }}</span>
          </div>
        </div>

        <div v-if="studentPlanDetailLoading" class="loading-state">
          <div class="spinner"></div>
          <span>加载学生计划明细...</span>
        </div>

        <div v-else-if="selectedStudentPlanDetail" class="student-plan-detail">
          <div class="detail-summary">
            <div class="summary-card">
              <span class="summary-label">任务完成</span>
              <strong>{{ selectedStudentPlanDetail.plan_progress?.completed_tasks || 0 }}/{{ selectedStudentPlanDetail.plan_progress?.total_tasks || 0 }}</strong>
            </div>
            <div class="summary-card">
              <span class="summary-label">完成率</span>
              <strong>{{ selectedStudentPlanDetail.plan_progress?.progress_rate || 0 }}%</strong>
            </div>
            <div class="summary-card">
              <span class="summary-label">状态</span>
              <strong>{{ isCompleted(selectedStudentPlanDetail.plan_progress?.is_completed) ? '已完成' : '进行中' }}</strong>
            </div>
          </div>

          <div v-if="selectedStudentPlanDetail.tasks?.length" class="student-task-list">
            <div v-for="task in selectedStudentPlanDetail.tasks" :key="task.id" class="student-task-card">
              <div class="student-task-header">
                <div>
                  <div class="student-task-title">任务 {{ task.task_order ?? '-' }}：{{ task.name }}</div>
                  <div v-if="task.description" class="student-task-desc">{{ task.description }}</div>
                </div>
                <span :class="['status-badge', isCompleted(task.task_progress?.is_completed) ? 'active' : 'ended']">
                  {{ isCompleted(task.task_progress?.is_completed) ? '已完成' : '进行中' }}
                </span>
              </div>

              <div class="task-counts">
                <span>客观题 {{ task.exam_progress?.completed || 0 }}/{{ task.exam_progress?.total || 0 }}</span>
                <span>编程题 {{ task.oj_progress?.completed || 0 }}/{{ task.oj_progress?.total || 0 }}</span>
              </div>

              <div v-if="task.exam_progress?.exams?.length" class="exercise-block">
                <h3>客观题分数</h3>
                <div class="exercise-list">
                  <div v-for="exam in task.exam_progress.exams" :key="`exam-${task.id}-${exam.id}`" class="exercise-row">
                    <div>
                      <div class="exercise-title">{{ exam.name }}</div>
                      <div class="exercise-meta">尝试 {{ exam.attempt_count || 0 }} 次</div>
                    </div>
                    <div class="exercise-result">
                      <strong>{{ formatScore(exam.best_score) }}分</strong>
                      <span :class="['mini-status', isCompleted(exam.is_completed) ? 'done' : 'todo']">
                        {{ isCompleted(exam.is_completed) ? '完成' : '未完成' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="task.oj_progress?.problems?.length" class="exercise-block">
                <h3>编程题完成情况</h3>
                <div class="exercise-list">
                  <div v-for="problem in task.oj_progress.problems" :key="`oj-${task.id}-${problem.id}`" class="exercise-row">
                    <div>
                      <div class="exercise-title">{{ problem.title }}</div>
                      <div class="exercise-meta">尝试 {{ problem.attempt_count || 0 }} 次</div>
                    </div>
                    <div class="exercise-result">
                      <strong v-if="!isCompleted(problem.is_completed)">{{ formatScore(problem.score ?? problem.best_pass_rate) }}分</strong>
                      <span :class="['mini-status', isCompleted(problem.is_completed) ? 'done' : 'todo']">
                        {{ isCompleted(problem.is_completed) ? '完成' : '未完成' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!task.exam_progress?.exams?.length && !task.oj_progress?.problems?.length" class="empty-inline">
                该任务暂无题目
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <p>该学生在此计划下暂无任务明细</p>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="studentPlanLoading" class="loading-state">
          <div class="spinner"></div>
          <span>加载学生计划...</span>
        </div>

        <div v-else-if="studentPlanRows.length === 0" class="empty-state">
          <CalendarDays :size="48" />
          <p>暂无学生计划进度</p>
        </div>

        <div v-else class="plans-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>班级</th>
                <th>学生姓名</th>
                <th>用户名</th>
                <th>所在计划</th>
                <th>计划完成</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in studentPlanRows" :key="student.student_id" class="table-row">
                <td>{{ student.class_no || '—' }}</td>
                <td class="plan-name">{{ student.real_name || student.username }}</td>
                <td class="date">{{ student.username }}</td>
                <td>
                  <div v-if="student.plans?.length" class="student-plan-chips">
                    <button
                      v-for="plan in student.plans"
                      :key="plan.id"
                      class="student-plan-chip"
                      @click="viewStudentPlanDetail(student, plan)"
                    >
                      <span>{{ plan.name }}</span>
                      <strong>{{ plan.plan_progress?.completed_tasks || 0 }}/{{ plan.plan_progress?.total_tasks || 0 }}</strong>
                    </button>
                  </div>
                  <span v-else class="date">暂无计划</span>
                </td>
                <td>
                  <span :class="['status-badge', student.completed_plan_count === student.plan_count && student.plan_count > 0 ? 'active' : 'ended']">
                    {{ student.completed_plan_count || 0 }}/{{ student.plan_count || 0 }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 任务列表视图 -->
    <div v-else-if="selectedPlan">
      <!-- 计划信息 -->
      <div class="plan-info">
        <div class="plan-info-header">
          <button class="btn-back" @click="goBack">
            <ArrowLeft :size="16" />
            返回计划列表
          </button>
          <div class="plan-info-title">
            <h2>{{ selectedPlan.name }}</h2>
            <span class="level-badge">GESP {{ selectedPlan.level }}级</span>
          </div>
        </div>
        <div class="plan-info-meta">
          <span>开始: {{ formatDate(selectedPlan.start_time) }}</span>
          <span>结束: {{ formatDate(selectedPlan.end_time) }}</span>
          <span :class="['status-badge', getStatusClass(selectedPlan)]">
            {{ getStatusText(selectedPlan) }}
          </span>
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-if="tasksLoading" class="loading-state">
        <div class="spinner"></div>
        <span>加载任务...</span>
      </div>

      <div v-else-if="tasks.length === 0" class="empty-state">
        <p>该计划暂无任务</p>
      </div>

      <div v-else class="tasks-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>任务名称</th>
              <th>模式</th>
              <th>客观题</th>
              <th>编程题</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" class="table-row">
              <td class="task-name">{{ task.name }}</td>
              <td>
                <span v-if="task.is_exam_mode" class="exam-mode-badge">
                  <Trophy :size="12" />
                  考试模式
                </span>
                <span v-else class="practice-badge">练习模式</span>
              </td>
              <td class="count">{{ task.exam_count || 0 }}</td>
              <td class="count">{{ task.oj_count || 0 }}</td>
              <td class="date">{{ formatDate(task.start_time) }}</td>
              <td class="date">{{ formatDate(task.end_time) }}</td>
              <td>
                <button class="btn-action" @click="viewTaskStudents(selectedPlan.id, task.id)">
                  <Users :size="14" />
                  查看学生完成
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 计划列表视图 -->
    <div v-else>
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载计划...</span>
      </div>

      <div v-else-if="filteredPlans.length === 0" class="empty-state">
        <CalendarDays :size="48" />
        <p>暂无学习计划</p>
      </div>

      <div v-else class="plans-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>计划名称</th>
              <th>级别</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plan in filteredPlans" :key="plan.id" class="table-row" @click="viewPlanTasks(plan)">
              <td class="plan-name">{{ plan.name }}</td>
              <td>
                <span class="level-badge">GESP {{ plan.level }}级</span>
              </td>
              <td class="date">{{ formatDate(plan.start_time) }}</td>
              <td class="date">{{ formatDate(plan.end_time) }}</td>
              <td>
                <span :class="['status-badge', getStatusClass(plan)]">
                  {{ getStatusText(plan) }}
                </span>
              </td>
              <td>
                <button class="btn-action" @click.stop="viewPlanTasks(plan)">
                  查看任务
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  color: var(--color-primary);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-foreground);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.aggregation-switch {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 204px;
  padding: 4px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.07), rgba(14, 165, 233, 0.08));
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.switch-slider {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  background: linear-gradient(135deg, var(--color-primary), #38bdf8);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.26);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.aggregation-switch.mode-student .switch-slider {
  transform: translateX(100%);
}

.switch-option {
  position: relative;
  z-index: 1;
  height: 42px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: color 180ms ease, transform 180ms ease;
}

.switch-option.active {
  color: var(--color-on-primary);
}

.switch-option:active {
  transform: scale(0.98);
}

.level-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.level-select {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  min-width: 120px;
}

/* Buttons */
.btn-back {
  padding: var(--space-2) var(--space-3);
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.btn-back:hover {
  background: var(--color-muted);
}

.btn-action {
  padding: var(--space-2) var(--space-3);
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.btn-action:hover {
  filter: brightness(1.1);
}

/* Badges */
.level-badge {
  padding: var(--space-1) var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-accent);
}

.status-badge.upcoming {
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
}

.status-badge.ended {
  background: rgba(100, 116, 139, 0.1);
  color: var(--color-text-secondary);
}

.exam-mode-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.practice-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--color-muted);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

/* Plan Info */
.plan-info {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-4);
}

.plan-info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.plan-info-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plan-info-title h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

.plan-info-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Table */
.plans-table,
.tasks-table {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.student-plan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: 760px;
}

.student-plan-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 360px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: all var(--transition-fast);
}

.student-plan-chip:hover {
  background: rgba(37, 99, 235, 0.14);
  transform: translateY(-1px);
}

.student-plan-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-plan-chip strong {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--color-surface);
}

.student-plan-detail,
.student-task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.summary-card {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.summary-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
}

.summary-card strong {
  color: var(--color-primary);
  font-size: var(--font-size-xl);
}

.student-task-card {
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.student-task-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.student-task-title {
  font-weight: 700;
  color: var(--color-foreground);
}

.student-task-desc {
  margin-top: var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.task-counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.task-counts span {
  padding: var(--space-1) var(--space-2);
  background: rgba(14, 165, 233, 0.1);
  color: #0369a1;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.exercise-block {
  margin-top: var(--space-4);
}

.exercise-block h3 {
  margin-bottom: var(--space-2);
  font-size: var(--font-size-base);
  color: var(--color-foreground);
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.exercise-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  background: rgba(248, 250, 252, 0.72);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.exercise-title {
  color: var(--color-foreground);
  font-weight: 600;
}

.exercise-meta {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.exercise-result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.mini-status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.mini-status.done {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
}

.mini-status.todo {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.empty-inline {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: var(--space-3) var(--space-4);
  background: rgba(37, 99, 235, 0.05);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.02);
}

.plan-name,
.task-name {
  font-weight: 500;
}

.count {
  text-align: center;
}

.date {
  color: var(--color-text-muted);
}

/* Loading & Empty */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10);
  color: var(--color-text-muted);
  gap: var(--space-3);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
