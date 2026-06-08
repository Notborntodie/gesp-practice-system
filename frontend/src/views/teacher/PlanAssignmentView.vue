<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import {
  UserPlus,
  UserMinus,
  Search,
  Check,
  BookOpen,
  RefreshCw
} from 'lucide-vue-next'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// 用户信息
const userInfo = ref<any>(null)

// 计划相关
const plans = ref<any[]>([])
const plansLoading = ref(false)
const selectedPlanId = ref<number | null>(null)

// 学生相关
const allStudents = ref<any[]>([])
const joinedStudentIds = ref<Set<number>>(new Set())
const studentsLoading = ref(false)

// 筛选
const searchQuery = ref('')
const classFilter = ref('')

// 选择状态
const selectedAddIds = ref<number[]>([])
const selectedRemoveIds = ref<number[]>([])

// 操作状态
const addLoading = ref(false)
const removeLoading = ref(false)

// 消息弹窗
const showMessageDialog = ref(false)
const messageDialogTitle = ref('')
const messageDialogText = ref('')
const messageDialogType = ref<'success' | 'error'>('success')

// 确认弹窗
const showConfirmDialog = ref(false)
const confirmTitle = ref('')
const confirmText = ref('')
const confirmAction = ref<(() => Promise<void>) | null>(null)

function normalizeStudentIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  return ids.map(id => Number(id)).filter(id => Number.isFinite(id))
}

function setJoinedStudentIds(ids: unknown) {
  joinedStudentIds.value = new Set(normalizeStudentIds(ids))
}

function applyJoinedStudentDelta(addIds: number[] = [], removeIds: number[] = []) {
  const next = new Set(joinedStudentIds.value)
  normalizeStudentIds(addIds).forEach(id => next.add(id))
  normalizeStudentIds(removeIds).forEach(id => next.delete(id))
  joinedStudentIds.value = next
}

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

// 选中的计划对象
const selectedPlan = computed(() => {
  if (!selectedPlanId.value) return null
  return plans.value.find(p => p.id === selectedPlanId.value) || null
})

// 班级选项
const classOptions = computed(() => {
  const set = new Set<string>()
  allStudents.value.forEach(s => {
    if (s.class_no && s.class_no.trim()) {
      set.add(s.class_no.trim())
    }
  })
  return Array.from(set).sort()
})

// 已加入计划的学生
const joinedStudents = computed(() => {
  return allStudents.value.filter(s => joinedStudentIds.value.has(s.id))
})

// 未加入计划的学生
const unjoinedStudents = computed(() => {
  return allStudents.value.filter(s => !joinedStudentIds.value.has(s.id))
})

// 筛选后的未加入学生
const filteredUnjoined = computed(() => {
  let list = unjoinedStudents.value
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    list = list.filter(s =>
      (s.username || '').toLowerCase().includes(q) ||
      (s.real_name || '').toLowerCase().includes(q) ||
      (s.class_no || '').toLowerCase().includes(q)
    )
  }
  if (classFilter.value) {
    list = list.filter(s => (s.class_no || '').trim() === classFilter.value)
  }
  return list
})

// 筛选后的已加入学生
const filteredJoined = computed(() => {
  let list = joinedStudents.value
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    list = list.filter(s =>
      (s.username || '').toLowerCase().includes(q) ||
      (s.real_name || '').toLowerCase().includes(q) ||
      (s.class_no || '').toLowerCase().includes(q)
    )
  }
  if (classFilter.value) {
    list = list.filter(s => (s.class_no || '').trim() === classFilter.value)
  }
  return list
})

// 全选状态（未加入）
const isAllUnjoinedSelected = computed(() => {
  if (filteredUnjoined.value.length === 0) return false
  return filteredUnjoined.value.every(s => selectedAddIds.value.includes(s.id))
})

