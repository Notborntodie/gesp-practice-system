<template>
  <AdminPageTemplate
    title="题目管理"
    :loading="loading"
    :total="questions.length"
    :cache-valid="questionStore.isCacheValid"
    :has-cache="questionStore.hasQuestions"
    @refresh="refreshQuestions"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="openBatchUpload">
        <Plus :size="16" />
        上传题目
      </AppButton>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="filter-group">
        <label>搜索题目：</label>
        <AppInput
          v-model="searchQuery"
          placeholder="搜索题目内容..."
          clearable
        />
      </div>
      <div class="filter-group">
        <label>题目来源：</label>
        <AppSelect
          v-model="filterCategory"
          :options="categoryOptions"
          placeholder="全部来源"
        />
      </div>
      <div v-if="filterCategory === '' || filterCategory === 'GESP'" class="filter-group">
        <label>级别筛选：</label>
        <AppSelect
          v-model="filterLevel"
          :options="levelOptions"
          placeholder="全部级别"
        />
      </div>
      <div class="filter-group">
        <label>日期筛选：</label>
        <input
          type="month"
          v-model="filterDate"
          class="month-input"
        />
      </div>
      <div class="filter-group">
        <label>知识点：</label>
        <AppSelect
          v-model="filterKnowledgePoint"
          :options="knowledgePointOptions"
          placeholder="全部知识点"
        />
      </div>
    </template>

    <!-- Batch Toolbar -->
    <template #batch-toolbar>
      <div v-if="selectedQuestions.length > 0" class="batch-toolbar">
        <span class="selected-info">已选择 {{ selectedQuestions.length }} 道题目</span>
        <div class="batch-actions">
          <AppButton variant="ghost" size="sm" @click="selectAll">全选</AppButton>
          <AppButton variant="ghost" size="sm" @click="clearSelection">取消选择</AppButton>
          <AppButton variant="secondary" size="sm" @click="openBatchEdit">
            <Edit3 :size="14" />
            批量编辑
          </AppButton>
          <AppButton variant="destructive" size="sm" @click="batchDelete">
            <Trash2 :size="14" />
            批量删除
          </AppButton>
        </div>
      </div>
    </template>

    <!-- Content: Table -->
    <div class="questions-table-container">
      <table v-if="filteredQuestions.length > 0" class="questions-table">
        <thead>
          <tr>
            <th style="width: 50px;">
              <input
                type="checkbox"
                :checked="selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0"
                @change="selectAll"
                class="table-checkbox"
              />
            </th>
            <th>序号</th>
            <th>题目内容</th>
            <th>题目来源</th>
            <th>级别</th>
            <th>难度</th>
            <th>类型</th>
            <th>创建时间</th>
            <th>正确答案</th>
            <th>知识点</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(q, index) in filteredQuestions"
            :key="q.id"
            class="table-row"
            @click="toggleQuestionExpansion(q.id)"
          >
            <td @click.stop>
              <input
                type="checkbox"
                :checked="selectedQuestions.includes(q.id)"
                @change="toggleQuestionSelection(q.id)"
                class="table-checkbox"
              />
            </td>
            <td>{{ q.question_number || (index + 1) }}</td>
            <td class="question-content-cell">
              <div class="question-preview">
                {{ truncateText(q.question_text || '题目内容加载中...', 50) }}
              </div>
              <div v-if="(q.images && q.images.length > 0) || q.image_url" class="has-images-indicator">
                <Image :size="14" />
                {{ getImageCount(q) }}张图片
              </div>
            </td>
            <td>
              <AppTag :type="getCategoryTagType(q.category || 'GESP')">
                {{ getCategoryText(q.category || 'GESP') }}
              </AppTag>
            </td>
            <td>
              <AppTag v-if="(q.category || 'GESP') === 'GESP'" type="info">
                GESP {{ q.level || 1 }}级
              </AppTag>
              <span v-else class="no-level">-</span>
            </td>
            <td>
              <AppTag :type="getDifficultyTagType(q.difficulty || 'medium')">
                {{ getDifficultyText(q.difficulty || 'medium') }}
              </AppTag>
            </td>
            <td>{{ q.question_type === 'code' ? '代码题' : '文本题' }}</td>
            <td>{{ formatDate(q.created_at) }}</td>
            <td class="answer-cell">{{ q.correct_answer }}</td>
            <td class="knowledge-points-cell">
              <div v-if="q.knowledge_points && q.knowledge_points.length > 0" class="knowledge-tags">
                <AppTag
                  v-for="kp in q.knowledge_points.slice(0, 2)"
                  :key="kp.id"
                  type="default"
                  size="sm"
                >
                  {{ kp.name }}
                </AppTag>
                <span v-if="q.knowledge_points.length > 2" class="more-tags">
                  +{{ q.knowledge_points.length - 2 }}
                </span>
              </div>
              <span v-else class="no-tags">-</span>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <AppButton variant="ghost" size="sm" @click="openEditDialog(q)">
                  <Pencil :size="16" />
                </AppButton>
                <AppButton variant="destructive" size="sm" @click="deleteQuestion(q.id)">
                  <Trash2 :size="16" />
                </AppButton>
              </div>
            </td>
          </tr>

          <!-- Detail Row -->
          <tr
            v-for="question in filteredQuestions.filter(q => expandedQuestions.includes(q.id))"
            :key="`detail-${question.id}`"
            class="detail-row"
          >
            <td colspan="11">
              <div class="question-details">
                <!-- Loading Details -->
                <div v-if="!question.options && !question.explanation" class="loading-details">
                  <div class="loading-spinner-small"></div>
                  <span>正在加载详细信息...</span>
                </div>

                <!-- Full Question Text -->
                <div class="detail-section">
                  <h5>完整题目内容</h5>
                  <div class="question-full-text">
                    {{ question.question_text || '题目内容加载中...' }}
                  </div>
                </div>

                <!-- Images -->
                <div v-if="(question.images && question.images.length > 0) || question.image_url" class="detail-section">
                  <h5>题目图片</h5>
                  <div class="images-preview-grid">
                    <div
                      v-if="question.image_url"
                      class="preview-image-item"
                      @click="openImageModal(getImageUrl(question.image_url))"
                    >
                      <img
                        :src="getImageUrl(question.image_url)"
                        alt="题目图片"
                        class="preview-image"
                      />
                      <div class="preview-image-overlay">
                        <span class="preview-image-count">主</span>
                      </div>
                    </div>
                    <div
                      v-for="(image, imageIndex) in (question.images || [])"
                      :key="imageIndex"
                      class="preview-image-item"
                      @click="openImageModal(getImageUrl(image.image_url))"
                    >
                      <img
                        :src="getImageUrl(image.image_url)"
                        :alt="`附加图片 ${imageIndex + 1}`"
                        class="preview-image"
                      />
                      <div class="preview-image-overlay">
                        <span class="preview-image-count">{{ imageIndex + 1 }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Code -->
                <div v-if="question.question_code" class="detail-section">
                  <h5>题目代码</h5>
                  <div class="code-block">
                    <pre>{{ question.question_code }}</pre>
                  </div>
                </div>

                <!-- Options -->
                <div v-if="question.options && question.options.length > 0" class="detail-section">
                  <h5>选项列表</h5>
                  <div class="options-list">
                    <div
                      v-for="option in question.options"
                      :key="option.label || option.option_label"
                      class="option-item"
                      :class="{ 'option-correct': (option.value || option.option_value) === question.correct_answer }"
                    >
                      <span class="option-label">{{ option.label || option.option_label }}.</span>
                      <div class="option-content">
                        <div v-if="(option.text || option.option_text) && (option.text || option.option_text).includes('\n')" class="option-code-block">
                          <pre>{{ option.text || option.option_text }}</pre>
                        </div>
                        <span v-else class="option-text">{{ option.text || option.option_text }}</span>
                      </div>
                      <span v-if="(option.value || option.option_value) === question.correct_answer" class="correct-indicator">✓</span>
                    </div>
                  </div>
                </div>

                <!-- Explanation -->
                <div v-if="question.explanation" class="detail-section">
                  <h5>解释说明</h5>
                  <div class="explanation-box">
                    <p>{{ question.explanation }}</p>
                  </div>
                </div>

                <!-- Stats -->
                <div class="detail-section">
                  <h5>题目统计</h5>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-label">原始编号</span>
                      <span class="stat-value">#{{ question.question_number }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">使用次数</span>
                      <span class="stat-value">{{ question.usage_count || 0 }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">正确率</span>
                      <span class="stat-value">{{ question.correct_rate || 'N/A' }}%</span>
                    </div>
                    <div class="stat-item" v-if="question.question_date">
                      <span class="stat-label">题目日期</span>
                      <span class="stat-value">{{ question.question_date }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无题目" />
    </div>

    <!-- Image Modal -->
    <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
      <div class="image-modal-content" @click.stop>
        <button @click="closeImageModal" class="image-modal-close">×</button>
        <img :src="selectedImageUrl" alt="题目图片" class="modal-image" />
      </div>
    </div>

    <!-- Dialogs -->
    <AppDialog
      v-model:show="showDeleteDialog"
      title="确认删除"
      width="400"
      positive-text="删除"
      negative-text="取消"
      @positive="confirmDelete"
    >
      <p style="color: var(--color-text-secondary);">确定要删除这道题目吗？此操作不可撤销。</p>
    </AppDialog>

    <AppDialog
      v-model:show="showBatchDeleteDialog"
      title="确认批量删除"
      width="400"
      positive-text="删除"
      negative-text="取消"
      @positive="confirmBatchDelete"
    >
      <p style="color: var(--color-text-secondary);">确定要删除选中的 {{ selectedQuestions.length }} 道题目吗？此操作不可撤销。</p>
    </AppDialog>

    <AppDialog
      v-model:show="showSuccessMessage"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <!-- Batch Edit Dialog -->
    <BatchEditDialog
      :visible="showBatchEditDialog"
      :selected-questions="selectedQuestionObjects"
      @close="closeBatchEditDialog"
      @updated="handleBatchEditUpdated"
    />
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'

function getImageUrl(url: string | undefined): string {
  if (!url || !url.trim()) return ''
  const n = normalizeImageUrl(url)
  if (!n) return ''
  if (n.startsWith('http://') || n.startsWith('https://')) return n
  return n.startsWith('/') ? `${API_SERVER_BASE}${n}` : `${API_SERVER_BASE}/${n}`
}

import { ref, computed, onMounted, watch, inject } from 'vue'
import axios from 'axios'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Pencil, Trash2, Image, Plus, Edit3 } from 'lucide-vue-next'

// Dialog Components
import BatchEditDialog from './Dialog/BatchEditDialog.vue'

// Stores
import { useQuestionStore } from '../../stores/questionStore'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

// Inject - navigation to editors
const openQuestionEditor = inject<(questionId: number) => void>('openQuestionEditor')
const openBatchUpload = inject<() => void>('openBatchUpload')

// Props
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), { refreshTrigger: 0 })

