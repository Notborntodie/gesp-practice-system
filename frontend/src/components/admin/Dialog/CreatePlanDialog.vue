<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ plan ? '编辑学习计划' : '创建学习计划' }}</h3>
        <button class="modal-close-btn" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- 基本信息 -->
        <div class="form-section">
          <h4>基本信息</h4>
          <div class="form-group">
            <label>计划名称<span class="required">*</span></label>
            <input v-model="formData.name" type="text" placeholder="请输入计划名称" />
          </div>

          <div class="form-group">
            <label>计划描述<span class="required">*</span></label>
            <textarea v-model="formData.description" placeholder="请输入计划描述" rows="3"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>分类：</label>
              <select v-model="formData.category">
                <option value="">请选择分类</option>
                <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                  {{ type.display_name || type.name }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="formData.category === 'GESP'">
              <label>级别<span class="required">*</span></label>
              <select v-model="formData.level">
                <option value="1">GESP 1级</option>
                <option value="2">GESP 2级</option>
                <option value="3">GESP 3级</option>
                <option value="4">GESP 4级</option>
                <option value="5">GESP 5级</option>
                <option value="6">GESP 6级</option>
              </select>
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
        </div>

        <!-- 任务列表 -->
        <div class="form-section">
          <div class="section-title-row">
            <h4>学习任务</h4>
            <button @click="addTask" class="btn-add-task">
              <i class="fas fa-plus"></i> 添加任务
            </button>
          </div>

          <div v-if="formData.tasks.length === 0" class="empty-tasks">
            <p>暂无任务，点击右侧按钮添加任务</p>
          </div>

          <div v-for="(task, index) in formData.tasks" :key="index" class="task-item">
            <div class="task-header">
              <h5>任务 {{ index + 1 }}</h5>
              <button @click="removeTask(index)" class="btn-remove-task">
                <i class="fas fa-trash"></i>
              </button>
            </div>

            <div class="form-group">
              <label>任务名称<span class="required">*</span></label>
              <input v-model="task.name" type="text" placeholder="请输入任务名称" />
            </div>

            <div class="form-group">
              <label>任务描述</label>
              <textarea v-model="task.description" placeholder="请输入任务描述" rows="2"></textarea>
            </div>

            <div class="form-group">
              <label>复习内容</label>
              <div class="review-content-upload">
                <div class="upload-row">
                  <input 
                    type="file" 
                    accept=".docx" 
                    @change="(e) => handleDocxUpload(e, index)"
                    :id="'docx-upload-' + index"
                    class="docx-input"
                  />
                  <label :for="'docx-upload-' + index" class="btn-upload-docx">
                    <i class="fas fa-file-word"></i> 上传Word文档
                  </label>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    @change="(e) => handlePdfUpload(e, index)"
                    :id="'pdf-upload-' + index"
                    class="docx-input"
                  />
                  <label :for="'pdf-upload-' + index" class="btn-upload-pdf">
                    <i class="fas fa-file-pdf"></i> 上传PDF
                  </label>
                  <button 
                    @click="showUrlInput(index)" 
                    class="btn-upload-url"
                    :class="{ 'active': task.showUrlInput }"
                  >
                    <i class="fas fa-link"></i> 输入URL
                  </button>
                  <span v-if="task.review_content" class="upload-status">
                    <i class="fas fa-check-circle"></i> 
                    {{ task.review_content_type === 'pdf' ? '已上传PDF' : '已有内容' }}
                  </span>
                </div>
                <!-- URL输入框 -->
                <div v-if="task.showUrlInput" class="url-input-section">
                  <input 
                    v-model="task.review_content_url" 
                    type="url" 
                    placeholder="请输入PDF或文档URL（支持够快云盘等）"
                    class="url-input"
                    @blur="handleUrlInput(index)"
                    @keyup.enter="handleUrlInput(index)"
                  />
                  <div class="url-input-actions">
                    <button @click="confirmUrlInput(index)" class="btn-confirm-url">
                      <i class="fas fa-check"></i> 确认
                    </button>
                    <button @click="cancelUrlInput(index)" class="btn-cancel-url">
                      <i class="fas fa-times"></i> 取消
                    </button>
                  </div>
                </div>
                <div v-if="task.review_content_type === 'pdf'" class="pdf-preview-hint">
                  <i class="fas fa-file-pdf"></i> PDF文件已上传，内容将以PDF形式展示
                </div>
                <textarea v-else v-model="task.review_content" placeholder="请输入复习内容，或上传.docx/.pdf文件，或输入URL" rows="5"></textarea>
              </div>
            </div>

            <div class="form-group">
              <label>复习视频URL</label>
              <input v-model="task.review_video_url" type="url" placeholder="https://example.com/video.mp4" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>开始时间<span class="required">*</span></label>
                <input v-model="task.start_time" type="datetime-local" />
              </div>

              <div class="form-group">
                <label>结束时间<span class="required">*</span></label>
                <input v-model="task.end_time" type="datetime-local" />
              </div>
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="task.is_exam_mode" />
                <span>考试模式</span>
              </label>
              <span class="checkbox-hint">开启后，学生做题时不会显示答案和解析</span>
            </div>

            <!-- 客观题练习 -->
            <div class="exercise-section">
              <div class="exercise-header">
                <label>客观题练习</label>
                <button @click="showExamSelector(index)" class="btn-select">
                  <i class="fas fa-plus"></i> 选择试卷
                </button>
              </div>
              <div v-if="task.exams && task.exams.length > 0" class="selected-items">
                <div v-for="(exam, examIndex) in task.exams" :key="examIndex" class="selected-item">
                  <div class="item-info">
                    <span class="item-id">ID: {{ exam.exam_id }}</span>
                    <span v-if="exam.exam_name" class="item-name">{{ exam.exam_name }}</span>
                    <span v-if="exam.exam_type" class="item-tag">{{ exam.exam_type }}</span>
                    <span v-if="exam.total_questions" class="item-detail">{{ exam.total_questions }}题</span>
                  </div>
                  <button @click="removeExam(index, examIndex)" class="btn-remove-item">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <div v-else class="no-items">
                <span>暂未选择试卷</span>
              </div>
            </div>

            <!-- OJ题目 -->
            <div class="exercise-section">
              <div class="exercise-header">
                <label>OJ编程题</label>
                <button @click="showOJSelector(index)" class="btn-select">
                  <i class="fas fa-plus"></i> 选择题目
                </button>
              </div>
              <div v-if="task.oj_problems && task.oj_problems.length > 0" class="selected-items">
                <div v-for="(problem, problemIndex) in task.oj_problems" :key="problemIndex" class="selected-item">
                  <div class="item-info">
                    <span class="item-id">ID: {{ problem.problem_id }}</span>
                    <span v-if="problem.problem_title" class="item-name">{{ problem.problem_title }}</span>
                    <span v-if="problem.problem_level" class="item-tag">{{ problem.problem_level }}级</span>
                  </div>
                  <button @click="removeProblem(index, problemIndex)" class="btn-remove-item">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <div v-else class="no-items">
                <span>暂未选择OJ题目</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-confirm" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '提交中...' : (plan ? '保存' : '创建') }}
        </button>
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
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import ExamSelectorDialog from './ExamSelectorDialog.vue'
import OJSelectorDialog from './OJSelectorDialog.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

const props = defineProps<{
  visible: boolean
  plan?: any
}>()

const emit = defineEmits(['close', 'success'])

import { BASE_URL } from '@/config/api'

const formData = ref({
  name: '',
  description: '',
  category: 'GESP',
  level: '1',
  start_time: '',
  end_time: '',
  tasks: [] as any[]
})

const submitting = ref(false)
const showExamSelectorDialog = ref(false)
const showOJSelectorDialog = ref(false)
const currentTaskIndex = ref<number | null>(null)

// 添加任务
function addTask() {
  formData.value.tasks.push({
    name: '',
    description: '',
    review_content: '',
    review_content_type: 'text',
    review_content_url: '',
    showUrlInput: false,
    review_video_url: '',
    start_time: '',
    end_time: '',
    task_order: formData.value.tasks.length + 1,
    is_exam_mode: false,
    exams: [],
    oj_problems: []
  })
}

// 移除任务
function removeTask(index: number) {
  if (confirm('确定要删除这个任务吗？')) {
    formData.value.tasks.splice(index, 1)
    // 更新任务顺序
    formData.value.tasks.forEach((task, i) => {
      task.task_order = i + 1
    })
  }
}

// 显示试卷选择器
function showExamSelector(index: number) {
  currentTaskIndex.value = index
  showExamSelectorDialog.value = true
}

// 显示OJ题目选择器
function showOJSelector(index: number) {
  currentTaskIndex.value = index
  showOJSelectorDialog.value = true
}

// 处理试卷选择
function handleExamSelect(examIds: number[]) {
  if (currentTaskIndex.value !== null) {
    const task = formData.value.tasks[currentTaskIndex.value]
    if (!task.exams) task.exams = []
    
    examIds.forEach((examId, index) => {
      if (!task.exams.find((e: any) => e.exam_id === examId)) {
        task.exams.push({
          exam_id: examId,
          exam_order: task.exams.length + index + 1
        })
      }
    })
  }
  showExamSelectorDialog.value = false
}

// 处理OJ题目选择
function handleOJSelect(problemIds: number[]) {
  if (currentTaskIndex.value !== null) {
    const task = formData.value.tasks[currentTaskIndex.value]
    if (!task.oj_problems) task.oj_problems = []
    
    problemIds.forEach((problemId, index) => {
      if (!task.oj_problems.find((p: any) => p.problem_id === problemId)) {
        task.oj_problems.push({
          problem_id: problemId,
          problem_order: task.oj_problems.length + index + 1
        })
      }
    })
  }
  showOJSelectorDialog.value = false
}

// 移除试卷
function removeExam(taskIndex: number, examIndex: number) {
  formData.value.tasks[taskIndex].exams.splice(examIndex, 1)
}

// 移除OJ题目
function removeProblem(taskIndex: number, problemIndex: number) {
  formData.value.tasks[taskIndex].oj_problems.splice(problemIndex, 1)
}

// 处理docx文件上传
async function handleDocxUpload(event: Event, taskIndex: number) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  if (!file.name.endsWith('.docx')) {
    alert('请上传.docx格式的文件')
    return
  }
  
  try {
    // 动态导入mammoth
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    // 使用HTML输出保留格式
    const result = await mammoth.convertToHtml({ arrayBuffer })
    
    // 将HTML内容设置到复习内容
    formData.value.tasks[taskIndex].review_content = result.value.trim()
    formData.value.tasks[taskIndex].review_content_type = 'text'
    alert('文档内容已成功导入！')
  } catch (error) {
    console.error('解析docx文件失败:', error)
    alert('解析文档失败，请确保文件格式正确')
  }
  
  // 清空input，允许重复选择同一文件
  input.value = ''
}

