<template>
    <div class="plan-management">
      <div class="section-header">
        <h2>学习计划管理</h2>
        <div v-if="mode === 'admin'" class="header-actions">
          <button @click="showQuickCreateDialog = true" class="btn btn-quick">
            <i class="fas fa-bolt"></i> 快速创建
          </button>
          <button @click="showTemplateDialog = true" class="btn btn-template">
            <i class="fas fa-clone"></i> 从模板创建
          </button>
          <button @click="openPlanEditor?.()" class="btn btn-primary">
            <i class="fas fa-plus"></i> 创建新计划
          </button>
        </div>
      </div>
  
      <!-- 筛选器 -->
      <div class="filters">
        <div class="filter-group">
          <label>题目来源：</label>
          <select v-model="selectedCategory" @change="fetchPlans" class="filter-select">
            <option value="">全部</option>
            <option v-for="t in questionTypeStore.allTypes.value" :key="t.name" :value="t.name">
              {{ t.display_name || t.name }}
            </option>
          </select>
        </div>
        <div class="filter-group" v-if="selectedCategory === '' || selectedCategory === 'GESP'">
          <label>级别筛选：</label>
          <select v-model="selectedLevel" @change="fetchPlans" class="filter-select">
            <option value="">全部级别</option>
            <option value="1">GESP 1级</option>
            <option value="2">GESP 2级</option>
            <option value="3">GESP 3级</option>
            <option value="4">GESP 4级</option>
            <option value="5">GESP 5级</option>
            <option value="6">GESP 6级</option>
            <option value="7">GESP 7级</option>
            <option value="8">GESP 8级</option>
          </select>
        </div>

        <div class="filter-group">
          <label>状态筛选：</label>
          <select v-model="selectedStatus" @change="fetchPlans" class="filter-select">
            <option value="">全部状态</option>
            <option value="1">激活</option>
            <option value="0">停用</option>
          </select>
        </div>
      </div>
  
      <!-- 计划列表 -->
      <div class="plans-table-container">
        <div v-if="loading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>加载中...</p>
        </div>
  
        <table v-else-if="plans.length > 0" class="plans-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>计划名称</th>
              <th>题目来源</th>
              <th>级别</th>
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
                <span class="category-badge" :class="'category-' + (plan.category || 'GESP').toLowerCase()">
                  {{ getCategoryText(plan.category) }}
                </span>
              </td>
              <td v-if="selectedCategory === '' || selectedCategory === 'GESP'">
                <span class="level-badge" v-if="plan.level">GESP {{ plan.level }}级</span>
                <span class="no-level" v-else>-</span>
              </td>
              <td>{{ formatDate(plan.start_time) }}</td>
              <td>{{ formatDate(plan.end_time) }}</td>
              <td>{{ plan.total_tasks || 0 }}</td>
              <td>
                <span class="active-badge" :class="plan.is_active ? 'is-active' : 'is-inactive'">
                  {{ plan.is_active ? '激活' : '停用' }}
                </span>
              </td>
              <td>
                <span class="status-badge" :class="getStatusClass(plan)">
                  {{ getStatusText(plan) }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <!-- 管理后台模式：显示所有操作按钮 -->
                  <template v-if="mode === 'admin'">
                    <button @click="viewPlan(plan.id)" class="btn-action btn-view" title="查看详情">
                      <Icon name="eye" :size="18" />
                    </button>
                    <button @click="openPlanEditor?.(plan.id)" class="btn-action btn-edit" title="编辑">
                      <Icon name="edit" :size="18" />
                    </button>
                    <button @click="togglePlanStatus(plan)" class="btn-action btn-toggle" :title="plan.is_active ? '停用' : '激活'">
                      <Icon :name="plan.is_active ? 'toggle-right' : 'toggle-left'" :size="18" />
                    </button>
                    <button @click="copyPlan(plan)" class="btn-action btn-copy" title="复制">
                      <Icon name="copy" :size="18" />
                    </button>
                    <button @click="saveAsTemplate(plan)" class="btn-action btn-save-template" title="保存为模板">
                      <Icon name="bookmark" :size="18" />
                    </button>
                    <button
                      class="btn-action btn-plan-link"
                      title="成长计划链接"
                      :disabled="enablingPlanProgress === plan.id"
                      @click="showPlanQr(plan)"
                    >
                      {{ enablingPlanProgress === plan.id ? '…' : '成长计划链接' }}
                    </button>
                    <button @click="deletePlan(plan.id)" class="btn-action btn-delete" title="删除">
                      <Icon name="trash-2" :size="18" />
                    </button>
                  </template>
                  <!-- 教师模式：只显示添加学生按钮 -->
                  <template v-else>
                    <button @click="openAddStudentsDialog(plan)" class="btn-action btn-add-students" title="添加学生">
                      <Icon name="user-plus" :size="18" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
  
        <div v-else class="empty-state">
          <Icon name="inbox" :size="64" class="empty-icon" />
          <p>暂无学习计划</p>
        </div>
      </div>
  
      <!-- 快速创建计划对话框 -->
      <QuickCreatePlanDialog
        :visible="showQuickCreateDialog"
        @close="showQuickCreateDialog = false"
        @created-with-id="handleQuickCreated"
      />

      <!-- 从模板创建对话框 -->
      <TemplateSelectDialog
        :visible="showTemplateDialog"
        @close="showTemplateDialog = false"
        @created-with-id="handleTemplateCreated"
      />
  
      <!-- 查看计划详情对话框 -->
      <PlanDetailDialog
        :visible="showDetailDialog"
        :plan-id="viewingPlanId"
        @close="showDetailDialog = false; viewingPlanId = null"
      />

      <!-- 添加学生对话框 -->
      <div v-if="showAddStudentsDialog" class="dialog-overlay" @click="showAddStudentsDialog = false">
        <div class="dialog add-students-dialog" @click.stop>
          <div class="dialog-header">
            <h3>添加学生到计划: {{ selectedPlanForStudents?.name }}</h3>
            <button @click="showAddStudentsDialog = false" class="btn-close">&times;</button>
          </div>
          <div class="dialog-body">
            <div v-if="loadingStudents" class="loading-state">
              <i class="fas fa-spinner fa-spin"></i>
              <p>加载学生列表...</p>
            </div>
            <div v-else-if="teacherStudents.length === 0" class="empty-state">
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
          </div>
          <div class="dialog-footer">
            <button @click="showAddStudentsDialog = false" class="btn btn-secondary">取消</button>
            <button @click="addStudentsToPlan" class="btn btn-primary" :disabled="selectedStudentIds.length === 0 || addingStudents">
              {{ addingStudents ? '添加中...' : `添加 (${selectedStudentIds.length})` }}
            </button>
          </div>
        </div>
      </div>

      <!-- 成功消息弹窗 -->
      <SuccessMessageDialog 
        :visible="showSuccessDialog" 
        :message="successMessage"
        @close="showSuccessDialog = false"
      />

      <!-- 成长计划链接/二维码弹窗 -->
      <div v-if="qrPlan" class="modal-overlay modal-qr-overlay" @click="qrPlan = null">
        <div class="modal-card modal-qr-card" @click.stop>
          <div class="modal-qr-header">
            <h4>{{ qrPlan.name }}</h4>
            <span class="modal-qr-subtitle">成长计划进度查询链接</span>
            <button type="button" class="modal-qr-close" aria-label="关闭" @click="qrPlan = null">×</button>
          </div>
          <div class="modal-qr-body">
            <div class="qr-block">
              <p class="qr-hint">学员手机扫码即可查看本计划完成情况</p>
              <div class="qr-canvas-wrap">
                <img
                  v-if="publicPlanProgressUrl"
                  :src="qrCodeImageUrlPlan"
                  alt="成长计划二维码"
                  class="qr-image"
                  width="200"
                  height="200"
                  ref="qrPlanImageRef"
                />
              </div>
              <button
                type="button"
                class="btn-copy-qr"
                :class="{ copied: copyPlanQrSuccess }"
                :disabled="!publicPlanProgressUrl || copyingPlanQr"
                @click="copyPlanQrImage"
              >
                {{ copyingPlanQr ? '复制中...' : copyPlanQrSuccess ? '已复制' : '复制二维码图片' }}
              </button>
            </div>
            <div class="url-block">
              <p class="url-label">或复制链接发给学员</p>
              <div class="url-box">
                <input :value="publicPlanProgressUrl" readonly class="url-input" />
                <button type="button" class="btn-copy" :class="{ copied: copyPlanSuccess }" @click="copyPlanUrl">
                  {{ copyPlanSuccess ? '已复制' : '复制' }}
                </button>
              </div>
              <p class="tip">打开链接后输入姓名或用户名可查个人成长计划完成情况（重名时优先显示完成度更高的学员）</p>
            </div>
          </div>
          <div class="modal-qr-footer">
            <button type="button" class="btn-close" @click="qrPlan = null">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue'
import axios from 'axios'
import QuickCreatePlanDialog from './Dialog/QuickCreatePlanDialog.vue'
import TemplateSelectDialog from './Dialog/TemplateSelectDialog.vue'
import PlanDetailDialog from './Dialog/PlanDetailDialog.vue'
import SuccessMessageDialog from './Dialog/SuccessMessageDialog.vue'
import Icon from '@/components/Icon.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

import { BASE_URL } from '@/config/api'

// Props
const props = withDefaults(defineProps<{
  mode?: 'admin' | 'teacher'
}>(), {
  mode: 'admin'
})

const questionTypeStore = useQuestionTypeStore()
const openPlanEditor: ((planId?: number) => void) | undefined = inject('openPlanEditor')
const selectedCategory = ref('')
const selectedLevel = ref('')
const selectedStatus = ref('1') // 默认显示激活的计划
const plans = ref<any[]>([])
const loading = ref(false)
const showQuickCreateDialog = ref(false)
const showTemplateDialog = ref(false)
const showDetailDialog = ref(false)
const viewingPlanId = ref<number | null>(null)

// 教师模式：添加学生相关
const showAddStudentsDialog = ref(false)
const selectedPlanForStudents = ref<any>(null)
const teacherStudents = ref<any[]>([])
const selectedStudentIds = ref<number[]>([])
const loadingStudents = ref(false)
const addingStudents = ref(false)
const selectAllStudents = computed({
  get: () => selectedStudentIds.value.length === teacherStudents.value.length && teacherStudents.value.length > 0,
  set: () => {}
})

// 获取用户信息
const userInfo = ref<any>(null)

// 成长计划链接/二维码
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

// 成功消息弹窗
const showSuccessDialog = ref(false)
const successMessage = ref('')

const showSuccess = (message: string) => {
  successMessage.value = message
  showSuccessDialog.value = true
}

// 获取计划列表
async function fetchPlans() {
  loading.value = true
  try {
    // 构建查询参数
    const params: any = {}

    if (selectedCategory.value) {
      params.category = selectedCategory.value
    }

    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }
    
    if (selectedStatus.value !== '') {
      params.is_active = selectedStatus.value
    }
    
    const response = await axios.get(`${BASE_URL}/learning-plans/all`, { params })
    
    if (response.data.success) {
      plans.value = response.data.data || []
    }
  } catch (error: any) {
    console.error('获取学习计划列表失败:', error)
    const errorMsg = error.response?.data?.message || error.message || '获取学习计划列表失败'
    alert(`获取学习计划列表失败: ${errorMsg}`)
  } finally {
    loading.value = false
  }
}