// 获取活跃计划列表
async function fetchPlans() {
  plansLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/learning-plans/all`, { params: { is_active: 1 } })
    const list = res.data?.data || res.data
    plans.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    console.error('获取计划列表失败:', e)
    plans.value = []
  } finally {
    plansLoading.value = false
  }
}

// 获取教师的学生列表
async function fetchStudents() {
  if (!userInfo.value) return
  studentsLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/students`, { timeout: 15000 })
    if (Array.isArray(res.data)) {
      allStudents.value = res.data
    } else if (Array.isArray(res.data?.data)) {
      allStudents.value = res.data.data
    } else {
      allStudents.value = []
    }
  } catch (e: any) {
    console.error('获取学生列表失败:', e)
    allStudents.value = []
  }
}

// 获取计划已加入的学生（轻量接口，只返回ID列表）
async function fetchJoinedStudents(
  planId: number,
  keepDelta: { addIds?: number[]; removeIds?: number[] } = {}
) {
  if (!userInfo.value) return
  try {
    const res = await axios.get(
      `${BASE_URL}/learning-plans/${planId}/student-ids`,
      {
        params: {
          teacher_id: userInfo.value.id,
          _t: Date.now()
        }
      }
    )
    const ids = res.data?.data || []
    const next = new Set(normalizeStudentIds(ids))
    normalizeStudentIds(keepDelta.addIds || []).forEach(id => next.add(id))
    normalizeStudentIds(keepDelta.removeIds || []).forEach(id => next.delete(id))
    setJoinedStudentIds(Array.from(next))
  } catch (e: any) {
    console.error('获取计划学生失败:', e)
    if (keepDelta.addIds?.length || keepDelta.removeIds?.length) {
      applyJoinedStudentDelta(keepDelta.addIds, keepDelta.removeIds)
    } else {
      joinedStudentIds.value = new Set()
    }
  }
}

// 选择计划
async function selectPlan(planId: number) {
  selectedPlanId.value = planId
  selectedAddIds.value = []
  selectedRemoveIds.value = []
  searchQuery.value = ''
  classFilter.value = ''
  studentsLoading.value = true
  try {
    // 如果学生列表已加载，只查已加入学生ID；否则并行加载
    if (allStudents.value.length > 0) {
      await fetchJoinedStudents(planId)
    } else {
      await Promise.all([fetchStudents(), fetchJoinedStudents(planId)])
    }
  } finally {
    studentsLoading.value = false
  }
}

// 刷新当前计划的学生状态
async function refreshPlanStudents() {
  if (!selectedPlanId.value) return
  studentsLoading.value = true
  try {
    if (allStudents.value.length === 0) {
      await Promise.all([fetchStudents(), fetchJoinedStudents(selectedPlanId.value)])
    } else {
      await fetchJoinedStudents(selectedPlanId.value)
    }
  } finally {
    studentsLoading.value = false
  }
}

// 切换未加入学生选择
function toggleAddSelection(id: number) {
  const idx = selectedAddIds.value.indexOf(id)
  if (idx > -1) selectedAddIds.value.splice(idx, 1)
  else selectedAddIds.value.push(id)
}

// 切换已加入学生选择
function toggleRemoveSelection(id: number) {
  const idx = selectedRemoveIds.value.indexOf(id)
  if (idx > -1) selectedRemoveIds.value.splice(idx, 1)
  else selectedRemoveIds.value.push(id)
}

// 全选/取消全选未加入
function toggleSelectAllUnjoined() {
  if (isAllUnjoinedSelected.value) {
    selectedAddIds.value = []
  } else {
    selectedAddIds.value = filteredUnjoined.value.map(s => s.id)
  }
}

