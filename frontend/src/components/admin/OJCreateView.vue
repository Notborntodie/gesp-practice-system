<template>
  <div class="oj-create-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回OJ列表
      </AppButton>
      <h2 class="editor-title">创建OJ题目</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="!canSubmit" :loading="submitting" @click="submitProblem">
          <Upload :size="16" />
          上传
        </AppButton>
      </div>
    </div>

    <!-- Body: Left (Form) + Right (Preview) -->
    <div class="editor-body">
      <!-- Left Panel: Form -->
      <div class="left-panel">
        <!-- Global Settings -->
        <div class="form-section">
          <h5 class="section-title">全局设置</h5>
          <div class="form-grid">
            <AppFormField label="题目来源">
              <AppSelect v-model="globalCategory" :options="categoryOptions" />
            </AppFormField>
            <AppFormField v-if="globalCategory === 'GESP'" label="等级">
              <AppSelect v-model.number="globalLevel" :options="levelOptions" placeholder="请选择" />
            </AppFormField>
          </div>
          <div class="settings-hint">
            本次上传的题目将设置为：<strong>{{ globalCategory }}</strong>
            <span v-if="globalCategory === 'GESP' && globalLevel"> / Lv{{ globalLevel }}</span>
            <span v-if="globalCategory === 'GESP' && !globalLevel" class="hint-warn">（请选择等级）</span>
          </div>
        </div>

        <!-- AI Prompt -->
        <div class="form-section">
          <div class="section-header">
            <h5 class="section-title">AI 提取 Prompt</h5>
            <AppTag type="primary" size="sm">PROMPT</AppTag>
          </div>
          <p class="hint-text">复制以下 Prompt，连同题目源文本发给 AI</p>
          <div class="code-container" @click="copyPrompt">
            <pre class="prompt-code">{{ aiPrompt }}</pre>
            <div class="code-overlay">
              <span>{{ promptCopyStatus }}</span>
            </div>
          </div>
        </div>

        <!-- JSON Input -->
        <div class="form-section">
          <div class="section-header">
            <h5 class="section-title">粘贴题目 JSON</h5>
            <span class="char-count">{{ jsonText.length }} 字符</span>
          </div>
          <AppTextarea v-model="jsonText" rows="14" placeholder="请粘贴 JSON 对象..." code />
          <div v-if="parseError" class="parse-error">{{ parseError }}</div>
        </div>
      </div>

      <!-- Right Panel: Preview (做题页面样式) -->
      <div class="right-panel">
        <div class="preview-card">
          <!-- Preview Header -->
          <div class="preview-header">
            <div class="preview-title-section">
              <h2 class="preview-title">{{ parsedData?.title || '题目标题' }}</h2>
              <span class="level-badge" v-if="globalCategory === 'GESP' && globalLevel">GESP {{ globalLevel }}级</span>
              <span class="category-badge" :class="'category-' + globalCategory.toLowerCase()">
                {{ getCategoryText(globalCategory) }}
              </span>
              <span class="preview-date" v-if="parsedData?.publish_date">
                <Calendar :size="16" />
                <span>{{ formatDate(parsedData.publish_date) }}</span>
              </span>
            </div>
          </div>

          <!-- Preview Content -->
          <div class="preview-content-scroll">
            <div v-if="parsedData" class="preview-content-inner">
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
                  <h4 class="section-title"><Upload :size="18" /> 输出格式</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedOutputFormat"></div>
                </div>
              </div>

              <!-- 样例 - 可折叠 -->
              <div v-if="parsedData.samples && parsedData.samples.length > 0" class="content-section collapsible">
                <div class="section-header clickable" @click="samplesExpanded = !samplesExpanded">
                  <h4 class="section-title"><Lightbulb :size="18" /> 样例 ({{ parsedData.samples.length }})</h4>
                  <ChevronDown :size="18" class="collapse-icon" :class="{ expanded: samplesExpanded }" />
                </div>
                <div v-if="samplesExpanded" class="section-content">
                  <div class="samples-container">
                    <div v-for="(s, i) in parsedData.samples" :key="i" class="sample-item">
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
              <div v-if="parsedData.data_range" class="content-section">
                <div class="section-header">
                  <h4 class="section-title"><BarChart3 :size="18" /> 数据范围</h4>
                </div>
                <div class="section-content">
                  <div class="markdown-content" v-html="renderedDataRange"></div>
                </div>
              </div>

              <!-- 限制信息 -->
              <div class="limits-info">
                <span class="limit-item">时间限制: {{ parsedData.time_limit || 1000 }}ms</span>
                <span class="limit-item">内存限制: {{ parsedData.memory_limit || 256 }}MB</span>
              </div>
            </div>

            <!-- Empty Preview -->
            <div v-else class="empty-preview">
              <FileQuestion :size="48" />
              <p>粘贴 JSON 后显示预览</p>
              <p class="hint">预览效果与实际做题页面一致</p>
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
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Upload, FileText, Download, UploadIcon, Lightbulb, BarChart3, Calendar, FileQuestion, ChevronDown } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