// 处理PDF文件上传
async function handlePdfUpload(event: Event, taskIndex: number) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  if (!file.name.endsWith('.pdf')) {
    alert('请上传.pdf格式的文件')
    return
  }
  
  // 检查文件大小（最大20MB）
  if (file.size > 20 * 1024 * 1024) {
    alert('PDF文件大小不能超过20MB')
    return
  }
  
  try {
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)
    
    const response = await axios.post(`${BASE_URL}/learning-tasks/upload-review-pdf`, formDataUpload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.data.success) {
      formData.value.tasks[taskIndex].review_content = response.data.data.file_path
      formData.value.tasks[taskIndex].review_content_type = 'pdf'
      formData.value.tasks[taskIndex].showUrlInput = false
      alert('PDF文件已成功上传！')
    } else {
      throw new Error(response.data.message || '上传失败')
    }
  } catch (error: any) {
    console.error('上传PDF文件失败:', error)
    alert('上传PDF失败: ' + (error.response?.data?.message || error.message))
  }
  
  // 清空input，允许重复选择同一文件
  input.value = ''
}

// 判断是否为PDF URL
function isPdfUrl(url: string): boolean {
  if (!url) return false
  const lowerUrl = url.toLowerCase()
  // 检查是否是PDF文件扩展名
  if (lowerUrl.includes('.pdf')) return true
  // 检查是否是够快云盘链接
  if (lowerUrl.includes('gokuai.com') || lowerUrl.includes('gokuai.cn')) return true
  // 可以添加其他PDF托管服务的检测
  return false
}