// 批量添加学生到计划
async function batchAddToPlan() {
  if (!userInfo.value || !selectedPlanId.value || selectedAddIds.value.length === 0) return

  confirmTitle.value = '确认绑定'
  confirmText.value = `确定要将 ${selectedAddIds.value.length} 名学生绑定到「${selectedPlan.value?.name || '计划'}」吗？`
  confirmAction.value = async () => {
    addLoading.value = true
    const pendingAddIds = [...selectedAddIds.value]
    try {
      const res = await axios.post(
        `${BASE_URL}/teacher/${userInfo.value.id}/learning-plans/${selectedPlanId.value}/add-students`,
        { student_ids: pendingAddIds }
      )
      if (res.data.success) {
        const successfulIds = normalizeStudentIds(
          res.data.results
            ?.filter((r: any) => ['success', 'already_joined'].includes(r.status))
            .map((r: any) => r.student_id) || pendingAddIds
        )
        const count = res.data.results?.filter((r: any) => r.status === 'success').length || successfulIds.length
        applyJoinedStudentDelta(successfulIds)
        showSuccess('绑定成功', `已成功绑定 ${count} 名学生`)
        selectedAddIds.value = []
        await fetchJoinedStudents(selectedPlanId.value!, { addIds: successfulIds })
      } else {
        showError('绑定失败', res.data.error || '未知错误')
      }
    } catch (e: any) {
      showError('绑定失败', e.response?.data?.error || e.message)
    } finally {
      addLoading.value = false
    }
  }
  showConfirmDialog.value = true
}

// 批量移除学生出计划
async function batchRemoveFromPlan() {
  if (!userInfo.value || !selectedPlanId.value || selectedRemoveIds.value.length === 0) return

  confirmTitle.value = '确认移除'
  confirmText.value = `确定要将 ${selectedRemoveIds.value.length} 名学生从「${selectedPlan.value?.name || '计划'}」中移除吗？`
  confirmAction.value = async () => {
    removeLoading.value = true
    const pendingRemoveIds = [...selectedRemoveIds.value]
    try {
      const res = await axios.delete(
        `${BASE_URL}/teacher/${userInfo.value.id}/learning-plans/${selectedPlanId.value}/remove-students`,
        { data: { student_ids: pendingRemoveIds } }
      )
      if (res.data.success) {
        const removedIds = normalizeStudentIds(
          res.data.results
            ?.filter((r: any) => ['success', 'not_joined'].includes(r.status))
            .map((r: any) => r.student_id) || pendingRemoveIds
        )
        const count = res.data.results?.filter((r: any) => r.status === 'success').length || removedIds.length
        applyJoinedStudentDelta([], removedIds)
        showSuccess('移除成功', `已成功移除 ${count} 名学生`)
        selectedRemoveIds.value = []
        await fetchJoinedStudents(selectedPlanId.value!, { removeIds: removedIds })
      } else {
        showError('移除失败', res.data.error || '未知错误')
      }
    } catch (e: any) {
      showError('移除失败', e.response?.data?.error || e.message)
    } finally {
      removeLoading.value = false
    }
  }
  showConfirmDialog.value = true
}

// 执行确认操作
async function executeConfirm() {
  showConfirmDialog.value = false
  if (confirmAction.value) {
    await confirmAction.value()
    confirmAction.value = null
  }
}

// 获取级别文本
function getLevelText(level: number | null | undefined): string {
  if (level == null) return ''
  return `GESP ${level}级`
}

onMounted(async () => {
  await fetchUserInfo()
  await fetchPlans()
})
</script>

