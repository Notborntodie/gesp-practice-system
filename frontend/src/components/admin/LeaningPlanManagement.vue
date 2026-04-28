<template>
  <AdminPageTemplate
    title="学习计划管理"
    :loading="loading"
    :total="plans.length"
    @refresh="fetchPlans"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="secondary" @click="showQuickCreateDialog = true">
        <Zap :size="16" />
        快速创建
      </AppButton>
      <AppButton variant="accent" @click="showTemplateDialog = true">
        <Copy :size="16" />
        从模板创建
      </AppButton>
      <AppButton variant="primary" @click="openPlanEditor?.()">
        <Plus :size="16" />
        创建新计划
      </AppButton>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="filter-group">
        <label>题目来源：</label>
        <AppSelect
          v-model="selectedCategory"
          :options="categoryOptions"
          placeholder="全部"
          @update:model-value="fetchPlans"
        />
      </div>
      <div v-if="selectedCategory === '' || selectedCategory === 'GESP'" class="filter-group">
        <label>级别筛选：</label>
        <AppSelect
          v-model="selectedLevel"
          :options="levelOptions"
          placeholder="全部级别"
          @update:model-value="fetchPlans"
        />
      </div>
      <div class="filter-group">
        <label>状态筛选：</label>
        <AppSelect
          v-model="selectedStatus"
          :options="statusOptions"
          placeholder="全部状态"
          @update:model-value="fetchPlans"
        />
      </div>
    </template>

    <!-- Content: Table -->
    <div class="plans-table-container">
      <table v-if="plans.length > 0" class="plans-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>计划名称</th>
            <th>题目来源</th>
            <th v-if="selectedCategory === '' || selectedCategory === 'GESP'">级别</th>
            <th>开始时间</th>
            <th>结束时间</th>
            <th>任务数量</th>
            <th>激活状态</th>
            <th>时间状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id">
            <td>{{ plan.id }}</td>
            <td class="title-cell">{{ plan.name }}</td>
            <td>
              <AppTag :type="getCategoryTagType(plan.category || 'GESP')">
                {{ getCategoryText(plan.category) }}
              </AppTag>
            </td>
            <td v-if="selectedCategory === '' || selectedCategory === 'GESP'">
              <AppTag v-if="plan.level" type="info">GESP {{ plan.level }}级</AppTag>
              <span v-else class="no-level">-</span>
            </td>
            <td>{{ formatDate(plan.start_time) }}</td>
            <td>{{ formatDate(plan.end_time) }}</td>
            <td>{{ plan.total_tasks || 0 }}</td>
            <td>
              <AppTag :type="plan.is_active ? 'success' : 'warning'">
                {{ plan.is_active ? '激活' : '停用' }}
              </AppTag>
            </td>
            <td>
              <AppTag :type="getStatusTagType(plan)">
                {{ getStatusText(plan) }}
              </AppTag>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <!-- Admin Mode -->
                <template v-if="mode === 'admin'">
                  <AppButton variant="ghost" size="sm" @click="viewPlan(plan.id)">
                    <Eye :size="16" />
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="openPlanEditor?.(plan.id)">
                    <Pencil :size="16" />
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="togglePlanStatus(plan)">
                    <ToggleLeft v-if="!plan.is_active" :size="16" />
                    <ToggleRight v-if="plan.is_active" :size="16" />
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="copyPlan(plan)">
                    <Copy :size="16" />
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="saveAsTemplate(plan)">
                    <Bookmark :size="16" />
                  </AppButton>
                  <AppButton variant="secondary" size="sm" @click="showPlanQr(plan)">
                    <Link :size="14" />
                    成长计划链接
                  </AppButton>
                  <AppButton variant="destructive" size="sm" @click="deletePlan(plan.id)">
                    <Trash2 :size="16" />
                  </AppButton>
                </template>
                <!-- Teacher Mode -->
                <template v-else>
                  <AppButton variant="primary" size="sm" @click="openAddStudentsDialog(plan)">
                    <UserPlus :size="16" />
                    添加学生
                  </AppButton>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无学习计划" />
    </div>

    <!-- Dialogs -->
    <QuickCreatePlanDialog
      :visible="showQuickCreateDialog"
      @close="showQuickCreateDialog = false"
      @created-with-id="handleQuickCreated"
    />

    <TemplateSelectDialog
      :visible="showTemplateDialog"
      @close="showTemplateDialog = false"
      @created-with-id="handleTemplateCreated"
    />

    <PlanDetailDialog
      :visible="showDetailDialog"
      :plan-id="viewingPlanId"
      @close="showDetailDialog = false; viewingPlanId = null"
    />

    <!-- Add Students Dialog -->
    <AppDialog
      v-model:show="showAddStudentsDialog"
      :title="`添加学生到计划: ${selectedPlanForStudents?.name}`"
      width="500"
      positive-text="添加"
      negative-text="取消"
      :loading="addingStudents"
      @positive="addStudentsToPlan"
    >
      <div v-if="loadingStudents" class="dialog-loading">
        <div class="loading-spinner"></div>
        <p>加载学生列表...</p>
      </div>
      <div v-else-if="teacherStudents.length === 0" class="dialog-empty">
        <p>暂无绑定的学生</p>
      </div>
      <div v-else class="students-list">
        <div class="select-all">
          <label>
            <input type="checkbox" v-model="selectAllStudents" @change="toggleSelectAll" />
            全选
          </label>
        </div>
        <div class="student-item" v-for="student in teacherStudents" :key="student.id">
          <label>
            <input type="checkbox" v-model="selectedStudentIds" :value="student.id" />
            {{ student.real_name || student.username }} ({{ student.username }})
          </label>
        </div>
      </div>
    </AppDialog>

    <AppDialog
      v-model:show="showSuccessDialog"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <!-- QR Code Dialog -->
    <AppDialog
      v-model:show="showQrDialog"
      :title="qrPlan?.name || '成长计划链接'"
      width="420"
      :show-footer="false"
    >
      <div class="qr-dialog-content">
        <div class="qr-block">
          <p class="qr-hint">学员手机扫码即可查看本计划完成情况</p>
          <div class="qr-canvas-wrap">
            <img
              v-if="publicPlanProgressUrl"
              :src="qrCodeImageUrlPlan"
              alt="成长计划二维码"
              class="qr-image"
              ref="qrPlanImageRef"
            />
          </div>
          <AppButton
            variant="primary"
            size="sm"
            :disabled="!publicPlanProgressUrl || copyingPlanQr"
            :loading="copyingPlanQr"
            @click="copyPlanQrImage"
          >
            {{ copyPlanQrSuccess ? '已复制' : '复制二维码图片' }}
          </AppButton>
        </div>
        <div class="url-block">
          <p class="url-label">或复制链接发给学员</p>
          <div class="url-box">
            <input :value="publicPlanProgressUrl" readonly class="url-input" />
            <AppButton
              variant="secondary"
              size="sm"
              @click="copyPlanUrl"
            >
              {{ copyPlanSuccess ? '已复制' : '复制' }}
            </AppButton>
          </div>
          <p class="tip">打开链接后输入姓名或用户名可查个人成长计划完成情况</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <AppButton variant="ghost" @click="qrPlan = null">关闭</AppButton>
      </div>
    </AppDialog>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue'
