<template>
  <div class="question-editor-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回题目列表
      </AppButton>
      <h2 class="editor-title">编辑题目 #{{ questionId }}</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="saving" :loading="saving" @click="saveQuestion">
          <Save :size="16" />
          保存
        </AppButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-wrap">
      <div class="loading-spinner"></div>
      <p>加载题目...</p>
    </div>

    <!-- Form -->
    <div v-else class="editor-body">
      <div class="form-section">
        <h5 class="section-title">基本信息</h5>
        <div class="form-grid">
          <AppFormField label="题目来源">
            <AppSelect v-model="form.category" :options="categoryOptions" />
          </AppFormField>
          <AppFormField v-if="form.category === 'GESP'" label="等级">
            <AppSelect v-model.number="form.level" :options="levelOptions" />
          </AppFormField>
          <AppFormField label="难度">
            <AppSelect v-model="form.difficulty" :options="difficultyOptions" />
          </AppFormField>
          <AppFormField label="题目日期">
            <AppInput v-model="form.question_date" type="month" />
          </AppFormField>
        </div>
      </div>

      <div class="form-section">
        <h5 class="section-title">题目内容</h5>
        <AppFormField label="题目文本" required>
          <AppTextarea v-model="form.question_text" rows="6" placeholder="题目内容" />
        </AppFormField>

        <AppFormField label="题目代码">
          <AppTextarea v-model="form.question_code" rows="5" placeholder="代码内容（可选）" code />
        </AppFormField>

        <!-- Image -->
        <AppFormField label="题目图片">
          <div v-if="form.image_url" class="image-preview-container">
            <img :src="form.image_url" class="image-preview-large" @click="openImagePreview(form.image_url)" />
            <div class="image-preview-actions">
              <span class="image-filename">{{ getImageFilename(form.image_url) }}</span>
              <AppButton variant="ghost" size="sm" @click="form.image_url = ''">
                <Trash2 :size="14" />
                删除
              </AppButton>
            </div>
          </div>
          <div
            v-else
            class="image-upload-area"
            :class="{ 'dragging': isDragging }"
            @click="triggerImageInput"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
            @dragover="handleDragOver"
            @drop="handleDrop"
          >
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              style="display:none"
              @change="handleImageSelect"
            />
            <div class="upload-content-inner">
              <Upload :size="28" class="upload-icon" />
              <span class="upload-text">点击或拖拽图片到此处</span>
              <span class="upload-hint">支持 JPG、PNG，最大 5MB</span>
            </div>
          </div>
        </AppFormField>
      </div>

      <div class="form-section">
        <h5 class="section-title">选项与答案</h5>

        <!-- Options -->
        <div v-if="form.options && form.options.length > 0" class="options-section">
          <div class="options-header">
            <h6>选项列表</h6>
            <AppButton variant="ghost" size="sm" @click="addOption">
              <Plus :size="14" />
              添加选项
            </AppButton>
          </div>
          <div v-for="(opt, idx) in form.options" :key="idx" class="option-row">
            <AppInput v-model="opt.label" placeholder="A" size="sm" style="width: 60px;" />
            <AppInput v-model="opt.text" placeholder="选项内容" size="sm" />
            <label class="correct-checkbox">
              <input type="checkbox" :checked="opt.value === form.correct_answer" @change="setCorrectAnswer(opt.value)" />
              正确
            </label>
            <AppButton variant="ghost" size="sm" @click="removeOption(idx)">
              <X :size="14" />
            </AppButton>
          </div>
        </div>

        <div v-else class="no-options">
          <p>暂无选项，点击下方添加</p>
          <AppButton variant="secondary" size="sm" @click="initOptions">
            <Plus :size="14" />
            添加标准选项 (A/B/C/D)
          </AppButton>
        </div>

        <div class="form-grid">
          <AppFormField label="正确答案" required>
            <AppInput v-model="form.correct_answer" placeholder="如：A" />
          </AppFormField>
          <AppFormField label="解析">
            <AppTextarea v-model="form.explanation" rows="2" placeholder="解析说明（可选）" />
          </AppFormField>
        </div>
      </div>

      <!-- Knowledge Points -->
      <div class="form-section">
        <h5 class="section-title">知识点关联</h5>
        <div class="knowledge-points-selector">
          <AppSelect
            v-model="kpLevelFilter"
            :options="kpLevelFilterOptions"
            placeholder="全部级别"
            size="sm"
          />
          <AppSelect
            v-model="selectedKnowledgePoint"
            :options="filteredKnowledgePointOptions"
            placeholder="选择知识点添加"
          />
          <AppButton variant="secondary" size="sm" @click="addKnowledgePoint">
            <Plus :size="14" />
            添加
          </AppButton>
        </div>
        <div v-if="form.knowledge_points && form.knowledge_points.length > 0" class="knowledge-points-list">
          <AppTag
            v-for="kp in form.knowledge_points"
            :key="kp.id"
            type="default"
            closable
            @close="removeKnowledgePoint(kp.id)"
          >
            {{ kp.name }}
          </AppTag>
        </div>
      </div>
    </div>

    <!-- Success/Error Dialogs -->
    <AppDialog
      v-model:show="showSuccessDialog"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

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
import { ref, computed, onMounted, inject } from 'vue'
import axios from 'axios'
import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'
import type { Ref } from 'vue'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Save, Upload, Plus, X, Trash2 } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// Inject
const questionEditorQuestionId = inject<Ref<number | undefined>>('questionEditorQuestionId')

