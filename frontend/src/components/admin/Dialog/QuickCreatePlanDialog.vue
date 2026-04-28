<template>
  <AppDialog
    v-model:show="dialogVisible"
    title="快速创建学习计划"
    width="560"
    :show-footer="false"
  >
    <!-- Form Section -->
    <div class="form-section">
      <div class="form-grid">
        <AppFormField label="分类">
          <AppSelect
            v-model="formData.category"
            :options="categoryOptions"
          />
        </AppFormField>
        <AppFormField v-if="formData.category === 'GESP'" label="级别">
          <AppSelect
            v-model="formData.level"
            :options="levelOptions"
          />
        </AppFormField>
      </div>

      <AppFormField label="计划名称" required>
        <AppInput
          v-model="formData.name"
          :placeholder="suggestedNamePlaceholder"
        />
      </AppFormField>

      <div class="form-grid">
        <AppFormField label="开始时间" required>
          <AppInput v-model="formData.start_time" type="date" />
        </AppFormField>
        <AppFormField label="结束时间" required>
          <AppInput v-model="formData.end_time" type="date" />
        </AppFormField>
      </div>

      <AppFormField label="任务数量">
        <div class="task-count-control">
          <AppButton variant="ghost" size="sm" :disabled="formData.taskCount <= 1" @click="changeTaskCount(-1)">
            <Minus :size="16" />
          </AppButton>
          <span class="count-value">{{ formData.taskCount }}</span>
          <AppButton variant="ghost" size="sm" :disabled="formData.taskCount >= 20" @click="changeTaskCount(1)">
            <Plus :size="16" />
          </AppButton>
        </div>
      </AppFormField>
    </div>

    <!-- Task Preview -->
    <div v-if="formData.start_time && formData.end_time && formData.taskCount > 0" class="preview-section">
      <h6>任务预览</h6>
      <div class="task-preview-list">
        <div v-for="(task, index) in taskPreview" :key="index" class="task-preview-item">
          <span class="task-index">{{ index + 1 }}</span>
          <span class="task-name">{{ task.name }}</span>
          <span class="task-time">{{ task.startLabel }} — {{ task.endLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dialog-footer">
      <AppButton variant="ghost" @click="$emit('close')">取消</AppButton>
      <AppButton variant="primary" :disabled="submitting" :loading="submitting" @click="handleSubmit">
        创建并编辑详情
      </AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFormField from '@/components/ui/AppFormField.vue'

// Lucide Icons
import { Plus, Minus } from 'lucide-vue-next'

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

const formData = ref({
  category: 'GESP',
  level: '1',
  name: '',
  start_time: '',
  end_time: '',
  taskCount: 6
})

const submitting = ref(false)

// Options
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelOptions = computed(() => {
  const levels = []
  for (let n = 1; n <= 8; n++) {
    levels.push({ label: `GESP ${n}级`, value: String(n) })
  }
  return levels
})

// 分类或级别变化时自动更新名称建议
const suggestedNamePlaceholder = computed(() => {
  const cat = questionTypeStore.allTypes.value.find((t: any) => t.name === formData.value.category)
  const catName = cat?.display_name || cat?.name || formData.value.category
  if (formData.value.category === 'GESP') {
    return `${catName} ${formData.value.level}级学习计划`
  }
  return `${catName} 学习计划`
})

// 任务预览
const taskPreview = computed(() => {
  if (!formData.value.start_time || !formData.value.end_time) return []

  const start = new Date(formData.value.start_time)
  const end = new Date(formData.value.end_time)
  const totalMs = end.getTime() - start.getTime()
  const count = formData.value.taskCount

  if (totalMs <= 0) return []

  const taskMs = totalMs / count
  const tasks = []

  for (let i = 0; i < count; i++) {
    const taskStart = new Date(start.getTime() + i * taskMs)
    const taskEnd = new Date(start.getTime() + (i + 1) * taskMs)
    tasks.push({
      name: `任务 ${i + 1}`,
      startLabel: formatDateLabel(taskStart),
      endLabel: formatDateLabel(taskEnd)
    })
  }
  return tasks
})

function formatDateLabel(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}/${d}`
}

function changeTaskCount(delta: number) {
  formData.value.taskCount = Math.max(1, Math.min(20, formData.value.taskCount + delta))
}

async function handleSubmit() {
  const planName = formData.value.name || suggestedNamePlaceholder.value
  if (!planName) {
    alert('请填写计划名称')
    return
  }
  if (!formData.value.start_time || !formData.value.end_time) {
    alert('请选择开始和结束时间')
    return
  }

  const startDate = new Date(formData.value.start_time)
  const endDate = new Date(formData.value.end_time)
  if (endDate <= startDate) {
    alert('结束时间必须晚于开始时间')
    return
  }

  submitting.value = true

  try {
    const start = startDate
    const end = endDate
    const totalMs = end.getTime() - start.getTime()
    const count = formData.value.taskCount
    const taskMs = totalMs / count

    const tasks = []
    for (let i = 0; i < count; i++) {
      const taskStart = new Date(start.getTime() + i * taskMs)
      const taskEnd = new Date(start.getTime() + (i + 1) * taskMs)
      tasks.push({
        name: `任务 ${i + 1}`,
        description: '',
        review_content: '',
        review_content_type: 'text',
        review_video_url: '',
        start_time: taskStart.toISOString(),
        end_time: taskEnd.toISOString(),
        task_order: i + 1,
        is_exam_mode: false,
        exams: [],
        oj_problems: []
      })
    }

    const payload = {
      name: planName,
      description: '',
      category: formData.value.category,
      level: formData.value.category === 'GESP' ? parseInt(formData.value.level) : null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      tasks
    }

    const response = await axios.post(`${BASE_URL}/learning-plans`, payload)
    if (response.data.success) {
      const newPlanId = response.data.data?.id || response.data.data?.insertId
      emit('created-with-id', newPlanId)
      emit('close')
    } else {
      throw new Error(response.data.message || '创建失败')
    }
  } catch (error: any) {
    console.error('快速创建失败:', error)
    alert('创建失败: ' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
})
</script>

<style scoped>
.form-section {
  padding: var(--space-4);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.task-count-control {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.count-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-foreground);
  min-width: 40px;
  text-align: center;
}

.preview-section {
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.preview-section h6 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.task-preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
}

.task-preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.task-index {
  width: 24px;
  height: 24px;
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
  flex: 1;
}

.task-time {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
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
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>