import axios from 'axios'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Plus, Zap, Copy, Eye, Pencil, ToggleLeft, ToggleRight, Bookmark, Link, Trash2, UserPlus } from 'lucide-vue-next'

// Dialog Components
import QuickCreatePlanDialog from './Dialog/QuickCreatePlanDialog.vue'
import TemplateSelectDialog from './Dialog/TemplateSelectDialog.vue'
import PlanDetailDialog from './Dialog/PlanDetailDialog.vue'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

import { BASE_URL } from '@/config/api'

// Props
const props = withDefaults(defineProps<{
  mode?: 'admin' | 'teacher'
}>(), { mode: 'admin' })

const questionTypeStore = useQuestionTypeStore()
const openPlanEditor: ((planId?: number) => void) | undefined = inject('openPlanEditor')

// State
const selectedCategory = ref('')
const selectedLevel = ref('')
const selectedStatus = ref('1')
const plans = ref<any[]>([])
const loading = ref(false)
const showQuickCreateDialog = ref(false)
const showTemplateDialog = ref(false)
const showDetailDialog = ref(false)
const viewingPlanId = ref<number | null>(null)

// Teacher Mode State
const showAddStudentsDialog = ref(false)
const selectedPlanForStudents = ref<any>(null)
const teacherStudents = ref<any[]>([])
const selectedStudentIds = ref<number[]>([])
const loadingStudents = ref(false)
const addingStudents = ref(false)
const userInfo = ref<any>(null)

