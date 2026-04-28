<template>
  <div class="batch-upload-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回题目列表
      </AppButton>
      <h2 class="editor-title">批量上传题目</h2>
    </div>

    <!-- Content -->
    <div class="upload-content">
      <!-- Step 1: JSON Input -->
      <div v-if="step === 'input'" class="batch-upload-area">
        <!-- Global Settings -->
        <div class="form-section">
          <h5 class="section-title">全局设置</h5>
          <div class="form-grid">
            <AppFormField label="题目来源">
              <AppSelect
                v-model="globalCategory"
                :options="categoryOptions"
              />
            </AppFormField>
            <AppFormField v-if="globalCategory === 'GESP'" label="等级">
              <AppSelect
                v-model.number="globalLevel"
                :options="levelOptions"
                placeholder="请选择"
              />
            </AppFormField>
          </div>
          <div class="settings-hint">
            本次上传的所有题目将统一设置为：<strong>{{ globalCategory }}</strong>
            <span v-if="globalCategory === 'GESP' && globalLevel"> / Lv{{ globalLevel }}</span>
            <span v-if="globalCategory === 'GESP' && !globalLevel" class="hint-warn">（请选择等级）</span>
          </div>
        </div>

        <!-- AI Prompt -->
        <div class="form-section">
          <div class="example-header">
            <h5 class="section-title">AI 提取 Prompt</h5>
            <AppTag type="primary" size="sm">PROMPT</AppTag>
          </div>
          <div class="format-tips">
            <p>复制以下 Prompt，连同题目源文本一起发给 AI，AI 会输出可直接粘贴的 JSON。</p>
          </div>
          <div class="code-container" @click="copyPrompt">
            <pre class="example-code">{{ aiPrompt }}</pre>
            <div class="code-overlay">
              <span class="copy-hint">{{ promptCopyStatus }}</span>
            </div>
          </div>
        </div>

        <!-- JSON Input -->
        <div class="form-section">
          <div class="input-header">
            <h5 class="section-title">粘贴题目 JSON 数据</h5>
            <span class="char-count">{{ batchText.length }} 字符</span>
          </div>
          <AppTextarea
            v-model="batchText"
            rows="12"
            placeholder="请粘贴 JSON 数组..."
            code
          />
          <div v-if="parseError" class="parse-error">{{ parseError }}</div>
        </div>

        <!-- Actions -->
        <div class="action-section">
          <div class="action-buttons">
            <AppButton variant="ghost" :disabled="!batchText.trim()" @click="clearInput">清空</AppButton>
            <AppButton variant="primary" :disabled="!batchText.trim()" @click="parseAndPreview">
              <Eye :size="16" />
              预览题目
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Step 2: Preview & Edit -->
      <div v-if="step === 'preview'" class="preview-area">
        <div class="preview-header">
          <div class="preview-stats">
            <AppTag type="primary" size="sm">共 {{ questions.length }} 道题</AppTag>
            <AppTag type="default" size="sm">{{ globalCategory }}</AppTag>
            <AppTag v-if="globalCategory === 'GESP' && globalLevel" type="info" size="sm">Lv{{ globalLevel }}</AppTag>
            <span v-if="questions.length > 0" class="stat-hint">可逐个编辑、上传图片后提交</span>
          </div>
          <AppButton variant="ghost" size="sm" @click="backToInput">返回修改 JSON</AppButton>
        </div>

        <div class="questions-list">
          <div v-for="(q, index) in questions" :key="index" class="question-card">
            <div class="question-card-header">
              <span class="question-index">#{{ index + 1 }}</span>
              <div class="question-badges">
                <AppTag type="default" size="sm">{{ q.question_type === 'code' ? '代码题' : '文本题' }}</AppTag>
                <AppTag :type="getDifficultyTagType(q.difficulty)" size="sm">{{ difficultyLabel(q.difficulty) }}</AppTag>
              </div>
              <AppButton variant="ghost" size="sm" @click="removeQuestion(index)">
                <Trash2 :size="16" />
              </AppButton>
            </div>

            <div class="question-card-body">
              <div class="form-grid">
                <AppFormField label="难度">
                  <AppSelect v-model="q.difficulty" :options="difficultyOptions" />
                </AppFormField>
                <AppFormField label="日期">
                  <AppInput v-model="q.question_date" type="month" />
                </AppFormField>
              </div>

              <AppFormField label="题目内容">
                <AppTextarea v-model="q.question_text" rows="3" placeholder="题目内容" />
              </AppFormField>

              <AppFormField v-if="q.question_type === 'code'" label="代码">
                <AppTextarea v-model="q.question_code" rows="5" placeholder="代码内容" code />
              </AppFormField>

              <!-- Image -->
              <AppFormField label="题目图片">
                <div v-if="q.image_url" class="image-preview-container">
                  <img :src="q.image_url" class="image-preview-large" @click="openImagePreview(q.image_url)" />
                  <div class="image-preview-actions">
                    <span class="image-filename">{{ getImageFilename(q.image_url) }}</span>
                    <AppButton variant="ghost" size="sm" @click="q.image_url = ''">
                      <Trash2 :size="14" />
                      删除
                    </AppButton>
                  </div>
                </div>
                <div
                  v-else
                  class="image-upload-area"
                  :class="{ 'dragging': draggingIndex === index }"
                  @click="triggerImageInput(index)"
                  @dragenter="handleDragEnter(index)"
                  @dragleave="handleDragLeave(index)"
                  @dragover="handleDragOver($event, index)"
                  @drop="handleDrop($event, index)"
                >
                  <input
                    :ref="el => imageInputs[index] = el"
                    type="file"
                    accept="image/*"
                    style="display:none"
                    @change="handleImageSelect($event, index)"
                  />
                  <div class="upload-content-inner">
                    <Upload :size="28" class="upload-icon" />
                    <span class="upload-text">点击或拖拽图片到此处</span>
                    <span class="upload-hint">支持 JPG、PNG，最大 5MB</span>
                  </div>
                </div>
              </AppFormField>

              <!-- Options -->
              <div v-if="q.options && q.options.length > 0" class="options-section">
                <h6>选项</h6>
                <div v-for="(opt, oi) in q.options" :key="oi" class="option-row">
                  <AppTag type="primary" size="sm">{{ opt.label }}.</AppTag>
                  <AppInput v-model="opt.text" size="sm" />
                  <AppButton variant="ghost" size="sm" @click="q.options.splice(oi, 1)">
                    <X :size="14" />
                  </AppButton>
                </div>
              </div>

              <div class="form-grid">
                <AppFormField label="正确答案">
                  <AppInput v-model="q.correct_answer" placeholder="如：A" />
                </AppFormField>
                <AppFormField label="解析">
                  <AppInput v-model="q.explanation" placeholder="可选" />
                </AppFormField>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="submit-section">
          <div v-if="submitResult.type === 'error'" class="submit-result error">
            ❌ {{ submitResult.message }}
          </div>
          <div class="action-buttons">
            <AppButton variant="ghost" @click="step = 'input'">返回修改</AppButton>
            <AppButton variant="primary" :disabled="submitting || questions.length === 0" :loading="submitting" @click="submitAll">
              <Upload :size="16" />
              提交 {{ questions.length }} 道题目
            </AppButton>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Eye, Upload, Image, X, Trash2 } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// State