const questionStore = useQuestionStore()
const questionTypeStore = useQuestionTypeStore()

// State
const searchQuery = ref('')
const filterCategory = ref('')
const filterLevel = ref('')
const filterDate = ref('')
const filterKnowledgePoint = ref('')
const expandedQuestions = ref<number[]>([])
const knowledgePoints = ref<any[]>([])

// From Store
const { questions, loading } = questionStore

// Dialog State
const showDeleteDialog = ref(false)
const questionToDelete = ref<number | null>(null)
const showSuccessMessage = ref(false)
const successMessage = ref('')
const showImageModal = ref(false)
const selectedImageUrl = ref('')
const selectedQuestions = ref<number[]>([])
const selectedQuestionObjects = ref<any[]>([])
const showBatchDeleteDialog = ref(false)
const showBatchEditDialog = ref(false)

// Filter Options
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

const knowledgePointOptions = computed(() => {
  return knowledgePoints.value.map((kp: any) => ({
    label: `${kp.name} (${getCategoryName(kp.category)})`,
    value: String(kp.id)
  }))
})

function getCategoryName(category: string): string {
  const map: Record<string, string> = {
    'algorithm': '算法',
    'data_structure': '数据结构',
    'programming': '编程',
    'math': '数学'
  }
  return map[category] || category
}

