<template>
  <AdminPageTemplate
    title="用户管理"
    :loading="loading"
    :total="users.length"
    :cache-valid="userStore.isCacheValid"
    :has-cache="userStore.hasUsers"
    @refresh="refreshUsers"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <div class="search-box">
        <AppInput
          v-model="searchQuery"
          placeholder="搜索用户名或真实姓名..."
          clearable
        />
        <Search :size="16" class="search-icon" />
      </div>
      <AppButton variant="primary" @click="showCreateDialog = true">
        <Plus :size="16" />
        创建用户
      </AppButton>
    </template>

    <!-- Content: User Cards Grid -->
    <div class="users-grid">
      <div
        v-for="user in filteredUsers"
        :key="user.id"
        class="user-card"
        @click="viewUserDetails(user)"
      >
        <div class="user-card-header">
          <div class="user-info">
            <div class="user-avatar">
              {{ user.real_name ? user.real_name.charAt(0) : user.username.charAt(0) }}
            </div>
            <div class="user-details">
              <h3 class="user-name">{{ user.real_name || user.username }}</h3>
              <p class="user-username">@{{ user.username }}</p>
              <div class="user-roles">
                <AppTag
                  v-for="role in user.roles"
                  :key="role.id"
                  :type="getRoleTagType(role.id)"
                  size="sm"
                >
                  {{ role.display_name }}
                </AppTag>
              </div>
            </div>
          </div>
          <div class="user-actions" @click.stop>
            <AppButton
              v-if="isSuperAdmin"
              variant="destructive"
              size="sm"
              @click="deleteUser(user)"
            >
              <Trash2 :size="16" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <AppEmptyState v-if="filteredUsers.length === 0 && !loading" type="empty" description="暂无用户" />

    <!-- Create User Dialog -->
    <AppFormDialog
      :show="showCreateDialog"
      title="创建用户"
      width="500"
      :loading="isCreating"
      positive-text="创建用户"
      @update:show="(val) => !val && closeCreateDialog()"
      @positive="createUser"
      @negative="closeCreateDialog"
    >
      <AppFormField label="用户名" required>
        <AppInput
          v-model="newUser.username"
          placeholder="请输入用户名"
        />
      </AppFormField>

      <AppFormField label="密码" required>
        <AppInput
          v-model="newUser.password"
          type="password"
          placeholder="请输入密码"
        />
      </AppFormField>

      <AppFormField label="邮箱">
        <AppInput
          v-model="newUser.email"
          type="email"
          placeholder="请输入邮箱地址"
        />
      </AppFormField>

      <AppFormField label="真实姓名">
        <AppInput
          v-model="newUser.real_name"
          placeholder="请输入真实姓名"
        />
      </AppFormField>

      <AppFormField label="角色（可多选）">
        <div class="role-checkboxes">
          <label class="role-checkbox">
            <input type="checkbox" v-model="newUser.role_ids" value="2" />
            <AppTag type="info" size="sm">普通用户</AppTag>
          </label>
          <label class="role-checkbox">
            <input type="checkbox" v-model="newUser.role_ids" value="3" />
            <AppTag type="warning" size="sm">教师</AppTag>
          </label>
          <label class="role-checkbox">
            <input type="checkbox" v-model="newUser.role_ids" value="1" />
            <AppTag type="success" size="sm">管理员</AppTag>
          </label>
          <label v-if="isSuperAdmin" class="role-checkbox">
            <input type="checkbox" v-model="newUser.role_ids" value="4" />
            <AppTag type="default" size="sm">超级管理员</AppTag>
          </label>
        </div>
      </AppFormField>
    </AppFormDialog>

    <!-- User Details Dialog -->
    <AppDialog
      v-model:show="showDetailsDialog"
      title="用户详细信息"
      width="600"
      :show-footer="false"
    >
      <div v-if="userDetails" class="user-details-content">
        <!-- Basic Info Section -->
        <div class="details-section">
          <div class="section-header">
            <h4>基本信息</h4>
            <AppButton
              v-if="!isEditingInDetails && isSuperAdmin"
              variant="ghost"
              size="sm"
              @click="startEditInDetails"
            >
              <Pencil :size="14" />
              编辑
            </AppButton>
          </div>

          <!-- View Mode -->
          <div v-if="!isEditingInDetails" class="user-basic-info">
            <div class="user-avatar-large">
              {{ userDetails.real_name ? userDetails.real_name.charAt(0) : userDetails.username.charAt(0) }}
            </div>
            <div class="user-basic-details">
              <h3>{{ userDetails.real_name || userDetails.username }}</h3>
              <p>@{{ userDetails.username }}</p>
              <p v-if="userDetails.email">{{ userDetails.email }}</p>
              <p class="created-time">创建时间: {{ formatDate(userDetails.created_at) }}</p>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="edit-form-in-details">
            <AppFormField label="用户名" required>
              <AppInput v-model="editingUser.username" placeholder="请输入用户名" />
            </AppFormField>
            <AppFormField label="邮箱">
              <AppInput v-model="editingUser.email" type="email" placeholder="请输入邮箱地址" />
            </AppFormField>
            <AppFormField label="真实姓名">
              <AppInput v-model="editingUser.real_name" placeholder="请输入真实姓名" />
            </AppFormField>
            <div class="edit-actions">
              <AppButton variant="ghost" @click="cancelEditInDetails">取消</AppButton>
              <AppButton variant="primary" :loading="isUpdating" @click="updateUserInDetails">保存</AppButton>
            </div>
          </div>
        </div>

        <!-- Roles Section -->
        <div class="details-section">
          <div class="section-header">
            <h4>角色信息</h4>
            <AppButton
              v-if="!isEditingRoleInDetails && isSuperAdmin"
              variant="ghost"
              size="sm"
              @click="startEditRoleInDetails"
            >
              <Shield :size="14" />
              管理角色
            </AppButton>
          </div>

          <!-- View Mode -->
          <div v-if="!isEditingRoleInDetails" class="roles-list">
            <div v-for="role in userDetails.roles" :key="role.id" class="role-item">
              <div class="role-info">
                <span class="role-name">{{ role.display_name }}</span>
                <span class="role-description">{{ role.description }}</span>
              </div>
              <span class="role-assigned-time">分配时间: {{ formatDate(role.assigned_at) }}</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="edit-role-in-details">
            <h5>选择角色（可多选）:</h5>
            <div class="role-options">
              <label class="role-option">
                <input type="checkbox" v-model="selectedRoleIds" value="2" />
                <AppTag type="info" size="sm">普通用户</AppTag>
              </label>
              <label class="role-option">
                <input type="checkbox" v-model="selectedRoleIds" value="3" />
                <AppTag type="warning" size="sm">教师</AppTag>
              </label>
              <label class="role-option">
                <input type="checkbox" v-model="selectedRoleIds" value="1" />
                <AppTag type="success" size="sm">管理员</AppTag>
              </label>
              <label v-if="isSuperAdmin" class="role-option">
                <input type="checkbox" v-model="selectedRoleIds" value="4" />
                <AppTag type="default" size="sm">超级管理员</AppTag>
              </label>
            </div>
            <div class="edit-actions">
              <AppButton variant="ghost" @click="cancelEditRoleInDetails">取消</AppButton>
              <AppButton variant="primary" :loading="isUpdatingRole" @click="updateUserRoleInDetails">保存</AppButton>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="dialog-actions">
          <AppButton
            v-if="isSuperAdmin"
            variant="secondary"
            :loading="isResettingPassword"
            @click="userDetails && resetUserPassword(userDetails)"
          >
            <Key :size="16" />
            重置密码
          </AppButton>
          <AppButton
            v-if="isSuperAdmin"
            variant="destructive"
            :loading="isDeleting"
            @click="userDetails && deleteUser(userDetails)"
          >
            <Trash2 :size="16" />
            删除用户
          </AppButton>
          <AppButton variant="ghost" @click="closeDetailsDialog">关闭</AppButton>
        </div>
      </div>
    </AppDialog>

    <!-- Success Dialog -->
    <AppDialog
      v-model:show="showSuccessDialog"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <!-- Confirm Dialog -->
    <AppDialog
      v-model:show="showConfirmDialog"
      :title="confirmTitle"
      width="400"
      positive-text="确认"
      negative-text="取消"
      @positive="handleConfirmAction"
    >
      <p style="color: var(--color-text-secondary);">{{ confirmMessage }}</p>
    </AppDialog>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, onMounted, reactive, computed } from 'vue'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppFormDialog from '@/components/ui/AppFormDialog.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Plus, Search, Trash2, Pencil, Shield, Key } from 'lucide-vue-next'

