<template>
  <div class="plan-editor">
    <!-- 顶部操作栏 -->
    <div class="editor-header">
      <button class="btn-back" @click="handleBack">
        <i class="fas fa-arrow-left"></i> 返回计划列表
      </button>
      <h3 class="editor-title">{{ isEditMode ? '编辑学习计划' : '创建学习计划' }}</h3>
      <button class="btn-save" :disabled="saving" @click="handleSave">
        <i class="fas fa-check"></i> {{ saving ? '保存中...' : '保存计划' }}
      </button>
    </div>

    <!-- 主体：左右分栏 -->
    <div class="editor-body">
      <!-- 左侧面板 -->
      <div class="left-panel">
        <!-- 计划基本信息 -->
        <div class="panel-section">
          <h4 class="section-label"><i class="fas fa-info-circle"></i> 计划信息</h4>
          <div class="form-group">
            <label>计划名称<span class="required">*</span></label>
            <input v-model="formData.name" type="text" placeholder="请输入计划名称" />
          </div>
          <div class="form-group">
            <label>计划描述<span class="required">*</span></label>
            <textarea v-model="formData.description" placeholder="请输入计划描述" rows="2"></textarea>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>分类</label>
              <select v-model="formData.category">
                <option value="">请选择</option>
                <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                  {{ type.display_name || type.name }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="formData.category === 'GESP'">
              <label>级别</label>
              <select v-model="formData.level">
                <option v-for="n in 8" :key="n" :value="String(n)">{{ n }}级</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>开始时间<span class="required">*</span></label>
            <input v-model="formData.start_time" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>结束时间<span class="required">*</span></label>
            <input v-model="formData.end_time" type="datetime-local" />
          </div>
        </div>

        <!-- 任务列表 -->
        <div class="panel-section tasks-section">
          <div class="section-header">
            <h4 class="section-label"><i class="fas fa-tasks"></i> 任务列表</h4>
            <button class="btn-add-task" @click="addTask">
              <i class="fas fa-plus"></i> 添加
            </button>
          </div>
          <div v-if="formData.tasks.length === 0" class="empty-tasks">
            <p>暂无任务</p>
          </div>
          <div class="task-list">
            <div
              v-for="(task, index) in formData.tasks"
              :key="index"
              class="task-list-item"
              :class="{ active: selectedTaskIndex === index }"
              @click="selectedTaskIndex = index"
            >
              <div class="task-item-left">
                <span class="task-num">{{ index + 1 }}</span>
                <div class="task-item-info">
                  <span class="task-item-name">{{ task.name || `任务 ${index + 1}` }}</span>
                  <span class="task-item-meta">
                    <template v-if="task.start_time && task.end_time">
                      {{ shortDate(task.start_time) }} ~ {{ shortDate(task.end_time) }}
                    </template>
                    <template v-if="(task.exams && task.exams.length > 0) || (task.oj_problems && task.oj_problems.length > 0)">
                      · {{ (task.exams?.length || 0) }}卷{{ (task.oj_problems?.length || 0) }}题
                    </template>
                  </span>
                </div>
              </div>
              <div class="task-item-actions">
                <button v-if="index > 0" class="btn-move" @click.stop="moveTask(index, -1)" title="上移">
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button v-if="index < formData.tasks.length - 1" class="btn-move" @click.stop="moveTask(index, 1)" title="下移">
                  <i class="fas fa-chevron-down"></i>
                </button>
                <button class="btn-remove" @click.stop="removeTask(index)" title="删除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧面板：任务编辑 -->
      <div class="right-panel">
        <template v-if="currentTask">
          <div class="task-editor">
            <div class="task-editor-header">
              <h3>任务 {{ selectedTaskIndex + 1 }}</h3>
              <span v-if="currentTask.is_exam_mode" class="exam-mode-badge">考试模式</span>
            </div>

            <div class="task-form">
              <div class="form-group">
                <label>任务名称<span class="required">*</span></label>
                <input v-model="currentTask.name" type="text" placeholder="请输入任务名称" />
              </div>
              <div class="form-group">
                <label>任务描述</label>
                <textarea v-model="currentTask.description" placeholder="请输入任务描述" rows="2"></textarea>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label>开始时间<span class="required">*</span></label>
                  <input v-model="currentTask.start_time" type="datetime-local" />
                </div>
                <div class="form-group">
                  <label>结束时间<span class="required">*</span></label>
                  <input v-model="currentTask.end_time" type="datetime-local" />
                </div>
              </div>
              <div class="form-group checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="currentTask.is_exam_mode" />
                  <span>考试模式</span>
                </label>
                <span class="checkbox-hint">开启后，学生做题时不会显示答案和解析</span>
              </div>

              <!-- 复习内容 -->
              <div class="form-group">
                <label>复习内容</label>
                <div class="review-content-upload">
                  <div class="upload-row">
                    <input type="file" accept=".docx" @change="(e) => handleDocxUpload(e)" :id="'editor-docx'" class="hidden-input" />
                    <label for="editor-docx" class="btn-upload btn-upload-docx">
                      <i class="fas fa-file-word"></i> Word
                    </label>
                    <input type="file" accept=".pdf" @change="(e) => handlePdfUpload(e)" :id="'editor-pdf'" class="hidden-input" />
                    <label for="editor-pdf" class="btn-upload btn-upload-pdf">
                      <i class="fas fa-file-pdf"></i> PDF
                    </label>
                    <button @click="toggleUrlInput" class="btn-upload btn-upload-url" :class="{ active: showUrlInput }">
                      <i class="fas fa-link"></i> URL
                    </button>
                    <span v-if="currentTask.review_content" class="upload-status">
                      <i class="fas fa-check-circle"></i>
                      {{ currentTask.review_content_type === 'pdf' ? '已上传PDF' : '已有内容' }}
                    </span>
                  </div>
                  <div v-if="showUrlInput" class="url-input-section">
                    <input v-model="urlInputValue" type="url" placeholder="请输入PDF或文档URL" class="url-input" @keyup.enter="confirmUrl" />
                    <div class="url-input-actions">
                      <button @click="confirmUrl" class="btn-url-confirm"><i class="fas fa-check"></i></button>
                      <button @click="showUrlInput = false; urlInputValue = ''" class="btn-url-cancel"><i class="fas fa-times"></i></button>
                    </div>
                  </div>
                  <textarea v-if="currentTask.review_content_type !== 'pdf'" v-model="currentTask.review_content" placeholder="复习内容（或上传文件/输入URL）" rows="4"></textarea>
                  <div v-else class="pdf-hint">
                    <i class="fas fa-file-pdf"></i> PDF已上传，将以PDF形式展示
                  </div>
                </div>
              </div>

              <!-- 复习视频 -->
              <div class="form-group">
                <label>复习视频URL</label>
                <input v-model="currentTask.review_video_url" type="url" placeholder="https://example.com/video.mp4" />
              </div>

              <!-- 客观题练习 -->
              <div class="exercise-section">
                <div class="exercise-header">
                  <label><i class="fas fa-file-alt"></i> 客观题练习 <span v-if="currentTask.exams?.length">({{ currentTask.exams.length }})</span></label>
                  <button class="btn-select-exercise" @click="openExamSelector">
                    <i class="fas fa-plus"></i> 选择试卷
                  </button>
                </div>
                <div v-if="currentTask.exams && currentTask.exams.length > 0" class="selected-items">
                  <div v-for="(exam, ei) in currentTask.exams" :key="ei" class="selected-item">
                    <div class="item-info">
                      <span v-if="exam.exam_name" class="item-name">{{ exam.exam_name }}</span>
                      <span v-if="exam.exam_type" class="item-tag">{{ exam.exam_type }}</span>
                      <span v-if="exam.total_questions" class="item-detail">{{ exam.total_questions }}题</span>
                    </div>
                    <button @click="removeExam(ei)" class="btn-remove-item"><i class="fas fa-times"></i></button>
                  </div>
                </div>
                <div v-else class="no-items"><span>暂未选择试卷</span></div>
              </div>

              <!-- OJ编程题 -->
              <div class="exercise-section">
                <div class="exercise-header">
                  <label><i class="fas fa-code"></i> OJ编程题 <span v-if="currentTask.oj_problems?.length">({{ currentTask.oj_problems.length }})</span></label>
                  <button class="btn-select-exercise" @click="openOJSelector">
                    <i class="fas fa-plus"></i> 选择题目
                  </button>
                </div>
                <div v-if="currentTask.oj_problems && currentTask.oj_problems.length > 0" class="selected-items">
                  <div v-for="(problem, pi) in currentTask.oj_problems" :key="pi" class="selected-item">
                    <div class="item-info">
                      <span v-if="problem.problem_title" class="item-name">{{ problem.problem_title }}</span>
                      <span v-if="problem.problem_level" class="item-tag">{{ problem.problem_level }}级</span>
                    </div>
                    <button @click="removeProblem(pi)" class="btn-remove-item"><i class="fas fa-times"></i></button>
                  </div>
                </div>
                <div v-else class="no-items"><span>暂未选择OJ题目</span></div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="no-task-selected">
          <i class="fas fa-hand-pointer"></i>
          <p>请从左侧选择一个任务进行编辑</p>
        </div>
      </div>
    </div>

    <!-- 选择试卷弹窗 -->
    <ExamSelectorDialog
      v-if="showExamSelectorDialog"
      @close="showExamSelectorDialog = false"
      @select="handleExamSelect"
    />
    <!-- 选择OJ题目弹窗 -->
    <OJSelectorDialog
      v-if="showOJSelectorDialog"
      @close="showOJSelectorDialog = false"
      @select="handleOJSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated, inject } from 'vue'
import axios from 'axios'
import ExamSelectorDialog from './Dialog/ExamSelectorDialog.vue'
import OJSelectorDialog from './Dialog/OJSelectorDialog.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import { BASE_URL } from '@/config/api'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

// AdminView 提供的 inject
const planEditorPlanId = inject<Ref<number | undefined>>('planEditorPlanId')
const closeSection: (() => void) | undefined = inject('closeCurrentSection')
const triggerRefresh: ((key: string) => void) | undefined = inject('triggerSectionRefresh')

const emit = defineEmits<{
  saved: []
}>()

const isEditMode = computed(() => !!planEditorPlanId?.value)
const saving = ref(false)
const selectedTaskIndex = ref(0)
const showExamSelectorDialog = ref(false)
const showOJSelectorDialog = ref(false)
const showUrlInput = ref(false)
const urlInputValue = ref('')

const formData = ref({
  name: '',
  description: '',
  category: 'GESP',
  level: '1',
  start_time: '',
  end_time: '',
  tasks: [] as any[]
})

const currentTask = computed(() => {
  if (selectedTaskIndex.value >= 0 && selectedTaskIndex.value < formData.value.tasks.length) {
    return formData.value.tasks[selectedTaskIndex.value]
  }
  return null
})

// 格式化日期为短格式
function shortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 添加任务
function addTask() {
  formData.value.tasks.push({
    name: '',
    description: '',
    review_content: '',
    review_content_type: 'text',
    review_video_url: '',
    start_time: '',
    end_time: '',
    task_order: formData.value.tasks.length + 1,
    is_exam_mode: false,
    exams: [],
    oj_problems: []
  })
  selectedTaskIndex.value = formData.value.tasks.length - 1
}

// 删除任务
function removeTask(index: number) {
  if (!confirm('确定要删除这个任务吗？')) return
  formData.value.tasks.splice(index, 1)
  formData.value.tasks.forEach((t, i) => { t.task_order = i + 1 })
  if (selectedTaskIndex.value >= formData.value.tasks.length) {
    selectedTaskIndex.value = Math.max(0, formData.value.tasks.length - 1)
  }
}

// 移动任务
function moveTask(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= formData.value.tasks.length) return
  const temp = formData.value.tasks[index]
  formData.value.tasks[index] = formData.value.tasks[newIndex]
  formData.value.tasks[newIndex] = temp
  formData.value.tasks.forEach((t, i) => { t.task_order = i + 1 })
}

