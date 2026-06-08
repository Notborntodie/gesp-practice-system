<template>
  <AppDialog
    v-model:show="dialogVisible"
    title="批量编辑题目"
    :width="null"
    :show-footer="false"
    fullscreen
  >
    <!-- Header Stats -->
    <div class="header-stats">
      <AppTag type="info" size="sm">共 {{ questions.length }} 道题目</AppTag>
      <AppTag type="default" size="sm">第 {{ currentQuestionIndex + 1 }} 题</AppTag>
    </div>

    <!-- Main Content: Three Panels -->
    <div class="dialog-main-content">
      <!-- Left Panel: Question Navigation -->
      <div class="left-panel">
        <div class="section-header">
          <h5>题目导航</h5>
        </div>

        <div v-if="questions.length > 0" class="questions-nav">
          <div
            v-for="(question, index) in questions"
            :key="`question-${question.id}`"
            class="question-nav-item"
            :class="{
              active: index === currentQuestionIndex,
              edited: question.isEdited
            }"
            @click="goToQuestion(index)"
          >
            <div class="nav-item-header">
              <span class="nav-item-number">{{ index + 1 }}</span>
              <AppTag type="default" size="sm">{{ getCategoryText(question.category || 'GESP') }}</AppTag>
              <AppTag v-if="(question.category || 'GESP') === 'GESP'" type="info" size="sm">
                {{ getLevelText(question.level || 1) }}
              </AppTag>
            </div>
            <div class="nav-item-content">
              <div class="nav-item-text">
                {{ truncateText(question.question_text, 50) }}
              </div>
              <div class="nav-item-answer" :class="{ empty: !question.correct_answer }">
                答案: {{ question.correct_answer || '未设置' }}
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-nav">
          <p>没有可编辑的题目</p>
        </div>
      </div>

      <!-- Center Panel: Question Editor -->
      <div class="center-panel">
        <div class="editor-header">
          <h5>题目编辑</h5>

          <!-- Navigation Buttons -->
          <div v-if="questions.length > 0" class="nav-controls">
            <AppButton variant="secondary" size="sm" :disabled="currentQuestionIndex === 0" @click="previousQuestion">
              <ChevronLeft :size="16" />
              上一题
            </AppButton>
            <AppButton variant="secondary" size="sm" :disabled="currentQuestionIndex === questions.length - 1" @click="nextQuestion">
              下一题
              <ChevronRight :size="16" />
            </AppButton>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-if="currentQuestion" class="question-edit-form">
          <!-- Basic Info -->
          <div class="edit-section">
            <h6>基本信息</h6>
            <div class="form-grid">
              <AppFormField label="题目来源">
                <AppSelect
                  v-model="currentQuestion.category"
                  :options="categoryOptions"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>

              <AppFormField v-if="currentQuestion.category === 'GESP'" label="等级">
                <AppSelect
                  v-model="currentQuestion.level"
                  :options="levelEditOptions"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>

              <AppFormField label="难度">
                <AppSelect
                  v-model="currentQuestion.difficulty"
                  :options="difficultyOptions"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>

              <AppFormField label="题目类型">
                <AppSelect
                  v-model="currentQuestion.question_type"
                  :options="questionTypeOptions"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>

              <AppFormField label="题目日期">
                <AppMonthSelect
                  v-model="currentQuestion.question_date"
                  placeholder="选择年月"
                  full-width
                  @update:model-value="markAsEdited"
                />
              </AppFormField>
            </div>
          </div>

          <!-- Question Content -->
          <div class="edit-section">
            <h6>题目内容</h6>
            <AppFormField label="题目内容" required>
              <AppTextarea
                v-model="currentQuestion.question_text"
                rows="4"
                placeholder="请输入题目内容"
                @update:model-value="markAsEdited"
              />
            </AppFormField>

            <!-- Image Upload -->
            <AppFormField label="题目图片">
              <div v-if="currentQuestion.image_url" class="image-preview-container">
                <img :src="getImageUrl(currentQuestion.image_url)" alt="题目图片" class="question-image-preview" />
                <AppButton variant="destructive" size="sm" @click="removeImage">删除图片</AppButton>
              </div>

              <div
                v-else
                class="image-upload-area"
                :class="{ dragging: isDragging }"
                @dragover.prevent="handleDragOver"
                @dragleave.prevent="handleDragLeave"
                @drop.prevent="handleDrop"
                @click="triggerFileInput"
              >
                <input
                  ref="imageFileInput"
                  type="file"
                  accept="image/*"
                  @change="handleFileSelect"
                  style="display: none;"
                />
                <Image :size="32" class="upload-icon" />
                <p class="upload-text">点击或拖拽图片到此处上传</p>
                <p class="upload-hint">支持 JPG、PNG、GIF 格式</p>
              </div>

              <!-- Upload Progress -->
              <div v-if="uploadingImage" class="upload-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
                </div>
                <p class="progress-text">上传中... {{ uploadProgress }}%</p>
              </div>
            </AppFormField>

            <!-- Code Content -->
            <AppFormField v-if="currentQuestion.question_type === 'code'" label="代码内容">
              <AppTextarea
                v-model="currentQuestion.question_code"
                rows="8"
                placeholder="请输入代码内容，支持多种编程语言..."
                code
                @update:model-value="markAsEdited"
              />
            </AppFormField>
          </div>

          <!-- Options -->
          <div class="edit-section">
            <h6>选项设置 ({{ (currentQuestion.options || []).length }} 个选项)</h6>
            <div v-for="(option, index) in (currentQuestion.options || [])" :key="index" class="option-edit-item">
              <div class="option-inputs">
                <AppInput
                  v-model="option.label"
                  placeholder="标签(A/B/C/D)"
                  size="sm"
                  class="option-label-input"
                  @update:model-value="markAsEdited"
                />
                <AppInput
                  v-model="option.value"
                  placeholder="值"
                  size="sm"
                  class="option-value-input"
                  @update:model-value="markAsEdited"
                />
                <AppTextarea
                  v-model="option.text"
                  placeholder="选项内容"
                  rows="2"
                  size="sm"
                  @update:model-value="markAsEdited"
                />
                <AppButton variant="ghost" size="sm" @click="removeOption(index)">
                  <X :size="14" />
                </AppButton>
              </div>
            </div>
            <div class="option-actions">
              <AppButton variant="secondary" size="sm" @click="addOption">添加选项</AppButton>
              <AppButton
                v-if="currentQuestion.options && currentQuestion.options.length > 0"
                variant="ghost"
                size="sm"
                @click="reorderOptions"
              >
                重新整理字母序
              </AppButton>
            </div>
          </div>

          <!-- Answer -->
          <div class="edit-section">
            <h6>答案设置</h6>
            <div class="form-grid-2">
              <AppFormField label="正确答案" required>
                <AppInput
                  v-model="currentQuestion.correct_answer"
                  placeholder="如：A"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>
              <AppFormField label="解释说明">
                <AppTextarea
                  v-model="currentQuestion.explanation"
                  placeholder="题目解释"
                  rows="2"
                  @update:model-value="markAsEdited"
                />
              </AppFormField>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <Edit3 :size="48" class="empty-icon" />
          <h5>没有可编辑的题目</h5>
          <p>请先选择要编辑的题目</p>
        </div>
      </div>

      <!-- Right Panel: Knowledge Points -->
      <div class="right-panel">
        <div class="section-header">
          <h5>关联知识点</h5>
        </div>

        <div v-if="currentQuestion" class="knowledge-points-content">
          <div class="level-groups">
            <div
              v-for="level in [1, 2, 3, 4, 5]"
              :key="`level-${level}`"
              class="level-group-card"
            >
              <div
                class="level-header"
                :class="{ collapsed: collapsedLevels[level] }"
                @click="toggleLevel(level)"
              >
                <div class="level-header-left">
                  <AppTag type="primary" size="sm">{{ getLevelText(level) }}</AppTag>
                  <span class="level-count">{{ groupedKnowledgePoints[level].length }} 个</span>
                </div>
                <ChevronDown
                  :size="14"
                  class="collapse-icon"
                  :class="{ expanded: !collapsedLevels[level] }"
                />
              </div>

              <div v-show="!collapsedLevels[level]" class="level-content">
                <div v-if="groupedKnowledgePoints[level].length > 0" class="knowledge-points-list">
                  <label v-for="kp in groupedKnowledgePoints[level]" :key="kp.id" class="kp-checkbox">
                    <input
                      type="checkbox"
                      :value="kp.id"
                      v-model="currentQuestion.knowledge_point_ids"
                      @change="markAsEdited"
                    />
                    <span>{{ kp.name }}</span>
                    <AppTag type="default" size="sm">{{ getCategoryLabel(kp.category) }}</AppTag>
                  </label>
                </div>
                <div v-else class="no-knowledge-points">暂无知识点</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <BookOpen :size="48" class="empty-icon" />
          <h5>请先选择题目</h5>
          <p>选择题目后可编辑关联知识点</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dialog-footer">
      <AppButton variant="ghost" @click="handleClose">关闭</AppButton>
      <AppButton
        v-if="questions.length > 0"
        variant="primary"
        :disabled="saving"
        :loading="saving"
        @click="saveAllQuestions"
      >
        保存所有修改
      </AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppMonthSelect from '@/components/ui/AppMonthSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppFormField from '@/components/ui/AppFormField.vue'

