<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ step === 'select' ? '从模板创建' : '创建计划' }}</h3>
        <button class="modal-close-btn" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Step 1: 选择模板 -->
        <template v-if="step === 'select'">
          <!-- 筛选 -->
          <div class="template-filters">
            <select v-model="filterCategory" @change="fetchTemplates" class="filter-select">
              <option value="">全部分类</option>
              <option v-for="t in allQuestionTypes" :key="t.name" :value="t.name">
                {{ t.display_name || t.name }}
              </option>
            </select>
            <select v-if="filterCategory === '' || filterCategory === 'GESP'" v-model="filterLevel" @change="fetchTemplates" class="filter-select">
              <option value="">全部级别</option>
              <option v-for="n in 8" :key="n" :value="String(n)">{{ n }}级</option>
            </select>
          </div>

          <!-- 模板列表 -->
          <div v-if="loading" class="loading-state">
            <i class="fas fa-spinner fa-spin"></i> 加载中...
          </div>
          <div v-else-if="templates.length === 0" class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>暂无模板</p>
            <p class="hint">可以先将现有计划保存为模板</p>
          </div>
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
                  <span class="category-badge" :class="'category-' + (tpl.category || 'GESP').toLowerCase()">
                    {{ getCategoryText(tpl.category) }}
                  </span>
                  <span v-if="tpl.level" class="level-tag">{{ tpl.level }}级</span>
                  <span class="task-count-tag">{{ tpl.task_count || 0 }} 个任务</span>
                </div>
              </div>
              <i class="fas fa-chevron-right template-arrow"></i>
            </div>
          </div>
        </template>

        <!-- Step 2: 填写计划信息 -->
        <template v-if="step === 'create'">
          <div class="form-section">
            <div class="form-group">
              <label>计划名称<span class="required">*</span></label>
              <input v-model="planName" type="text" placeholder="请输入计划名称" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>开始时间<span class="required">*</span></label>
                <input v-model="planStartTime" type="date" />
              </div>
              <div class="form-group">
                <label>结束时间<span class="required">*</span></label>
                <input v-model="planEndTime" type="date" />
              </div>
            </div>
          </div>

          <!-- 模板内容预览 -->
          <div class="form-section" v-if="templateDetail">
            <h4>模板内容预览</h4>
            <div class="template-tasks-preview">
              <div v-for="(task, index) in templateDetail.tasks" :key="index" class="preview-task-item">
                <div class="preview-task-header">
                  <span class="task-index">{{ index + 1 }}</span>
                  <span class="task-name">{{ task.name }}</span>
                </div>
                <div class="preview-task-meta">
                  <span v-if="task.exams && task.exams.length > 0" class="meta-tag exam-tag">
                    <i class="fas fa-file-alt"></i> {{ task.exams.length }} 份试卷
                  </span>
                  <span v-if="task.oj_problems && task.oj_problems.length > 0" class="meta-tag oj-tag">
                    <i class="fas fa-code"></i> {{ task.oj_problems.length }} 道编程题
                  </span>
                  <span v-if="task.review_content" class="meta-tag review-tag">
                    <i class="fas fa-book"></i> 有复习内容
                  </span>
                  <span v-if="task.review_video_url" class="meta-tag video-tag">
                    <i class="fas fa-video"></i> 有视频
                  </span>
                  <span v-if="task.is_exam_mode" class="meta-tag exam-mode-tag">
                    <i class="fas fa-shield-alt"></i> 考试模式
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button v-if="step === 'create'" class="btn-back" @click="step = 'select'">
          <i class="fas fa-arrow-left"></i> 返回
        </button>
        <button class="btn-cancel" @click="handleClose">取消</button>
        <button
          v-if="step === 'select'"
          class="btn-confirm"
          :disabled="!selectedTemplate"
          @click="selectTemplate"
        >
          下一步
        </button>
        <button
          v-if="step === 'create'"
          class="btn-confirm"
          :disabled="submitting"
          @click="handleCreate"
        >
          {{ submitting ? '创建中...' : '创建并编辑详情' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

function getCategoryText(category: string) {
  const type = allQuestionTypes.value.find(t => t.name === category)
  return type?.display_name || type?.name || category || 'GESP'
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
  fetchQuestionTypes()
  if (props.visible) {
    fetchTemplates()
  }
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
  max-width: 640px;
  max-height: 85vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
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

/* 筛选 */
.template-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-select {
  padding: 8px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #1e293b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-select:focus {
  outline: none;
  border-color: #6366f1;
}

/* 加载/空状态 */
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.3;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
  color: #94a3b8;
}

/* 模板列表 */
.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
}

.template-card.selected {
  border-color: #6366f1;
  background: #eef2ff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-name {
  color: #1e293b;
  font-weight: 600;
  font-size: 15px;
}

.template-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.category-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.category-gesp { background: #dbeafe; color: #2563eb; }
.category-csp_j { background: #dcfce7; color: #16a34a; }
.category-csp_s { background: #fef3c7; color: #d97706; }
.category-noi_p { background: #e0e7ff; color: #4f46e5; }
.category-noi_a { background: #fce7f3; color: #db2777; }
.category-noi_ioi { background: #f3e8ff; color: #7c3aed; }
.category-leetcode { background: #fef2f2; color: #dc2626; }
.category-other { background: #f1f5f9; color: #64748b; }

.level-tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #dbeafe;
  color: #2563eb;
}

.task-count-tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  background: #f1f5f9;
  color: #64748b;
}

.template-arrow {
  color: #94a3b8;
  font-size: 14px;
}

/* 表单 */
.form-section {
  margin-bottom: 16px;
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

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* 模板任务预览 */
.template-tasks-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.preview-task-item {
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.preview-task-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.preview-task-header .task-index {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.preview-task-header .task-name {
  color: #1e293b;
  font-weight: 600;
  font-size: 13px;
}

.preview-task-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-left: 32px;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.meta-tag i {
  font-size: 10px;
}

.exam-tag { background: #dbeafe; color: #2563eb; }
.oj-tag { background: #dcfce7; color: #16a34a; }
.review-tag { background: #fef3c7; color: #d97706; }
.video-tag { background: #f3e8ff; color: #7c3aed; }
.exam-mode-tag { background: #fef2f2; color: #dc2626; }

/* 底部按钮 */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-back,
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

.btn-back {
  background: #f1f5f9;
  color: #64748b;
  margin-right: auto;
}

.btn-back:hover {
  background: #e2e8f0;
}

.btn-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-confirm {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