// 试卷选择
function openExamSelector() {
  showExamSelectorDialog.value = true
}

function openOJSelector() {
  showOJSelectorDialog.value = true
}

function handleExamSelect(examIds: number[]) {
  const task = currentTask.value
  if (!task) return
  if (!task.exams) task.exams = []
  examIds.forEach((id, i) => {
    if (!task.exams.find((e: any) => e.exam_id === id)) {
      task.exams.push({ exam_id: id, exam_order: task.exams.length + i + 1 })
    }
  })
  showExamSelectorDialog.value = false
}

function handleOJSelect(problemIds: number[]) {
  const task = currentTask.value
  if (!task) return
  if (!task.oj_problems) task.oj_problems = []
  problemIds.forEach((id, i) => {
    if (!task.oj_problems.find((p: any) => p.problem_id === id)) {
      task.oj_problems.push({ problem_id: id, problem_order: task.oj_problems.length + i + 1 })
    }
  })
  showOJSelectorDialog.value = false
}

function removeExam(index: number) {
  currentTask.value?.exams?.splice(index, 1)
}

function removeProblem(index: number) {
  currentTask.value?.oj_problems?.splice(index, 1)
}

// 复习内容处理
function toggleUrlInput() {
  showUrlInput.value = !showUrlInput.value
  if (!showUrlInput.value) urlInputValue.value = ''
}

