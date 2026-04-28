<template>
  <div class="teacher-layout">
    <NLayout has-sider class="teacher-sider-layout" sider-placement="right">
      <NLayout class="teacher-content-layout">
        <div class="teacher-content">
          <!-- 学生管理 -->
          <div v-if="currentActiveSection === 'student-management'" class="student-management-wrapper" :class="{ 'has-panel': selectedStudentForPlanProgress || selectedStudentForPlanManagement }">
            <div class="student-management-main">
              <StudentManagementSection
                :students="students"
                :loading="studentsLoading"
                :has-panel="!!(selectedStudentForPlanProgress || selectedStudentForPlanManagement)"
                @bind-student="handleBindStudent"
                @create-student="showCreateStudentDialog = true"
                @batch-create-student="showBatchCreateDialog = true"
                @view-plan-progress="showStudentPlanProgress"
                @manage-plans="showStudentPlanManagement"
                @reset-password="handleResetPassword"
                @unbind-student="handleUnbindStudent"
                @update-class="handleUpdateClass"
              />
            </div>
            <StudentPlanProgressPanel
              v-if="selectedStudentForPlanProgress"
              :student-id="selectedStudentForPlanProgress.id"
              :student-info="selectedStudentForPlanProgress"
              :teacher-id="userInfo?.id || 0"
              @close="closeStudentPlanProgress"
            />
            <StudentPlanManagementPanel
              v-if="selectedStudentForPlanManagement"
              :student-id="selectedStudentForPlanManagement.id"
              :student-info="selectedStudentForPlanManagement"
              :teacher-id="userInfo?.id || 0"
              @close="closeStudentPlanManagement"
              @plan-updated="handlePlanUpdated"
            />
          </div>

          <!-- 客观题提交 -->
          <div v-else-if="currentActiveSection === 'objective-submissions'" class="section-wrapper">
            <ObjectiveSubmissionsSection />
          </div>

          <!-- OJ提交 -->
          <div v-else-if="currentActiveSection === 'oj-submissions'" class="section-wrapper">
            <OJSubmissionsSection />
          </div>

          <!-- 测试管理 -->
          <div v-else-if="currentActiveSection === 'my-tests'" class="section-wrapper">
            <AdminTestManagementSection />
          </div>

          <!-- 欢迎页 -->
          <div v-else class="welcome-wrapper">
            <div class="welcome-content">
              <h3>欢迎来到教师管理</h3>
              <p>请从右侧菜单选择功能模块</p>
            </div>
          </div>
        </div>
      </NLayout>
      <NLayoutSider
        :collapsed="collapsed"
        :collapsed-width="64"
        :width="200"
        :native-scrollbar="false"
        bordered
        show-trigger="bar"
        collapse-mode="width"
        @update:collapsed="collapsed = $event"
      >
        <div class="sidebar-title">教师端</div>
        <NMenu
          :value="currentActiveSection"
          :options="menuOptions"
          :collapsed="collapsed"
          :collapsed-width="64"
          @update:value="openSection"
        />
      </NLayoutSider>
    </NLayout>

    <!-- 对话框们 (暂时保留旧样式，后续迁移到 AppDialog) -->
    <!-- 创建学生对话框 -->
    <div v-if="showCreateStudentDialog" class="dialog-overlay" @click="closeCreateStudentDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>创建学生</h3>
          <button @click="closeCreateStudentDialog" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="createStudent" class="user-form">
            <div class="form-row">
              <div class="form-group">
                <label for="student_username">用户名 *</label>
                <input id="student_username" v-model="newStudent.username" type="text" required placeholder="请输入用户名" />
              </div>
              <div class="form-group">
                <label for="student_password">密码 *</label>
                <input id="student_password" v-model="newStudent.password" type="password" required placeholder="请输入密码" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="student_class_no">班级编号</label>
                <input id="student_class_no" v-model="newStudent.class_no" type="text" placeholder="如：1班、2班（可选）" />
              </div>
              <div class="form-group">
                <label for="student_email">邮箱</label>
                <input id="student_email" v-model="newStudent.email" type="email" placeholder="请输入邮箱地址" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="student_real_name">真实姓名</label>
                <input id="student_real_name" v-model="newStudent.real_name" type="text" placeholder="请输入真实姓名" />
              </div>
            </div>
            <div class="form-group">
              <label>角色</label>
              <div class="role-info">
                <span class="role-badge role-user">普通用户</span>
                <span class="role-description">学生将自动获得普通用户角色</span>
              </div>
            </div>
            <div class="form-group">
              <label>自动绑定</label>
              <div class="bind-option">
                <label class="bind-checkbox">
                  <input type="checkbox" v-model="autoBindStudent" checked />
                  <span class="bind-label">创建后自动绑定到我的学生列表</span>
                </label>
              </div>
            </div>
            <div class="dialog-actions">
              <button type="button" @click="closeCreateStudentDialog" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary" :disabled="isCreatingStudent">{{ isCreatingStudent ? '创建中...' : '创建学生' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 绑定学生对话框 -->
    <div v-if="showBindStudentDialog" class="dialog-overlay" @click="closeBindStudentDialog">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>绑定学生</h3>
          <button @click="closeBindStudentDialog" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <div v-if="availableStudents.length === 0" class="empty-state"><p>暂无可绑定的学生</p></div>
          <div v-else class="available-students">
            <h4>选择要绑定的学生：</h4>
            <div class="form-group bind-class-row">
              <label for="bind_class_no">班级编号</label>
              <input id="bind_class_no" v-model="bindStudentClassNo" type="text" placeholder="如：1班、2班、A班（可选）" class="class-no-input" />
            </div>
            <div class="search-box">
              <input v-model="bindStudentSearchQuery" type="text" placeholder="搜索学生用户名、真实姓名或邮箱..." class="search-input" />
            </div>
            <div class="students-list">
              <div
                v-for="student in filteredAvailableStudents"
                :key="student.id"
                class="student-item"
                :class="{ selected: selectedStudentIds.includes(student.id) }"
                @click="toggleStudentSelection(student.id)"
              >
                <div class="student-info-row">
                  <span class="student-name">{{ student.real_name || student.username }}</span>
                  <span class="student-username">@{{ student.username }}</span>
                  <span v-if="student.email" class="student-email">{{ student.email }}</span>
                </div>
                <div v-if="student.class_no" class="student-class-badge">{{ student.class_no }}</div>
              </div>
            </div>
            <div class="selected-count">已选择 {{ selectedStudentIds.length }} 名学生</div>
            <div class="dialog-actions">
              <button @click="closeBindStudentDialog" class="btn-secondary">取消</button>
              <button @click="bindSelectedStudents" class="btn-primary" :disabled="isBindingStudent || selectedStudentIds.length === 0">
                {{ isBindingStudent ? '绑定中...' : `绑定 ${selectedStudentIds.length} 名学生` }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量创建对话框 -->
    <div v-if="showBatchCreateDialog" class="dialog-overlay" @click="closeBatchCreateDialog">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>批量创建学生</h3>
          <button @click="closeBatchCreateDialog" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <form @submit.prevent="batchCreateStudents">
            <div class="form-group">
              <label>班级编号</label>
              <input v-model="batchClassNo" type="text" placeholder="如：1班、2班（可选）" />
            </div>
            <div class="form-group">
              <label>学生名单 <span class="hint">（每行一个真实姓名）</span></label>
              <textarea
                v-model="batchStudentNames"
                placeholder="张三&#10;李四&#10;王五"
                rows="8"
                class="batch-textarea"
              ></textarea>
            </div>
            <div class="dialog-actions">
              <button type="button" @click="closeBatchCreateDialog" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary" :disabled="isBatchCreating">{{ isBatchCreating ? '创建中...' : '批量创建' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 成功消息 -->
    <SuccessMessageDialog v-if="showSuccessDialog" :message="successMessage" @close="showSuccessDialog = false" />
    <!-- 确认对话框 -->
    <ConfirmDialog v-if="showConfirmDialog" :title="confirmTitle" :message="confirmMessage" @confirm="handleConfirmAction" @cancel="showConfirmDialog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, reactive, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NLayout, NLayoutSider, NMenu } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { BASE_URL } from '@/config/api'
import axios from 'axios'
import SuccessMessageDialog from '@/components/admin/Dialog/SuccessMessageDialog.vue'
import ConfirmDialog from '@/components/admin/Dialog/ConfirmDialog.vue'
import ObjectiveSubmissionsSection from '@/components/teacher/ObjectiveSubmissionsSection.vue'
import OJSubmissionsSection from '@/components/teacher/OJSubmissionsSection.vue'
import StudentManagementSection from '@/components/teacher/StudentManagementSection.vue'
import StudentPlanProgressPanel from '@/components/teacher/StudentPlanProgressPanel.vue'
import StudentPlanManagementPanel from '@/components/teacher/StudentPlanManagementPanel.vue'
import AdminTestManagementSection from '@/components/admin/AdminTestManagementSection.vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

// Menu
const menuOptions: MenuOption[] = [
  { label: '学生管理', key: 'student-management' },
  { label: '客观题提交', key: 'objective-submissions' },
  { label: 'OJ提交', key: 'oj-submissions' },
  { label: '测试管理', key: 'my-tests' },
]

// === State (copied from TeacherView - same business logic) ===
const currentActiveSection = ref<string>('')
const userInfo = ref<any>(null)
const students = ref<any[]>([])
const studentsLoading = ref(false)
const showCreateStudentDialog = ref(false)
const showBindStudentDialog = ref(false)
const showBatchCreateDialog = ref(false)
const isCreatingStudent = ref(false)
const isBindingStudent = ref(false)
const isBatchCreating = ref(false)
const availableStudents = ref<any[]>([])
const selectedStudentIds = ref<number[]>([])
const bindStudentSearchQuery = ref('')
const bindStudentClassNo = ref('')
const batchClassNo = ref('')
const batchStudentNames = ref('')
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showConfirmDialog = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmAction = ref<(() => void) | null>(null)
const selectedStudentForPlanProgress = ref<any>(null)
const selectedStudentForPlanManagement = ref<any>(null)
const autoBindStudent = ref(true)
const newStudent = reactive({ username: '', password: '', email: '', real_name: '', class_no: '', role_id: 2 })

const filteredAvailableStudents = computed(() => {
  if (!bindStudentSearchQuery.value) return availableStudents.value
  const q = bindStudentSearchQuery.value.toLowerCase()
  return availableStudents.value.filter((s: any) =>
    (s.username || '').toLowerCase().includes(q) ||
    (s.real_name || '').toLowerCase().includes(q) ||
    (s.email || '').toLowerCase().includes(q)
  )
})

// === Methods (copied from TeacherView - same business logic) ===
function openSection(sectionKey: string) {
  currentActiveSection.value = sectionKey
  saveCurrentState()
  if (sectionKey === 'student-management' && userInfo.value) fetchStudents()
}

function saveCurrentState() {
  if (currentActiveSection.value) localStorage.setItem('teacherView_activeSection', currentActiveSection.value)
}

function closeStudentPlanProgress() { selectedStudentForPlanProgress.value = null }
function closeStudentPlanManagement() { selectedStudentForPlanManagement.value = null }
function handlePlanUpdated() { fetchStudents() }
function closeCreateStudentDialog() { showCreateStudentDialog.value = false; resetNewStudentForm() }
function closeBindStudentDialog() { showBindStudentDialog.value = false; selectedStudentIds.value = []; bindStudentSearchQuery.value = ''; bindStudentClassNo.value = '' }
function closeBatchCreateDialog() { showBatchCreateDialog.value = false; batchStudentNames.value = ''; batchClassNo.value = '' }

function resetNewStudentForm() {
  newStudent.username = ''; newStudent.password = ''; newStudent.email = ''; newStudent.real_name = ''; newStudent.class_no = ''
}

function showSuccessMsg(msg: string) { successMessage.value = msg; showSuccessDialog.value = true }
function handleConfirmAction() { if (confirmAction.value) { confirmAction.value(); confirmAction.value = null } showConfirmDialog.value = false }

function toggleStudentSelection(id: number) {
  const idx = selectedStudentIds.value.indexOf(id)
  if (idx > -1) selectedStudentIds.value.splice(idx, 1)
  else selectedStudentIds.value.push(id)
}

async function fetchUserInfo() {
  try {
    const res = await axios.get(`${BASE_URL}/api/users/profile`)
    userInfo.value = res.data
    if (!currentActiveSection.value && userInfo.value) {
      const saved = localStorage.getItem('teacherView_activeSection')
      if (saved) { currentActiveSection.value = saved }
      else { currentActiveSection.value = 'student-management'; fetchStudents() }
    }
  } catch (e) { console.error('获取用户信息失败', e) }
}

async function fetchStudents() {
  if (!userInfo.value) return
  studentsLoading.value = true
  try {
    const res = await axios.get(`${BASE_URL}/api/teachers/${userInfo.value.id}/students`)
    students.value = res.data
  } catch (e) { console.error('获取学生列表失败', e) }
  finally { studentsLoading.value = false }
}

async function createStudent() {
  isCreatingStudent.value = true
  try {
    const res = await axios.post(`${BASE_URL}/api/users/create`, newStudent)
    if (autoBindStudent.value && userInfo.value) {
      await axios.post(`${BASE_URL}/api/teachers/${userInfo.value.id}/students/${res.data.id}/bind`, { class_no: newStudent.class_no })
    }
    showSuccessMsg('学生创建成功')
    closeCreateStudentDialog()
    fetchStudents()
  } catch (e: any) { showSuccessMsg(e.response?.data?.error || '创建失败') }
  finally { isCreatingStudent.value = false }
}

async function handleBindStudent() {
  showBindStudentDialog.value = true
  try {
    const res = await axios.get(`${BASE_URL}/api/users?role=user&unbound=true`)
    availableStudents.value = res.data.filter((s: any) => !students.value.some((us: any) => us.id === s.id))
  } catch (e: any) { showSuccessMsg('获取可绑定学生失败') }
}

async function bindSelectedStudents() {
  if (!userInfo.value || selectedStudentIds.value.length === 0) return
  isBindingStudent.value = true
  try {
    for (const id of selectedStudentIds.value) {
      await axios.post(`${BASE_URL}/api/teachers/${userInfo.value.id}/students/${id}/bind`, { class_no: bindStudentClassNo.value })
    }
    showSuccessMsg(`成功绑定 ${selectedStudentIds.value.length} 名学生`)
    closeBindStudentDialog()
    fetchStudents()
  } catch (e: any) { showSuccessMsg(e.response?.data?.error || '绑定失败') }
  finally { isBindingStudent.value = false }
}

async function handleBatchCreate() {
  showBatchCreateDialog.value = true
}

async function batchCreateStudents() {
  if (!batchStudentNames.value.trim() || !userInfo.value) return
  isBatchCreating.value = true
  try {
    const names = batchStudentNames.value.split('\n').map(n => n.trim()).filter(n => n)
    let successCount = 0
    for (const name of names) {
      try {
        const res = await axios.post(`${BASE_URL}/api/users/create`, { username: name, password: '123456', real_name: name, role_id: 2, class_no: batchClassNo.value })
        await axios.post(`${BASE_URL}/api/teachers/${userInfo.value.id}/students/${res.data.id}/bind`, { class_no: batchClassNo.value })
        successCount++
      } catch (e) { console.error(`创建学生 ${name} 失败`, e) }
    }
    showSuccessMsg(`成功创建并绑定 ${successCount} 名学生`)
    closeBatchCreateDialog()
    fetchStudents()
  } catch (e: any) { showSuccessMsg('批量创建失败') }
  finally { isBatchCreating.value = false }
}

function showStudentPlanProgress(student: any) { selectedStudentForPlanProgress.value = student }
function showStudentPlanManagement(student: any) { selectedStudentForPlanManagement.value = student }

function handleResetPassword(student: any) {
  confirmTitle.value = '重置密码'
  confirmMessage.value = `确定要重置学生 ${student.real_name || student.username} 的密码为默认密码 123456 吗？`
  confirmAction.value = async () => {
    try {
      await axios.post(`${BASE_URL}/api/users/${student.id}/reset-password`)
      showSuccessMsg('密码已重置为 123456')
    } catch (e: any) { showSuccessMsg(e.response?.data?.error || '重置失败') }
  }
  showConfirmDialog.value = true
}

function handleUnbindStudent(student: any) {
  if (!userInfo.value) return
  confirmTitle.value = '解绑学生'
  confirmMessage.value = `确定要解绑学生 ${student.real_name || student.username} 吗？解绑后该学生将不在您的管理列表中。`
  confirmAction.value = async () => {
    try {
      await axios.post(`${BASE_URL}/api/teachers/${userInfo.value.id}/students/${student.id}/unbind`)
      showSuccessMsg('解绑成功')
      fetchStudents()
    } catch (e: any) { showSuccessMsg(e.response?.data?.error || '解绑失败') }
  }
  showConfirmDialog.value = true
}

function handleUpdateClass(student: any) {
  const newClassNo = prompt(`修改 ${student.real_name || student.username} 的班级编号：`, student.class_no || '')
  if (newClassNo === null || !userInfo.value) return
  axios.post(`${BASE_URL}/api/teachers/${userInfo.value.id}/students/${student.id}/bind`, { class_no: newClassNo })
    .then(() => { showSuccessMsg('班级编号已更新'); fetchStudents() })
    .catch((e: any) => showSuccessMsg(e.response?.data?.error || '更新失败'))
}

// Lifecycle
onMounted(() => {
  fetchUserInfo()
  const saved = localStorage.getItem('teacherView_activeSection')
  if (saved) currentActiveSection.value = saved
})

watch(() => route.path, (newPath) => {
  if (newPath === '/teacher' && !currentActiveSection.value && userInfo.value) {
    currentActiveSection.value = 'student-management'
    fetchStudents()
  }
})
</script>

<style scoped>
.teacher-layout {
  height: calc(100vh - 48px);
  overflow: hidden;
}

.teacher-sider-layout {
  height: 100%;
}

.teacher-content-layout {
  overflow: auto;
}

.teacher-content {
  padding: 0;
  min-height: 100%;
}

.sidebar-title {
  padding: 16px 20px 12px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.95);
  white-space: nowrap;
  overflow: hidden;
}