// Filtered Questions
const filteredQuestions = computed(() => {
  let list = [...questionStore.questions.value]

  if (filterCategory.value) {
    list = list.filter(q => (q.category || 'GESP') === filterCategory.value)
  }
  if (filterLevel.value) {
    list = list.filter(q => String(q.level || 1) === filterLevel.value)
  }
  if (filterDate.value) {
    list = list.filter(q => q.question_date === filterDate.value)
  }
  if (filterKnowledgePoint.value) {
    list = list.filter(q => {
      if (!q.knowledge_points || !Array.isArray(q.knowledge_points)) return false
      return q.knowledge_points.some((kp: any) => kp.id === parseInt(filterKnowledgePoint.value))
    })
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(q =>
      q.question_text?.toLowerCase().includes(query) ||
      q.question_code?.toLowerCase().includes(query) ||
      q.correct_answer?.toLowerCase().includes(query)
    )
  }

  return list.sort((a, b) => (a.question_number || 0) - (b.question_number || 0))
})

// Watch filterCategory
watch(filterCategory, (newVal) => {
  if (newVal && newVal !== 'GESP') {
    filterLevel.value = ''
  }
})

// Fetch Functions
async function fetchQuestions(forceRefresh = false) {
  try {
    await questionStore.fetchQuestions(forceRefresh)
  } catch (error: any) {
    console.error('获取题目列表失败:', error)
    alert('获取题目列表失败: ' + (error.response?.data?.error || error.message))
  }
}