function confirmUrl() {
  const url = urlInputValue.value?.trim()
  if (!url) return
  try { new URL(url) } catch { alert('请输入有效的URL'); return }
  const task = currentTask.value
  if (!task) return
  const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('gokuai.')
  task.review_content = url
  task.review_content_type = isPdf ? 'pdf' : 'text'
  showUrlInput.value = false
  urlInputValue.value = ''
}

async function handleDocxUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.name.endsWith('.docx')) { alert('请上传.docx格式文件'); return }
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    if (currentTask.value) {
      currentTask.value.review_content = result.value.trim()
      currentTask.value.review_content_type = 'text'
    }
  } catch { alert('解析文档失败') }
  input.value = ''
}

async function handlePdfUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !file.name.endsWith('.pdf')) { alert('请上传.pdf格式文件'); return }
  if (file.size > 20 * 1024 * 1024) { alert('PDF文件不能超过20MB'); return }
  try {
    const uploadData = new FormData()
    uploadData.append('file', file)
    const response = await axios.post(`${BASE_URL}/learning-tasks/upload-review-pdf`, uploadData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (response.data.success && currentTask.value) {
      currentTask.value.review_content = response.data.data.file_path
      currentTask.value.review_content_type = 'pdf'
      showUrlInput.value = false
    }
  } catch (e: any) {
    alert('上传PDF失败: ' + (e.response?.data?.message || e.message))
  }
  input.value = ''
}