// QR Code State
const qrPlan = ref<any>(null)
const enablingPlanProgress = ref<number | null>(null)
const publicPlanBase = computed(() =>
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
const publicPlanProgressUrl = computed(() => {
  if (!qrPlan.value?.public_progress_token) return ''
  return `${publicPlanBase.value}/public-plans/${qrPlan.value.public_progress_token}`
})
const qrCodeImageUrlPlan = computed(() => {
  const url = publicPlanProgressUrl.value
  if (!url) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`
})
const copyPlanSuccess = ref(false)
let copyPlanSuccessTimer: ReturnType<typeof setTimeout> | null = null
const copyPlanQrSuccess = ref(false)
let copyPlanQrSuccessTimer: ReturnType<typeof setTimeout> | null = null
const copyingPlanQr = ref(false)
const qrPlanImageRef = ref<HTMLImageElement | null>(null)

// QR Dialog visibility
const showQrDialog = computed({
  get: () => qrPlan.value !== null,
  set: (val: boolean) => { if (!val) qrPlan.value = null }
})

// Success Dialog
const showSuccessDialog = ref(false)
const successMessage = ref('')

const showSuccess = (message: string) => {
  successMessage.value = message
  showSuccessDialog.value = true
}

// Filter Options
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelOptions = [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
]

const statusOptions = [
  { label: '激活', value: '1' },
  { label: '停用', value: '0' },
]

const selectAllStudents = computed({
  get: () => selectedStudentIds.value.length === teacherStudents.value.length && teacherStudents.value.length > 0,
  set: () => {}
})

// Fetch Plans
async function fetchPlans() {
  loading.value = true
  try {
    const params: any = {}
    if (selectedCategory.value) params.category = selectedCategory.value
    if (selectedLevel.value) params.level = selectedLevel.value
    if (selectedStatus.value !== '') params.is_active = selectedStatus.value

    const response = await axios.get(`${BASE_URL}/learning-plans/all`, { params })
    if (response.data.success) {
      plans.value = response.data.data || []
    }
  } catch (error: any) {
    console.error('获取学习计划列表失败:', error)
    alert('获取学习计划列表失败: ' + (error.response?.data?.message || error.message))
  } finally {
    loading.value = false
  }
}

// Helpers
function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find((t: any) => t.name === category)
  return type?.display_name || category
}

function getCategoryTagType(category: string): 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    'GESP': 'info',
    'CSP_J': 'success',
    'CSP_S': 'success',
    'NOI_P': 'warning',
    'NOI_A': 'warning',
  }
  return map[category] || 'default'
}

function formatDate(dateString: string) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getStatusTagType(plan: any): 'success' | 'warning' | 'default' {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)

  if (now < start) return 'warning'
  if (now > end) return 'default'
  return 'success'
}

function getStatusText(plan: any): string {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)

  if (now < start) return '未开始'
  if (now > end) return '已结束'
  return '进行中'
}

function viewPlan(id: number) {
  viewingPlanId.value = id
  showDetailDialog.value = true
}

async function togglePlanStatus(plan: any) {
  const action = plan.is_active ? '停用' : '激活'
  if (!confirm(`确定要${action}这个学习计划吗？`)) return

  try {
    await axios.put(`${BASE_URL}/learning-plans/${plan.id}`, { is_active: plan.is_active ? 0 : 1 })
    showSuccess(`学习计划${action}成功`)
    fetchPlans()
  } catch (error: any) {
    console.error('修改计划状态失败:', error)
    alert('修改计划状态失败: ' + (error.response?.data?.error || error.message))
  }
}

async function copyPlan(plan: any) {
  const newName = prompt('请输入新计划名称（留空则自动添加"(副本)"后缀）：', `${plan.name}(副本)`)
  if (newName === null) return

  try {
    const params: any = {}
    if (newName.trim()) params.name = newName.trim()
    await axios.post(`${BASE_URL}/learning-plans/${plan.id}/copy`, params)
    showSuccess('计划复制成功')
    fetchPlans()
  } catch (error: any) {
    console.error('复制计划失败:', error)
    alert('复制计划失败: ' + (error.response?.data?.error || error.message))
  }
}

async function deletePlan(id: number) {
  if (!confirm('确定要删除这个学习计划吗？此操作不可恢复！')) return

  try {
    await axios.delete(`${BASE_URL}/learning-plans/${id}`)
    showSuccess('学习计划删除成功')
    fetchPlans()
  } catch (error: any) {
    console.error('删除学习计划失败:', error)
    alert('删除学习计划失败: ' + (error.response?.data?.error || error.message))
  }
}

async function saveAsTemplate(plan: any) {
  const name = prompt('请输入模板名称：', plan.name)
  if (!name) return

  try {
    const response = await axios.post(`${BASE_URL}/plan-templates`, {
      name,
      description: plan.description,
      category: plan.category,
      level: plan.level,
      plan_id: plan.id
    })
    if (response.data.success) {
      showSuccess('模板保存成功')
    } else {
      throw new Error(response.data.error || '保存失败')
    }
  } catch (error: any) {
    console.error('保存模板失败:', error)
    alert('保存模板失败: ' + (error.response?.data?.error || error.message))
  }
}

async function handleQuickCreated(planId: number) {
  await fetchPlans()
  openPlanEditor?.(planId)
}

async function handleTemplateCreated(planId: number) {
  await fetchPlans()
  openPlanEditor?.(planId)
}

// Teacher Mode Functions
async function openAddStudentsDialog(plan: any) {
  selectedPlanForStudents.value = plan
  selectedStudentIds.value = []
  showAddStudentsDialog.value = true

  loadingStudents.value = true
  try {
    const teacherId = userInfo.value?.id
    if (!teacherId) {
      alert('无法获取教师信息')
      return
    }
    const response = await axios.get(`${BASE_URL}/teacher/${teacherId}/students`)
    let studentList = []
    if (response.data.data?.students) {
      studentList = response.data.data.students
    } else if (response.data.students) {
      studentList = response.data.students
    } else if (Array.isArray(response.data.data)) {
      studentList = response.data.data
    } else if (Array.isArray(response.data)) {
      studentList = response.data
    }
    teacherStudents.value = studentList
  } catch (error: any) {
    console.error('获取学生列表失败:', error)
    alert('获取学生列表失败')
  } finally {
    loadingStudents.value = false
  }
}

function toggleSelectAll() {
  if (selectedStudentIds.value.length === teacherStudents.value.length) {
    selectedStudentIds.value = []
  } else {
    selectedStudentIds.value = teacherStudents.value.map((s: any) => s.id)
  }
}

async function addStudentsToPlan() {
  if (selectedStudentIds.value.length === 0) return

  addingStudents.value = true
  try {
    const teacherId = userInfo.value?.id
    const planId = selectedPlanForStudents.value?.id

    const response = await axios.post(`${BASE_URL}/teacher/${teacherId}/learning-plans/${planId}/add-students`, {
      student_ids: selectedStudentIds.value
    })

    if (response.data.success) {
      const results = response.data.data?.results || response.data.results || []
      const successCount = results.filter((r: any) => r.status === 'success').length
      const alreadyJoinedCount = results.filter((r: any) => r.status === 'already_joined').length

      let message = `添加完成！成功添加: ${successCount} 个学生`
      if (alreadyJoinedCount > 0) {
        message += `，已在计划中: ${alreadyJoinedCount} 个`
      }
      showAddStudentsDialog.value = false
      showSuccess(message)
    } else if (response.data.message) {
      showAddStudentsDialog.value = false
      showSuccess(response.data.message)
    }
  } catch (error: any) {
    console.error('添加学生失败:', error)
    alert('添加学生失败: ' + (error.response?.data?.error || error.message))
  } finally {
    addingStudents.value = false
  }
}

// QR Code Functions
async function showPlanQr(plan: any) {
  const uid = userInfo.value?.id
  if (!uid) {
    alert('请先登录')
    return
  }
  if (plan.public_progress_enabled && plan.public_progress_token) {
    qrPlan.value = plan
    return
  }
  enablingPlanProgress.value = plan.id
  try {
    const res = await fetch(`${BASE_URL}/learning-plans/${plan.id}/enable-public-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid })
    })
    const data = await res.json()
    if (res.ok && data.public_progress_token) {
      plan.public_progress_enabled = true
      plan.public_progress_token = data.public_progress_token
      qrPlan.value = plan
    } else {
      alert(data.error || '开启失败')
    }
  } catch (e) {
    console.error(e)
    alert('网络错误，请稍后重试')
  } finally {
    enablingPlanProgress.value = null
  }
}

