<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <Icon name="code" :size="20" class="dialog-icon" />
        <h3 class="dialog-title">OJ题目上传</h3>
        <button @click="handleClose" class="close-btn"><Icon name="x" :size="20" /></button>
      </div>
      <div class="dialog-content">
        <!-- 全局来源 & 等级 -->
        <div class="global-settings">
          <div class="form-row">
            <div class="form-group">
              <label>题目来源</label>
              <select v-model="globalCategory">
                <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                  {{ type.display_name || type.name }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="globalCategory === 'GESP'">
              <label>等级</label>
              <select v-model.number="globalLevel">
                <option :value="null">请选择</option>
                <option v-for="n in 8" :key="n" :value="n">{{ n }}级</option>
              </select>
            </div>
          </div>
          <div class="settings-hint">
            本次上传的题目将设置为：<strong>{{ globalCategory }}</strong>
            <span v-if="globalCategory === 'GESP' && globalLevel"> / Lv{{ globalLevel }}</span>
            <span v-if="globalCategory === 'GESP' && !globalLevel" class="hint-warn">（请选择等级）</span>
          </div>
        </div>

        <!-- AI Prompt -->
        <div class="batch-example">
          <div class="example-header">
            <h4><Icon name="bot" :size="18" /> AI 提取 Prompt</h4>
            <div class="format-badge prompt-badge">PROMPT</div>
          </div>
          <div class="format-tips">
            <p>复制以下 Prompt，连同 OJ 题目源文本（真题截图 OCR、题面 PDF 文本等）一起发给 AI（ChatGPT、DeepSeek 等），AI 会输出可直接粘贴的 JSON。</p>
          </div>
          <div class="code-container" @click="copyPrompt">
            <pre class="example-code">{{ aiPrompt }}</pre>
            <div class="code-overlay"><span class="copy-hint">{{ promptCopyStatus }}</span></div>
          </div>
        </div>

        <!-- JSON 输入 -->
        <div class="input-section">
          <div class="input-header">
            <h5><Icon name="file-json" :size="18" /> 粘贴 OJ 题目 JSON 数据</h5>
            <div class="input-stats">
              <span class="char-count">{{ jsonText.length }} 字符</span>
            </div>
          </div>
          <div class="textarea-container">
            <textarea
              v-model="jsonText"
              placeholder="请粘贴 JSON 对象..."
              rows="14"
              class="json-textarea"
            ></textarea>
          </div>
          <div v-if="jsonError" class="parse-error">{{ jsonError }}</div>
        </div>

        <!-- 提交 -->
        <div class="submit-section">
          <div v-if="submitResult" class="submit-result" :class="submitResult.type">
            {{ submitResult.type === 'success' ? '✅' : '❌' }} {{ submitResult.message }}
          </div>
          <div class="action-buttons">
            <button @click="clearInput" class="btn btn-secondary" :disabled="!jsonText.trim()">清空</button>
            <button @click="uploadOJProblem" class="btn btn-primary" :disabled="uploading || !jsonText.trim()">
              {{ uploading ? '上传中...' : '上传题目' }}
            </button>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">关闭</button>
      </div>
    </div>
  </div>

  <SuccessMessageDialog
    :visible="showSuccessMessage"
    :message="successMessage"
    @close="closeSuccessMessage"
  />
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'

import { ref, onMounted } from 'vue'
import axios from 'axios'
import SuccessMessageDialog from './SuccessMessageDialog.vue'
import Icon from '@/components/Icon.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const uploading = ref(false)
const promptCopyStatus = ref('点击复制 Prompt')
const globalCategory = ref('GESP')
const globalLevel = ref<number | null>(null)
const showSuccessMessage = ref(false)
const successMessage = ref('')
const jsonError = ref('')
const jsonText = ref('')
const submitResult = ref<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })
const todayStr = new Date().toISOString().split('T')[0]