// 保存
async function handleSave() {
  if (!formData.value.name || !formData.value.description || !formData.value.start_time || !formData.value.end_time) {
    alert('请填写所有必填字段'); return
  }
  if (formData.value.tasks.length === 0) {
    alert('至少需要添加一个任务'); return
  }
  for (const task of formData.value.tasks) {
    if (!task.name || !task.start_time || !task.end_time) {
      alert('请填写所有任务的必填字段（名称、开始时间、结束时间）'); return
    }
  }

  saving.value = true
  try {
    const payload = {
      ...formData.value,
      level: formData.value.category === 'GESP' ? (formData.value.level ? parseInt(formData.value.level) : null) : null
    }

    if (isEditMode.value && planEditorPlanId?.value) {
      await axios.put(`${BASE_URL}/learning-plans/${planEditorPlanId.value}`, payload)
      alert('学习计划更新成功')
    } else {
      await axios.post(`${BASE_URL}/learning-plans`, payload)
      alert('学习计划创建成功')
    }
    emit('saved')
    // 刷新计划管理列表并返回
    triggerRefresh?.('plan-management')
    handleBack()
  } catch (error: any) {
    alert('保存失败: ' + (error.response?.data?.error || error.message))
  } finally {
    saving.value = false
  }
}

// 返回
function handleBack() {
  closeSection?.()
}

