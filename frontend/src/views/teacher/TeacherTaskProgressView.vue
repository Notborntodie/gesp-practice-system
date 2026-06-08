<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import {
  ArrowLeft,
  Users,
  Trophy,
  Download,
  CheckCircle,
  Clock
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

// 路由参数
const planId = computed(() => Number(route.params.planId))
const taskId = computed(() => Number(route.params.taskId))

// 用户信息
const userInfo = ref<any>(null)

// 计划和任务信息
const planInfo = ref<any>(null)
const taskInfo = ref<any>(null)

// 学生列表
const students = ref<any[]>([])
const loading = ref(false)

// 完成判定
function isCompleted(value: any): boolean {
  return value === true || value === 1 || value === '1'
}

// OJ分数
function getOJScore(problem: any): number {
  if (!problem || !problem.best_verdict) return 0
  if (problem.best_verdict === 'Accepted' || problem.best_verdict === 'AC') return 100
  if (problem.best_pass_rate !== undefined) return Math.round(Number(problem.best_pass_rate)) || 0
  return 0
}

// 考试总分计算
function getStudentExamScore(student: any): number {
  const exams = student.exam_progress?.exams || []
  const problems = student.oj_progress?.problems || []

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

// 排序后的学生列表
const sortedStudents = computed(() => {
  if (!students.value.length) return []
  const isExam = taskInfo.value?.is_exam_mode

  return [...students.value].sort((a, b) => {
    if (isExam) {
      return getStudentExamScore(b) - getStudentExamScore(a)
    }
    const aCompleted = isCompleted(a.task_progress?.is_completed) ? 1 : 0
    const bCompleted = isCompleted(b.task_progress?.is_completed) ? 1 : 0
    return bCompleted - aCompleted
  })
})

// 统计信息
const stats = computed(() => {
  const total = students.value.length
  const completed = students.value.filter(s => isCompleted(s.task_progress?.is_completed)).length
  return { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 }
})

// 获取用户信息
async function fetchUserInfo() {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

// 获取计划信息
async function fetchPlanInfo() {
  if (!planId.value) return
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/${planId.value}`)
    planInfo.value = res.data.data || res.data
  } catch (e) {
    console.error('获取计划信息失败:', e)
  }
}

// 获取任务信息和学生列表
async function fetchData() {
  if (!userInfo.value || !planId.value || !taskId.value) return
  loading.value = true

  try {
    // 获取任务学生进度
    const res = await axios.get(`${BASE_URL}/learning-plans/${planId.value}/tasks/${taskId.value}/students-progress`, {
      params: { teacher_id: userInfo.value.id }
    })
    students.value = res.data.data?.students || res.data.students || res.data.data || []

    // 从第一个学生获取任务信息
    if (students.value.length > 0) {
      const firstStudent = students.value[0]
      taskInfo.value = {
        name: firstStudent.task_name || `任务 ${taskId.value}`,
        is_exam_mode: firstStudent.is_exam_mode || false
      }
    }
  } catch (e) {
    // 备用方法
    try {
      const progressRes = await axios.get(`${BASE_URL}/learning-plans/${planId.value}/students-progress`, {
        params: { teacher_id: userInfo.value.id }
      })
      const allStudents = progressRes.data.data?.students || []

      students.value = await Promise.all(allStudents.map(async (s: any) => {
        try {
          const detailRes = await axios.get(`${BASE_URL}/learning-plans/${planId.value}/students/${s.student_id}/progress`, {
            params: { teacher_id: userInfo.value.id }
          })
          const tasks = detailRes.data.data?.tasks || []
          const taskDetail = tasks.find(t => t.id === taskId.value)
          return {
            ...s,
            task_progress: taskDetail?.task_progress || {},
            exam_progress: taskDetail?.exam_progress || {},
            oj_progress: taskDetail?.oj_progress || {}
          }
        } catch (e2) {
          return { ...s, task_progress: {}, exam_progress: {}, oj_progress: {} }
        }
      }))
    } catch (e2) {
      console.error('备用方法也失败:', e2)
      students.value = []
    }
  } finally {
    loading.value = false
  }
}

// 查看学生详情
function viewStudent(studentId: number) {
  router.push(`/teacher/students/${studentId}`)
}

// 导出CSV
function exportCSV() {
  if (sortedStudents.value.length === 0) return

  const headers = ['姓名', '用户名', '班级', '完成状态', '客观题进度', '编程题进度']
  if (taskInfo.value?.is_exam_mode) {
    headers.splice(4, 0, '总分')
  }

  const rows = sortedStudents.value.map(s => {
    const row = [
      s.real_name || s.username,
      s.username,
      s.class_no || '',
      isCompleted(s.task_progress?.is_completed) ? '已完成' : '进行中'
    ]
    if (taskInfo.value?.is_exam_mode) {
      row.push(String(getStudentExamScore(s)))
    }
    row.push(`${s.exam_progress?.completed || 0}/${s.exam_progress?.total || 0}`)
    row.push(`${s.oj_progress?.completed || 0}/${s.oj_progress?.total || 0}`)
    return row
  })

  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${planInfo.value?.name || '计划'}_${taskInfo.value?.name || '任务'}_学生完成情况.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// 返回计划进度
function goBack() {
  router.push('/teacher/plan-progress')
}

// 格式化进度
function formatProgress(progress: any): string {
  if (!progress) return '0/0'
  return `${progress.completed || 0}/${progress.total || 0}`
}

onMounted(async () => {
  await fetchUserInfo()
  await fetchPlanInfo()
  await fetchData()
})
</script>

<template>
  <div class="task-progress">
    <!-- 页面头部 -->
    <div class="page-header">
      <button class="btn-back" @click="goBack">
        <ArrowLeft :size="16" />
        返回计划进度
      </button>
      <div class="header-info">
        <h1 class="page-title">{{ taskInfo?.name || '任务完成情况' }}</h1>
        <span v-if="taskInfo?.is_exam_mode" class="exam-mode-badge">
          <Trophy :size="14" />
          考试模式
        </span>
      </div>
      <div class="header-actions">
        <span class="stats-badge">
          <CheckCircle :size="14" />
          {{ stats.completed }}/{{ stats.total }} 完成
        </span>
        <button class="btn-export" @click="exportCSV" :disabled="students.length === 0">
          <Download :size="14" />
          导出CSV
        </button>
      </div>
    </div>

    <!-- 计划信息 -->
    <div v-if="planInfo" class="plan-info-bar">
      <span class="plan-name">{{ planInfo.name }}</span>
      <span class="level-badge">GESP {{ planInfo.level }}级</span>
    </div>

    <!-- 学生列表 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载学生完成情况...</span>
    </div>

    <div v-else-if="students.length === 0" class="empty-state">
      <Users :size="48" />
      <p>该任务暂无学生参与</p>
    </div>

    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>姓名</th>
            <th>用户名</th>
            <th>班级</th>
            <th>完成状态</th>
            <th v-if="taskInfo?.is_exam_mode">总分</th>
            <th>客观题进度</th>
            <th>编程题进度</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(student, idx) in sortedStudents" :key="student.student_id" class="table-row" @click="viewStudent(student.student_id)">
            <td class="rank">
              <span v-if="taskInfo?.is_exam_mode && idx < 3" :class="['rank-badge', `rank-${idx + 1}`]">
                {{ idx + 1 }}
              </span>
              <span v-else class="rank-text">{{ idx + 1 }}</span>
            </td>
            <td class="student-name">{{ student.real_name || student.username }}</td>
            <td class="username">{{ student.username }}</td>
            <td>
              <span v-if="student.class_no" class="class-badge">{{ student.class_no }}</span>
              <span v-else class="no-class">—</span>
            </td>
            <td>
              <span :class="['status-badge', isCompleted(student.task_progress?.is_completed) ? 'completed' : 'in-progress']">
                <CheckCircle v-if="isCompleted(student.task_progress?.is_completed)" :size="12" />
                <Clock v-else :size="12" />
                {{ isCompleted(student.task_progress?.is_completed) ? '已完成' : '进行中' }}
              </span>
            </td>
            <td v-if="taskInfo?.is_exam_mode" class="exam-score">
              {{ getStudentExamScore(student) }}
            </td>
            <td class="progress">{{ formatProgress(student.exam_progress) }}</td>
            <td class="progress">{{ formatProgress(student.oj_progress) }}</td>
            <td>
              <button class="btn-action" @click.stop="viewStudent(student.student_id)">
                查看详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.task-progress {
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
  flex-wrap: wrap;
  gap: var(--space-3);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.stats-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
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
  font-size: var(--font-size-sm);
}

.btn-back:hover {
  background: var(--color-muted);
}

.btn-export {
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
}

.btn-export:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action {
  padding: var(--space-1) var(--space-2);
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}

/* Plan Info Bar */
.plan-info-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(37, 99, 235, 0.05);
  border-radius: var(--radius-md);
}

.plan-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.level-badge {
  padding: var(--space-1) var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

/* Table */
.table-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
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

/* Rank */
.rank {
  text-align: center;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: 700;
  font-size: var(--font-size-sm);
}

.rank-badge.rank-1 {
  background: linear-gradient(135deg, #ffd700, #ffb700);
  color: white;
}

.rank-badge.rank-2 {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: white;
}

.rank-badge.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #b06f2f);
  color: white;
}

.rank-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Student */
.student-name {
  font-weight: 500;
}

.username {
  color: var(--color-text-muted);
}

.class-badge {
  padding: 2px 6px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.no-class {
  color: var(--color-text-muted);
}

/* Status */
.status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
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

.exam-score {
  font-weight: 700;
  color: var(--color-primary);
}

.progress {
  color: var(--color-text-secondary);
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