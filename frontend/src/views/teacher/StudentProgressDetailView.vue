<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import {
  ArrowLeft,
  User,
  CalendarDays,
  FileText,
  Code,
  Trophy,
  Target,
  Clock,
  Plus,
  X,
  BookOpen
} from 'lucide-vue-next'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

const route = useRoute()
const router = useRouter()

// 学生信息
const studentId = computed(() => Number(route.params.studentId))
const studentInfo = ref<any>(null)
const userInfo = ref<any>(null)

// 计划列表
const plans = ref<any[]>([])
const selectedPlan = ref<any>(null)
const planDetail = ref<any>(null)
const loading = ref(false)
const detailLoading = ref(false)

// === 计划管理 ===
const allPlans = ref<any[]>([])
const joinedPlanIds = ref<number[]>([])
const planManageLoading = ref(false)
const addingPlanId = ref<number | null>(null)
const removingPlanId = ref<number | null>(null)

// 对话框状态
const showMessageDialog = ref(false)
const messageDialogTitle = ref('')
const messageDialogText = ref('')
const messageDialogType = ref<'success' | 'error'>('success')
const showConfirmDialog = ref(false)
const confirmPlanId = ref<number | null>(null)
const confirmPlanName = ref('')

// 已加入的计划
const joinedPlans = computed(() => {
  return allPlans.value.filter(plan => joinedPlanIds.value.includes(plan.id))
})

// 可加入的计划
const availablePlans = computed(() => {
  return allPlans.value.filter(plan => !joinedPlanIds.value.includes(plan.id))
})

function showSuccess(title: string, text: string) {
  messageDialogTitle.value = title
  messageDialogText.value = text
  messageDialogType.value = 'success'
  showMessageDialog.value = true
}

function showError(title: string, text: string) {
  messageDialogTitle.value = title
  messageDialogText.value = text
  messageDialogType.value = 'error'
  showMessageDialog.value = true
}

// 获取用户信息
async function fetchUserInfo() {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

// 获取学生信息
async function fetchStudentInfo() {
  if (!userInfo.value || !studentId.value) return
  try {
    const res = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/students`)
    const students = res.data.data?.students || res.data.students || res.data.data || res.data
    studentInfo.value = students.find(s => s.id === studentId.value)
  } catch (e) {
    console.error('获取学生信息失败:', e)
  }
}

// 获取学生加入的计划
async function fetchPlans() {
  if (!studentId.value) return
  loading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/my-plans`, {
      params: { user_id: studentId.value }
    })
    plans.value = res.data.data?.plans || res.data.plans || res.data.data || []
  } catch (e) {
    console.error('获取计划列表失败:', e)
  } finally {
    loading.value = false
  }
}

// === 计划管理功能 ===

// 获取所有计划列表
async function fetchAllPlans() {
  planManageLoading.value = true
  try {
    const response = await axios.get(`${BASE_URL}/learning-plans/all`, {
      params: { is_active: 1 }
    })
    if (response.data.success) {
      allPlans.value = response.data.data || []
    } else {
      allPlans.value = []
    }
  } catch (error: any) {
    console.error('获取计划列表失败:', error)
    allPlans.value = []
  } finally {
    planManageLoading.value = false
  }
}

// 获取学生已加入的计划ID
async function fetchStudentJoinedPlanIds() {
  if (!studentId.value) return
  try {
    const response = await axios.get(`${BASE_URL}/learning-plans/my-plans`, {
      params: { user_id: studentId.value }
    })
    if (response.data.success) {
      const planList = response.data.data?.plans || response.data.plans || response.data.data || []
      joinedPlanIds.value = planList.map((plan: any) => plan.id)
    } else {
      joinedPlanIds.value = []
    }
  } catch (error: any) {
    console.error('获取学生计划列表失败:', error)
    joinedPlanIds.value = []
  }
}

// 添加学生到计划
async function addToPlan(planId: number) {
  if (!studentId.value || !userInfo.value?.id) return

  addingPlanId.value = planId
  try {
    const response = await axios.post(
      `${BASE_URL}/teacher/${userInfo.value.id}/learning-plans/${planId}/add-students`,
      { student_ids: [studentId.value] }
    )

    if (response.data.success) {
      await fetchStudentJoinedPlanIds()
      await fetchPlans()
      const plan = allPlans.value.find(p => p.id === planId)
      showSuccess('添加成功', `已将学生添加到"${plan?.name || '计划'}"`)
    } else {
      showError('添加失败', response.data.message || '未知错误')
    }
  } catch (error: any) {
    console.error('添加学生到计划失败:', error)
    showError('添加失败', error.response?.data?.error || error.response?.data?.message || error.message)
  } finally {
    addingPlanId.value = null
  }
}