const step = ref<'input' | 'preview'>('input')
const globalCategory = ref('GESP')
const globalLevel = ref<number | null>(null)
const batchText = ref('')
const parseError = ref('')
const questions = ref<any[]>([])
const submitting = ref(false)
const submitResult = ref<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })
const imageInputs = ref<any[]>([])
const promptCopyStatus = ref('点击复制 Prompt')
const draggingIndex = ref<number | null>(null) // 当前拖拽的题目索引

// Success Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')

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

const aiPrompt = ref(`你是题目提取专家。请将以下题目源文本转换为 JSON 数组格式，只输出 JSON，不要输出其他内容。

输出格式示例（包含三种题型）：
[
  {
    "question_text": "以下哪个不是Python关键字？",
    "question_type": "text",
    "question_code": "",
    "correct_answer": "D",
    "explanation": "include是预处理指令，不是关键字",
    "level": 3,
    "difficulty": "easy",
    "question_date": "2025-07",
    "options": [
      {"label": "A", "value": "A", "text": "if"},
      {"label": "B", "value": "B", "text": "for"},
      {"label": "C", "value": "C", "text": "while"},
      {"label": "D", "value": "D", "text": "include"}
    ]
  }
]

关键规则：
- 不要输出 category 字段
- 所有文本字段输出纯文本，不要使用 Markdown 或 LaTeX 格式
- question_type: 题目包含代码用 code，否则用 text
- options 的 text 必须逐字复制原文
- 判断题 options 固定为 [{"label":"A","text":"正确"},{"label":"B","text":"错误"}]
- level: 根据内容推断等级（1-8），无法判断时填 1
- question_date: YYYY-MM格式
- difficulty: easy/medium/hard

题目源文本：
（将你的题目内容粘贴在这里）`)

function goBack() {
  window.location.href = '/admin/questions'
}

function difficultyLabel(d: string) {
  return { easy: '简单', medium: '中等', hard: '困难' }[d] || d
}

function getDifficultyTagType(d: string): 'success' | 'warning' | 'default' {
  if (d === 'easy') return 'success'
  if (d === 'hard') return 'warning'
  return 'default'
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
  // 打开图片预览（可选实现）
  window.open(url, '_blank')
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(aiPrompt.value)
    promptCopyStatus.value = '已复制'
    setTimeout(() => { promptCopyStatus.value = '点击复制 Prompt' }, 2000)
  } catch { /* ignore */ }
}

function clearInput() {
  batchText.value = ''
  parseError.value = ''
}

