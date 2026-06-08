<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import {
  Plus,
  Users,
  Download,
  Search,
  Key,
  UserX,
  Pencil
} from 'lucide-vue-next'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// 用户信息
const userInfo = ref<any>(null)
const students = ref<any[]>([])
const loading = ref(false)

// 搜索和筛选
const searchQuery = ref('')
const classFilter = ref('')

// 对话框状态
const showCreateDialog = ref(false)
const showBindDialog = ref(false)
const showBatchDialog = ref(false)
const showEditClassDialog = ref(false)
const createLoading = ref(false)
const bindLoading = ref(false)
const batchLoading = ref(false)
const editClassLoading = ref(false)

// 消息弹窗状态
const showMessageDialog = ref(false)
const messageDialogTitle = ref('')
const messageDialogText = ref('')
const messageDialogType = ref<'success' | 'error'>('success')

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

// 创建学生表单
const newStudent = ref({
  username: '',
  password: '',
  real_name: '',
  class_no: '',
  email: '',
  autoBind: true
})

// 编辑班级
const editStudent = ref<any>(null)
const editClassNo = ref('')

// 绑定学生
const availableStudents = ref<any[]>([])
const selectedStudentIds = ref<number[]>([])
const bindClassNo = ref('')
const bindSearchQuery = ref('')

// 批量创建
const batchClassNo = ref('')
const batchNames = ref('')

// 班级选项
const classOptions = computed(() => {
  const set = new Set<string>()
  students.value.forEach(s => {
    if (s.class_no && s.class_no.trim()) {
      set.add(s.class_no.trim())
    }
  })
  return Array.from(set).sort()
})