function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find(t => t.name === category)
  return type?.display_name || category
}

// 格式化日期
function formatDate(dateString: string) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 获取状态样式类
function getStatusClass(plan: any) {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return 'status-upcoming'
  if (now > end) return 'status-ended'
  return 'status-active'
}

// 获取状态文本
function getStatusText(plan: any) {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return '未开始'
  if (now > end) return '已结束'
  return '进行中'
}

// 查看计划详情
function viewPlan(id: number) {
  viewingPlanId.value = id
  showDetailDialog.value = true
}

// 切换计划激活状态
async function togglePlanStatus(plan: any) {
  const action = plan.is_active ? '停用' : '激活'
  if (!confirm(`确定要${action}这个学习计划吗？`)) {
    return
  }
  
  try {
    await axios.put(`${BASE_URL}/learning-plans/${plan.id}`, {
      is_active: plan.is_active ? 0 : 1
    })
    alert(`学习计划${action}成功`)
    fetchPlans()
  } catch (error: any) {
    console.error('修改计划状态失败:', error)
    alert('修改计划状态失败: ' + (error.response?.data?.error || error.message))
  }
}

// 复制计划
async function copyPlan(plan: any) {
  const newName = prompt('请输入新计划名称（留空则自动添加"(副本)"后缀）：', `${plan.name}(副本)`)
  if (newName === null) return // 用户取消
  
  try {
    const params: any = {}
    if (newName.trim()) {
      params.name = newName.trim()
    }
    await axios.post(`${BASE_URL}/learning-plans/${plan.id}/copy`, params)
    alert('计划复制成功')
    fetchPlans()
  } catch (error: any) {
    console.error('复制计划失败:', error)
    alert('复制计划失败: ' + (error.response?.data?.error || error.message))
  }
}