async function fetchKnowledgePoints() {
  try {
    const response = await axios.get(`${BASE_URL}/knowledge-points`)
    knowledgePoints.value = response.data
  } catch (error: any) {
    console.error('获取知识点列表失败:', error)
  }
}

// Toggle Expansion
function toggleQuestionExpansion(id: number) {
  const idx = expandedQuestions.value.indexOf(id)
  if (idx === -1) {
    expandedQuestions.value.push(id)
    const question = questionStore.questions.value.find(q => q.id === id)
    if (question && (!question.options || !question.explanation)) {
      questionStore.preloadQuestionDetails(id)
    }
  } else {
    expandedQuestions.value.splice(idx, 1)
  }
}

// Selection
function toggleQuestionSelection(questionId: number) {
  const index = selectedQuestions.value.indexOf(questionId)
  if (index === -1) {
    selectedQuestions.value.push(questionId)
    const question = questionStore.questions.value.find(q => q.id === questionId)
    if (question) {
      selectedQuestionObjects.value.push(question)
    }
  } else {
    selectedQuestions.value.splice(index, 1)
    selectedQuestionObjects.value.splice(index, 1)
  }
}

function selectAll() {
  if (selectedQuestions.value.length === filteredQuestions.value.length) {
    selectedQuestions.value = []
    selectedQuestionObjects.value = []
  } else {
    selectedQuestions.value = filteredQuestions.value.map(q => q.id)
    selectedQuestionObjects.value = [...filteredQuestions.value]
  }
}

function clearSelection() {
  selectedQuestions.value = []
  selectedQuestionObjects.value = []
}

// Actions
function openEditDialog(q: any) {
  // Navigate to question editor page
  openQuestionEditor?.(q.id)
}

function openBatchEdit() {
  if (selectedQuestions.value.length === 0) {
    showSuccessMessage.value = true
    successMessage.value = '请先选择要编辑的题目'
    return
  }
  // 加载选中题目的详细信息
  loadSelectedQuestionDetails()
  showBatchEditDialog.value = true
}

async function loadSelectedQuestionDetails() {
  // 加载每个选中题目的详细信息
  for (const id of selectedQuestions.value) {
    const question = questionStore.questions.value.find(q => q.id === id)
    if (question && (!question.options || question.options.length === 0)) {
      try {
        const response = await axios.get(`${BASE_URL}/questions/${id}`)
        questionStore.updateQuestion(id, response.data)
      } catch (error) {
        console.error(`获取题目 ${id} 详情失败:`, error)
      }
    }
  }
  // 更新 selectedQuestionObjects
  selectedQuestionObjects.value = selectedQuestions.value.map(id => {
    return questionStore.questions.value.find(q => q.id === id) || { id }
  })
}

function closeBatchEditDialog() {
  showBatchEditDialog.value = false
}

function handleBatchEditUpdated(updatedQuestions: any[]) {
  updatedQuestions.forEach(question => {
    if (question.id) {
      questionStore.updateQuestion(question.id, question)
    }
  })
  fetchQuestions(true)
  clearSelection()
}

function deleteQuestion(id: number) {
  questionToDelete.value = id
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!questionToDelete.value) return

  try {
    await axios.delete(`${BASE_URL}/questions/${questionToDelete.value}`)
    questionStore.removeQuestion(questionToDelete.value)
    showDeleteDialog.value = false
    questionToDelete.value = null
    showSuccessMessage.value = true
    successMessage.value = '题目删除成功！'
  } catch (error: any) {
    console.error('删除题目失败:', error)
    alert('删除题目失败: ' + (error.response?.data?.error || error.message))
  }
}

function batchDelete() {
  if (selectedQuestions.value.length === 0) {
    alert('请先选择要删除的题目')
    return
  }
  showBatchDeleteDialog.value = true
}

async function confirmBatchDelete() {
  try {
    const deletePromises = selectedQuestions.value.map(id =>
      axios.delete(`${BASE_URL}/questions/${id}`)
    )
    await Promise.all(deletePromises)
    questionStore.removeQuestions(selectedQuestions.value)
    selectedQuestions.value = []
    showBatchDeleteDialog.value = false
    showSuccessMessage.value = true
    successMessage.value = `成功删除 ${deletePromises.length} 道题目！`
  } catch (error: any) {
    console.error('批量删除失败:', error)
    alert('批量删除失败: ' + (error.response?.data?.error || error.message))
  }
}