// 确认移除弹窗
function confirmRemove(planId: number) {
  const plan = allPlans.value.find(p => p.id === planId)
  confirmPlanId.value = planId
  confirmPlanName.value = plan?.name || '计划'
  showConfirmDialog.value = true
}

// 执行移除操作
async function performRemove() {
  if (!confirmPlanId.value || !studentId.value || !userInfo.value?.id) return

  removingPlanId.value = confirmPlanId.value
  try {
    const response = await fetch(
      `${BASE_URL}/teacher/${userInfo.value.id}/learning-plans/${confirmPlanId.value}/remove-students`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: [studentId.value] })
      }
    )

    const result = await response.json()

    if (result.success) {
      await fetchStudentJoinedPlanIds()
      await fetchPlans()
      showSuccess('移除成功', `已将学生从"${confirmPlanName.value}"中移除`)
    } else {
      showError('移除失败', result.message || '未知错误')
    }
  } catch (error: any) {
    console.error('从计划中移除学生失败:', error)
    showError('移除失败', error.message || '未知错误')
  } finally {
    removingPlanId.value = null
    showConfirmDialog.value = false
    confirmPlanId.value = null
  }
}

// 获取计划详细进度
async function fetchPlanDetail(plan: any) {
  if (!userInfo.value || !studentId.value) return
  selectedPlan.value = plan
  detailLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/${plan.id}/students/${studentId.value}/progress`, {
      params: { teacher_id: userInfo.value.id }
    })
    planDetail.value = res.data.data || res.data
  } catch (e) {
    console.error('获取计划进度失败:', e)
  } finally {
    detailLoading.value = false
  }
}

// 返回学生列表
function goBack() {
  router.push('/teacher/students')
}

// 格式化日期
function formatDate(date: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('zh-CN')
}

// 计算任务进度百分比
function taskProgressPercent(task: any) {
  if (!task) return 0
  const examTotal = task.exam_progress?.total || 0
  const examCompleted = task.exam_progress?.completed || 0
  const ojTotal = task.oj_progress?.total || 0
  const ojCompleted = task.oj_progress?.completed || 0
  const total = examTotal + ojTotal
  const completed = examCompleted + ojCompleted
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

// 是否完成
function isCompleted(value: any): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

// OJ分数计算
function getOJScore(problem: any): number {
  if (!problem || !problem.best_verdict) return 0
  if (problem.best_verdict === 'Accepted' || problem.best_verdict === 'AC') return 100
  if (problem.best_pass_rate !== undefined) {
    return Math.round(Number(problem.best_pass_rate)) || 0
  }
  return 0
}

// 考试模式总分
function getExamTotalScore(task: any): number | null {
  if (!task || !task.is_exam_mode) return null
  const exams = task.exam_progress?.exams || []
  const problems = task.oj_progress?.problems || []

  let examScore = 0
  if (exams.length > 0 && exams[0].best_score !== undefined) {
    examScore = Number(exams[0].best_score) || 0
  }

  let oj1Score = 0
  let oj2Score = 0
  if (problems.length >= 1) oj1Score = getOJScore(problems[0])
  if (problems.length >= 2) oj2Score = getOJScore(problems[1])

  return Math.round(examScore * 0.5 + oj1Score * 0.25 + oj2Score * 0.25)
}

// 完成状态样式
function completedClass(value: any): string {
  return isCompleted(value) ? 'completed' : 'in-progress'
}

// 进度条样式
function progressClass(percent: number): string {
  if (percent >= 100) return 'complete'
  if (percent >= 60) return 'good'
  return 'low'
}

onMounted(async () => {
  await fetchUserInfo()
  await fetchStudentInfo()
  await fetchPlans()
  await fetchAllPlans()
  await fetchStudentJoinedPlanIds()
})

// 监听学生ID变化
watch(studentId, async (newId) => {
  if (newId) {
    await fetchStudentInfo()
    await fetchPlans()
    await fetchAllPlans()
    await fetchStudentJoinedPlanIds()
  }
})
</script>

<template>
  <div class="student-progress">
    <!-- 页面头部 -->
    <div class="page-header">
      <button class="btn-back" @click="goBack">
        <ArrowLeft :size="16" />
        返回学生列表
      </button>
      <div class="header-info">
        <User :size="20" class="header-icon" />
        <h1 class="page-title">{{ studentInfo?.real_name || studentInfo?.username || '学生详情' }}</h1>
        <span class="username-badge">@{{ studentInfo?.username }}</span>
        <span v-if="studentInfo?.class_no" class="class-badge">{{ studentInfo?.class_no }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载计划列表...</span>
    </div>

    <!-- 计划详情视图 -->
    <div v-else-if="selectedPlan && planDetail" class="plan-detail-view">
      <!-- 计划信息 -->
      <div class="plan-info-card">
        <div class="plan-header">
          <div class="plan-title-row">
            <CalendarDays :size="20" />
            <h2>{{ selectedPlan.name }}</h2>
            <span class="level-badge">GESP {{ selectedPlan.level }}级</span>
          </div>
          <button class="btn-back-sm" @click="selectedPlan = null; planDetail = null">
            返回计划列表
          </button>
        </div>
        <div class="plan-meta">
          <span><Clock :size="14" /> 开始: {{ formatDate(selectedPlan.start_time) }}</span>
          <span><Clock :size="14" /> 结束: {{ formatDate(selectedPlan.end_time) }}</span>
          <span><Target :size="14" /> 任务: {{ planDetail.tasks?.length || 0 }} 个</span>
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-if="detailLoading" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else class="tasks-list">
        <div v-for="task in planDetail.tasks" :key="task.id" class="task-card">
          <div class="task-header">
            <h3 class="task-name">{{ task.name }}</h3>
            <span :class="['status-badge', completedClass(task.is_completed)]">
              {{ isCompleted(task.is_completed) ? '已完成' : '进行中' }}
            </span>
            <span v-if="task.is_exam_mode && getExamTotalScore(task) !== null" class="exam-score">
              <Trophy :size="14" />
              总分: {{ getExamTotalScore(task) }}
            </span>
          </div>

          <div class="task-progress">
            <!-- 进度条 -->
            <div class="progress-bar-container">
              <div class="progress-bar" :class="progressClass(taskProgressPercent(task))">
                <div class="progress-fill" :style="{ width: taskProgressPercent(task) + '%' }"></div>
              </div>
              <span class="progress-text">{{ taskProgressPercent(task) }}%</span>
            </div>

            <!-- 客观题进度 -->
            <div class="progress-item">
              <FileText :size="14" />
              <span>客观题: {{ task.exam_progress?.completed || 0 }}/{{ task.exam_progress?.total || 0 }}</span>
              <span v-if="task.exam_progress?.exams?.length > 0" class="best-score">
                最高分: {{ Math.max(...task.exam_progress.exams.map(e => e.best_score || 0)) }}
              </span>
            </div>

            <!-- OJ题进度 -->
            <div class="progress-item">
              <Code :size="14" />
              <span>编程题: {{ task.oj_progress?.completed || 0 }}/{{ task.oj_progress?.total || 0 }}</span>
            </div>

            <!-- OJ题详情 -->
            <div v-if="task.oj_progress?.problems?.length > 0" class="oj-problems-mini">
              <div v-for="(problem, idx) in task.oj_progress.problems" :key="problem.id" class="oj-mini-item">
                <span class="oj-name">编程题{{ idx + 1 }}: {{ problem.title }}</span>
                <span :class="['oj-status', isCompleted(problem.is_completed) ? 'ac' : 'wa']">
                  {{ isCompleted(problem.is_completed) ? 'AC' : (problem.best_verdict || '未提交') }}
                </span>
                <span v-if="!isCompleted(problem.is_completed) && problem.best_pass_rate" class="oj-score">
                  {{ getOJScore(problem) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 计划列表视图 -->
    <div v-else class="plans-section">
      <!-- 计划管理区域 -->
      <div class="plan-manage-card">
        <div class="plan-manage-header">
          <h3 class="manage-title">
            <BookOpen :size="18" />
            学习计划管理
          </h3>
        </div>

        <div v-if="planManageLoading" class="loading-state-sm">
          <div class="spinner-sm"></div>
        </div>

        <div v-else class="plan-manage-body">
          <!-- 已加入的计划 -->
          <div class="plan-group">
            <h4 class="group-title">已加入的计划 ({{ joinedPlans.length }})</h4>
            <div v-if="joinedPlans.length === 0" class="empty-group">
              <p>暂未加入任何计划</p>
            </div>
            <div v-else class="plan-manage-list">
              <div v-for="plan in joinedPlans" :key="plan.id" class="plan-manage-item joined">
                <div class="plan-manage-info">
                  <span class="plan-manage-name">{{ plan.name }}</span>
                  <span class="level-badge-sm">GESP {{ plan.level }}级</span>
                </div>
                <AppButton
                  variant="ghost"
                  size="sm"
                  :disabled="removingPlanId === plan.id"
                  @click="confirmRemove(plan.id)"
                >
                  <X :size="14" />
                  {{ removingPlanId === plan.id ? '移除中...' : '移除' }}
                </AppButton>
              </div>
            </div>
          </div>

          <!-- 可加入的计划 -->
          <div class="plan-group">
            <h4 class="group-title">可加入的计划 ({{ availablePlans.length }})</h4>
            <div v-if="availablePlans.length === 0" class="empty-group">
              <p>暂无可加入的计划</p>
            </div>
            <div v-else class="plan-manage-list">
              <div v-for="plan in availablePlans" :key="plan.id" class="plan-manage-item available">
                <div class="plan-manage-info">
                  <span class="plan-manage-name">{{ plan.name }}</span>
                  <span class="level-badge-sm">GESP {{ plan.level }}级</span>
                </div>
                <AppButton
                  variant="primary"
                  size="sm"
                  :disabled="addingPlanId === plan.id"
                  @click="addToPlan(plan.id)"
                >
                  <Plus :size="14" />
                  {{ addingPlanId === plan.id ? '添加中...' : '加入' }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 已加入计划进度卡片 -->
      <div class="plans-progress-section">
        <h3 class="section-title">
          <CalendarDays :size="18" />
          学习计划进度
        </h3>

        <div v-if="plans.length === 0" class="empty-state">
          <CalendarDays :size="48" />
          <p>该学生暂未加入任何学习计划</p>
        </div>

        <div v-else class="plan-cards">
          <div v-for="plan in plans" :key="plan.id" class="plan-card" @click="fetchPlanDetail(plan)">
            <div class="plan-card-header">
              <CalendarDays :size="18" />
              <h3>{{ plan.name }}</h3>
            </div>
            <div class="plan-card-body">
              <span class="level-badge">GESP {{ plan.level }}级</span>
              <span class="progress-text">
                {{ plan.completed_tasks || 0 }}/{{ plan.total_tasks || 0 }} 任务完成
              </span>
            </div>
            <div class="plan-card-footer">
              <span>{{ formatDate(plan.start_time) }} ~ {{ formatDate(plan.end_time) }}</span>
              <span :class="['status-badge', plan.is_completed ? 'completed' : 'in-progress']">
                {{ plan.is_completed ? '已完成' : '进行中' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成功/错误消息弹窗 -->
    <AppDialog
      v-model:show="showMessageDialog"
      :title="messageDialogTitle"
      width="400"
      :show-footer="false"
    >
      <p :style="{ color: messageDialogType === 'success' ? 'var(--color-accent)' : 'var(--color-destructive)' }">
        {{ messageDialogText }}
      </p>
    </AppDialog>

    <!-- 确认移除弹窗 -->
    <AppDialog
      v-model:show="showConfirmDialog"
      title="确认移除"
      width="400"
    >
      <p>确定要将该学生从"{{ confirmPlanName }}"中移除吗？</p>
      <template #footer>
        <AppButton variant="ghost" @click="showConfirmDialog = false">取消</AppButton>
        <AppButton variant="destructive" @click="performRemove">确认移除</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.student-progress {
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

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  color: var(--color-primary);
}

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

.username-badge {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.class-badge {
  padding: var(--space-1) var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

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
  transition: all var(--transition-fast);
}

.btn-back:hover {
  background: var(--color-muted);
}

.btn-back-sm {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
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

/* Status Badge */
.status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.status-badge.completed {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-accent);
}

.status-badge.in-progress {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

/* Level Badge */
.level-badge {
  padding: var(--space-1) var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

/* Plans Grid */
.plans-grid {
  min-height: 400px;
}

.plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.plan-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.plan-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card);
}

.plan-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.plan-card-header h3 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
}

.plan-card-body {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.progress-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.plan-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Plan Detail View */
.plan-info-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-4);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.plan-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plan-title-row h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

.plan-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.plan-meta span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Tasks List */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.task-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-4);
}

.task-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.task-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
}

.exam-score {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* Progress */
.task-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar.complete {
  background: rgba(16, 185, 129, 0.2);
}

.progress-bar.good {
  background: rgba(37, 99, 235, 0.2);
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  transition: width var(--transition-normal);
}

.progress-bar.complete .progress-fill {
  background: var(--color-accent);
}

.progress-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  min-width: 40px;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.best-score {
  color: var(--color-accent);
  font-weight: 500;
}

/* OJ Problems Mini */
.oj-problems-mini {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-2);
  margin-top: var(--space-2);
}

.oj-mini-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
}

.oj-name {
  color: var(--color-text-secondary);
}

.oj-status {
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 500;
}

.oj-status.ac {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-accent);
}

.oj-status.wa {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-destructive);
}

.oj-score {
  color: #f59e0b;
}

/* === 计划管理样式 === */

.plans-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.plan-manage-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.plan-manage-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.manage-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}

.loading-state-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.spinner-sm {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.plan-manage-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.plan-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.empty-group {
  padding: var(--space-3);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.empty-group p {
  margin: 0;
}

.plan-manage-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.plan-manage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.plan-manage-item.joined {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}

.plan-manage-item.available {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.05);
}

.plan-manage-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plan-manage-name {
  font-weight: 500;
  color: var(--color-foreground);
}

.level-badge-sm {
  padding: 2px var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

/* 计划进度区域 */

.plans-progress-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}
</style>