// 删除计划
async function deletePlan(id: number) {
  if (!confirm('确定要删除这个学习计划吗？此操作不可恢复！')) {
    return
  }
  
  try {
    await axios.delete(`${BASE_URL}/learning-plans/${id}`)
    alert('学习计划删除成功')
    fetchPlans()
  } catch (error: any) {
    console.error('删除学习计划失败:', error)
    alert('删除学习计划失败: ' + (error.response?.data?.error || error.message))
  }
}

// 快速创建成功后，自动打开编辑器
async function handleQuickCreated(planId: number) {
  await fetchPlans()
  openPlanEditor?.(planId)
}

// 从模板创建成功后，自动打开编辑器
async function handleTemplateCreated(planId: number) {
  await fetchPlans()
  openPlanEditor?.(planId)
}

// 保存为模板
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

// 教师模式：打开添加学生弹窗
async function openAddStudentsDialog(plan: any) {
  selectedPlanForStudents.value = plan
  selectedStudentIds.value = []
  showAddStudentsDialog.value = true
  
  // 加载教师的学生列表
  loadingStudents.value = true
  try {
    const teacherId = userInfo.value?.id
    if (!teacherId) {
      alert('无法获取教师信息')
      return
    }
    const response = await axios.get(`${BASE_URL}/teacher/${teacherId}/students`)
    // 处理不同的响应格式
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

// 全选/取消全选
function toggleSelectAll() {
  if (selectedStudentIds.value.length === teacherStudents.value.length) {
    selectedStudentIds.value = []
  } else {
    selectedStudentIds.value = teacherStudents.value.map((s: any) => s.id)
  }
}

// 添加学生到计划
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
      
      let message = ''
      if (results.length > 0) {
        message = `添加完成！成功添加: ${successCount} 个学生`
        if (alreadyJoinedCount > 0) {
          message += `，已在计划中: ${alreadyJoinedCount} 个`
        }
      } else {
        message = `成功添加 ${selectedStudentIds.value.length} 个学生到计划`
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

// 成长计划链接：未开启时先开启再展示二维码
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

  // 获取用户信息
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
  }
  
  fetchPlans()
})
</script>
  