// Stores
import { useUserStore } from '../../stores/userStore'

const userStore = useUserStore()

// Types
interface Role {
  id: number
  name: string
  display_name: string
  description: string
  assigned_at: string
}

interface User {
  id: number
  username: string
  email?: string
  real_name?: string
  created_at: string
  roles: Role[]
}

// Current User
const currentUser = ref<any>(null)
const isSuperAdmin = computed(() => {
  if (!currentUser.value || !currentUser.value.roles) return false
  return currentUser.value.roles.some((role: Role) => role.id === 4)
})

const getCurrentUser = () => {
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    currentUser.value = JSON.parse(userInfoStr)
  }
}

const getCurrentUserId = (): number | null => currentUser.value?.id || null

// State
const showCreateDialog = ref(false)
const showDetailsDialog = ref(false)
const isCreating = ref(false)
const isUpdating = ref(false)
const isUpdatingRole = ref(false)
const isEditingInDetails = ref(false)
const isEditingRoleInDetails = ref(false)
const isDeleting = ref(false)
const isResettingPassword = ref(false)
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showConfirmDialog = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const userToDelete = ref<User | null>(null)
const userToResetPassword = ref<User | null>(null)
const searchQuery = ref('')

// From Store
const { users, loading } = userStore

// Form Data
const newUser = reactive({
  username: '',
  password: '',
  email: '',
  real_name: '',
  role_ids: ['2']
})