// 格式化 datetime 为 input 格式
function formatDateTimeForInput(dateString: string): string {
  if (!dateString) return ''
  const d = new Date(dateString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 加载编辑数据
async function loadPlanData() {
  if (!planEditorPlanId?.value) return
  try {
    const response = await axios.get(`${BASE_URL}/learning-plans/${planEditorPlanId.value}/admin`)
    if (response.data.success) {
      const plan = response.data.data
      formData.value = {
        name: plan.name || '',
        description: plan.description || '',
        category: plan.category || 'GESP',
        level: plan.level ? String(plan.level) : '1',
        start_time: formatDateTimeForInput(plan.start_time),
        end_time: formatDateTimeForInput(plan.end_time),
        tasks: (plan.tasks || []).map((task: any) => ({
          name: task.name || '',
          description: task.description || '',
          review_content: task.review_content || '',
          review_content_type: task.review_content_type || 'text',
          review_video_url: task.review_video_url || '',
          start_time: formatDateTimeForInput(task.start_time),
          end_time: formatDateTimeForInput(task.end_time),
          task_order: task.task_order || 0,
          is_exam_mode: task.is_exam_mode || false,
          exams: (task.exams || []).map((exam: any) => ({
            exam_id: exam.exam_id,
            exam_order: exam.exam_order,
            exam_name: exam.exam_name,
            exam_level: exam.exam_level,
            exam_type: exam.exam_type,
            total_questions: exam.total_questions
          })),
          oj_problems: (task.oj_problems || []).map((problem: any) => ({
            problem_id: problem.problem_id,
            problem_order: problem.problem_order,
            problem_title: problem.problem_title,
            problem_level: problem.problem_level,
            time_limit: problem.time_limit,
            memory_limit: problem.memory_limit
          }))
        }))
      }
      if (formData.value.tasks.length > 0) {
        selectedTaskIndex.value = 0
      }
    }
  } catch (error) {
    console.error('加载计划数据失败:', error)
    alert('加载计划数据失败')
  }
}

// 重置表单为空（创建模式）
function resetFormData() {
  formData.value = {
    name: '',
    description: '',
    category: 'GESP',
    level: '1',
    start_time: '',
    end_time: '',
    tasks: [] as any[]
  }
  selectedTaskIndex.value = 0
}

// 当 planId 变化时加载数据或重置
watch(() => planEditorPlanId?.value, (newVal) => {
  if (newVal) {
    loadPlanData()
  } else {
    resetFormData()
  }
})

onMounted(() => {
  fetchQuestionTypes()
  // 初始化时根据 planId 状态决定加载还是重置
  if (planEditorPlanId?.value) {
    loadPlanData()
  } else {
    resetFormData()
  }
})

// KeepAlive 激活时，重新响应当前 planId（防止缓存旧数据）
onActivated(() => {
  if (planEditorPlanId?.value) {
    loadPlanData()
  } else {
    resetFormData()
  }
})
</script>

<style scoped>
.plan-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 96px);
  background: #f1f5f9;
}

