<template>
  <div class="exam-editor-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回练习列表
      </AppButton>
      <h2 class="editor-title">{{ isEditMode ? '编辑练习' : '创建练习' }}</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="!canSave" :loading="saving" @click="saveExam">
          <Save :size="16" />
          保存
        </AppButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loadError" class="load-error">
      <p>{{ loadError }}</p>
      <AppButton variant="primary" @click="goBack">返回列表</AppButton>
    </div>

    <div v-else-if="detailLoading" class="loading-wrap">
      <div class="loading-spinner"></div>
      <p>加载练习详情...</p>
    </div>

    <!-- Editor Body -->
    <div v-else class="editor-body">
      <!-- Left Panel: Basic Info -->
      <div class="left-panel">
        <div class="form-section">
          <h5 class="section-title">基本信息</h5>
          <div class="form-row">
            <AppFormField label="练习名称" required :error="errors.name" class="flex-1">
              <AppInput v-model="examForm.name" placeholder="请输入练习名称" />
            </AppFormField>
          </div>
          <div class="form-row">
            <AppFormField label="分类" required :error="errors.category" class="flex-2">
              <AppSelect
                v-model="examForm.category"
                :options="categoryOptions"
                placeholder="请选择分类"
              />
            </AppFormField>
            <AppFormField v-if="examForm.category === 'GESP'" label="等级" required :error="errors.level" class="flex-1">
              <AppSelect
                v-model="examForm.level"
                :options="levelOptions"
                placeholder="请选择等级"
              />
            </AppFormField>
            <AppFormField label="类型" required :error="errors.type" class="flex-1">
              <AppSelect
                v-model="examForm.type"
                :options="typeOptions"
                placeholder="请选择类型"
              />
            </AppFormField>
          </div>

          <AppFormField label="描述">
            <AppTextarea v-model="examForm.description" rows="2" placeholder="请输入描述（可选）" />
          </AppFormField>

          <div class="checkbox-row">
            <label class="checkbox-label">
              <input v-model="examForm.bank_visible" type="checkbox" class="checkbox-input" />
              <span>题库可见</span>
            </label>
          </div>
        </div>

        <!-- Selected Questions Summary -->
        <div class="form-section">
          <h5 class="section-title">已选题目 ({{ selectedQuestions.length }})</h5>
          <div v-if="selectedQuestions.length === 0" class="empty-state inline">
            <p>暂无题目</p>
          </div>
          <div v-else class="selected-questions-list">
            <div
              v-for="(question, index) in selectedQuestions"
              :key="`sel-${question.id}-${index}`"
              class="selected-question-item"
            >
              <span class="question-number">{{ index + 1 }}</span>
              <AppTag type="info" size="sm">{{ getLevelText(question.level) }}</AppTag>
              <span class="question-text">{{ truncateText(question.question_text, 40) }}</span>
              <div class="question-actions">
                <AppButton variant="ghost" size="sm" :disabled="index === 0" @click="moveQuestion(index, 'up')">
                  <ChevronUp :size="14" />
                </AppButton>
                <AppButton variant="ghost" size="sm" :disabled="index === selectedQuestions.length - 1" @click="moveQuestion(index, 'down')">
                  <ChevronDown :size="14" />
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="removeQuestion(index)">
                  <X :size="14" />
                </AppButton>
              </div>
            </div>
          </div>
          <AppButton v-if="selectedQuestions.length > 0" variant="ghost" size="sm" @click="clearAllSelected" class="mt-2">
            清空全部
          </AppButton>
        </div>
      </div>

      <!-- Right Panel: Question Pool -->
      <div class="right-panel">
        <div class="form-section">
          <div class="section-header">
            <h5 class="section-title">题库筛选</h5>
          </div>

          <!-- Filters -->
          <div class="pool-filters">
            <div class="filter-row">
              <AppInput
                v-model="poolSearch"
                placeholder="搜索题目内容..."
                clearable
                size="sm"
              />
              <AppSelect
                v-model="poolCategoryFilter"
                :options="poolCategoryOptions"
                placeholder="题目来源"
                size="sm"
              />
              <AppSelect
                v-model="poolLevelFilter"
                :options="poolLevelOptions"
                placeholder="级别"
                size="sm"
              />
              <input
                v-model="poolDateFilter"
                type="month"
                class="month-input-sm"
                placeholder="日期"
              />
              <AppSelect
                v-model="poolDifficultyFilter"
                :options="poolDifficultyOptions"
                placeholder="难度"
                size="sm"
              />
              <AppSelect
                v-model="poolKnowledgePointFilter"
                :options="poolKnowledgePointOptions"
                placeholder="知识点"
                size="sm"
              />
            </div>
            <div class="filter-actions">
              <span class="pool-count">筛选结果: {{ filteredPool.length }} 道</span>
              <AppButton variant="ghost" size="sm" @click="clearPoolFilters">清除筛选</AppButton>
              <AppButton variant="ghost" size="sm" @click="fetchAvailable">
                <RefreshCw :size="14" />
              </AppButton>
            </div>
          </div>

          <!-- Batch Actions -->
          <div v-if="filteredPool.length > 0" class="batch-actions-bar">
            <label class="checkbox-label">
              <input type="checkbox" :checked="isAllPoolSelected" @change="toggleSelectAllPool" class="checkbox-input" />
              <span>全选筛选结果</span>
            </label>
            <span v-if="poolSelectedIds.length > 0" class="selected-count">已选 {{ poolSelectedIds.length }} 道</span>
            <AppButton
              v-if="poolSelectedIds.length > 0"
              variant="primary"
              size="sm"
              @click="batchAddQuestions"
            >
              <Plus :size="14" />
              批量添加
            </AppButton>
          </div>

          <!-- Loading -->
          <div v-if="poolLoading" class="loading-wrap small">
            <div class="loading-spinner"></div>
            <p>加载题库...</p>
          </div>

          <!-- Question List -->
          <div v-else class="pool-questions-list">
            <div v-if="filteredPool.length > 0">
              <div
                v-for="question in filteredPool"
                :key="question.id"
                class="pool-question-item"
                :class="{ selected: poolSelectedIds.includes(question.id) }"
              >
                <input
                  type="checkbox"
                  :checked="poolSelectedIds.includes(question.id)"
                  @change="togglePoolQuestion(question.id)"
                  class="checkbox-input"
                />
                <div class="question-info">
                  <span class="question-id">#{{ question.id }}</span>
                  <AppTag type="info" size="sm">{{ getLevelText(question.level) }}</AppTag>
                  <AppTag :type="getDifficultyTagType(question.difficulty || 'medium')" size="sm">
                    {{ getDifficultyText(question.difficulty || 'medium') }}
                  </AppTag>
                  <span class="question-text">{{ truncateText(question.question_text, 50) }}</span>
                </div>
                <AppButton variant="secondary" size="sm" @click="addQuestion(question)">
                  <Plus :size="14" />
                </AppButton>
              </div>
            </div>
            <div v-else class="empty-state inline">
              <p>没有符合条件的题目</p>
            </div>
          </div>
        </div>
      </div>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, computed, watch, onMounted, inject } from 'vue'