const editingUser = reactive<{
  id: number | null
  username: string
  email: string
  real_name: string
}>({
  id: null,
  username: '',
  email: '',
  real_name: ''
})

const selectedRoleIds = ref<string[]>(['2'])
const userDetails = ref<User | null>(null)

// Filtered Users
const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return users.value

  const query = searchQuery.value.toLowerCase().trim()
  return users.value.filter(user => {
    const username = (user.username || '').toLowerCase()
    const realName = (user.real_name || '').toLowerCase()
    return username.includes(query) || realName.includes(query)
  })
})

// Fetch Users
const fetchUsers = async (forceRefresh = false) => {
  try {
    await userStore.fetchUsers(forceRefresh)
  } catch (error: any) {
    console.error('获取用户列表失败:', error)
    alert('获取用户列表失败: ' + (error.response?.data?.error || error.message))
  }
}

// Create User
const createUser = async () => {
  isCreating.value = true
  try {
    const userData = {
      ...newUser,
      role_id: parseInt(newUser.role_ids[0]) || 2
    }

    const response = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    })

    if (response.ok) {
      const result = await response.json()

      if (result.user) {
        userStore.addUser(result.user)
      } else if (result.id) {
        if (newUser.role_ids.length > 1) {
          try {
            await fetch(`${BASE_URL}/users/${result.id}/roles`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role_ids: newUser.role_ids.map(id => parseInt(id)) })
            })
          } catch (roleError) {
            console.error('分配角色失败:', roleError)
          }
        }

        const basicUser = {
          id: result.id,
          username: newUser.username,
          email: newUser.email || '',
          real_name: newUser.real_name || '',
          created_at: new Date().toISOString(),
          roles: newUser.role_ids.map(roleId => {
            const roleMap: Record<string, any> = {
              '1': { id: 1, name: 'admin', display_name: '管理员', description: '系统管理员' },
              '2': { id: 2, name: 'user', display_name: '普通用户', description: '普通用户' },
              '3': { id: 3, name: 'teacher', display_name: '教师', description: '教师' },
              '4': { id: 4, name: 'super_admin', display_name: '超级管理员', description: '超级管理员' }
            }
            return { ...roleMap[roleId], assigned_at: new Date().toISOString() }
          })
        }
        userStore.addUser(basicUser)
      } else {
        await fetchUsers(true)
      }

      closeCreateDialog()
      resetNewUser()
      searchQuery.value = ''
      setTimeout(() => showSuccessMessage('用户创建成功'), 100)
    } else {
      const error = await response.json()
      alert('创建用户失败: ' + (error.message || '未知错误'))
    }
  } catch (error) {
    console.error('创建用户出错:', error)
    alert('创建用户出错')
  } finally {
    isCreating.value = false
  }
}