// 显示URL输入框
function showUrlInput(taskIndex: number) {
  const task = formData.value.tasks[taskIndex]
  task.showUrlInput = !task.showUrlInput
  if (!task.review_content_url) {
    task.review_content_url = ''
  }
}

// 处理URL输入
function handleUrlInput(taskIndex: number) {
  const task = formData.value.tasks[taskIndex]
  const url = task.review_content_url?.trim()
  
  if (!url) {
    return
  }
  
  // 验证URL格式
  try {
    new URL(url)
  } catch {
    alert('请输入有效的URL')
    return
  }
  
  // 如果是PDF URL，设置类型为pdf
  if (isPdfUrl(url)) {
    task.review_content = url
    task.review_content_type = 'pdf'
    task.showUrlInput = false
    alert('PDF URL已设置！')
  } else {
    // 其他URL作为文本内容
    task.review_content = url
    task.review_content_type = 'text'
    task.showUrlInput = false
    alert('URL已设置！')
  }
}

// 确认URL输入
function confirmUrlInput(taskIndex: number) {
  handleUrlInput(taskIndex)
}

// 取消URL输入
function cancelUrlInput(taskIndex: number) {
  const task = formData.value.tasks[taskIndex]
  task.showUrlInput = false
  task.review_content_url = ''
}