<template>
  <div class="plan-assignment">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <UserPlus :size="24" class="header-icon" />
        <h1 class="page-title">计划分配</h1>
      </div>
      <div class="header-right">
        <AppButton v-if="selectedPlanId" variant="ghost" size="sm" @click="refreshPlanStudents">
          <RefreshCw :size="14" />
          刷新
        </AppButton>
      </div>
    </div>

    <!-- 第一步：选择学习计划 -->
    <div class="step-section">
      <h3 class="step-title">
        <span class="step-number">1</span>
        选择学习计划
      </h3>

      <AppEmptyState v-if="plansLoading" type="loading" description="加载计划列表..." />

      <div v-else-if="plans.length === 0" class="empty-hint">
        暂无活跃的学习计划
      </div>

      <div v-else class="plan-cards">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="['plan-card', { selected: selectedPlanId === plan.id }]"
          @click="selectPlan(plan.id)"
        >
          <div class="plan-card-header">
            <span class="plan-name">{{ plan.name }}</span>
            <div v-if="selectedPlanId === plan.id" class="plan-check">
              <Check :size="16" />
            </div>
          </div>
          <div class="plan-card-meta">
            <AppTag v-if="plan.level" type="info" size="sm">{{ getLevelText(plan.level) }}</AppTag>
            <AppTag v-if="plan.category" type="default" size="sm">{{ plan.category }}</AppTag>
            <span v-if="plan.total_tasks" class="plan-tasks">{{ plan.total_tasks }} 个任务</span>
          </div>
          <p v-if="plan.description" class="plan-desc">{{ plan.description }}</p>
        </div>
      </div>
    </div>

    <!-- 第二步：选择学生 -->
    <div v-if="selectedPlanId" class="step-section">
      <h3 class="step-title">
        <span class="step-number">2</span>
        选择学生 — {{ selectedPlan?.name }}
      </h3>

      <AppEmptyState v-if="studentsLoading" type="loading" description="加载学生数据..." />

      <template v-else>
        <!-- 搜索和筛选 -->
        <div class="filter-bar">
          <div class="search-box">
            <Search :size="16" class="search-icon" />
            <input v-model="searchQuery" type="text" placeholder="搜索学生姓名、用户名..." class="search-input" />
          </div>
          <select v-model="classFilter" class="class-select">
            <option value="">全部班级</option>
            <option v-for="c in classOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <!-- 统计摘要 -->
        <div class="summary-bar">
          <span class="summary-item">
            <BookOpen :size="14" />
            共 {{ allStudents.length }} 名学生
          </span>
          <span class="summary-item joined">
            已加入: {{ joinedStudents.length }} 人
          </span>
          <span class="summary-item unjoined">
            未加入: {{ unjoinedStudents.length }} 人
          </span>
        </div>

        <!-- 已加入的学生 -->
        <div class="student-group">
          <div class="group-header">
            <h4 class="group-title">已加入计划 ({{ joinedStudents.length }})</h4>
            <AppButton
              v-if="selectedRemoveIds.length > 0"
              variant="destructive"
              size="sm"
              :loading="removeLoading"
              @click="batchRemoveFromPlan"
            >
              <UserMinus :size="14" />
              移除 {{ selectedRemoveIds.length }} 人
            </AppButton>
          </div>

          <div v-if="joinedStudents.length === 0" class="group-empty">暂无学生加入此计划</div>

          <div v-else class="student-list">
            <div
              v-for="student in filteredJoined"
              :key="student.id"
              :class="['student-item', { selected: selectedRemoveIds.includes(student.id) }]"
              @click="toggleRemoveSelection(student.id)"
            >
              <input
                type="checkbox"
                :checked="selectedRemoveIds.includes(student.id)"
                @click.stop
                @change="toggleRemoveSelection(student.id)"
                class="student-checkbox"
              />
              <span class="student-class">{{ student.class_no || '—' }}</span>
              <span class="student-name">{{ student.real_name || student.username }}</span>
              <span class="student-username">@{{ student.username }}</span>
            </div>
          </div>
        </div>

        <!-- 未加入的学生 -->
        <div class="student-group">
          <div class="group-header">
            <div class="group-title-row">
              <h4 class="group-title">未加入计划 ({{ unjoinedStudents.length }})</h4>
              <label class="select-all-label">
                <input
                  type="checkbox"
                  :checked="isAllUnjoinedSelected"
                  @change="toggleSelectAllUnjoined"
                  class="student-checkbox"
                />
                <span>全选</span>
              </label>
            </div>
            <AppButton
              v-if="selectedAddIds.length > 0"
              variant="primary"
              size="sm"
              :loading="addLoading"
              @click="batchAddToPlan"
            >
              <UserPlus :size="14" />
              绑定 {{ selectedAddIds.length }} 人
            </AppButton>
          </div>

          <div v-if="unjoinedStudents.length === 0" class="group-empty">所有学生均已加入此计划</div>

          <AppEmptyState v-else-if="filteredUnjoined.length === 0" type="empty" description="没有符合筛选条件的学生" />

          <div v-else class="student-list">
            <div
              v-for="student in filteredUnjoined"
              :key="student.id"
              :class="['student-item', { selected: selectedAddIds.includes(student.id) }]"
              @click="toggleAddSelection(student.id)"
            >
              <input
                type="checkbox"
                :checked="selectedAddIds.includes(student.id)"
                @click.stop
                @change="toggleAddSelection(student.id)"
                class="student-checkbox"
              />
              <span class="student-class">{{ student.class_no || '—' }}</span>
              <span class="student-name">{{ student.real_name || student.username }}</span>
              <span class="student-username">@{{ student.username }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 未选择计划时的提示 -->
    <div v-else class="step-placeholder">
      <BookOpen :size="32" class="placeholder-icon" />
      <p>请先在上方选择一个学习计划</p>
    </div>

    <!-- 确认弹窗 -->
    <AppDialog
      v-model:show="showConfirmDialog"
      :title="confirmTitle"
      width="400"
      positive-text="确认"
      negative-text="取消"
      @positive="executeConfirm"
    >
      <p style="color: var(--color-text-secondary);">{{ confirmText }}</p>
    </AppDialog>

    <!-- 消息弹窗 -->
    <AppDialog
      v-model:show="showMessageDialog"
      :title="messageDialogTitle"
      width="400"
      :show-footer="true"
      positive-text="确定"
      :show-negative="false"
      @positive="showMessageDialog = false"
    >
      <p :style="{ color: messageDialogType === 'success' ? 'var(--color-accent)' : 'var(--color-destructive)' }">
        {{ messageDialogText }}
      </p>
    </AppDialog>
  </div>
</template>

<style scoped>
.plan-assignment {
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

/* Steps */
.step-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-5);
}

