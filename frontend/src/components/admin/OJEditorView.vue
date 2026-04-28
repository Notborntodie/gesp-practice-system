<template>
  <div class="oj-editor-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回OJ列表
      </AppButton>
      <h2 class="editor-title">编辑OJ题目 #{{ problemId }}</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="saving" :loading="saving" @click="saveProblem">
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

    <!-- Body: Left (Form) + Right (Preview) -->
    <div v-else class="editor-body">
      <!-- Left Panel: Form -->
      <div class="left-panel">
        <div class="form-section">
          <h5 class="section-title">基本信息</h5>
          <div class="form-grid">
            <AppFormField label="标题" required>
              <AppInput v-model="form.title" placeholder="题目标题" />
            </AppFormField>
            <AppFormField label="来源">
              <AppSelect v-model="form.category" :options="categoryOptions" />
            </AppFormField>
            <AppFormField v-if="form.category === 'GESP'" label="等级">
              <AppSelect v-model.number="form.level" :options="levelOptions" />
            </AppFormField>
            <AppFormField label="时间限制(ms)">
              <AppInput v-model.number="form.time_limit" type="number" />
            </AppFormField>
            <AppFormField label="内存限制(MB)">
              <AppInput v-model.number="form.memory_limit" type="number" />
            </AppFormField>
            <AppFormField label="发布日期">
              <AppInput v-model="form.publish_date" type="month" />
            </AppFormField>
          </div>

          <AppFormField label="题目描述" required>
            <AppTextarea v-model="form.description" rows="6" placeholder="支持 Markdown 和 $...$ 公式" />
          </AppFormField>

          <div class="form-grid">
            <AppFormField label="输入格式" required>
              <AppTextarea v-model="form.input_format" rows="4" placeholder="输入格式说明" />
            </AppFormField>
            <AppFormField label="输出格式" required>
              <AppTextarea v-model="form.output_format" rows="4" placeholder="输出格式说明" />
            </AppFormField>
          </div>

          <div class="form-grid">
            <AppFormField label="数据范围">
              <AppTextarea v-model="form.data_range" rows="2" placeholder="可选" />
            </AppFormField>
            <AppFormField label="视频链接">
              <AppInput v-model="form.video_url" placeholder="可选" />
            </AppFormField>
          </div>

          <div class="checkbox-row">
            <label class="checkbox-label">
              <input v-model="form.bank_visible" type="checkbox" class="checkbox-input" />
              <span>题库可见</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Right Panel: Preview (做题页面样式) -->
      <div class="right-panel">
        <div class="preview-card">
          <!-- Preview Header -->
          <div class="preview-header">
            <div class="preview-title-section">
              <h2 class="preview-title">{{ form.title || '题目标题' }}</h2>
              <span class="level-badge" v-if="form.category === 'GESP' && form.level">GESP {{ form.level }}级</span>
              <span class="category-badge" :class="'category-' + form.category.toLowerCase()">
                {{ getCategoryText(form.category) }}
              </span>
              <span class="preview-date" v-if="form.publish_date">
                <Calendar :size="16" />
                <span>{{ formatDate(form.publish_date) }}</span>
              </span>
            </div>
          </div>

          <!-- Preview Content -->
          <div class="preview-content-scroll">
            <div class="preview-content-inner">
              <!-- 题目描述 -->
              <div class="content-section">
                <div class="section-header">
                  <h4 class="section-title"><FileText :size="18" /> 题目描述</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedDescription"></div>
                </div>
              </div>

              <!-- 输入格式 -->
              <div class="content-section">
                <div class="section-header">
                  <h4 class="section-title"><Download :size="18" /> 输入格式</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedInputFormat"></div>
                </div>
              </div>

              <!-- 输出格式 -->
              <div class="content-section">
                <div class="section-header">
                  <h4 class="section-title"><UploadIcon :size="18" /> 输出格式</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedOutputFormat"></div>
                </div>
              </div>

              <!-- 样例 (从API加载) - 可折叠 -->
              <div v-if="samples.length > 0" class="content-section collapsible">
                <div class="section-header clickable" @click="samplesExpanded = !samplesExpanded">
                  <h4 class="section-title"><Lightbulb :size="18" /> 样例 ({{ samples.length }})</h4>
                  <ChevronDown :size="18" class="collapse-icon" :class="{ expanded: samplesExpanded }" />
                </div>
                <div v-if="samplesExpanded" class="section-content">
                  <div class="samples-container">
                    <div v-for="(s, i) in samples" :key="i" class="sample-item">
                      <div class="sample-block">
                        <div class="sample-label">输入 {{ i + 1 }}:</div>
                        <pre class="sample-code">{{ s.input }}</pre>
                      </div>
                      <div class="sample-block">
                        <div class="sample-label">输出 {{ i + 1 }}:</div>
                        <pre class="sample-code">{{ s.output }}</pre>
                      </div>
                      <div v-if="s.explanation" class="sample-explanation">
                        <div class="sample-label">说明:</div>
                        <div class="markdown-content" v-html="renderMarkdown(s.explanation)"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 数据范围 -->
              <div v-if="form.data_range" class="content-section">
                <div class="section-header">
                  <h4 class="section-title"><BarChart3 :size="18" /> 数据范围</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedDataRange"></div>
                </div>
              </div>

              <!-- 限制信息 -->
              <div class="limits-info">
                <span class="limit-item">时间限制: {{ form.time_limit || 1000 }}ms</span>
                <span class="limit-item">内存限制: {{ form.memory_limit || 256 }}MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Dialog -->
    <AppDialog v-model:show="showSuccessDialog" title="操作成功" width="400" :show-footer="false">
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <!-- Error Dialog -->
    <AppDialog v-model:show="showErrorDialog" title="操作失败" width="400" :show-footer="false">
      <p style="color: var(--color-destructive);">{{ errorMessage }}</p>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'