// Lucide Icons
import { ChevronLeft, ChevronRight, ChevronDown, X, Image, Edit3, BookOpen } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// Props
interface Props {
  visible: boolean
  selectedQuestions: any[]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  updated: [questions: any[]]
}>()

// Dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: () => emit('close')
})

// State
const questions = ref<any[]>([])
const currentQuestionIndex = ref(0)
const knowledgePoints = ref<any[]>([])
const saving = ref(false)
const collapsedLevels = ref<{ [key: number]: boolean }>({
  1: true,
  2: true,
  3: true,
  4: true,
  5: true
})

// Image upload
const isDragging = ref(false)
const uploadingImage = ref(false)
const uploadProgress = ref(0)
const imageFileInput = ref<HTMLInputElement>()

// Current question
const currentQuestion = computed(() => {
  if (questions.value.length > 0 && currentQuestionIndex.value < questions.value.length) {
    return questions.value[currentQuestionIndex.value]
  }
  return null
})

// Grouped knowledge points by level
const groupedKnowledgePoints = computed(() => {
  const groups: { [key: number]: any[] } = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  knowledgePoints.value.forEach(kp => {
    const level = kp.level || 1
    if (level >= 1 && level <= 5) {
      groups[level].push(kp)
    }
  })
  return groups
})

// Options for selects
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelEditOptions = [
  { label: 'GESP 1级', value: 1 },
  { label: 'GESP 2级', value: 2 },
  { label: 'GESP 3级', value: 3 },
  { label: 'GESP 4级', value: 4 },
  { label: 'GESP 5级', value: 5 },
  { label: 'GESP 6级', value: 6 },
  { label: 'GESP 7级', value: 7 },
  { label: 'GESP 8级', value: 8 },
]

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
]