.section-wrapper {
  padding: 24px;
}

.welcome-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}

.welcome-content {
  text-align: center;
  color: #a39e98;
}

.welcome-content h3 {
  font-size: 20px;
  color: rgba(0, 0, 0, 0.95);
  margin-bottom: 8px;
}

.welcome-content p {
  font-size: 14px;
}

/* Student management wrapper */
.student-management-wrapper {
  display: flex;
  min-height: calc(100vh - 48px);
}

.student-management-wrapper.has-panel .student-management-main {
  flex: 1;
  min-width: 0;
}

.student-management-main {
  flex: 1;
  padding: 0;
  overflow: auto;
}

/* Dialogs - temporary, will be replaced with AppDialog */
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  max-width: 560px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.027);
}

.dialog-large { max-width: 720px; }

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.95);
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #a39e98;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-close:hover { color: rgba(0, 0, 0, 0.95); }

.dialog-body { padding: 24px; }

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-primary {
  padding: 8px 20px;
  background: #0075de;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover { background: #0069c8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 8px 20px;
  background: transparent;
  color: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-secondary:hover { background: rgba(55, 53, 47, 0.08); }

.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }

.form-group { margin-bottom: 16px; }
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #615d59;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.95);
  background: #fff;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #0075de;
  box-shadow: 0 0 0 2px rgba(0, 117, 222, 0.15);
}

