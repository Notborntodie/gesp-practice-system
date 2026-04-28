<template>
  <AppDialog
    v-model:show="dialogVisible"
    :title="step === 'select' ? '从模板创建' : '创建计划'"
    width="640"
    :show-footer="false"
  >
    <!-- Step 1: Select Template -->
    <template v-if="step === 'select'">
      <!-- Filters -->
      <div class="template-filters">
        <AppSelect
          v-model="filterCategory"
          :options="filterCategoryOptions"
          placeholder="全部分类"
          @update:model-value="fetchTemplates"
        />
        <AppSelect
          v-if="filterCategory === '' || filterCategory === 'GESP'"
          v-model="filterLevel"
          :options="filterLevelOptions"
          placeholder="全部级别"
          @update:model-value="fetchTemplates"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="templates.length === 0" class="empty-state">
        <FolderOpen :size="48" class="empty-icon" />
        <p>暂无模板</p>
        <p class="hint">可以先将现有计划保存为模板</p>
      </div>

      <!-- Template List -->
      <div v-else class="template-list">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="template-card"
          :class="{ selected: selectedTemplate?.id === tpl.id }"
          @click="selectedTemplate = tpl"
        >
          <div class="template-info">
            <span class="template-name">{{ tpl.name }}</span>
            <div class="template-meta">
              <AppTag :type="getCategoryTagType(tpl.category)" size="sm">
                {{ getCategoryText(tpl.category) }}
              </AppTag>
              <AppTag v-if="tpl.level" type="info" size="sm">{{ tpl.level }}级</AppTag>
              <AppTag type="default" size="sm">{{ tpl.task_count || 0 }} 个任务</AppTag>
            </div>
          </div>
          <ChevronRight :size="16" class="template-arrow" />
        </div>
      </div>
    </template>

    <!-- Step 2: Create Plan -->
    <template v-if="step === 'create'">
      <div class="form-section">
        <AppFormField label="计划名称" required>
          <AppInput v-model="planName" placeholder="请输入计划名称" />
        </AppFormField>
        <div class="form-grid">
          <AppFormField label="开始时间" required>
            <AppInput v-model="planStartTime" type="date" />
          </AppFormField>
          <AppFormField label="结束时间" required>
            <AppInput v-model="planEndTime" type="date" />
          </AppFormField>
        </div>
      </div>

      <!-- Template Preview -->
      <div v-if="templateDetail" class="form-section">
        <h6>模板内容预览</h6>
        <div class="template-tasks-preview">
          <div v-for="(task, index) in templateDetail.tasks" :key="index" class="preview-task-item">
            <div class="preview-task-header">
              <span class="task-index">{{ index + 1 }}</span>
              <span class="task-name">{{ task.name }}</span>
            </div>
            <div class="preview-task-meta">
              <AppTag v-if="task.exams && task.exams.length > 0" type="info" size="sm">
                {{ task.exams.length }} 份试卷
              </AppTag>
              <AppTag v-if="task.oj_problems && task.oj_problems.length > 0" type="success" size="sm">
                {{ task.oj_problems.length }} 道编程题
              </AppTag>
              <AppTag v-if="task.review_content" type="warning" size="sm">有复习内容</AppTag>
              <AppTag v-if="task.review_video_url" type="default" size="sm">有视频</AppTag>
              <AppTag v-if="task.is_exam_mode" type="destructive" size="sm">考试模式</AppTag>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Footer -->
    <div class="dialog-footer">
      <AppButton v-if="step === 'create'" variant="ghost" @click="step = 'select'">
        <ChevronLeft :size="16" />
        返回
      </AppButton>
      <AppButton variant="ghost" @click="handleClose">取消</AppButton>
      <AppButton
        v-if="step === 'select'"
        variant="primary"
        :disabled="!selectedTemplate"
        @click="selectTemplate"
      >
        下一步
      </AppButton>
      <AppButton
        v-if="step === 'create'"
        variant="primary"
        :disabled="submitting"
        :loading="submitting"
        @click="handleCreate"
      >
        创建并编辑详情
      </AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppFormField from '@/components/ui/AppFormField.vue'