// 过滤后的学生列表
const filteredStudents = computed(() => {
  let list = students.value
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

// 过滤后的可绑定学生
const filteredAvailableStudents = computed(() => {
  if (!bindSearchQuery.value.trim()) return availableStudents.value
  const q = bindSearchQuery.value.toLowerCase()
  return availableStudents.value.filter(s =>
    (s.username || '').toLowerCase().includes(q) ||
    (s.real_name || '').toLowerCase().includes(q) ||
    (s.email || '').toLowerCase().includes(q)
  )
})

// 获取用户信息
async function fetchUserInfo() {
  const info = localStorage.getItem('userInfo')
  if (info) {
    userInfo.value = JSON.parse(info)
  }
}

// 加载错误状态
const loadError = ref('')

// 获取学生列表
async function fetchStudents() {
  if (!userInfo.value) return
  loading.value = true
  loadError.value = ''
  try {
    const res = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/students`, { timeout: 15000 })
    if (Array.isArray(res.data)) {
      students.value = res.data
    } else if (Array.isArray(res.data?.data)) {
      students.value = res.data.data
    } else if (res.data?.students && Array.isArray(res.data.students)) {
      students.value = res.data.students
    } else {
      students.value = []
    }
  } catch (e: any) {
    console.error('获取学生列表失败:', e)
    if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      loadError.value = '请求超时，请稍后重试'
    } else if (e.response?.status === 500) {
      loadError.value = '服务器错误，请稍后重试'
    } else {
      loadError.value = e.response?.data?.error || e.message || '加载失败'
    }
  } finally {
    loading.value = false
  }
}

// 打开编辑班级对话框
function openEditClassDialog(student: any) {
  editStudent.value = student
  editClassNo.value = student.class_no || ''
  showEditClassDialog.value = true
}

// 更新班级
async function updateClassNo() {
  if (!userInfo.value || !editStudent.value) return
  editClassLoading.value = true
  try {
    await axios.put(`${BASE_URL}/teacher/${userInfo.value.id}/students/${editStudent.value.id}`, {
      class_no: editClassNo.value.trim() || null
    })
    showEditClassDialog.value = false
    editStudent.value = null
    editClassNo.value = ''
    await fetchStudents()
  } catch (e: any) {
    showError('更新失败', e.response?.data?.error || e.message)
  } finally {
    editClassLoading.value = false
  }
}

// 创建学生
async function createStudent() {
  if (!userInfo.value) return
  createLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newStudent.value.username,
        password: newStudent.value.password,
        real_name: newStudent.value.real_name,
        email: newStudent.value.email,
        role_id: 2
      })
    })
    if (res.ok) {
      const result = await res.json()
      const studentId = result.user_id || result.id || result.data?.id
      if (studentId && newStudent.value.autoBind) {
        await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, {
          student_ids: [studentId],
          class_no: newStudent.value.class_no?.trim() || undefined
        })
      }
      showCreateDialog.value = false
      resetCreateForm()
      await fetchStudents()
      showSuccess('创建成功', '学生创建成功！')
    } else {
      const err = await res.json()
      showError('创建失败', err.message || '未知错误')
    }
  } catch (e: any) {
    showError('创建失败', e.message)
  } finally {
    createLoading.value = false
  }
}

function resetCreateForm() {
  newStudent.value = { username: '', password: '', real_name: '', class_no: '', email: '', autoBind: true }
}

// 绑定学生
async function openBindDialog() {
  showBindDialog.value = true
  try {
    const res = await axios.get(`${BASE_URL}/users`, { params: { role_id: 2, limit: 100 } })
    const allStudents = res.data || []
    const boundIds = students.value.map(s => s.id)
    availableStudents.value = allStudents.filter(s => !boundIds.includes(s.id))
  } catch (e) {
    console.error('获取可绑定学生失败:', e)
  }
}

function toggleStudentSelection(id: number) {
  const idx = selectedStudentIds.value.indexOf(id)
  if (idx > -1) selectedStudentIds.value.splice(idx, 1)
  else selectedStudentIds.value.push(id)
}

async function bindStudents() {
  if (!userInfo.value || selectedStudentIds.value.length === 0) return
  bindLoading.value = true
  try {
    await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, {
      student_ids: selectedStudentIds.value,
      class_no: bindClassNo.value?.trim() || undefined
    })
    showBindDialog.value = false
    selectedStudentIds.value = []
    bindClassNo.value = ''
    bindSearchQuery.value = ''
    await fetchStudents()
    showSuccess('绑定成功', `成功绑定 ${selectedStudentIds.value.length} 名学生！`)
  } catch (e: any) {
    showError('绑定失败', e.response?.data?.error || e.message)
  } finally {
    bindLoading.value = false
  }
}

// 批量创建
async function batchCreate() {
  if (!userInfo.value || !batchNames.value.trim()) return
  batchLoading.value = true
  try {
    const names = batchNames.value.split('\n').map(n => n.trim()).filter(n => n)
    let successCount = 0
    let failCount = 0
    for (const name of names) {
      try {
        const res = await fetch(`${BASE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name + Math.floor(Math.random() * 90 + 10), password: '123456', real_name: name, role_id: 2 })
        })
        if (res.ok) {
          const result = await res.json()
          const studentId = result.user_id || result.id || result.data?.id
          if (studentId) {
            // 自动绑定到当前老师
            await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, {
              student_ids: [studentId],
              class_no: batchClassNo.value?.trim() || undefined
            })
            successCount++
          } else {
            console.error(`创建 ${name} 成功但未返回ID:`, result)
            failCount++
          }
        } else {
          const err = await res.json()
          console.error(`创建 ${name} 失败:`, err.message || err.error)
          failCount++
        }
      } catch (e) {
        console.error(`创建 ${name} 异常:`, e)
        failCount++
      }
    }
    showBatchDialog.value = false
    batchNames.value = ''
    batchClassNo.value = ''
    await fetchStudents()
    if (failCount > 0) {
      showSuccess('批量创建', `成功创建并绑定 ${successCount} 名学生，失败 ${failCount} 名。初始密码: 123456`)
    } else {
      showSuccess('批量创建', `成功创建并绑定 ${successCount} 名学生！初始密码: 123456`)
    }
  } catch (e: any) {
    showError('批量创建失败', e.message)
  } finally {
    batchLoading.value = false
  }
}