const questionTypeOptions = [
  { label: '文本题', value: 'text' },
  { label: '代码题', value: 'code' },
]

// Helper functions
function getImageUrl(url: string | undefined): string {
  if (!url || !url.trim()) return ''
  const n = normalizeImageUrl(url)
  if (!n) return ''
  if (n.startsWith('http://') || n.startsWith('https://')) return n
  return n.startsWith('/') ? `${API_SERVER_BASE}${n}` : `${API_SERVER_BASE}/${n}`
}

function truncateText(text: string, max: number): string {
  if (!text || text.length <= max) return text
  return text.substring(0, max) + '...'
}

function getLevelText(level: number): string {
  return `GESP ${level}级`
}

function getCategoryText(category: string): string {
  const type = questionTypeStore.allTypes.value.find((t: any) => t.name === category)
  return type?.display_name || category
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    algorithm: '算法',
    data_structure: '数据结构',
    programming: '编程',
    math: '数学',
  }
  return map[category] || category
}

// Initialize questions
function initializeQuestions() {
  questions.value = props.selectedQuestions.map(q => ({
    ...q,
    isEdited: false,
    knowledge_point_ids: q.knowledge_points?.map((kp: any) => kp.id) || [],
    options: q.options ? q.options.map((opt: any) => ({
      label: opt.label || opt.option_label || '',
      value: opt.value || opt.option_value || '',
      text: opt.text || opt.option_text || ''
    })) : [],
    category: q.category || 'GESP',
    level: q.level || 1,
    difficulty: q.difficulty || 'medium',
    question_type: q.question_type || 'text',
    question_text: q.question_text || '',
    question_code: q.question_code || '',
    correct_answer: q.correct_answer || '',
    explanation: q.explanation || '',
    question_date: q.question_date || ''
  }))
  currentQuestionIndex.value = 0
}