.step-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.empty-hint {
  text-align: center;
  padding: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Plan Cards */
.plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-3);
}

.plan-card {
  padding: var(--space-4);
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.plan-card:hover {
  border-color: var(--color-primary);
}

.plan-card.selected {
  border-color: var(--color-primary);
  background: rgba(37, 99, 235, 0.04);
}

.plan-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.plan-name {
  font-weight: 600;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.plan-check {
  color: var(--color-primary);
}

.plan-card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.plan-tasks {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.plan-desc {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-3);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-width: 280px;
}

.search-icon {
  color: var(--color-text-muted);
}

.search-input {
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  outline: none;
  width: 100%;
}

.class-select {
  padding: var(--space-2) var(--space-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  min-width: 120px;
}

/* Summary Bar */
.summary-bar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-4);
}

.summary-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.summary-item.joined {
  color: var(--color-accent);
}

.summary-item.unjoined {
  color: var(--color-primary);
}

/* Student Groups */
.student-group {
  margin-bottom: var(--space-4);
}

.student-group:last-child {
  margin-bottom: 0;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.group-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.group-title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
}

.group-empty {
  text-align: center;
  padding: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border);
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

/* Student List */
.student-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--color-border);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.student-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-background);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.student-item:hover {
  background: rgba(37, 99, 235, 0.04);
}

.student-item.selected {
  background: rgba(37, 99, 235, 0.08);
}

.student-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.student-class {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  background: rgba(37, 99, 235, 0.1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
}

.student-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.student-username {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

/* Step Placeholder */
.step-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.placeholder-icon {
  opacity: 0.4;
}

/* Responsive */
@media (max-width: 768px) {
  .plan-cards {
    grid-template-columns: 1fr;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    min-width: auto;
  }

  .summary-bar {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