// Markdown Render
import { renderMarkdown, formatDate, getCategoryText } from '@/utils/markdownRender'

// Import KaTeX CSS
import 'katex/dist/katex.min.css'

const questionTypeStore = useQuestionTypeStore()

// State
const globalCategory = ref('GESP')
const globalLevel = ref<number | null>(null)
const jsonText = ref('')
const parseError = ref('')
const parsedData = ref<any>(null)
const submitting = ref(false)
const samplesExpanded = ref(false)

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')
const promptCopyStatus = ref('点击复制')

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

// AI Prompt
const aiPrompt = `你是 OJ 题目提取专家。请将以下题目源文本转换为 JSON 对象格式，只输出 JSON，不要输出其他内容。

输出格式示例（GESP202512 二级 黄金格）：
{
  "title": "黄金格",
  "description": "小杨有一个 $n \\times m$ 的网格，网格的每个格子要么是金色，要么是银色。金色格子用字符 \`G\` 表示，银色格子用字符 \`S\` 表示。\\n\\n小杨想知道，在这个网格中，有多少个金色格子恰好与四个金色格子相邻（上下左右四个方向）。\\n\\n**注意：** 边界上的格子可能只有2个或3个相邻格子。",
  "input_format": "第一行包含两个正整数 $n$ 和 $m$，表示网格的行数和列数。\\n\\n接下来 $n$ 行，每行包含 $m$ 个字符，表示网格中每个格子的颜色。每个字符要么是 \`G\`，要么是 \`S\`。",
  "output_format": "输出一个整数，表示恰好与四个金色格子相邻的金色格子数量。",
  "data_range": "对于全部数据，保证有 $1 \\leq n, m \\leq 100$。",
  "time_limit": 1000,
  "memory_limit": 256,
  "publish_date": "2025-12",
  "bank_visible": true,
  "samples": [
    {
      "input": "3 3\\nGGG\\nGGG\\nGGG",
      "output": "1",
      "explanation": "只有中心的格子恰好与四个金色格子相邻。",
      "is_hidden": false,
      "is_displayed": true,
      "sort_order": 1
    },
    {
      "input": "4 4\\nGGGG\\nGSGG\\nGGGG\\nGGGG",
      "output": "3",
      "explanation": "第1行第2列、第3行第2列、第2行第3列的金色格子都恰好与四个金色格子相邻。",
      "is_hidden": false,
      "is_displayed": true,
      "sort_order": 2
    }
  ]
}

关键规则：
- 不要输出 category 和 level 字段（由上传页面单独设置）
- description、input_format、output_format、data_range 使用 Markdown 格式
- 数学公式统一用 $...$（行内）或 $$...$$（独立行）
- 行内代码用 \`...\`（反引号）
- title 不含题号前缀（如"GESP202512 二级"）
- publish_date: YYYY-MM格式（如"2025-12"）
- time_limit 默认 1000，memory_limit 默认 256
- samples 至少包含1个样例，建议包含2-3个样例

题目源文本：
（将你的题目内容粘贴在这里）`