import axios from 'axios'
import type { Ref } from 'vue'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Save, Plus, ChevronUp, ChevronDown, X, RefreshCw } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// Inject from AdminLayout
const examEditorExamId = inject<Ref<number | undefined>>('examEditorExamId')
const examEditorQuestionIds = inject<Ref<number[] | undefined>>('examEditorQuestionIds')

// Computed
const isEditMode = computed(() => !!examEditorExamId?.value)

// Form
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

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

// Questions
const selectedQuestions = ref<any[]>([])
const availableQuestions = ref<any[]>([])
const poolLoading = ref(false)
const poolSearch = ref('')
const poolCategoryFilter = ref('')
const poolLevelFilter = ref('')
const poolDifficultyFilter = ref('')
const poolDateFilter = ref('')
const poolKnowledgePointFilter = ref('')
const poolKnowledgePoints = ref<any[]>([])
const poolSelectedIds = ref<number[]>([])

// Options
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelOptions = [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
]

const typeOptions = [
  { label: '真题', value: '真题' },
  { label: '模拟', value: '模拟' },
  { label: '专项', value: '专项' },
]

const poolLevelOptions = [
  { label: '全部等级', value: '' },
  ...levelOptions
]

const poolDifficultyOptions = [
  { label: '全部难度', value: '' },
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
]

const poolCategoryOptions = computed(() => [
  { label: '全部来源', value: '' },
  ...categoryOptions.value
])

const poolKnowledgePointOptions = computed(() => [
  { label: '全部知识点', value: '' },
  ...poolKnowledgePoints.value.map((kp: any) => ({
    label: kp.name,
    value: String(kp.id)
  }))
])

const selectedIdSet = computed(() => new Set(selectedQuestions.value.map(q => q.id)))

