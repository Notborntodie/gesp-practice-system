<template>
  <div v-if="visible" class="dialog-overlay" @click="closeDialog">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>创建新考试</h3>
        <button @click="closeDialog" class="close-btn">×</button>
      </div>

      <div class="dialog-body">
        <!-- 考试基本信息 -->
        <div class="exam-info-section">
          <h4>考试基本信息</h4>
          <div class="form-grid">
            <div class="form-group">
              <label for="examName">考试名称 *</label>
              <input 
                id="examName"
                v-model="examForm.name" 
                type="text" 
                placeholder="请输入考试名称"
                class="form-input"
                :class="{ 'error': errors.name }"
              />
              <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
            </div>

            <div class="form-group">
              <label for="examCategory">考试分类 *</label>
              <select
                id="examCategory"
                v-model="examForm.category"
                class="form-select"
                :class="{ 'error': errors.category }"
              >
                <option value="">请选择分类</option>
                <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                  {{ type.display_name || type.name }}
                </option>
              </select>
              <span v-if="errors.category" class="error-message">{{ errors.category }}</span>
            </div>

            <div class="form-group">
              <label for="examLevel">考试等级 *</label>
              <select
                id="examLevel"
                v-model="examForm.level"
                class="form-select"
                :class="{ 'error': errors.level }"
                v-if="examForm.category === 'GESP'"
              >
                <option value="">请选择考试等级</option>
                <option value="1">GESP 1级</option>
                <option value="2">GESP 2级</option>
                <option value="3">GESP 3级</option>
                <option value="4">GESP 4级</option>
                <option value="5">GESP 5级</option>
                <option value="6">GESP 6级</option>
                <option value="7">GESP 7级</option>
                <option value="8">GESP 8级</option>
              </select>
              <span v-if="errors.level" class="error-message">{{ errors.level }}</span>
            </div>

            <div class="form-group">
              <label for="examType">考试类型 *</label>
              <select 
                id="examType"
                v-model="examForm.type" 
                class="form-select"
                :class="{ 'error': errors.type }"
              >
                <option value="">请选择考试类型</option>
                <option value="真题">真题</option>
                <option value="模拟">模拟</option>
                <option value="专项">专项</option>
              </select>
              <span v-if="errors.type" class="error-message">{{ errors.type }}</span>
            </div>

            <div class="form-group full-width">
              <label for="examDescription">考试描述</label>
              <textarea 
                id="examDescription"
                v-model="examForm.description" 
                placeholder="请输入考试描述（可选）"
                class="form-textarea"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group full-width checkbox-group">
              <label>
                <input type="checkbox" v-model="examForm.bank_visible" />
                题库可见（关闭后 level-exams 题库不显示，计划与测试仍可使用）
              </label>
            </div>
          </div>
        </div>

        <!-- 已选题目管理 -->
        <div class="selected-questions-section">
          <div class="section-header">
            <h4>已选题目 ({{ selectedQuestions.length }})</h4>
            <div class="section-actions">
              <button 
                @click="clearAllSelection" 
                class="btn-secondary"
                :disabled="selectedQuestions.length === 0"
              >
                清空所有
              </button>
            </div>
          </div>

          <div v-if="selectedQuestions.length === 0" class="empty-state">
            <p>暂未选择任何题目</p>
          </div>

          <div v-else class="selected-questions-list">
            <div 
              v-for="(question, index) in selectedQuestions" 
              :key="question.id"
              class="selected-question-item"
            >
              <div class="question-info">
                <div class="question-number">{{ index + 1 }}</div>
                <div class="question-badges">
                  <span class="level-badge" :class="`level-${question.level}`">
                    {{ getLevelText(question.level) }}
                  </span>
                  <span class="difficulty-badge" :class="`difficulty-${question.difficulty}`">
                    {{ getDifficultyText(question.difficulty) }}
                  </span>
                </div>
                <div class="question-text">{{ question.question_text }}</div>
              </div>
              <div class="question-actions">
                <button 
                  @click="moveQuestion(index, 'up')" 
                  class="btn-icon"
                  :disabled="index === 0"
                  title="上移"
                >
                  ⬆️
                </button>
                <button 
                  @click="moveQuestion(index, 'down')" 
                  class="btn-icon"
                  :disabled="index === selectedQuestions.length - 1"
                  title="下移"
                >
                  ⬇️
                </button>
                <button 
                  @click="removeQuestion(index)" 
                  class="btn-icon btn-icon--danger"
                  title="移除"
                >
                  ❌
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button @click="closeDialog" class="btn btn-secondary">
          取消
        </button>
        <button @click="createExam" class="btn btn-primary" :disabled="!canCreate">
          {{ creating ? '创建中...' : '创建练习' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

const router = useRouter()

// Props
interface Props {
  visible: boolean
  selectedQuestions: any[]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  created: [examId: number]
  removeQuestion: [index: number]
  moveQuestion: [data: { index: number, direction: 'up' | 'down' }]
  clearAllSelection: []
}>()

// 表单数据
const examForm = ref({
  name: '',
  category: 'GESP',
  level: '',
  type: '',
  description: '',
  bank_visible: true
})

// 错误信息
const errors = ref({
  name: '',
  category: '',
  level: '',
  type: ''
})

// 状态数据
const creating = ref(false)

// 监听选中的题目变化
watch(() => props.selectedQuestions, (newQuestions) => {
  // 可以在这里处理题目变化逻辑
}, { deep: true })

onMounted(() => {
  fetchQuestionTypes()
})

// 验证表单
function validateForm() {
  errors.value = { name: '', category: '', level: '', type: '' }
  let isValid = true

  if (!examForm.value.name.trim()) {
    errors.value.name = '请输入考试名称'
    isValid = false
  }

  if (examForm.value.category === 'GESP' && !examForm.value.level) {
    errors.value.level = 'GESP 分类请选择考试等级'
    isValid = false
  }

  if (!examForm.value.type) {
    errors.value.type = '请选择考试类型'
    isValid = false
  }

  return isValid
}

// 检查是否可以创建练习
const canCreate = computed(() => {
  return examForm.value.name.trim() &&
         examForm.value.category &&
         (examForm.value.category !== 'GESP' || examForm.value.level) &&
         examForm.value.type &&
         props.selectedQuestions.length > 0 &&
         !creating.value
})

// 创建练习
async function createExam() {
  if (!validateForm()) return

  creating.value = true
  try {
    const examData = {
      name: examForm.value.name.trim(),
      category: examForm.value.category,
      level: examForm.value.category === 'GESP' ? parseInt(examForm.value.level) : null,
      type: examForm.value.type,
      description: examForm.value.description.trim(),
      bank_visible: !!examForm.value.bank_visible,
      question_ids: props.selectedQuestions.map((q, index) => ({
        id: q.id,
        question_number: index + 1
      }))
    }

    const response = await axios.post(`${BASE_URL}/exams`, examData)
    
    // 重置表单
    examForm.value.name = ''
    examForm.value.category = 'GESP'
    examForm.value.level = ''
    examForm.value.type = ''
    examForm.value.description = ''
    examForm.value.bank_visible = true
    
    // 关闭弹窗
    closeDialog()
    
    // 触发创建成功事件
    emit('created', response.data.id)
    
  } catch (error: any) {
    console.error('创建练习失败:', error)
    alert('创建练习失败: ' + (error.response?.data?.error || error.message))
  } finally {
    creating.value = false
  }
}

// 关闭弹窗
function closeDialog() {
  emit('close')
}

// 移除题目
function removeQuestion(index: number) {
  // 这里需要通过emit通知父组件移除题目
  emit('removeQuestion', index)
}

// 移动题目位置
function moveQuestion(index: number, direction: 'up' | 'down') {
  // 这里需要通过emit通知父组件移动题目
  emit('moveQuestion', { index, direction })
}

// 清空所有选择
function clearAllSelection() {
  emit('clearAllSelection')
}

// 难度文本
function getDifficultyText(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

// 等级文本
function getLevelText(level: number) {
  return `GESP ${level}级`
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: white;
  border-radius: 18px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  color: white;
}

.dialog-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.dialog-body {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

.exam-info-section {
  margin-bottom: 32px;
}

.exam-info-section h4 {
  margin: 0 0 20px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.full-width {
  grid-column: span 2;
}

.form-group label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.form-input,
.form-select,
.form-textarea {
  padding: 12px 16px;
  border: 1.5px solid #b6e0fe;
  border-radius: 10px;
  font-size: 15px;
  background: white;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px 0 rgba(30,144,255,0.08);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.2);
}

.form-input.error,
.form-select.error {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

.error-message {
  color: #ef4444;
  font-size: 12px;
  font-weight: 500;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.selected-questions-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h4 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.section-actions {
  display: flex;
  gap: 12px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1.5px solid #b6e0fe;
  border-radius: 8px;
  background: white;
  color: #1e90ff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover:not(:disabled) {
  background: #f0f9ff;
  border-color: #1e90ff;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #cbd5e1;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
}

.selected-questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.selected-question-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f0f9ff;
  border: 1px solid #b6e0fe;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.selected-question-item:hover {
  background: #e0f2fe;
  border-color: #1e90ff;
}

.question-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.question-number {
  background: #1e90ff;
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
}

.question-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.level-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.level-1 { background: #e0f7fa; color: #1e90ff; }
.level-2 { background: #b6e0fe; color: #1e90ff; }
.level-3 { background: #d1faff; color: #1e90ff; }
.level-4 { background: #e3f2fd; color: #1e90ff; }
.level-5 { background: #b3e5fc; color: #1e90ff; }
.level-6 { background: #fef3c7; color: #d97706; }
.level-7 { background: #dbeafe; color: #1d4ed8; }
.level-8 { background: #fce7f3; color: #be185d; }

.difficulty-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.difficulty-easy { background: #d1fae5; color: #065f46; }
.difficulty-medium { background: #e0e7ef; color: #1e293b; }
.difficulty-hard { background: #fee2e2; color: #b91c1c; }

.question-text {
  color: #1e293b;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
  flex: 1;
  min-width: 0;
}

.question-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #6b7280;
  transition: all 0.3s ease;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
}

.btn-icon:hover:not(:disabled) {
  background: rgba(107, 114, 128, 0.1);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon--danger {
  color: #ef4444;
}

.btn-icon--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 24px 32px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
}

.btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 144, 255, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #cbd5e1;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dialog-content {
    width: 95%;
    max-height: 95vh;
  }

  .dialog-header,
  .dialog-body,
  .dialog-footer {
    padding: 20px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }

  .question-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .dialog-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