.role-info { display: flex; align-items: center; gap: 8px; }
.role-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.role-user { background: #e3f0fd; color: #0075de; }
.role-description { font-size: 12px; color: #a39e98; }
.bind-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.bind-label { font-size: 14px; color: rgba(0, 0, 0, 0.95); }

.empty-state { text-align: center; padding: 32px; color: #a39e98; }

.available-students h4 { margin: 0 0 12px; font-size: 15px; color: rgba(0, 0, 0, 0.95); }

.bind-class-row { margin-bottom: 12px; }
.search-box { margin-bottom: 12px; }
.search-input { width: 100%; }

.students-list { max-height: 300px; overflow-y: auto; margin-bottom: 12px; }

.student-item {
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.student-item:hover { background: rgba(55, 53, 47, 0.04); }
.student-item.selected { background: #e3f0fd; border-color: #0075de; }

.student-info-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.student-name { font-weight: 500; color: rgba(0, 0, 0, 0.95); }
.student-username { font-size: 12px; color: #a39e98; }
.student-email { font-size: 12px; color: #615d59; }
.student-class-badge { font-size: 11px; padding: 1px 6px; background: #f6f5f4; border-radius: 4px; color: #615d59; margin-top: 4px; display: inline-block; }

.selected-count { font-size: 13px; color: #615d59; text-align: right; }

.batch-textarea { width: 100%; min-height: 120px; }
.hint { font-size: 12px; color: #a39e98; }

@media (max-width: 768px) {
  .form-row { flex-direction: column; gap: 0; }
}
</style>