async function refreshQuestions() {
  try {
    await fetchQuestions(true)
    showSuccessMessage.value = true
    successMessage.value = '题目列表已刷新！'
  } catch (error: any) {
    alert('刷新失败: ' + (error.response?.data?.error || error.message))
  }
}

function openCreateExamDialog() {
  if (selectedQuestions.value.length === 0) {
    showSuccessMessage.value = true
    successMessage.value = '请先选择题目，再创建练习'
    return
  }
  // Navigate to exam-editor with selected question IDs
  openExamEditor?.(undefined, selectedQuestions.value)
}

// Image Modal
function openImageModal(imageUrl: string) {
  selectedImageUrl.value = imageUrl
  showImageModal.value = true
}

function closeImageModal() {
  showImageModal.value = false
  selectedImageUrl.value = ''
}

// Helpers
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function getImageCount(question: any): number {
  let count = 0
  if (question.image_url) count++
  if (question.images && question.images.length > 0) count += question.images.length
  return count
}

function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find((t: any) => t.name === category)
  return type?.display_name || category
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

function getDifficultyText(d: string): string {
  const map: Record<string, string> = { 'easy': '简单', 'medium': '中等', 'hard': '困难' }
  return map[d] || '中等'
}

function getDifficultyTagType(d: string): 'success' | 'warning' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'default'> = {
    'easy': 'success',
    'hard': 'warning',
  }
  return map[d] || 'default'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}

// Watch Refresh Trigger
watch(() => props.refreshTrigger, async (newTrigger, oldTrigger) => {
  if (newTrigger && newTrigger !== oldTrigger && newTrigger > 0) {
    await fetchQuestions(true)
    await fetchKnowledgePoints()
  }
})

onMounted(async () => {
  questionTypeStore.fetchQuestionTypes()
  await fetchKnowledgePoints()

  if (!questionStore.hasQuestions.value) {
    await fetchQuestions()
  } else {
    questionStore.fetchQuestions()
  }
})
</script>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.month-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.month-input:hover {
  border-color: var(--color-primary);
}

.month-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-alpha);
}

/* Batch Toolbar */
.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.selected-info {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-primary);
}

.batch-actions {
  display: flex;
  gap: var(--space-2);
}

/* Table */
.questions-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.questions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.questions-table thead {
  background: var(--color-muted);
}

.questions-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.questions-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.table-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.question-content-cell {
  max-width: 300px;
}

.question-preview {
  font-weight: 500;
  color: var(--color-foreground);
  line-height: 1.4;
  margin-bottom: var(--space-1);
}

.has-images-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.no-level {
  color: var(--color-text-muted);
}

.answer-cell {
  font-weight: 600;
  color: var(--color-accent);
}

.knowledge-points-cell {
  max-width: 150px;
}

.knowledge-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.more-tags {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.no-tags {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--space-2);
}

/* Detail Row */
.detail-row {
  background: var(--color-muted);
}

.detail-row td {
  padding: 0;
}

.question-details {
  padding: var(--space-5);
  margin: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.loading-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.loading-spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.detail-section {
  margin-bottom: var(--space-5);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h5 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.question-full-text {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-text-secondary);
  line-height: 1.6;
  word-break: break-word;
}

/* Images Preview */
.images-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.preview-image-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.preview-image-item:hover {
  transform: scale(1.05);
  border-color: var(--color-primary);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-image-overlay {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  background: var(--color-primary);
  color: white;
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

/* Code Block */
.code-block {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  overflow-x: auto;
  border: 1px solid #334155;
}

.code-block pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Options */
.options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.option-item.option-correct {
  background: rgba(5, 150, 105, 0.1);
  border-color: var(--color-accent);
  border-left-width: 4px;
}

.option-label {
  font-weight: 600;
  color: var(--color-foreground);
  min-width: 24px;
}

.option-content {
  flex: 1;
}

.option-text {
  color: var(--color-foreground);
  line-height: 1.5;
}

.option-code-block {
  background: var(--color-muted);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  margin: var(--space-1) 0;
  overflow-x: auto;
}

.option-code-block pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  white-space: pre-wrap;
}

.correct-indicator {
  color: var(--color-accent);
  font-weight: bold;
  font-size: var(--font-size-base);
}

.explanation-box {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-text-secondary);
}

.explanation-box p {
  margin: 0;
  line-height: 1.6;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-2);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

/* Image Modal */
.image-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.image-modal-content {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 90%;
  max-height: 90%;
  position: relative;
}

.image-modal-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-text-muted);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.image-modal-close:hover {
  background: var(--color-muted);
}

.modal-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-lg);
}
</style>