// State
const loading = ref(false)
const saving = ref(false)
const questionId = computed(() => questionEditorQuestionId?.value)

const form = ref({
  category: 'GESP',
  level: null as number | null,
  difficulty: 'medium',
  question_text: '',
  question_code: '',
  question_date: '',
  image_url: '',
  correct_answer: '',
  explanation: '',
  options: [] as { label: string; value: string; text: string }[],
  knowledge_points: [] as { id: number; name: string }[]
})

const selectedKnowledgePoint = ref<string | null>(null)
const knowledgePoints = ref<any[]>([])
const kpLevelFilter = ref<string | null>(null) // 知识点级别筛选
const imageInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

// Options
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelOptions = [
  { label: '请选择', value: null },
  { label: '1级', value: 1 },
  { label: '2级', value: 2 },
  { label: '3级', value: 3 },
  { label: '4级', value: 4 },
  { label: '5级', value: 5 },
  { label: '6级', value: 6 },
  { label: '7级', value: 7 },
  { label: '8级', value: 8 },
]

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
]

const kpLevelFilterOptions = [
  { label: '全部级别', value: null },
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
]

const filteredKnowledgePointOptions = computed(() => {
  let list = knowledgePoints.value
  if (kpLevelFilter.value) {
    list = list.filter((kp: any) => String(kp.level) === kpLevelFilter.value)
  }
  return list.map((kp: any) => ({
    label: `${kp.name} (${kp.category || ''}${kp.level ? ` Lv${kp.level}` : ''})`,
    value: String(kp.id)
  }))
})

const knowledgePointOptions = computed(() => {
  return knowledgePoints.value.map((kp: any) => ({
    label: `${kp.name} (${kp.category || ''})`,
    value: String(kp.id)
  }))
})

function goBack() {
  window.location.href = '/admin/questions'
}

