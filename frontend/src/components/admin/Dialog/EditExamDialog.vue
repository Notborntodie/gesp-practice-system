<template>
  <div v-if="visible" class="dialog-overlay" @click="closeDialog">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>编辑练习 / 试卷</h3>
        <button type="button" @click="closeDialog" class="close-btn">×</button>
      </div>

      <div v-if="loadError" class="dialog-body">
        <p class="load-error">{{ loadError }}</p>
      </div>

      <div v-else-if="detailLoading" class="dialog-body loading-wrap">
        <div class="loading-spinner" />
        <p>加载考试详情...</p>
      </div>

      <template v-else>
        <div class="dialog-body">
          <div class="exam-info-section">
            <h4>考试基本信息</h4>
            <div class="form-grid">
              <div class="form-group">
                <label for="editExamName">考试名称 *</label>
                <input
                  id="editExamName"
                  v-model="examForm.name"
                  type="text"
                  class="form-input"
                  :class="{ error: errors.name }"
                />
                <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
              </div>

              <div class="form-group">
                <label for="editExamCategory">考试分类 *</label>
                <select
                  id="editExamCategory"
                  v-model="examForm.category"
                  class="form-select"
                  :class="{ error: errors.category }"
                >
                  <option value="">请选择</option>
                  <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                    {{ type.display_name || type.name }}
                  </option>
                </select>
                <span v-if="errors.category" class="error-message">{{ errors.category }}</span>
              </div>

              <div class="form-group" v-if="examForm.category === 'GESP'">
                <label for="editExamLevel">考试等级 *</label>
                <select
                  id="editExamLevel"
                  v-model="examForm.level"
                  class="form-select"
                  :class="{ error: errors.level }"
                >
                  <option value="">请选择</option>
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
                <label for="editExamType">考试类型 *</label>
                <select
                  id="editExamType"
                  v-model="examForm.type"
                  class="form-select"
                  :class="{ error: errors.type }"
                >
                  <option value="">请选择</option>
                  <option value="真题">真题</option>
                  <option value="模拟">模拟</option>
                  <option value="专项">专项</option>
                </select>
                <span v-if="errors.type" class="error-message">{{ errors.type }}</span>
              </div>

              <div class="form-group full-width">
                <label for="editExamDesc">考试描述</label>
                <textarea
                  id="editExamDesc"
                  v-model="examForm.description"
                  class="form-textarea"
                  rows="3"
                />
              </div>

              <div class="form-group full-width checkbox-group">
                <label>
                  <input v-model="examForm.bank_visible" type="checkbox" />
                  题库可见（关闭后 level-exams 题库不显示，计划与测试仍可使用）
                </label>
              </div>
            </div>
          </div>

          <div class="selected-questions-section">
            <div class="section-header">
              <h4>卷内题目 ({{ selectedQuestions.length }})</h4>
              <div class="section-actions">
                <button
                  type="button"
                  class="btn-secondary"
                  :disabled="selectedQuestions.length === 0"
                  @click="clearAllSelected"
                >
                  清空卷内
                </button>
              </div>
            </div>

            <div v-if="selectedQuestions.length === 0" class="empty-state">
              <p>当前试卷暂无题目（允许保存为空卷）</p>
            </div>

            <div v-else class="selected-questions-list">
              <div
                v-for="(question, index) in selectedQuestions"
                :key="`sel-${question.id}-${index}`"
                class="selected-question-item"
              >
                <div class="question-info">
                  <div class="question-number">{{ index + 1 }}</div>
                  <div class="question-badges">
                    <span class="level-badge" :class="`level-${question.level}`">
                      {{ getLevelText(question.level) }}
                    </span>
                    <span class="difficulty-badge" :class="`difficulty-${question.difficulty || 'medium'}`">
                      {{ getDifficultyText(question.difficulty || 'medium') }}
                    </span>
                  </div>
                  <div class="question-text">{{ question.question_text }}</div>
                </div>
                <div class="question-actions">
                  <button
                    type="button"
                    class="btn-icon"
                    :disabled="index === 0"
                    title="上移"
                    @click="moveQuestion(index, 'up')"
                  >
                    ⬆️
                  </button>
                  <button
                    type="button"
                    class="btn-icon"
                    :disabled="index === selectedQuestions.length - 1"
                    title="下移"
                    @click="moveQuestion(index, 'down')"
                  >
                    ⬇️
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-icon--danger"
                    title="移出试卷"
                    @click="removeQuestion(index)"
                  >
                    ❌
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="available-section">
            <div class="section-header">
              <h4>从题库添加 ({{ filteredPool.length }})</h4>
              <div class="section-actions pool-actions">
                <input
                  v-model="poolSearch"
                  type="text"
                  class="pool-search"
                  placeholder="搜索题干..."
                />
                <select v-model="poolLevelFilter" class="pool-filter" @change="refetchAvailable">
                  <option value="">全部等级</option>
                  <option value="1">GESP 1级</option>
                  <option value="2">GESP 2级</option>
                  <option value="3">GESP 3级</option>
                  <option value="4">GESP 4级</option>
                  <option value="5">GESP 5级</option>
                  <option value="6">GESP 6级</option>
                  <option value="7">GESP 7级</option>
                  <option value="8">GESP 8级</option>
                </select>
                <select v-model="poolDifficultyFilter" class="pool-filter">
                  <option value="">全部难度</option>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
                <button type="button" class="btn-secondary btn-compact" @click="refetchAvailable">
                  刷新题库
                </button>
              </div>
            </div>

            <div v-if="poolLoading" class="loading-wrap small">
              <div class="loading-spinner" />
              <p>加载题库...</p>
            </div>
            <div v-else class="questions-grid">
              <div
                v-for="question in filteredPool"
                :key="question.id"
                class="question-card"
              >
                <div class="question-card-header">
                  <div class="question-badges">
                    <span class="level-badge" :class="`level-${question.level}`">
                      {{ getLevelText(question.level) }}
                    </span>
                    <span class="difficulty-badge" :class="`difficulty-${question.difficulty || 'medium'}`">
                      {{ getDifficultyText(question.difficulty || 'medium') }}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="select-btn"
                    title="加入试卷"
                    @click="addQuestion(question)"
                  >
                    +
                  </button>
                </div>
                <div class="question-card-body">
                  <p class="question-text">{{ question.question_text }}</p>
                </div>
              </div>
              <div v-if="filteredPool.length === 0" class="empty-state inline">
                <p>没有可添加的题目（调整筛选或搜索）</p>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn btn-secondary" @click="closeDialog">取消</button>
          <button type="button" class="btn btn-primary" :disabled="!canSave" @click="saveExam">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