function parseAndPreview() {
  parseError.value = ''
  if (globalCategory.value === 'GESP' && !globalLevel.value) {
    parseError.value = 'GESP 来源必须选择等级'
    return
  }
  try {
    const data = JSON.parse(batchText.value)
    if (!Array.isArray(data)) throw new Error('顶层必须是 JSON 数组')
    if (data.length === 0) throw new Error('数组不能为空')
    questions.value = data.map((q: any) => ({
      question_text: q.question_text || '',
      question_type: q.question_type || 'text',
      question_code: q.question_code || '',
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
      level: globalCategory.value === 'GESP' ? (q.level || globalLevel.value || null) : null,
      difficulty: q.difficulty || 'medium',
      image_url: q.image_url || '',
      question_date: q.question_date || '',
      options: Array.isArray(q.options) ? q.options.map((o: any) => ({
        label: o.label || '', value: o.value || o.label || '', text: o.text || ''
      })) : []
    }))
    step.value = 'preview'
  } catch (e: any) {
    parseError.value = 'JSON 解析失败: ' + e.message
  }
}

function backToInput() {
  step.value = 'input'
  submitResult.value = { type: null, message: '' }
}

function removeQuestion(index: number) {
  questions.value.splice(index, 1)
}

function triggerImageInput(index: number) {
  imageInputs.value[index]?.click()
}

async function handleImageSelect(event: any, index: number) {
  const file = event.target.files?.[0]
  if (!file) return
  await uploadImageFile(file, index)
  if (imageInputs.value[index]) imageInputs.value[index].value = ''
}

// 拖拽上传处理
function handleDragEnter(index: number) {
  draggingIndex.value = index
}

function handleDragLeave(index: number) {
  if (draggingIndex.value === index) {
    draggingIndex.value = null
  }
}

function handleDragOver(event: DragEvent, index: number) {
  event.preventDefault()
  draggingIndex.value = index
}

async function handleDrop(event: DragEvent, index: number) {
  event.preventDefault()
  draggingIndex.value = null

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (!file.type.startsWith('image/')) {
    alert('请上传图片文件')
    return
  }

  await uploadImageFile(file, index)
}

async function uploadImageFile(file: File, index: number) {
  if (file.size > 5 * 1024 * 1024) {
    alert('图片不能超过5MB')
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
      url = normalized
    }
    questions.value[index].image_url = url
  } catch (e: any) {
    alert('图片上传失败: ' + (e.response?.data?.error || e.message))
  }
}

async function submitAll() {
  if (questions.value.length === 0) return
  submitting.value = true
  submitResult.value = { type: null, message: '' }
  try {
    const payload = questions.value.map(q => ({
      question_text: q.question_text,
      question_type: q.question_type,
      question_code: q.question_code || null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      category: globalCategory.value,
      level: globalCategory.value === 'GESP' ? (q.level || globalLevel.value || null) : null,
      difficulty: q.difficulty,
      image_url: q.image_url || null,
      question_date: q.question_date || null,
      options: q.options || []
    }))
    const res = await axios.post(`${BASE_URL}/upload-questions-batch`, { questions: payload })
    const count = res.data.results?.length || payload.length
    // 显示成功弹窗
    successMessage.value = `成功上传 ${count} 道题目`
    showSuccessDialog.value = true
    // 清空数据
    questions.value = []
    batchText.value = ''
    step.value = 'input'
    submitResult.value = { type: null, message: '' }
  } catch (e: any) {
    const detail = e.response?.data?.details || e.response?.data?.error || e.message
    submitResult.value = { type: 'error', message: '上传失败: ' + detail }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
})
</script>

<style scoped>
.batch-upload-page {
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

.upload-content {
  flex: 1;
}

.batch-upload-area {
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
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.settings-hint {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.settings-hint strong {
  color: var(--color-primary);
}

.hint-warn {
  color: var(--color-destructive);
  font-weight: 600;
}

.example-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.format-tips {
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.format-tips p {
  margin: 0;
}

.code-container {
  position: relative;
  background: #1e293b;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.code-container:hover {
  border-color: var(--color-primary);
}

.example-code {
  margin: 0;
  padding: var(--space-3);
  color: #e2e8f0;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-overlay {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: 0 var(--radius-md) 0 var(--radius-sm);
  font-size: var(--font-size-xs);
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.char-count {
  background: var(--color-muted);
  color: var(--color-text-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.parse-error {
  background: var(--color-destructive-lightest);
  color: var(--color-destructive);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2);
}

.action-section {
  padding: var(--space-4);
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.action-buttons {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

/* Preview Area */
.preview-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
}

.preview-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.question-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  transition: border-color var(--transition-fast);
}

.question-card:hover {
  border-color: var(--color-primary-light);
}

.question-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.question-index {
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.question-badges {
  display: flex;
  gap: var(--space-2);
  flex: 1;
}

.question-card-body {
  padding: var(--space-3);
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
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

.image-upload-area:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.image-upload-area.dragging {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
  color: var(--color-primary);
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

.options-section {
  margin-top: var(--space-3);
}

.options-section h6 {
  margin: 0 0 var(--space-2);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.option-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.submit-section {
  padding: var(--space-4);
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.submit-result {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.submit-result.success {
  background: var(--color-accent-lightest);
  color: var(--color-accent);
}

.submit-result.error {
  background: var(--color-destructive-lightest);
  color: var(--color-destructive);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
  }
}
</style>