const filteredPool = computed(() => {
  let list = availableQuestions.value.filter(q => !selectedIdSet.value.has(q.id))

  // Search filter
  const q = poolSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(it =>
      it.question_text?.toLowerCase().includes(q) ||
      String(it.id).includes(q)
    )
  }

  // Category filter
  if (poolCategoryFilter.value) {
    list = list.filter(it => it.category === poolCategoryFilter.value)
  }

  // Level filter
  if (poolLevelFilter.value) {
    list = list.filter(it => String(it.level) === poolLevelFilter.value)
  }

  // Difficulty filter
  if (poolDifficultyFilter.value) {
    list = list.filter(it => (it.difficulty || 'medium') === poolDifficultyFilter.value)
  }

  // Date filter
  if (poolDateFilter.value) {
    list = list.filter(it => it.question_date?.startsWith(poolDateFilter.value))
  }

  // Knowledge point filter
  if (poolKnowledgePointFilter.value) {
    const kpId = parseInt(poolKnowledgePointFilter.value)
    list = list.filter(it => {
      const kps = it.knowledge_points || []
      return kps.some((kp: any) => kp.id === kpId || kp.knowledge_point_id === kpId)
    })
  }

  return list
})

const isAllPoolSelected = computed(() => {
  if (filteredPool.value.length === 0) return false
  return filteredPool.value.every(q => poolSelectedIds.value.includes(q.id))
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

// Helpers
function truncateText(text: string, max: number): string {
  if (!text || text.length <= max) return text
  return text.substring(0, max) + '...'
}

function getDifficultyText(d: string): string {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

function getDifficultyTagType(d: string): 'success' | 'warning' | 'default' {
  if (d === 'easy') return 'success'
  if (d === 'hard') return 'warning'
  return 'default'
}

function getLevelText(level: number): string {
  return `GESP ${level}级`
}

function validateForm(): boolean {
  errors.value = { name: '', category: '', level: '', type: '' }
  let ok = true
  if (!examForm.value.name.trim()) {
    errors.value.name = '请输入练习名称'
    ok = false
  }
  if (examForm.value.category === 'GESP' && !examForm.value.level) {
    errors.value.level = 'GESP 分类请选择等级'
    ok = false
  }
  if (!examForm.value.type) {
    errors.value.type = '请选择类型'
    ok = false
  }
  return ok
}

function goBack() {
  window.location.href = '/admin/exams'
}

// Load Data
async function loadExam(id: number) {
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
    qs.sort((a: any, b: any) => (Number(a.question_number) || 0) - (Number(b.question_number) || 0))
    selectedQuestions.value = qs
    if (data.level != null) {
      poolLevelFilter.value = String(data.level)
    }
    await fetchAvailable()
  } catch (e: any) {
    console.error(e)
    loadError.value = e.response?.data?.error || e.message || '加载练习失败'
  } finally {
    detailLoading.value = false
  }
}

async function loadQuestionsByIds(ids: number[]) {
  if (ids.length === 0) return
  detailLoading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/questions`, {
      params: { ids: ids.join(','), pageSize: ids.length }
    })
    if (data.success && Array.isArray(data.data)) {
      selectedQuestions.value = data.data.map((q: any, i: number) => ({
        ...q,
        question_number: i + 1
      }))
    }
    await fetchAvailable()
  } catch (e: any) {
    console.error(e)
    loadError.value = '加载题目失败'
  } finally {
    detailLoading.value = false
  }
}

async function fetchAvailable() {
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
    availableQuestions.value = []
  } finally {
    poolLoading.value = false
  }
}

async function loadKnowledgePoints() {
  try {
    const { data } = await axios.get(`${BASE_URL}/knowledge-points`)
    poolKnowledgePoints.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    console.error('加载知识点失败:', e)
    poolKnowledgePoints.value = []
  }
}

// Question Actions
function clearAllSelected() {
  selectedQuestions.value = []
}

function removeQuestion(index: number) {
  selectedQuestions.value.splice(index, 1)
}

function moveQuestion(index: number, direction: 'up' | 'down') {
  const arr = selectedQuestions.value
  if (direction === 'up' && index > 0) {
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  } else if (direction === 'down' && index < arr.length - 1) {
    [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
  }
}

function addQuestion(q: any) {
  if (selectedIdSet.value.has(q.id)) return
  selectedQuestions.value.push({ ...q })
}

// Pool batch selection functions
function clearPoolFilters() {
  poolSearch.value = ''
  poolCategoryFilter.value = ''
  poolLevelFilter.value = ''
  poolDifficultyFilter.value = ''
  poolDateFilter.value = ''
  poolKnowledgePointFilter.value = ''
  poolSelectedIds.value = []
}

function toggleSelectAllPool() {
  if (isAllPoolSelected.value) {
    // Unselect all
    poolSelectedIds.value = []
  } else {
    // Select all filtered
    poolSelectedIds.value = filteredPool.value.map(q => q.id)
  }
}

function togglePoolQuestion(id: number) {
  const idx = poolSelectedIds.value.indexOf(id)
  if (idx === -1) {
    poolSelectedIds.value.push(id)
  } else {
    poolSelectedIds.value.splice(idx, 1)
  }
}

function batchAddQuestions() {
  if (poolSelectedIds.value.length === 0) return

  // Get all selected questions from filtered pool
  const toAdd = filteredPool.value.filter(q => poolSelectedIds.value.includes(q.id))

  // Add each question to selected list
  for (const q of toAdd) {
    if (!selectedIdSet.value.has(q.id)) {
      selectedQuestions.value.push({ ...q })
    }
  }

  // Clear selection after adding
  poolSelectedIds.value = []
}

async function saveExam() {
  if (!validateForm()) return
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

    if (isEditMode.value && examEditorExamId?.value) {
      await axios.put(`${BASE_URL}/exams/${examEditorExamId.value}`, payload)
      successMessage.value = '练习保存成功！'
      showSuccessDialog.value = true
    } else {
      await axios.post(`${BASE_URL}/exams`, payload)
      successMessage.value = '练习创建成功！'
      showSuccessDialog.value = true
    }
    // 延迟返回列表，让用户看到成功提示
    setTimeout(() => goBack(), 1500)
  } catch (e: any) {
    console.error(e)
    const msg = e.response?.data?.details || e.response?.data?.error || e.message || '保存失败'
    errorMessage.value = msg
    showErrorDialog.value = true
  } finally {
    saving.value = false
  }
}

// Init
onMounted(async () => {
  await questionTypeStore.fetchQuestionTypes()
  await loadKnowledgePoints()

  if (examEditorExamId?.value) {
    // Edit mode
    await loadExam(examEditorExamId.value)
  } else if (examEditorQuestionIds?.value && examEditorQuestionIds.value.length > 0) {
    // Create from selected questions
    await loadQuestionsByIds(examEditorQuestionIds.value)
    await fetchAvailable()
  } else {
    // Create new
    await fetchAvailable()
  }
})
</script>

<style scoped>
.exam-editor-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--navbar-height) - var(--space-6) * 2);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.editor-title {
  flex: 1;
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  color: var(--color-destructive);
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.loading-wrap.small {
  padding: var(--space-4);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.editor-body {
  display: flex;
  gap: var(--space-4);
  flex: 1;
}

.left-panel {
  min-width: 320px;
  max-width: 400px;
  flex: 0 0 auto;
}

.right-panel {
  flex: 1;
  min-width: 0;
}

.form-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.checkbox-row {
  margin-top: var(--space-3);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.empty-state {
  text-align: center;
  padding: var(--space-4);
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.empty-state.inline {
  grid-column: 1 / -1;
}

.summary-stat {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.stat-value {
  color: var(--color-primary);
  font-weight: 600;
}

.pool-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.selected-questions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 240px;
  overflow-y: auto;
}

.selected-question-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.question-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.question-number {
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.question-badges {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.question-text {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
}

.question-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.questions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
}

.question-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast);
}

.question-card:hover {
  border-color: var(--color-primary);
}

.question-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.question-card-body {
  padding: var(--space-3);
}

.question-card-body .question-text {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

/* Pool Filters */
.pool-filters {
  margin-bottom: var(--space-3);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.filter-row > * {
  flex: 1;
  min-width: 120px;
}

.month-input-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-foreground);
  min-width: 120px;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.pool-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Batch Actions */
.batch-actions-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.selected-count {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: 500;
}

/* Pool Questions List */
.pool-questions-list {
  max-height: 400px;
  overflow-y: auto;
}

.pool-question-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  transition: border-color var(--transition-fast);
}

.pool-question-item:hover {
  border-color: var(--color-primary);
}

.pool-question-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.pool-question-item .question-info {
  flex: 1;
  min-width: 0;
}

.pool-question-item .question-id {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 500;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.form-row > * {
  flex: 1;
  min-width: 140px;
}

.flex-2 {
  flex: 2;
  min-width: 180px;
}

.flex-1 {
  flex: 1;
  min-width: 120px;
}

.mt-2 {
  margin-top: var(--space-2);
}

@media (max-width: 900px) {
  .editor-body {
    flex-direction: column;
  }

  .left-panel {
    min-width: 100%;
    max-width: 100%;
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .pool-actions {
    flex-wrap: wrap;
  }

  .questions-grid {
    grid-template-columns: 1fr;
  }

  .form-row > * {
    min-width: 100%;
  }
}
</style>