// Navigation
function previousQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  }
}

function goToQuestion(index: number) {
  currentQuestionIndex.value = index
}

// Editing
function markAsEdited() {
  if (currentQuestion.value) {
    currentQuestion.value.isEdited = true
  }
}

function addOption() {
  if (currentQuestion.value) {
    if (!currentQuestion.value.options) {
      currentQuestion.value.options = []
    }
    const currentCount = currentQuestion.value.options.length
    const nextLetter = String.fromCharCode(65 + currentCount)
    currentQuestion.value.options.push({
      label: nextLetter,
      value: nextLetter,
      text: ''
    })
    markAsEdited()
  }
}

function removeOption(index: number) {
  if (currentQuestion.value && currentQuestion.value.options) {
    currentQuestion.value.options.splice(index, 1)
    reorderOptions()
    markAsEdited()
  }
}

function reorderOptions() {
  if (currentQuestion.value && currentQuestion.value.options) {
    currentQuestion.value.options.forEach((option: any, idx: number) => {
      const letter = String.fromCharCode(65 + idx)
      option.label = letter
      option.value = letter
    })
    markAsEdited()
  }
}

function toggleLevel(level: number) {
  collapsedLevels.value[level] = !collapsedLevels.value[level]
}

// Image handling
function handleDragOver() {
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    await uploadImage(files[0])
  }
}

function triggerFileInput() {
  imageFileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    await uploadImage(files[0])
  }
}

async function uploadImage(file: File) {
  if (!currentQuestion.value) return

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    alert('请上传有效的图片文件')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('图片文件不能超过 5MB')
    return
  }

  uploadingImage.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await axios.post(`${BASE_URL}/upload-image`, formData, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      }
    })

    let imageUrl = response.data.imageUrl || response.data.image_url || response.data.url || response.data.path
    if (typeof response.data === 'string') {
      imageUrl = response.data
    }

    if (imageUrl) {
      let normalized = normalizeImageUrl(imageUrl)
      if (!normalized) normalized = imageUrl
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = normalized.startsWith('/')
          ? `${API_SERVER_BASE}${normalized}`
          : `${API_SERVER_BASE}/${normalized}`
      }
      currentQuestion.value.image_url = normalized
      markAsEdited()
    }
  } catch (error: any) {
    console.error('图片上传失败:', error)
    alert('图片上传失败: ' + (error.response?.data?.error || error.message))
  } finally {
    uploadingImage.value = false
    uploadProgress.value = 0
    if (imageFileInput.value) {
      imageFileInput.value.value = ''
    }
  }
}

function removeImage() {
  if (currentQuestion.value) {
    currentQuestion.value.image_url = ''
    markAsEdited()
  }
}

// Save all questions
async function saveAllQuestions() {
  if (questions.value.length === 0) return

  saving.value = true
  try {
    const editedQuestions = questions.value.filter(q => q.isEdited)

    if (editedQuestions.length === 0) {
      alert('没有需要保存的修改')
      return
    }

    const updatePromises = editedQuestions.map(async (question) => {
      const updateData = {
        question_text: question.question_text,
        question_type: question.question_type,
        question_code: question.question_code || '',
        correct_answer: question.correct_answer,
        explanation: question.explanation || '',
        category: question.category || 'GESP',
        level: question.category === 'GESP' ? question.level : null,
        difficulty: question.difficulty,
        image_url: question.image_url || '',
        question_date: question.question_date || '',
        knowledge_point_ids: question.knowledge_point_ids || [],
        options: question.options ? question.options.map((opt: any) => ({
          label: opt.label,
          value: opt.value,
          text: opt.text
        })) : []
      }
      return axios.put(`${BASE_URL}/questions/${question.id}`, updateData)
    })

    await Promise.all(updatePromises)

    editedQuestions.forEach(question => {
      question.isEdited = false
    })

    emit('updated', questions.value)
    alert(`成功保存 ${editedQuestions.length} 道题目的修改！`)
  } catch (error: any) {
    console.error('批量保存失败:', error)
    const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message
    alert('保存失败: ' + errorMessage)
  } finally {
    saving.value = false
  }
}

