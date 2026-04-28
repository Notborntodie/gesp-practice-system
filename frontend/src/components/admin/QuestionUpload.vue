<template>
  <AdminPageTemplate
    title="题目来源管理"
    :loading="loading"
    :total="allTypes.length"
    @refresh="refreshTypes"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="showAddDialog = true">
        <Plus :size="16" />
        新增来源
      </AppButton>
    </template>

    <!-- Content: Source List -->
    <div class="source-list-container">
      <div v-if="allTypes.length > 0" class="source-list">
        <div
          v-for="t in allTypes"
          :key="t.id"
          class="source-item"
        >
          <div class="source-info">
            <span class="source-name">{{ t.display_name }}</span>
            <AppTag type="default" size="sm">{{ t.name }}</AppTag>
            <span v-if="t.description" class="source-desc">{{ t.description }}</span>
          </div>
          <div class="source-actions">
            <AppButton
              v-if="isSuperAdmin"
              variant="ghost"
              size="sm"
              @click="deleteSource(t)"
            >
              <Trash2 :size="16" />
            </AppButton>
          </div>
        </div>
      </div>

      <AppEmptyState v-else type="empty" description="暂无题目来源" />
    </div>

    <!-- 新增题目来源弹窗 -->
    <AppFormDialog
      :show="showAddDialog"
      title="新增题目来源"
      width="420"
      :loading="adding"
      positive-text="确认添加"
      @update:show="(val) => !val && (showAddDialog = false)"
      @positive="addSource"
      @negative="showAddDialog = false"
    >
      <AppFormField label="显示名称" required>
        <AppInput
          v-model="newType.display_name"
          placeholder="如：蓝桥杯"
        />
      </AppFormField>

      <AppFormField label="类型标识" required>
        <AppInput
          v-model="newType.name"
          placeholder="如：LANQIAO（英文大写，自动转换）"
        />
      </AppFormField>

      <AppFormField label="描述">
        <AppInput
          v-model="newType.description"
          placeholder="可选描述"
        />
      </AppFormField>
    </AppFormDialog>

    <!-- Success Dialog -->
    <AppDialog
      v-model:show="showSuccessDialog"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <!-- Error Dialog -->
    <AppDialog
      v-model:show="showErrorDialog"
      title="操作失败"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-destructive);">{{ errorMessage }}</p>
    </AppDialog>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppFormDialog from '@/components/ui/AppFormDialog.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { Plus, Trash2 } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allTypes } = questionTypeStore

// State
const loading = ref(false)
const showAddDialog = ref(false)
const adding = ref(false)
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

// Form Data
const newType = ref({ name: '', display_name: '', description: '' })

// Super Admin Check
const isSuperAdmin = computed(() => {
  const userInfoStr = localStorage.getItem('userInfo')
  if (!userInfoStr) return false
  try {
    const userInfo = JSON.parse(userInfoStr)
    return userInfo.roles?.some((role: any) => role.id === 4 || role.name === 'super_admin') || false
  } catch {
    return false
  }
})

function getCurrentUserId(): number | null {
  const userInfoStr = localStorage.getItem('userInfo')
  if (!userInfoStr) return null
  try {
    const userInfo = JSON.parse(userInfoStr)
    return userInfo.id || null
  } catch {
    return null
  }
}

async function refreshTypes() {
  loading.value = true
  try {
    await questionTypeStore.fetchQuestionTypes(true)
    successMessage.value = '题目来源列表已刷新'
    showSuccessDialog.value = true
  } catch (e: any) {
    errorMessage.value = e.response?.data?.error || e.message
    showErrorDialog.value = true
  } finally {
    loading.value = false
  }
}

async function addSource() {
  if (!newType.value.display_name.trim() || !newType.value.name.trim()) {
    errorMessage.value = '请填写显示名称和类型标识'
    showErrorDialog.value = true
    return
  }

  adding.value = true
  try {
    await questionTypeStore.createQuestionType({
      name: newType.value.name,
      display_name: newType.value.display_name,
      description: newType.value.description
    }, getCurrentUserId())
    newType.value = { name: '', display_name: '', description: '' }
    showAddDialog.value = false
    successMessage.value = '题目来源添加成功'
    showSuccessDialog.value = true
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || err.message
    showErrorDialog.value = true
  } finally {
    adding.value = false
  }
}

async function deleteSource(type: any) {
  if (!confirm(`确定要删除题目来源「${type.display_name}」吗？`)) return

  const userId = getCurrentUserId()
  try {
    await axios.delete(`${BASE_URL}/question-types/${type.id}`, {
      params: { admin_user_id: userId }
    })
    await questionTypeStore.fetchQuestionTypes(true)
    successMessage.value = '题目来源删除成功'
    showSuccessDialog.value = true
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || err.message
    showErrorDialog.value = true
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await questionTypeStore.fetchQuestionTypes()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.source-list-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.source-list {
  display: flex;
  flex-direction: column;
}

.source-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition-fast);
}

.source-item:last-child {
  border-bottom: none;
}

.source-item:hover {
  background: var(--color-muted);
}

.source-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.source-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-foreground);
}

.source-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.source-actions {
  display: flex;
  gap: var(--space-2);
}
</style>