// 重置密码
async function resetPassword(student: any) {
  if (!userInfo.value) return
  if (!confirm(`确定要重置学生 ${student.real_name || student.username} 的密码为 123456？`)) return
  try {
    await axios.put(`${BASE_URL}/users/${student.id}/reset-password`, { admin_user_id: userInfo.value.id })
    showSuccess('重置成功', '密码已重置为 123456')
  } catch (e: any) {
    showError('重置失败', e.response?.data?.error || e.message)
  }
}

// 解绑学生
async function unbindStudent(student: any) {
  if (!userInfo.value) return
  if (!confirm(`确定要解绑学生 ${student.real_name || student.username}？`)) return
  try {
    await axios.delete(`${BASE_URL}/teacher/${userInfo.value.id}/students/${student.id}`)
    await fetchStudents()
    showSuccess('解绑成功', `已解绑学生 ${student.real_name || student.username}`)
  } catch (e: any) {
    showError('解绑失败', e.response?.data?.error || e.message)
  }
}

// 导出学生列表
function exportStudents() {
  if (filteredStudents.value.length === 0) return
  const headers = ['姓名', '用户名', '班级']
  const rows = filteredStudents.value.map(s => [s.real_name || s.username, s.username, s.class_no || ''])
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `学生名单_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await fetchUserInfo()
  await fetchStudents()
})
</script>

<template>
  <div class="student-management">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <Users :size="24" class="header-icon" />
        <h1 class="page-title">学生管理</h1>
        <span class="count-badge">共 {{ filteredStudents.length }} 名学生</span>
      </div>
      <div class="header-right">
        <AppButton variant="secondary" @click="exportStudents" :disabled="filteredStudents.length === 0">
          <Download :size="16" />
          导出
        </AppButton>
        <AppButton variant="secondary" @click="openBindDialog">
          <Plus :size="16" />
          绑定学生
        </AppButton>
        <AppButton variant="secondary" @click="showBatchDialog = true">
          <Users :size="16" />
          批量创建
        </AppButton>
        <AppButton variant="primary" @click="showCreateDialog = true">
          <Plus :size="16" />
          创建学生
        </AppButton>
      </div>
    </div>

    <!-- 搜索筛选 -->
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

    <!-- 学生列表 -->
    <AppEmptyState v-if="loading" type="loading" description="加载中..." />

    <div v-else-if="loadError" class="error-state">
      <p class="error-text">{{ loadError }}</p>
      <AppButton variant="secondary" @click="fetchStudents">
        重试
      </AppButton>
    </div>

    <AppEmptyState v-else-if="filteredStudents.length === 0" type="empty" description="暂无学生" />

    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>班级</th>
            <th>姓名</th>
            <th>用户名</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in filteredStudents" :key="student.id" class="table-row">
            <td>
              <span class="class-badge">{{ student.class_no || '—' }}</span>
            </td>
            <td class="student-name">{{ student.real_name || student.username }}</td>
            <td class="username">{{ student.username }}</td>
            <td>
              <div class="action-buttons">
                <AppButton variant="secondary" size="sm" @click="openEditClassDialog(student)">
                  <Pencil :size="14" />
                  编辑班级
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="resetPassword(student)">
                  <Key :size="14" />
                  重置密码
                </AppButton>
                <AppButton variant="destructive" size="sm" @click="unbindStudent(student)">
                  <UserX :size="14" />
                  解绑
                </AppButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 创建学生对话框 -->
    <AppDialog
      v-model:show="showCreateDialog"
      title="创建学生"
      width="500"
      :loading="createLoading"
      positive-text="创建"
      @positive="createStudent"
    >
      <div class="form-content">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">用户名 *</label>
            <input v-model="newStudent.username" type="text" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">密码 *</label>
            <input v-model="newStudent.password" type="password" class="form-input" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">真实姓名</label>
            <input v-model="newStudent.real_name" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">班级编号</label>
            <input v-model="newStudent.class_no" type="text" class="form-input" placeholder="如：1班" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">邮箱</label>
          <input v-model="newStudent.email" type="email" class="form-input" />
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="newStudent.autoBind" />
            <span>创建后自动绑定到我的学生列表</span>
          </label>
        </div>
      </div>
    </AppDialog>

    <!-- 编辑班级对话框 -->
    <AppDialog
      v-model:show="showEditClassDialog"
      title="编辑班级"
      width="400"
      :loading="editClassLoading"
      positive-text="保存"
      @positive="updateClassNo"
    >
      <div class="form-content">
        <div class="form-group">
          <label class="form-label">学生</label>
          <p class="student-info">{{ editStudent?.real_name || editStudent?.username }}</p>
        </div>
        <div class="form-group">
          <label class="form-label">班级编号</label>
          <input v-model="editClassNo" type="text" class="form-input" placeholder="如：1班" />
        </div>
      </div>
    </AppDialog>

    <!-- 绑定学生对话框 -->
    <AppDialog
      v-model:show="showBindDialog"
      title="绑定学生"
      width="600"
      :show-footer="false"
    >
      <div class="form-content">
        <AppEmptyState v-if="availableStudents.length === 0" type="empty" description="暂无可绑定的学生" />
        <div v-else>
          <div class="form-group">
            <label class="form-label">班级编号（可选）</label>
            <input v-model="bindClassNo" type="text" class="form-input" placeholder="如：1班" />
          </div>
          <div class="search-box">
            <Search :size="16" class="search-icon" />
            <input v-model="bindSearchQuery" type="text" placeholder="搜索..." class="search-input" />
          </div>
          <div class="students-list">
            <div
              v-for="student in filteredAvailableStudents"
              :key="student.id"
              :class="['student-item', { selected: selectedStudentIds.includes(student.id) }]"
              @click="toggleStudentSelection(student.id)"
            >
              <span class="student-name">{{ student.real_name || student.username }}</span>
              <span class="student-username">@{{ student.username }}</span>
            </div>
          </div>
          <div class="selected-count">已选择 {{ selectedStudentIds.length }} 名学生</div>
          <div class="dialog-footer-custom">
            <AppButton variant="secondary" @click="showBindDialog = false">取消</AppButton>
            <AppButton variant="primary" :loading="bindLoading" :disabled="selectedStudentIds.length === 0" @click="bindStudents">
              {{ bindLoading ? '绑定中...' : `绑定 ${selectedStudentIds.length} 名` }}
            </AppButton>
          </div>
        </div>
      </div>
    </AppDialog>

    <!-- 批量创建对话框 -->
    <AppDialog
      v-model:show="showBatchDialog"
      title="批量创建学生"
      width="500"
      :loading="batchLoading"
      positive-text="批量创建"
      @positive="batchCreate"
    >
      <div class="form-content">
        <div class="form-group">
          <label class="form-label">班级编号（可选）</label>
          <input v-model="batchClassNo" type="text" class="form-input" placeholder="如：1班" />
        </div>
        <div class="form-group">
          <label class="form-label">学生名单 <span class="hint">（每行一个姓名，自动生成用户名和密码123456，并自动绑定到您的学生列表）</span></label>
          <textarea v-model="batchNames" rows="6" class="form-input" placeholder="张三&#10;李四&#10;王五"></textarea>
        </div>
      </div>
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
.student-management {
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

.count-badge {
  padding: var(--space-1) var(--space-3);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.header-right {
  display: flex;
  gap: var(--space-2);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  min-width: 120px;
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

.table-row:hover {
  background: rgba(37, 99, 235, 0.02);
}

.class-badge {
  padding: var(--space-1) var(--space-2);
  background: rgba(37, 99, 235, 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.student-name {
  font-weight: 500;
}

.username {
  color: var(--color-text-muted);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-2);
}

/* Form Content */
.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-4);
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  background: var(--color-background);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.student-info {
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0;
}

/* Students List in Bind Dialog */
.students-list {
  max-height: 300px;
  overflow-y: auto;
  margin: var(--space-3) 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.student-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
  border-bottom: 1px solid var(--color-border);
}

.student-item:last-child {
  border-bottom: none;
}

.student-item:hover {
  background: rgba(37, 99, 235, 0.05);
}

.student-item.selected {
  background: rgba(37, 99, 235, 0.1);
}

.student-item .student-name {
  font-weight: 500;
}

.student-item .student-username {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.selected-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: right;
}

.dialog-footer-custom {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.error-text {
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
