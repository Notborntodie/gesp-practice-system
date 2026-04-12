<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>快速创建学习计划</h3>
        <button class="modal-close-btn" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label>分类</label>
              <select v-model="formData.category">
                <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                  {{ type.display_name || type.name }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="formData.category === 'GESP'">
              <label>级别</label>
              <select v-model="formData.level">
                <option v-for="n in 8" :key="n" :value="String(n)">GESP {{ n }}级</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>计划名称<span class="required">*</span></label>
            <input v-model="formData.name" type="text" placeholder="请输入计划名称" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>开始时间<span class="required">*</span></label>
              <input v-model="formData.start_time" type="date" />
            </div>
            <div class="form-group">
              <label>结束时间<span class="required">*</span></label>
              <input v-model="formData.end_time" type="date" />
            </div>
          </div>

          <div class="form-group">
            <label>任务数量</label>
            <div class="task-count-control">
              <button class="count-btn" @click="changeTaskCount(-1)" :disabled="formData.taskCount <= 1">
                <i class="fas fa-minus"></i>
              </button>
              <span class="count-value">{{ formData.taskCount }}</span>
              <button class="count-btn" @click="changeTaskCount(1)" :disabled="formData.taskCount >= 20">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 任务预览 -->
        <div class="form-section" v-if="formData.start_time && formData.end_time && formData.taskCount > 0">
          <h4>任务预览</h4>
          <div class="task-preview-list">
            <div v-for="(task, index) in taskPreview" :key="index" class="task-preview-item">
              <span class="task-index">{{ index + 1 }}</span>
              <span class="task-name">{{ task.name }}</span>
              <span class="task-time">{{ task.startLabel }} — {{ task.endLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-confirm" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '创建中...' : '创建并编辑详情' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import { BASE_URL } from '@/config/api'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  'created-with-id': [planId: number]
}>()

const formData = ref({
  category: 'GESP',
  level: '1',
  name: '',
  start_time: '',
  end_time: '',
  taskCount: 6
})

const submitting = ref(false)

// 分类或级别变化时自动更新名称建议
const suggestedName = computed(() => {
  if (formData.value.name) return formData.value.name
  const cat = allQuestionTypes.value.find(t => t.name === formData.value.category)
  const catName = cat?.display_name || cat?.name || formData.value.category
  if (formData.value.category === 'GESP') {
    return `${catName} ${formData.value.level}级学习计划`
  }
  return `${catName} 学习计划`
})

watch(() => [formData.value.category, formData.value.level], () => {
  if (!formData.value.name) {
    // name is empty, suggestedName will auto-update via computed
  }
}, { immediate: true })

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
  if (!suggestedName.value) {
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
      name: suggestedName.value,
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
  fetchQuestionTypes()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 560px;
  max-height: 90vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  color: white;
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
}

.modal-close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  color: white;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.form-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.form-section h4 {
  margin: 0 0 12px 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #1e293b;
  font-weight: 600;
  font-size: 13px;
}

.required {
  color: #ef4444;
  margin-left: 4px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.task-count-control {
  display: flex;
  align-items: center;
  gap: 16px;
}

.count-btn {
  width: 36px;
  height: 36px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #1e293b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
}

.count-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
}

.count-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.count-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  min-width: 32px;
  text-align: center;
}

.task-preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  font-size: 13px;
}

.task-index {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.task-name {
  color: #1e293b;
  font-weight: 600;
  flex: 1;
}

.task-time {
  color: #64748b;
  font-size: 12px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
}

.btn-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-confirm {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