import type { Ref } from 'vue'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Save, FileText, Download, UploadIcon, Lightbulb, BarChart3, Calendar, ChevronDown } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

// Markdown Render
import { renderMarkdown, formatDate, getCategoryText } from '@/utils/markdownRender'

// Import KaTeX CSS
import 'katex/dist/katex.min.css'

const questionTypeStore = useQuestionTypeStore()

// Inject
const ojEditorProblemId = inject<Ref<number | undefined>>('ojEditorProblemId')

// State
const loading = ref(false)
const saving = ref(false)
const samples = ref<any[]>([])
const samplesExpanded = ref(false)

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

const form = ref({
  title: '',
  description: '',
  input_format: '',
  output_format: '',
  data_range: '',
  video_url: '',
  time_limit: 1000,
  memory_limit: 256,
  category: 'GESP',
  level: null as number | null,
  publish_date: '',
  bank_visible: true
})

// Computed
const problemId = computed(() => ojEditorProblemId?.value)

// Rendered content
const renderedDescription = computed(() => renderMarkdown(form.value.description))
const renderedInputFormat = computed(() => renderMarkdown(form.value.input_format))
const renderedOutputFormat = computed(() => renderMarkdown(form.value.output_format))
const renderedDataRange = computed(() => renderMarkdown(form.value.data_range))

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

function goBack() {
  window.location.href = '/admin/oj'
}

async function loadProblem() {
  if (!problemId.value) return
  loading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/oj/problems/${problemId.value}/all`)
    if (data.success) {
      const p = data.data
      form.value = {
        title: p.title || '',
        description: p.description || '',
        input_format: p.input_format || '',
        output_format: p.output_format || '',
        data_range: p.data_range || '',
        video_url: p.video_url || '',
        time_limit: p.time_limit || 1000,
        memory_limit: p.memory_limit || 256,
        category: p.category || 'GESP',
        level: p.level || null,
        publish_date: p.publish_date || '',
        bank_visible: p.bank_visible === 1 || p.bank_visible === true
      }
      // Load samples
      samples.value = Array.isArray(p.samples) ? p.samples : []
    }
  } catch (e: any) {
    console.error(e)
    errorMessage.value = '加载题目失败'
    showErrorDialog.value = true
    setTimeout(() => goBack(), 1500)
  } finally {
    loading.value = false
  }
}

async function saveProblem() {
  if (!form.value.title.trim()) {
    errorMessage.value = '请输入标题'
    showErrorDialog.value = true
    return
  }
  saving.value = true
  try {
    await axios.put(`${BASE_URL}/oj/problems/${problemId.value}`, {
      title: form.value.title,
      description: form.value.description,
      input_format: form.value.input_format,
      output_format: form.value.output_format,
      data_range: form.value.data_range,
      video_url: form.value.video_url,
      time_limit: form.value.time_limit,
      memory_limit: form.value.memory_limit,
      category: form.value.category,
      level: form.value.category === 'GESP' ? form.value.level : null,
      publish_date: form.value.publish_date,
      bank_visible: form.value.bank_visible ? 1 : 0
    })
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
  await loadProblem()
})
</script>

<style scoped>
.oj-editor-page {
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
  display: flex;
  gap: var(--space-4);
  flex: 1;
}

.left-panel {
  flex: 0 0 400px;
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
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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

/* Preview Card - 做题页面样式 */
.preview-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-header {
  padding: var(--space-4);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.preview-title-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.preview-title {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.level-badge {
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.category-badge {
  background: var(--color-surface);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.preview-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.preview-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.preview-content-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.content-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.content-section .section-header {
  padding: var(--space-3);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.content-section .section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-foreground);
}

.content-section .section-content {
  padding: var(--space-4);
}

/* Collapsible Section */
.content-section.collapsible .section-header {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.content-section.collapsible .section-header:hover {
  background: var(--color-muted);
}

.content-section.collapsible .section-header.clickable {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.collapse-icon {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

/* Markdown Content - 做题页面样式 */
.markdown-content {
  font-size: var(--font-size-base);
  line-height: 1.8;
  color: var(--color-foreground);
  word-break: break-word;
}

.markdown-content :deep(.math-inline) {
  font-family: 'Times New Roman', serif;
}

.markdown-content :deep(.math-block) {
  display: block;
  text-align: center;
  margin: var(--space-3) 0;
  overflow-x: auto;
}

.markdown-content :deep(pre.hljs) {
  background: #1e293b;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.markdown-content :deep(code) {
  font-family: 'Courier New', monospace;
}

.markdown-content :deep(pre:not(.hljs) code) {
  background: var(--color-surface);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}

/* Samples */
.samples-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sample-item {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.sample-block {
  margin-bottom: var(--space-2);
}

.sample-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.sample-code {
  background: var(--color-muted);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  overflow-x: auto;
  margin: 0;
  border: 1px solid var(--color-border);
}

.sample-explanation {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

/* Limits */
.limits-info {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.limit-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

@media (max-width: 900px) {
  .editor-body {
    flex-direction: column;
  }

  .left-panel {
    flex: none;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>