/* 顶部操作栏 */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-back:hover { background: #f8fafc; color: #1e293b; }

.editor-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.btn-save {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* 主体 */
.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧面板 */
.left-panel {
  width: 300px;
  min-width: 300px;
  border-right: 1px solid #e2e8f0;
  background: white;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-section {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-label i { font-size: 12px; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

/* 表单 */
.form-group {
  margin-bottom: 10px;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.required { color: #ef4444; margin-left: 2px; }

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: #f8fafc;
}
.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #1e90ff;
  background: white;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
}
.checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1e90ff; }
.checkbox-hint { font-size: 11px; color: #94a3b8; }

/* 任务列表 */
.tasks-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tasks-section .section-label { margin-bottom: 8px; }

.btn-add-task {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1.5px dashed #cbd5e1;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-add-task:hover { border-color: #1e90ff; color: #1e90ff; background: #eff6ff; }

.empty-tasks {
  text-align: center;
  padding: 24px 16px;
  color: #94a3b8;
  font-size: 13px;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid transparent;
}
.task-list-item:hover { background: #f8fafc; }
.task-list-item.active { background: #eff6ff; border-color: #93c5fd; }

.task-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.task-num {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.task-list-item.active .task-num { background: #3b82f6; color: white; }

.task-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.task-item-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-item-meta {
  font-size: 11px;
  color: #94a3b8;
}

.task-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.task-list-item:hover .task-item-actions,
.task-list-item.active .task-item-actions { opacity: 1; }

.btn-move, .btn-remove {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}
.btn-move:hover { background: #f1f5f9; color: #64748b; }
.btn-remove:hover { background: #fef2f2; color: #ef4444; }

/* 右侧面板 */
.right-panel {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.task-editor {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 20px;
}

.task-editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}
.task-editor-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}
.exam-mode-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef2f2;
  color: #ef4444;
  font-size: 11px;
  font-weight: 600;
}

.task-form .form-group input,
.task-form .form-group textarea,
.task-form .form-group select {
  background: #f8fafc;
}
.task-form .form-group input:focus,
.task-form .form-group textarea:focus,
.task-form .form-group select:focus {
  background: white;
}

/* 复习内容 */
.review-content-upload { display: flex; flex-direction: column; gap: 8px; }
.upload-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hidden-input { display: none; }
.btn-upload {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-upload-docx { background: #eef2ff; color: #4f46e5; }
.btn-upload-docx:hover { background: #e0e7ff; }
.btn-upload-pdf { background: #fef2f2; color: #dc2626; }
.btn-upload-pdf:hover { background: #fee2e2; }
.btn-upload-url { background: #f0fdf4; color: #16a34a; }
.btn-upload-url:hover { background: #dcfce7; }
.btn-upload-url.active { background: #bbf7d0; }
.upload-status { color: #10b981; font-size: 12px; display: flex; align-items: center; gap: 4px; }

.url-input-section {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1.5px solid #e2e8f0;
}
.url-input {
  flex: 1;
  padding: 6px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 4px;
  font-size: 13px;
}
.url-input:focus { outline: none; border-color: #1e90ff; }
.url-input-actions { display: flex; gap: 4px; }
.btn-url-confirm, .btn-url-cancel {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.btn-url-confirm { background: #10b981; color: white; }
.btn-url-cancel { background: #e2e8f0; color: #64748b; }
.pdf-hint { padding: 8px 12px; background: #fef2f2; border-radius: 6px; color: #dc2626; font-size: 12px; display: flex; align-items: center; gap: 6px; }

/* 选题 */
.exercise-section {
  margin-top: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.exercise-header label {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}
.exercise-header label i { color: #6366f1; }

.btn-select-exercise {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1.5px solid #c7d2fe;
  border-radius: 6px;
  background: white;
  color: #6366f1;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-select-exercise:hover { background: #eef2ff; }

.selected-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
}
.item-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.item-name { color: #1e293b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
.item-tag { padding: 1px 6px; border-radius: 4px; background: #fef3c7; color: #d97706; font-size: 11px; font-weight: 500; }
.item-detail { color: #94a3b8; font-size: 11px; }
.btn-remove-item { background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 2px; font-size: 12px; transition: color 0.15s; }
.btn-remove-item:hover { color: #ef4444; }

.no-items {
  padding: 8px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
}

/* 未选择任务 */
.no-task-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  gap: 12px;
}
.no-task-selected i { font-size: 40px; opacity: 0.3; }
.no-task-selected p { font-size: 14px; }
</style>