interface Props {
  visible: boolean
  examId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const examForm = ref({
  name: '',
  category: 'GESP',
  level: '',
  type: '',
  description: '',
  bank_visible: true
})

const errors = ref({ name: '', category: '', level: '', type: '' })
const detailLoading = ref(false)
const loadError = ref('')
const saving = ref(false)

const selectedQuestions = ref<any[]>([])
const availableQuestions = ref<any[]>([])
const poolLoading = ref(false)
const poolSearch = ref('')
const poolLevelFilter = ref('')
const poolDifficultyFilter = ref('')

const selectedIdSet = computed(() => new Set(selectedQuestions.value.map((q) => q.id)))

const filteredPool = computed(() => {
  let list = availableQuestions.value.filter((q) => !selectedIdSet.value.has(q.id))
  const q = poolSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (it) =>
        it.question_text?.toLowerCase().includes(q) ||
        String(it.id).includes(q)
    )
  }
  if (poolDifficultyFilter.value) {
    list = list.filter((it) => (it.difficulty || 'medium') === poolDifficultyFilter.value)
  }
  return list
})

const canSave = computed(() => {
  return (
    examForm.value.name.trim() &&
    examForm.value.category &&
    (examForm.value.category !== 'GESP' || examForm.value.level) &&
    examForm.value.type &&
    !saving.value &&
    !detailLoading.value &&
    !loadError.value
  )
})