// Delete User
const deleteUser = (user: User) => {
  userToDelete.value = user
  confirmTitle.value = '确认删除用户'
  confirmMessage.value = `确定要删除用户 "${user.real_name || user.username}" 吗？此操作不可撤销。`
  showConfirmDialog.value = true
}

// Reset Password
const resetUserPassword = (user: User) => {
  userToResetPassword.value = user
  confirmTitle.value = '确认重置密码'
  confirmMessage.value = `确定要重置用户 "${user.real_name || user.username}" 的密码吗？密码将重置为 "123456"。`
  showConfirmDialog.value = true
}

// Confirm Actions
const confirmResetPassword = async () => {
  if (!userToResetPassword.value) return
  isResettingPassword.value = true
  try {
    const response = await fetch(`${BASE_URL}/users/${userToResetPassword.value.id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: getCurrentUserId() })
    })

    if (response.ok) {
      showSuccessMessage('用户密码重置成功，新密码为：123456')
    } else {
      const error = await response.json()
      alert('重置密码失败: ' + (error.message || '未知错误'))
    }
  } catch (error) {
    console.error('重置密码出错:', error)
    alert('重置密码出错')
  } finally {
    isResettingPassword.value = false
    closeConfirmDialog()
  }
}

const confirmDeleteUser = async () => {
  if (!userToDelete.value) return
  isDeleting.value = true
  try {
    const response = await fetch(`${BASE_URL}/users/${userToDelete.value.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user_id: getCurrentUserId() })
    })

    if (response.ok) {
      userStore.removeUser(userToDelete.value.id)
      if (userDetails.value && userDetails.value.id === userToDelete.value.id) {
        closeDetailsDialog()
      }
      showSuccessMessage('用户删除成功')
    } else {
      const error = await response.json()
      alert('删除用户失败: ' + (error.message || '未知错误'))
    }
  } catch (error) {
    console.error('删除用户出错:', error)
    alert('删除用户出错')
  } finally {
    isDeleting.value = false
    closeConfirmDialog()
  }
}

const handleConfirmAction = () => {
  if (userToDelete.value) confirmDeleteUser()
  else if (userToResetPassword.value) confirmResetPassword()
}

// Edit in Details
const startEditInDetails = () => {
  if (userDetails.value) {
    editingUser.id = userDetails.value.id
    editingUser.username = userDetails.value.username
    editingUser.email = userDetails.value.email || ''
    editingUser.real_name = userDetails.value.real_name || ''
    isEditingInDetails.value = true
  }
}

const cancelEditInDetails = () => {
  isEditingInDetails.value = false
}

const updateUserInDetails = async () => {
  isUpdating.value = true
  try {
    const response = await fetch(`${BASE_URL}/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: editingUser.username,
        email: editingUser.email,
        real_name: editingUser.real_name,
        admin_user_id: getCurrentUserId()
      })
    })

    if (response.ok) {
      if (userDetails.value) {
        userDetails.value.username = editingUser.username
        userDetails.value.email = editingUser.email
        userDetails.value.real_name = editingUser.real_name
      }
      userStore.updateUserInCache(editingUser.id!, {
        username: editingUser.username,
        email: editingUser.email,
        real_name: editingUser.real_name
      })
      isEditingInDetails.value = false
      showSuccessMessage('用户信息更新成功')
    } else {
      const error = await response.json()
      alert('更新用户失败: ' + (error.message || '未知错误'))
    }
  } catch (error) {
    console.error('更新用户出错:', error)
    alert('更新用户出错')
  } finally {
    isUpdating.value = false
  }
}

// Edit Role in Details
const startEditRoleInDetails = () => {
  if (userDetails.value && userDetails.value.roles && userDetails.value.roles.length > 0) {
    selectedRoleIds.value = userDetails.value.roles.map(role => role.id.toString())
  } else {
    selectedRoleIds.value = ['2']
  }
  isEditingRoleInDetails.value = true
}

const cancelEditRoleInDetails = () => {
  isEditingRoleInDetails.value = false
}

const updateUserRoleInDetails = async () => {
  if (!userDetails.value) return
  isUpdatingRole.value = true
  try {
    const response = await fetch(`${BASE_URL}/users/${userDetails.value.id}/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role_ids: selectedRoleIds.value.map(id => parseInt(id)),
        admin_user_id: getCurrentUserId()
      })
    })

    if (response.ok) {
      const detailsResponse = await fetch(`${BASE_URL}/users/${userDetails.value.id}`)
      if (detailsResponse.ok) {
        userDetails.value = await detailsResponse.json()
      }
      await fetchUsers()
      isEditingRoleInDetails.value = false
      showSuccessMessage('用户角色更新成功')
    } else {
      const error = await response.json()
      alert('更新角色失败: ' + (error.message || '未知错误'))
    }
  } catch (error) {
    console.error('更新角色出错:', error)
    alert('更新角色出错')
  } finally {
    isUpdatingRole.value = false
  }
}