async function loadQuestion() {
  if (!questionId.value) return
  loading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/questions/${questionId.value}`)
    form.value = {
      category: data.category || 'GESP',
      level: data.level || null,
      difficulty: data.difficulty || 'medium',
      question_text: data.question_text || '',
      question_code: data.question_code || '',
      question_date: data.question_date || '',
      image_url: data.image_url || '',
      correct_answer: data.correct_answer || '',
      explanation: data.explanation || '',
      options: Array.isArray(data.options) ? data.options.map((o: any) => ({
        label: o.label || o.option_label || '',
        value: o.value || o.option_value || '',
        text: o.text || o.option_text || ''
      })) : [],
      knowledge_points: Array.isArray(data.knowledge_points) ? data.knowledge_points : []
    }
  } catch (e: any) {
    console.error(e)
    errorMessage.value = '加载题目失败'
    showErrorDialog.value = true
  } finally {
    loading.value = false
  }
}

async function loadKnowledgePoints() {
  try {
    const { data } = await axios.get(`${BASE_URL}/knowledge-points`)
    knowledgePoints.value = data || []
  } catch (e) {
    console.error('加载知识点失败:', e)
  }
}

function initOptions() {
  form.value.options = [
    { label: 'A', value: 'A', text: '' },
    { label: 'B', value: 'B', text: '' },
    { label: 'C', value: 'C', text: '' },
    { label: 'D', value: 'D', text: '' }
  ]
}

function addOption() {
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const nextLabel = labels[form.value.options.length] || String(form.value.options.length + 1)
  form.value.options.push({ label: nextLabel, value: nextLabel, text: '' })
}

function removeOption(idx: number) {
  form.value.options.splice(idx, 1)
}

function setCorrectAnswer(value: string) {
  form.value.correct_answer = value
}

function addKnowledgePoint() {
  if (!selectedKnowledgePoint.value) return
  const kpId = parseInt(selectedKnowledgePoint.value)
  const kp = knowledgePoints.value.find(k => k.id === kpId)
  if (kp && !form.value.knowledge_points.some(k => k.id === kpId)) {
    form.value.knowledge_points.push({ id: kpId, name: kp.name })
  }
  selectedKnowledgePoint.value = null
}

function removeKnowledgePoint(id: number) {
  form.value.knowledge_points = form.value.knowledge_points.filter(k => k.id !== id)
}

// Image handling
function triggerImageInput() {
  imageInputRef.value?.click()
}

function handleDragEnter() { isDragging.value = true }
function handleDragLeave() { isDragging.value = false }
function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging.value = true }
async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    await uploadImageFile(files[0])
  }
}

async function handleImageSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    await uploadImageFile(file)
  }
  if (imageInputRef.value) imageInputRef.value.value = ''
}

async function uploadImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请上传图片文件'
    showErrorDialog.value = true
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = '图片不能超过5MB'
    showErrorDialog.value = true
    return
  }
  const formData = new FormData()
  formData.append('image', file)
  try {
    const res = await axios.post(`${BASE_URL}/upload-image`, formData)
    let url = res.data.imageUrl || res.data.image_url || res.data.url || res.data.path || res.data
    if (url) {
      let normalized = normalizeImageUrl(url)
      if (!normalized) normalized = url
      if (!normalized.startsWith('http')) {
        normalized = `${API_SERVER_BASE}${normalized.startsWith('/') ? '' : '/'}${normalized}`
      }
      form.value.image_url = normalized
    }
  } catch (e: any) {
    errorMessage.value = '图片上传失败: ' + (e.response?.data?.error || e.message)
    showErrorDialog.value = true
  }
}

function getImageFilename(url: string): string {
  if (!url) return ''
  try {
    const parts = url.split('/')
    return parts[parts.length - 1] || '图片'
  } catch {
    return '图片'
  }
}

function openImagePreview(url: string) {
  window.open(url, '_blank')
}

async function saveQuestion() {
  if (!form.value.question_text.trim()) {
    errorMessage.value = '请输入题目内容'
    showErrorDialog.value = true
    return
  }
  saving.value = true
  try {
    const payload = {
      category: form.value.category,
      level: form.value.category === 'GESP' ? form.value.level : null,
      difficulty: form.value.difficulty,
      question_text: form.value.question_text,
      question_code: form.value.question_code || null,
      question_date: form.value.question_date || null,
      image_url: form.value.image_url || null,
      correct_answer: form.value.correct_answer,
      explanation: form.value.explanation,
      options: form.value.options,
      knowledge_point_ids: form.value.knowledge_points.map(k => k.id)
    }
    await axios.put(`${BASE_URL}/questions/${questionId.value}`, payload)
    successMessage.value = '题目保存成功！'
    showSuccessDialog.value = true
  } catch (e: any) {
    errorMessage.value = e.response?.data?.error || e.message
    showErrorDialog.value = true
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await questionTypeStore.fetchQuestionTypes()
  await loadKnowledgePoints()
  await loadQuestion()
})
</script>

<style scoped>
.question-editor-page {
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

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
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
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

/* Image Upload */
.image-preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.image-preview-large {
  max-width: 100%;
  max-height: 300px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.image-preview-large:hover {
  transform: scale(1.02);
}

.image-preview-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.image-filename {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.image-upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 150px;
}

.image-upload-area:hover,
.image-upload-area.dragging {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
  transform: scale(1.02);
}

.upload-content-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.upload-icon {
  color: var(--color-primary);
}

.upload-text {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.upload-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Options */
.options-section {
  margin-bottom: var(--space-3);
}

.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.options-header h6 {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.option-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.correct-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.correct-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.no-options {
  text-align: center;
  padding: var(--space-3);
  color: var(--color-text-muted);
}

/* Knowledge Points */
.knowledge-points-selector {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.knowledge-points-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>