<style scoped>
.plan-management {
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  color: #1e293b;
  font-weight: 600;
  font-size: 14px;
}

.filter-select {
  padding: 8px 16px;
  border: 2px solid #bae6fd;
  border-radius: 8px;
  background: white;
  color: #1e293b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-select:hover {
  border-color: #1e90ff;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
}

.filter-select:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.plans-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
}

.plans-table {
  width: 100%;
  border-collapse: collapse;
}

.plans-table thead {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.plans-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.plans-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
}

.plans-table tbody tr:hover {
  background: #f8fafc;
}

.title-cell {
  font-weight: 500;
  color: #1e90ff;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-badge {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.category-gesp { background: #dbeafe; color: #1e40af; }
.category-csp_j { background: #dcfce7; color: #166534; }
.category-csp_s { background: #dcfce7; color: #166534; }
.category-noi_p { background: #fef3c7; color: #92400e; }
.category-noi_a { background: #fef3c7; color: #92400e; }
.category-noi_ioi { background: #fce7f3; color: #9d174d; }
.category-leetcode { background: #f3e8ff; color: #6b21a8; }
.category-other { background: #f1f5f9; color: #475569; }

.no-level {
  color: #94a3b8;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-active {
  background: #d1fae5;
  color: #059669;
}

.status-upcoming {
  background: #fef3c7;
  color: #d97706;
}

.status-ended {
  background: #fee2e2;
  color: #dc2626;
}

.active-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.active-badge.is-active {
  background: #d1fae5;
  color: #059669;
}

.active-badge.is-inactive {
  background: #fee2e2;
  color: #dc2626;
}
  
  .action-buttons {
    display: flex;
    gap: 8px;
  }
  
  .btn-action {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 14px;
  }
  
  .btn-view {
    background: #0ea5e9;
    color: white;
  }
  
  .btn-view:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }
  
  .btn-edit {
    background: #f59e0b;
    color: white;
  }
  
  .btn-edit:hover {
    background: #d97706;
    transform: translateY(-1px);
  }
  
  .btn-toggle {
    background: #8b5cf6;
    color: white;
  }
  
  .btn-toggle:hover {
    background: #7c3aed;
    transform: translateY(-1px);
  }

  .btn-copy {
    background: #10b981;
    color: white;
  }
  
  .btn-copy:hover {
    background: #059669;
    transform: translateY(-1px);
  }

  .btn-save-template {
    background: #6366f1;
    color: white;
  }

  .btn-save-template:hover {
    background: #4f46e5;
    transform: translateY(-1px);
  }

  .btn-plan-link {
    background: #38bdf8;
    color: white;
    font-size: 12px;
  }

  .btn-plan-link:hover:not(:disabled) {
    background: #0ea5e9;
    transform: translateY(-1px);
  }

  .btn-plan-link:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-delete {
    background: #ef4444;
    color: white;
  }
  
  .btn-delete:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }
  
  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  }

  .btn-quick {
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    color: white;
  }

  .btn-quick:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-template {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
  }

  .btn-template:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #1e90ff;
  }
  
  .loading-state i {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .loading-state p {
    font-size: 16px;
    font-weight: 500;
    color: #64748b;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #64748b;
  }
  
  .empty-state i {
    font-size: 64px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  .empty-state p {
    font-size: 18px;
    font-weight: 500;
  }

  .btn-add-students {
    background: #6366f1;
    color: white;
  }
  
  .btn-add-students:hover {
    background: #4f46e5;
    transform: translateY(-1px);
  }

  /* 添加学生弹窗样式 */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    border-radius: 12px;
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 18px;
    color: #1e293b;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #64748b;
  }

  .dialog-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #e2e8f0;
  }

  .btn-secondary {
    background: #e2e8f0;
    color: #1e293b;
  }

  .btn-secondary:hover {
    background: #cbd5e1;
  }

  .students-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .select-all {
    padding: 8px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .student-item {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .student-item label,
  .select-all label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .student-item input[type="checkbox"],
  .select-all input[type="checkbox"] {
    width: 16px;
    height: 16px;
  }

  /* 成长计划链接/二维码弹窗 */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; overflow-y: auto; }
  .modal-card { background: #fff; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; }
  .modal-card h4 { margin: 0 0 12px 0; }
  .modal-qr-card { max-width: 420px; padding: 0; overflow: hidden; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
  .modal-qr-header { position: relative; padding: 20px 24px 16px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-bottom: 1px solid #bae6fd; }
  .modal-qr-header h4 { margin: 0 0 4px 0; font-size: 1.2rem; font-weight: 600; color: #0f172a; }
  .modal-qr-subtitle { font-size: 0.9rem; color: #64748b; }
  .modal-qr-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border: none; background: rgba(255,255,255,0.8); color: #64748b; font-size: 1.5rem; line-height: 1; border-radius: 10px; cursor: pointer; }
  .modal-qr-close:hover { background: #fff; color: #0f172a; }
  .modal-qr-body { padding: 24px; }
  .qr-block { text-align: center; margin-bottom: 24px; }
  .qr-hint { margin: 0 0 16px 0; font-size: 0.9rem; color: #475569; }
  .qr-canvas-wrap { display: inline-flex; padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .qr-image { display: block; width: 200px; height: 200px; }
  .btn-copy-qr { margin-top: 12px; padding: 10px 20px; background: #0f172a; color: #fff; border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
  .btn-copy-qr:hover:not(:disabled) { background: #334155; }
  .btn-copy-qr:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-copy-qr.copied { background: #16a34a; }
  .url-block .url-label { margin: 0 0 8px 0; font-size: 0.9rem; color: #475569; }
  .url-box { display: flex; gap: 10px; margin-bottom: 10px; }
  .url-input { flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; background: #f8fafc; }
  .url-block .btn-copy { padding: 10px 18px; background: #1e90ff; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 500; flex-shrink: 0; }
  .url-block .btn-copy:hover { background: #0c7cd5; }
  .url-block .btn-copy.copied { background: #16a34a; }
  .url-block .tip { margin: 0; font-size: 0.82rem; color: #64748b; }
  .modal-qr-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; }
  .modal-qr-footer .btn-close { padding: 10px 24px; background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-size: 0.95rem; }
  .modal-qr-footer .btn-close:hover { background: #e2e8f0; }
  </style>
  
  