// 提交表单
async function handleSubmit() {
  // 验证必填字段
  if (!formData.value.name || !formData.value.description || !formData.value.start_time || !formData.value.end_time) {
    alert('请填写所有必填字段')
    return
  }

  if (formData.value.tasks.length === 0) {
    alert('至少需要添加一个任务')
    return
  }

  // 验证任务
  for (const task of formData.value.tasks) {
    if (!task.name || !task.start_time || !task.end_time) {
      alert('请填写所有任务的必填字段')
      return
    }
  }

  submitting.value = true

  try {
    const payload = {
      ...formData.value,
      level: formData.value.category === 'GESP' ? (formData.value.level ? parseInt(formData.value.level) : null) : null
    }
    if (props.plan) {
      // 编辑计划
      await axios.put(`${BASE_URL}/learning-plans/${props.plan.id}`, payload)
      alert('学习计划更新成功')
    } else {
      // 创建计划
      await axios.post(`${BASE_URL}/learning-plans`, payload)
      alert('学习计划创建成功')
    }
    emit('success')
  } catch (error: any) {
    console.error('提交失败:', error)
    alert('操作失败: ' + (error.response?.data?.error || error.message))
  } finally {
    submitting.value = false
  }
}

// 初始化表单数据
function initFormData() {
  if (props.plan) {
    console.log('🔧 [CreatePlanDialog] 初始化编辑模式，计划数据:', props.plan)
    
    formData.value = {
      name: props.plan.name || '',
      description: props.plan.description || '',
      category: props.plan.category || 'GESP',
      level: props.plan.level ? String(props.plan.level) : '',
      start_time: formatDateTimeForInput(props.plan.start_time),
      end_time: formatDateTimeForInput(props.plan.end_time),
      // 确保每个任务都有正确的 exams 和 oj_problems 数组
      tasks: (props.plan.tasks || []).map((task: any) => ({
        name: task.name || '',
        description: task.description || '',
        review_content: task.review_content || '',
        review_content_type: task.review_content_type || 'text',
        review_content_url: '',
        showUrlInput: false,
        review_video_url: task.review_video_url || '',
        start_time: formatDateTimeForInput(task.start_time),
        end_time: formatDateTimeForInput(task.end_time),
        task_order: task.task_order || 0,
        is_exam_mode: task.is_exam_mode || false,
        exams: task.exams || [],
        oj_problems: task.oj_problems || []
      }))
    }
    
    console.log('✅ [CreatePlanDialog] 初始化完成，任务数量:', formData.value.tasks.length)
    formData.value.tasks.forEach((task, index) => {
      console.log(`📋 [CreatePlanDialog] 任务 ${index + 1}:`, {
        name: task.name,
        exams: task.exams.length,
        oj_problems: task.oj_problems.length
      })
    })
  } else {
    console.log('🆕 [CreatePlanDialog] 初始化创建模式')
    formData.value = {
      name: '',
      description: '',
      level: '1',
      start_time: '',
      end_time: '',
      tasks: []
    }
  }
}