const aiPrompt = `你是 OJ 题目提取专家。请将以下题目源文本转换为 JSON 对象格式，只输出 JSON，不要输出其他内容。

输出格式示例：
{
  "title": "两数之和",
  "description": "给定两个整数 a 和 b，请输出它们的和。\\n\\n$1 \\leq a, b \\leq 10^9$",
  "input_format": "一行包含两个整数 a 和 b。",
  "output_format": "一行输出一个整数，表示 a + b 的值。",
  "data_range": "$1 \\leq a, b \\leq 10^9$",
  "time_limit": 1000,
  "memory_limit": 256,
  "publish_date": "2025-07",
  "bank_visible": true,
  "samples": [
    {
      "input": "1 2",
      "output": "3",
      "explanation": "1 + 2 = 3",
      "is_hidden": false,
      "is_displayed": true,
      "sort_order": 1
    },
    {
      "input": "-5 10",
      "output": "5",
      "explanation": "",
      "is_hidden": false,
      "is_displayed": false,
      "sort_order": 2
    }
  ]
}

关键规则：
- 不要输出 category 和 level 字段（由上传页面单独设置）
- description、input_format、output_format、data_range 使用 Markdown 格式
- 数学公式统一用 $...$（行内）或 $$...$$（独立行），不要用 \\( \\) 或 \\[ \\]
- title 不含题号前缀（如"GESP202506"、"第1题"等），只保留题名
- publish_date: 根据内容推断考试日期（YYYY-MM格式），无法判断时填 ""
- time_limit 默认 1000，memory_limit 默认 256
- samples 测试样例规则：
  - 第 1 个样例 is_displayed=true（题面展示），其余 is_displayed=false
  - 前 5 个样例 is_hidden=false（提交后展示），第 6 个起 is_hidden=true（提交后隐藏）
  - 如果源文本只有 1-2 个样例，全部设为 is_hidden=false
  - input/output 字段保留原始格式（多行用 \\n 换行），不要修改数值
  - explanation 样例说明，无则留空字符串 ""
- 如果源文本是代码阅读题（给出代码问输出结果），description 中需包含完整代码，用代码块包裹（用三个反引号 + cpp）

题目源文本：
（将你的题目内容粘贴在这里）`

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(aiPrompt)
    promptCopyStatus.value = '已复制'
    setTimeout(() => { promptCopyStatus.value = '点击复制 Prompt' }, 2000)
  } catch { /* ignore */ }
}

function clearInput() {
  jsonText.value = ''
  jsonError.value = ''
  submitResult.value = { type: null, message: '' }
}