// Fetch knowledge points
async function fetchKnowledgePoints() {
  try {
    const response = await axios.get(`${BASE_URL}/knowledge-points`)
    knowledgePoints.value = response.data
  } catch (error) {
    console.error('获取知识点失败:', error)
  }
}

function handleClose() {
  emit('close')
}

// Watchers
watch(() => props.visible, (newVal) => {
  if (newVal && props.selectedQuestions.length > 0) {
    initializeQuestions()
  }
})

watch(() => props.selectedQuestions, () => {
  if (props.visible) {
    initializeQuestions()
  }
}, { deep: true })

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
  fetchKnowledgePoints()
})
</script>

<style scoped>
.header-stats {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.dialog-main-content {
  display: flex;
  gap: var(--space-4);
  height: calc(100vh - 200px);
  min-height: 400px;
}

/* Left Panel */
.left-panel {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  padding-right: var(--space-4);
  overflow-y: auto;
}

.section-header {
  margin-bottom: var(--space-3);
}

.section-header h5 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.questions-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.question-nav-item {
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.question-nav-item:hover {
  border-color: var(--color-primary-light);
}

.question-nav-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.question-nav-item.edited {
  border-color: var(--color-accent);
  background: var(--color-accent-lightest);
}

.nav-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.nav-item-number {
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.nav-item-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item-text {
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  line-height: 1.4;
}

.nav-item-answer {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}

.nav-item-answer.empty {
  color: var(--color-text-muted);
}

.empty-nav {
  text-align: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.empty-nav p {
  margin: 0;
}

/* Center Panel */
.center-panel {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.editor-header h5 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.nav-controls {
  display: flex;
  gap: var(--space-2);
}

.question-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.edit-section {
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
}

.edit-section h6 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-3);
}

/* Image Upload */
.image-preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.question-image-preview {
  max-width: 100%;
  max-height: 300px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.image-upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.image-upload-area:hover {
  border-color: var(--color-primary-light);
  background: var(--color-muted);
}

.image-upload-area.dragging {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.upload-icon {
  color: var(--color-primary);
  margin-bottom: var(--space-2);
}

.upload-text {
  margin: 0 0 var(--space-1);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.upload-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.upload-progress {
  margin-top: var(--space-2);
}

.progress-bar {
  height: 8px;
  background: var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--transition-fast);
}

.progress-text {
  margin: var(--space-1) 0 0;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

/* Options */
.option-edit-item {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

.option-inputs {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.option-label-input {
  width: 80px;
}

.option-value-input {
  width: 80px;
}

.option-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* Right Panel */
.right-panel {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  padding-left: var(--space-4);
  overflow-y: auto;
}

.knowledge-points-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.level-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.level-group-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.level-header:hover {
  background: var(--color-primary-lightest);
}

.level-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.level-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.collapse-icon {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

.level-content {
  padding: var(--space-2);
  background: var(--color-surface);
}

.knowledge-points-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.kp-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  transition: background var(--transition-fast);
}

.kp-checkbox:hover {
  background: var(--color-muted);
}

.kp-checkbox input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary);
}

.no-knowledge-points {
  padding: var(--space-2);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-icon {
  color: var(--color-primary-light);
  margin-bottom: var(--space-3);
}

.empty-state h5 {
  margin: 0 0 var(--space-2);
  color: var(--color-foreground);
}

.empty-state p {
  margin: 0;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Responsive */
@media (max-width: 1200px) {
  .left-panel,
  .right-panel {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .dialog-main-content {
    flex-direction: column;
    height: auto;
  }

  .left-panel,
  .right-panel {
    width: 100%;
    border: none;
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .form-grid,
  .form-grid-2 {
    grid-template-columns: 1fr;
  }

  .option-inputs {
    flex-wrap: wrap;
  }
}
</style>