// 格式化日期时间为输入框格式
function formatDateTimeForInput(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

onMounted(() => {
  fetchQuestionTypes()
  if (props.visible) {
    initFormData()
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
  max-width: 900px;
  max-height: 90vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.modal-close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  width: 40px;
  height: 40px;
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
  padding: 24px 28px;
}

.form-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.form-section h4 {
  margin: 0 0 20px 0;
  color: #1e293b;
  font-size: 1.2rem;
  font-weight: 600;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title-row h4 {
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #1e293b;
  font-weight: 600;
  font-size: 14px;
}

.required {
  color: #ef4444;
  margin-left: 4px;
}

.form-group input,
.form-group textarea,
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
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #1e293b;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #1e90ff;
}

.checkbox-hint {
  color: #64748b;
  font-size: 12px;
}

.btn-add-task {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-add-task:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-2px);
}

.empty-tasks {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
  background: white;
  border-radius: 8px;
  border: 2px dashed #e2e8f0;
}

.task-item {
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  margin-bottom: 16px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
}

.task-header h5 {
  margin: 0;
  color: #1e90ff;
  font-size: 1.1rem;
  font-weight: 700;
}

.btn-remove-task {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-remove-task:hover {
  background: #dc2626;
}

.exercise-section {
  margin-top: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.exercise-header label {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.btn-select {
  background: #1e90ff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-select:hover {
  background: #0c7cd5;
}

.selected-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #1e90ff;
  border-radius: 8px;
  font-size: 12px;
  min-width: 250px;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.item-id {
  color: #1e90ff;
  font-weight: 700;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
}

.item-name {
  color: #1e293b;
  font-weight: 600;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-tag {
  background: #fef3c7;
  color: #d97706;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.item-detail {
  color: #64748b;
  font-size: 11px;
}

.no-items {
  padding: 12px;
  text-align: center;
  color: #64748b;
  font-size: 12px;
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
}

.btn-remove-item {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.btn-remove-item:hover {
  color: #dc2626;
  transform: scale(1.2);
}

.modal-footer {
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.95rem;
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
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* docx上传样式 */
.review-content-upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.docx-input {
  display: none;
}

.btn-upload-docx {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-upload-docx:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  transform: translateY(-1px);
}

.btn-upload-pdf {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-upload-pdf:hover {
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
  transform: translateY(-1px);
}

.btn-upload-url {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
}

.btn-upload-url:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-1px);
}

.btn-upload-url.active {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}

.url-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 2px solid #1e90ff;
}

.url-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.url-input:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.url-input-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-confirm-url,
.btn-cancel-url {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-confirm-url {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
}

.btn-confirm-url:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
}

.btn-cancel-url {
  background: #e2e8f0;
  color: #64748b;
}

.btn-cancel-url:hover {
  background: #cbd5e1;
}

.pdf-preview-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 2px solid #fca5a5;
  border-radius: 8px;
  color: #dc2626;
  font-weight: 500;
}

.upload-status {
  color: #10b981;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