function copyPlanUrl() {
  if (copyPlanSuccessTimer) clearTimeout(copyPlanSuccessTimer)
  try {
    navigator.clipboard.writeText(publicPlanProgressUrl.value)
    copyPlanSuccess.value = true
    copyPlanSuccessTimer = setTimeout(() => {
      copyPlanSuccess.value = false
      copyPlanSuccessTimer = null
    }, 2000)
  } catch {
    alert('复制失败，请手动复制链接')
  }
}

async function copyPlanQrImage() {
  if (!publicPlanProgressUrl.value || copyingPlanQr.value) return
  if (copyPlanQrSuccessTimer) clearTimeout(copyPlanQrSuccessTimer)
  copyingPlanQr.value = true
  copyPlanQrSuccess.value = false
  try {
    const url = qrCodeImageUrlPlan.value
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) throw new Error('not image')
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    copyPlanQrSuccess.value = true
    copyPlanQrSuccessTimer = setTimeout(() => {
      copyPlanQrSuccess.value = false
      copyPlanQrSuccessTimer = null
    }, 2000)
  } catch {
    try {
      const img = qrPlanImageRef.value
      if (img && img.complete && img.naturalWidth) {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
          if (blob && navigator.clipboard?.write) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            copyPlanQrSuccess.value = true
            copyPlanQrSuccessTimer = setTimeout(() => {
              copyPlanQrSuccess.value = false
              copyPlanQrSuccessTimer = null
            }, 2000)
          } else throw new Error('toBlob failed')
        } else throw new Error('no context')
      } else throw new Error('image not loaded')
    } catch (e2) {
      console.error(e2)
      alert('复制二维码图片失败，请右键保存图片后发送')
    }
  } finally {
    copyingPlanQr.value = false
  }
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()

  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
  }

  fetchPlans()
})
</script>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Table */
.plans-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.plans-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.plans-table thead {
  background: var(--color-muted);
}

.plans-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.plans-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.plans-table tbody tr:hover {
  background: rgba(37, 99, 235, 0.04);
}

.title-cell {
  font-weight: 500;
  color: var(--color-primary);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-level {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Dialog Styles */
.dialog-loading,
.dialog-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-3);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.students-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.select-all {
  padding: var(--space-2) var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.student-item {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.student-item label,
.select-all label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.student-item input[type="checkbox"],
.select-all input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

/* QR Dialog Content */
.qr-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.qr-block {
  text-align: center;
}

.qr-hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.qr-canvas-wrap {
  display: inline-flex;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.qr-image {
  display: block;
  width: 200px;
  height: 200px;
}

.url-block .url-label {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.url-box {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.url-input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-muted);
  color: var(--color-foreground);
}

.url-block .tip {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>