// Rendered content
const renderedDescription = computed(() => renderMarkdown(parsedData.value?.description || ''))
const renderedInputFormat = computed(() => renderMarkdown(parsedData.value?.input_format || ''))
const renderedOutputFormat = computed(() => renderMarkdown(parsedData.value?.output_format || ''))
const renderedDataRange = computed(() => renderMarkdown(parsedData.value?.data_range || ''))

// Can submit
const canSubmit = computed(() => {
  return parsedData.value && !parseError.value && !submitting.value &&
    (globalCategory.value !== 'GESP' || globalLevel.value)
})

// Parse JSON
watch(jsonText, () => {
  parseError.value = ''
  parsedData.value = null
  if (!jsonText.value.trim()) return

  try {
    const fixed = jsonText.value.replace(/\\(?!["\\/bfnrtu])/g, '\\$&')
    const data = JSON.parse(fixed)
    if (!data || typeof data !== 'object') {
      parseError.value = 'JSON 顶层必须是对象'
      return
    }
    if (!data.samples || !Array.isArray(data.samples) || data.samples.length === 0) {
      parseError.value = 'samples 必须是非空数组'
      return
    }
    const requiredFields = ['title', 'description', 'input_format', 'output_format']
    for (const k of requiredFields) {
      if (!data[k]) {
        parseError.value = `缺少必要字段：${k}`
        return
      }
    }
    parsedData.value = data
  } catch (e: any) {
    parseError.value = 'JSON 解析失败：' + (e?.message || String(e))
  }
})

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(aiPrompt)
    promptCopyStatus.value = '已复制'
    setTimeout(() => { promptCopyStatus.value = '点击复制' }, 2000)
  } catch { /* ignore */ }
}

function goBack() {
  window.location.href = '/admin/oj'
}

async function submitProblem() {
  if (!parsedData.value) return
  submitting.value = true
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const payload = {
      title: parsedData.value.title,
      description: parsedData.value.description,
      input_format: parsedData.value.input_format,
      output_format: parsedData.value.output_format,
      data_range: parsedData.value.data_range || '',
      video_url: parsedData.value.video_url || '',
      time_limit: parsedData.value.time_limit || 1000,
      memory_limit: parsedData.value.memory_limit || 256,
      category: globalCategory.value,
      level: globalCategory.value === 'GESP' ? globalLevel.value : null,
      publish_date: parsedData.value.publish_date || todayStr,
      bank_visible: parsedData.value.bank_visible === undefined ? 1 : (parsedData.value.bank_visible ? 1 : 0),
      samples: parsedData.value.samples.map((s: any, idx: number) => ({
        input: String(s?.input ?? ''),
        output: String(s?.output ?? ''),
        explanation: s?.explanation ?? '',
        is_hidden: !!s?.is_hidden,
        is_displayed: s?.is_displayed === undefined ? (idx === 0) : !!s?.is_displayed,
        sort_order: s?.sort_order ?? idx + 1
      }))
    }
    const response = await axios.post(`${BASE_URL}/oj/upload`, payload)
    const pid = response.data.data?.problem_id
    successMessage.value = `题目上传成功！ID: ${pid}`
    showSuccessDialog.value = true
    setTimeout(() => goBack(), 1500)
  } catch (error: any) {
    const detail = error.response?.data?.error || error.message
    errorMessage.value = detail
    showErrorDialog.value = true
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
})
</script>

<style scoped>
.oj-create-page {
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

.editor-body {
  display: flex;
  gap: var(--space-4);
  flex: 1;
}

.left-panel {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  margin: 0;
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

.hint-text {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

.prompt-code {
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

.char-count {
  background: var(--color-surface);
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

/* Empty Preview */
.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-text-muted);
}

.empty-preview p {
  margin: 0;
}

.empty-preview .hint {
  font-size: var(--font-size-xs);
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