// View Details
const viewUserDetails = async (user: User) => {
  try {
    const response = await fetch(`${BASE_URL}/users/${user.id}`)
    if (response.ok) {
      userDetails.value = await response.json()
      showDetailsDialog.value = true
    } else {
      alert('获取用户详情失败')
    }
  } catch (error) {
    console.error('获取用户详情出错:', error)
    alert('获取用户详情出错')
  }
}

// Dialog Controls
const closeCreateDialog = () => {
  showCreateDialog.value = false
  resetNewUser()
}

const closeDetailsDialog = () => {
  showDetailsDialog.value = false
  userDetails.value = null
  isEditingInDetails.value = false
  isEditingRoleInDetails.value = false
}

const closeConfirmDialog = () => {
  showConfirmDialog.value = false
  confirmTitle.value = ''
  confirmMessage.value = ''
  userToDelete.value = null
  userToResetPassword.value = null
}

const showSuccessMessage = (message: string) => {
  successMessage.value = message
  showSuccessDialog.value = true
}

const resetNewUser = () => {
  newUser.username = ''
  newUser.password = ''
  newUser.email = ''
  newUser.real_name = ''
  newUser.role_ids = ['2']
}

// Helpers
const formatDate = (dateStr: string) => {
  if (!dateStr) return '未知'
  return new Date(dateStr).toLocaleDateString()
}

const getRoleTagType = (roleId: number): 'success' | 'info' | 'warning' | 'default' => {
  const map: Record<number, 'success' | 'info' | 'warning' | 'default'> = {
    1: 'success',
    2: 'info',
    3: 'warning',
    4: 'default'
  }
  return map[roleId] || 'default'
}

const refreshUsers = async () => {
  try {
    await fetchUsers(true)
    showSuccessMessage('用户列表已刷新！')
  } catch (error: any) {
    alert('刷新失败: ' + (error.response?.data?.error || error.message))
  }
}

onMounted(async () => {
  getCurrentUser()
  if (!userStore.hasUsers.value) {
    await fetchUsers()
  } else {
    userStore.fetchUsers()
  }
})
</script>

<style scoped>
/* Search Box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 300px;
}

.search-icon {
  position: absolute;
  right: var(--space-3);
  color: var(--color-text-muted);
}

/* Users Grid */
.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-4);
}

.user-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  cursor: pointer;
}

.user-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.user-details h3 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.user-details p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.user-roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.user-actions {
  display: flex;
  gap: var(--space-2);
}

/* Role Checkboxes */
.role-checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.role-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.role-checkbox:hover {
  background: var(--color-muted);
}

.role-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

/* Details Content */
.user-details-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.details-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.section-header h4 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.user-basic-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.user-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--font-size-xl);
}

.user-basic-details h3 {
  margin: 0 0 var(--space-2);
  color: var(--color-foreground);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.user-basic-details p {
  margin: 0 0 var(--space-1);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.created-time {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.role-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.role-name {
  font-weight: 600;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.role-description {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.role-assigned-time {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.edit-form-in-details,
.edit-role-in-details {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.edit-role-in-details h5 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.role-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.role-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.role-option:hover {
  background: var(--color-muted);
}

.role-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.edit-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.dialog-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .search-box {
    width: 100%;
  }

  .users-grid {
    grid-template-columns: 1fr;
  }

  .user-basic-info {
    flex-direction: column;
    text-align: center;
  }
}
</style>