function getDifficultyText(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

function getLevelText(level: number) {
  return `GESP ${level}级`
}

function validateForm(): boolean {
  errors.value = { name: '', category: '', level: '', type: '' }
  let ok = true
  if (!examForm.value.name.trim()) {
    errors.value.name = '请输入考试名称'
    ok = false
  }
  if (examForm.value.category === 'GESP' && !examForm.value.level) {
    errors.value.level = 'GESP 分类请选择考试等级'
    ok = false
  }
  if (!examForm.value.type) {
    errors.value.type = '请选择考试类型'
    ok = false
  }
  return ok
}

async function loadExamAndPool(id: number) {
  loadError.value = ''
  detailLoading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/exams/${id}`)
    examForm.value = {
      name: data.name || '',
      category: data.category || 'GESP',
      level: data.level != null ? String(data.level) : '',
      type: data.type || '真题',
      description: data.description || '',
      bank_visible: data.bank_visible === undefined || Number(data.bank_visible) === 1
    }
    const qs = Array.isArray(data.questions) ? [...data.questions] : []
    qs.sort(
      (a: any, b: any) => (Number(a.question_number) || 0) - (Number(b.question_number) || 0)
    )
    selectedQuestions.value = qs
    if (data.level != null) {
      poolLevelFilter.value = String(data.level)
    } else {
      poolLevelFilter.value = ''
    }
    await fetchAvailable()
  } catch (e: any) {
    console.error(e)
    loadError.value =
      e.response?.data?.error || e.message || '加载考试失败'
  } finally {
    detailLoading.value = false
  }
}

async function fetchAvailable() {
  if (!props.examId) return
  poolLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (poolLevelFilter.value) {
      params.level = poolLevelFilter.value
    }
    const { data } = await axios.get(`${BASE_URL}/available-questions`, { params })
    availableQuestions.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    console.error(e)
    alert('加载题库失败: ' + (e.response?.data?.error || e.message))
    availableQuestions.value = []
  } finally {
    poolLoading.value = false
  }
}

function refetchAvailable() {
  fetchAvailable()
}

watch(
  () => ({ v: props.visible, id: props.examId }),
  ({ v, id }) => {
    if (v && id != null) {
      loadError.value = ''
      loadExamAndPool(id)
    } else if (!v) {
      loadError.value = ''
      poolSearch.value = ''
      poolDifficultyFilter.value = ''
    }
  }
)

onMounted(() => {
  fetchQuestionTypes()
})

function closeDialog() {
  emit('close')
}

function clearAllSelected() {
  selectedQuestions.value = []
}

function removeQuestion(index: number) {
  selectedQuestions.value.splice(index, 1)
}

function moveQuestion(index: number, direction: 'up' | 'down') {
  const arr = selectedQuestions.value
  if (direction === 'up' && index > 0) {
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  } else if (direction === 'down' && index < arr.length - 1) {
    ;[arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
  }
}

function addQuestion(q: any) {
  if (selectedIdSet.value.has(q.id)) return
  selectedQuestions.value.push({ ...q })
}

async function saveExam() {
  if (!validateForm() || props.examId == null) return
  saving.value = true
  try {
    const payload = {
      name: examForm.value.name.trim(),
      category: examForm.value.category,
      level: examForm.value.category === 'GESP' ? parseInt(examForm.value.level, 10) : null,
      type: examForm.value.type,
      description: examForm.value.description.trim(),
      bank_visible: !!examForm.value.bank_visible,
      question_ids: selectedQuestions.value.map((q, index) => ({
        id: q.id,
        question_number: index + 1
      }))
    }
    await axios.put(`${BASE_URL}/exams/${props.examId}`, payload)
    emit('saved')
    emit('close')
  } catch (e: any) {
    console.error(e)
    const msg =
      e.response?.data?.details ||
      e.response?.data?.error ||
      e.message ||
      '保存失败'
    alert('保存失败: ' + msg)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
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
  max-width: 920px;
  width: 92%;
  max-height: 92vh;
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
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.dialog-body {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

.load-error {
  color: #b91c1c;
  font-weight: 500;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px;
  color: #64748b;
}

.loading-wrap.small {
  padding: 24px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #1e90ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.exam-info-section {
  margin-bottom: 28px;
}

.exam-info-section h4 {
  margin: 0 0 16px 0;
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
}

.error-message {
  color: #ef4444;
  font-size: 12px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.selected-questions-section {
  margin-bottom: 24px;
}

.available-section {
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.section-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.pool-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pool-search {
  padding: 8px 12px;
  border: 1.5px solid #b6e0fe;
  border-radius: 8px;
  min-width: 160px;
  font-size: 14px;
}

.pool-filter {
  padding: 8px 12px;
  border: 1.5px solid #b6e0fe;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.btn-compact {
  padding: 8px 14px;
  font-size: 13px;
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
}

.btn-secondary:hover:not(:disabled) {
  background: #f0f9ff;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 28px 16px;
  color: #64748b;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #cbd5e1;
}

.empty-state.inline {
  grid-column: 1 / -1;
}

.selected-questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.selected-question-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  background: #f0f9ff;
  border: 1px solid #b6e0fe;
  border-radius: 12px;
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
  flex-shrink: 0;
}

.question-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
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
  gap: 6px;
  flex-shrink: 0;
}

.btn-icon {
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
}

.btn-icon:hover:not(:disabled) {
  background: rgba(107, 114, 128, 0.12);
}

.btn-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-icon--danger {
  color: #ef4444;
}

.questions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  max-height: 360px;
  overflow-y: auto;
}

.question-card {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.question-card:hover {
  border-color: #1e90ff;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
}

.question-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(30, 144, 255, 0.08);
  border-bottom: 1px solid #e2e8f0;
}

.question-card-body {
  padding: 12px;
}

.select-btn {
  width: 32px;
  height: 32px;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
  background: white;
  color: #1e90ff;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.select-btn:hover {
  border-color: #1e90ff;
  background: #eff6ff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 20px 32px;
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
  min-width: 110px;
}

.dialog-footer .btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #cbd5e1;
}

.dialog-footer .btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-group.full-width {
    grid-column: span 1;
  }
  .dialog-footer {
    flex-direction: column;
  }
  .btn {
    width: 100%;
  }
}
</style>