function parseJson() {
  jsonError.value = ''

  if (globalCategory.value === 'GESP' && !globalLevel.value) {
    jsonError.value = 'GESP 来源必须选择等级'
    return null
  }

  let data: any = null
  try {
    // 预处理：修复 AI 输出中常见的 LaTeX 反斜杠问题（\leq \geq \neq 等不是合法 JSON 转义）
    const fixed = jsonText.value.replace(/\\(?!["\\/bfnrtu])/g, '\\$&')
    data = JSON.parse(fixed)
  } catch (e: any) {
    jsonError.value = 'JSON 解析失败：' + (e?.message || String(e))
    return null
  }

  if (!data || typeof data !== 'object') {
    jsonError.value = 'JSON 顶层必须是对象'
    return null
  }

  const samples = data.samples
  if (!Array.isArray(samples) || samples.length === 0) {
    jsonError.value = 'samples 必须是非空数组'
    return null
  }

  const requiredFields = ['title', 'description', 'input_format', 'output_format']
  for (const k of requiredFields) {
    if (data[k] === undefined || data[k] === null || data[k] === '') {
      jsonError.value = `缺少必要字段：${k}`
      return null
    }
  }

  const normalizedSamples = samples.map((s: any, idx: number) => ({
    input: String(s?.input ?? ''),
    output: String(s?.output ?? ''),
    explanation: s?.explanation ?? '',
    is_hidden: !!s?.is_hidden,
    is_displayed: s?.is_displayed === undefined ? (idx === 0) : !!s?.is_displayed,
    sort_order: s?.sort_order ?? idx + 1
  }))

  return {
    title: String(data.title),
    description: String(data.description),
    input_format: String(data.input_format),
    output_format: String(data.output_format),
    data_range: data.data_range ? String(data.data_range) : '',
    video_url: data.video_url ? String(data.video_url) : '',
    time_limit: Number(data.time_limit ?? 1000),
    memory_limit: Number(data.memory_limit ?? 256),
    category: globalCategory.value,
    level: globalCategory.value === 'GESP' ? (globalLevel.value || null) : null,
    publish_date: data.publish_date ? String(data.publish_date) : todayStr,
    bank_visible: data.bank_visible === undefined ? 1 : (data.bank_visible ? 1 : 0),
    samples: normalizedSamples
  }
}

async function uploadOJProblem() {
  const problemData = parseJson()
  if (!problemData) return

  uploading.value = true
  submitResult.value = { type: null, message: '' }
  try {
    const response = await axios.post(`${BASE_URL}/oj/upload`, problemData)
    const pid = response.data.data.problem_id
    const sc = response.data.data.sample_count
    submitResult.value = { type: 'success', message: `上传成功！题目ID: ${pid}，共 ${sc} 个测试样例` }
    successMessage.value = `题目上传成功！题目ID: ${pid}，共 ${sc} 个测试样例`
    showSuccessMessage.value = true
    jsonText.value = ''
    jsonError.value = ''
    emit('success')
    setTimeout(() => { handleClose() }, 1500)
  } catch (error: any) {
    const detail = error.response?.data?.error || error.message
    submitResult.value = { type: 'error', message: '上传失败: ' + detail }
  } finally {
    uploading.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  emit('close')
}

function closeSuccessMessage() {
  showSuccessMessage.value = false
  successMessage.value = ''
}

onMounted(() => {
  fetchQuestionTypes()
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog-container {
  background: white;
  border-radius: 12px;
  padding: 0;
  max-width: 960px;
  width: 95%;
  max-height: 92vh;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  animation: dialogSlideIn 0.2s ease-out;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@keyframes dialogSlideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: #f9fafb;
  border-bottom: 1px solid #f1f5f9;
}
.dialog-icon { color: #6366f1; }
.dialog-title { margin: 0; color: #1e293b; font-size: 16px; font-weight: 600; flex: 1; }
.close-btn {
  background: none; border: none;
  display: flex; align-items: center; justify-content: center;
  padding: 4px; color: #94a3b8; cursor: pointer; border-radius: 6px;
  transition: all 0.15s;
}
.close-btn:hover { background: #f1f5f9; color: #475569; }
.dialog-content { flex: 1; overflow-y: auto; padding: 20px 24px; }
.dialog-actions {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 24px; border-top: 1px solid #f1f5f9;
  background: #f9fafb;
}

/* 全局设置 */
.global-settings {
  background: #f9fafb; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;
}
.settings-hint { margin-top: 8px; font-size: 13px; color: #64748b; }
.settings-hint strong { color: #4f46e5; }
.hint-warn { color: #dc2626 !important; font-weight: 600; }

/* 表单 */
.form-row { display: flex; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.form-group { flex: 1; min-width: 140px; margin-bottom: 8px; }
.form-group label { display: block; margin-bottom: 4px; font-weight: 600; color: #374151; font-size: 13px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; background: white; transition: border-color 0.2s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
}

/* AI Prompt */
.batch-example {
  background: #f9fafb; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
}
.example-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}
.example-header h4 { margin: 0; color: #1e293b; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.format-badge {
  background: #6366f1; color: white; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600;
}
.prompt-badge { background: #8b5cf6; }
.format-tips { margin-bottom: 12px; font-size: 13px; color: #64748b; line-height: 1.5; }
.format-tips p { margin: 0 0 6px; }
.code-container {
  position: relative; background: #1e293b; border-radius: 8px;
  overflow: hidden; border: 1px solid #334155; cursor: pointer; transition: border-color 0.2s;
}
.code-container:hover { border-color: #6366f1; }
.example-code {
  margin: 0; padding: 14px; color: #e2e8f0;
  font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
}
.code-overlay {
  position: absolute; top: 0; right: 0;
  background: rgba(99,102,241,0.9); color: white;
  padding: 5px 12px; border-radius: 0 7px 0 8px; font-size: 11px; font-weight: 600;
}

/* JSON 输入 */
.input-section {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;
}
.input-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.input-header h5 { margin: 0; color: #1e293b; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.char-count { background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.textarea-container {
  background: white; border-radius: 8px; overflow: hidden;
  border: 1px solid #e2e8f0; transition: border-color 0.2s;
}
.textarea-container:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
.json-textarea {
  width: 100%; min-height: 200px; padding: 14px; border: none; outline: none;
  font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5;
  background: #1e293b; color: #f8fafc; resize: vertical;
}
.parse-error {
  background: #fef2f2; color: #991b1b; padding: 10px 14px; border-radius: 8px;
  font-size: 13px; margin-top: 8px; border: 1px solid #fecaca;
}

/* 提交 */
.submit-section {
  background: #f9fafb; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-top: 4px;
}
.submit-result {
  padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;
  font-size: 13px; font-weight: 600;
}
.submit-result.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.submit-result.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.action-buttons { display: flex; gap: 10px; justify-content: center; }

/* 按钮 */
.btn {
  padding: 9px 18px; border-radius: 8px; font-weight: 600; font-size: 13px;
  cursor: pointer; border: none; transition: all 0.15s;
}
.btn-primary { background: #6366f1; color: white; }
.btn-primary:hover { background: #4f46e5; }
.btn-primary:disabled { background: #c7d2fe; color: #94a3b8; cursor: not-allowed; }
.btn-secondary { background: white; color: #64748b; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #f9fafb; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