// Lucide Icons
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  'created-with-id': [planId: number]
}>()

// Dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: () => emit('close')
})

// State
const step = ref<'select' | 'create'>('select')
const templates = ref<any[]>([])
const loading = ref(false)
const selectedTemplate = ref<any>(null)
const templateDetail = ref<any>(null)
const filterCategory = ref('')
const filterLevel = ref('')

const planName = ref('')
const planStartTime = ref('')
const planEndTime = ref('')
const submitting = ref(false)

// Options
const filterCategoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return [
    { label: '全部分类', value: '' },
    ...types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
  ]
})

const filterLevelOptions = [
  { label: '全部级别', value: '' },
  { label: '1级', value: '1' },
  { label: '2级', value: '2' },
  { label: '3级', value: '3' },
  { label: '4级', value: '4' },
  { label: '5级', value: '5' },
  { label: '6级', value: '6' },
  { label: '7级', value: '7' },
  { label: '8级', value: '8' },
]

function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find((t: any) => t.name === category)
  return type?.display_name || type?.name || category || 'GESP'
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

async function fetchTemplates() {
  loading.value = true
  try {
    const params: any = {}
    if (filterCategory.value) params.category = filterCategory.value
    if (filterLevel.value) params.level = filterLevel.value
    const response = await axios.get(`${BASE_URL}/plan-templates`, { params })
    if (response.data.success) {
      templates.value = response.data.data
    }
  } catch (error) {
    console.error('获取模板列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function selectTemplate() {
  if (!selectedTemplate.value) return
  try {
    const response = await axios.get(`${BASE_URL}/plan-templates/${selectedTemplate.value.id}`)
    if (response.data.success) {
      templateDetail.value = response.data.data
      planName.value = selectedTemplate.value.name
      step.value = 'create'
    }
  } catch (error) {
    console.error('获取模板详情失败:', error)
    alert('获取模板详情失败')
  }
}

async function handleCreate() {
  if (!planName.value || !planStartTime.value || !planEndTime.value) {
    alert('请填写所有必填字段')
    return
  }

  const start = new Date(planStartTime.value)
  const end = new Date(planEndTime.value)
  if (end <= start) {
    alert('结束时间必须晚于开始时间')
    return
  }

  submitting.value = true
  try {
    const response = await axios.post(
      `${BASE_URL}/plan-templates/${selectedTemplate.value.id}/create-plan`,
      {
        name: planName.value,
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }
    )
    if (response.data.success) {
      const newPlanId = response.data.data?.id
      emit('created-with-id', newPlanId)
      emit('close')
    } else {
      throw new Error(response.data.error || '创建失败')
    }
  } catch (error: any) {
    console.error('从模板创建失败:', error)
    alert('创建失败: ' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  step.value = 'select'
  selectedTemplate.value = null
  templateDetail.value = null
  planName.value = ''
  planStartTime.value = ''
  planEndTime.value = ''
  emit('close')
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
  if (props.visible) {
    fetchTemplates()
  }
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchTemplates()
  }
})
</script>

<style scoped>
.template-filters {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.empty-icon {
  color: var(--color-primary-light);
  margin-bottom: var(--space-3);
}

.empty-state p {
  margin: 0;
}

.empty-state .hint {
  font-size: var(--font-size-xs);
  margin-top: var(--space-2);
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.template-card:hover {
  border-color: var(--color-primary-light);
  background: var(--color-muted);
}

.template-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.template-name {
  color: var(--color-foreground);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.template-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.template-arrow {
  color: var(--color-text-muted);
}

.form-section {
  padding: var(--space-4);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.form-section h6 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.template-tasks-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 300px;
  overflow-y: auto;
}

.preview-task-item {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.preview-task-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.task-index {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.task-name {
  color: var(--color-foreground);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.preview-task-meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-left: var(--space-5);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .template-filters {
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>