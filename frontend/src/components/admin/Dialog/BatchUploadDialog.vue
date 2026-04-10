<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <Icon name="package" :size="20" class="dialog-icon" />
        <h3 class="dialog-title">批量上传题目</h3>
        <button @click="handleClose" class="close-btn"><Icon name="x" :size="20" /></button>
      </div>
      <div class="dialog-content">
        <!-- 步骤一：JSON 输入 -->
        <div v-if="step === 'input'" class="batch-upload-area">
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
              本次上传的所有题目将统一设置为：<strong>{{ globalCategory }}</strong>
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
              <p>复制以下 Prompt，连同题目源文本一起发给 AI（ChatGPT、DeepSeek 等），AI 会输出可直接粘贴的 JSON。</p>
            </div>
            <div class="code-container" @click="copyPrompt">
              <pre class="example-code">{{ aiPrompt }}</pre>
              <div class="code-overlay"><span class="copy-hint">{{ promptCopyStatus }}</span></div>
            </div>
          </div>

          <div class="input-section">
            <div class="input-header">
              <h5><Icon name="file-text" :size="18" /> 粘贴题目 JSON 数据</h5>
              <div class="input-stats">
                <span class="char-count">{{ batchText.length }} 字符</span>
              </div>
            </div>
            <div class="textarea-container">
              <textarea
                v-model="batchText"
                placeholder="请粘贴 JSON 数组..."
                rows="12"
                class="batch-textarea"
              ></textarea>
            </div>
            <div v-if="parseError" class="parse-error">{{ parseError }}</div>
          </div>

          <div class="action-section">
            <div class="action-buttons">
              <button @click="clearInput" class="btn btn-secondary" :disabled="!batchText.trim()">清空</button>
              <button @click="parseAndPreview" class="btn btn-primary" :disabled="!batchText.trim()">预览题目</button>
            </div>
          </div>
        </div>

        <!-- 步骤二：预览 & 编辑 -->
        <div v-if="step === 'preview'" class="preview-area">
          <div class="preview-header">
            <div class="preview-stats">
              <span class="stat-badge">共 {{ questions.length }} 道题</span>
              <span class="badge badge-category">{{ globalCategory }}</span>
              <span v-if="globalCategory === 'GESP' && globalLevel" class="badge badge-level">Lv{{ globalLevel }}</span>
              <span v-if="questions.length > 0" class="stat-hint">可逐个编辑、上传图片后提交</span>
            </div>
            <button @click="backToInput" class="btn btn-secondary btn-sm">返回修改 JSON</button>
          </div>

          <div class="questions-list">
            <div v-for="(q, index) in questions" :key="index" class="question-card">
              <div class="question-card-header">
                <span class="question-index">#{{ index + 1 }}</span>
                <div class="question-badges">
                  <span class="badge badge-type">{{ q.question_type === 'code' ? '代码题' : '文本题' }}</span>
                  <span class="badge" :class="'badge-' + q.difficulty">{{ difficultyLabel(q.difficulty) }}</span>
                </div>
                <button @click="removeQuestion(index)" class="btn-remove" title="删除此题">删除</button>
              </div>

              <div class="question-card-body">
                <!-- 难度 / 日期 -->
                <div class="form-row">
                  <div class="form-group">
                    <label>难度</label>
                    <select v-model="q.difficulty">
                      <option value="easy">简单</option>
                      <option value="medium">中等</option>
                      <option value="hard">困难</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>日期</label>
                    <input type="month" v-model="q.question_date" />
                  </div>
                </div>

                <!-- 题目内容 -->
                <div class="form-group">
                  <label>题目内容</label>
                  <textarea v-model="q.question_text" rows="3" placeholder="题目内容"></textarea>
                </div>

                <!-- 代码 -->
                <div v-if="q.question_type === 'code'" class="form-group">
                  <label>代码</label>
                  <textarea v-model="q.question_code" class="code-textarea" rows="5" placeholder="代码内容"></textarea>
                </div>

                <!-- 图片上传 -->
                <div class="form-group">
                  <label>题目图片</label>
                  <div v-if="q.image_url" class="image-preview-row">
                    <img :src="q.image_url" class="image-preview" />
                    <button type="button" @click="q.image_url = ''" class="btn-remove-img">删除</button>
                  </div>
                  <div v-else class="image-upload-area" @click="triggerImageInput(index)">
                    <input
                      :ref="el => imageInputs[index] = el"
                      type="file"
                      accept="image/*"
                      style="display:none"
                      @change="handleImageSelect($event, index)"
                    />
                    <div class="upload-icon">📷</div>
                    <div class="upload-text">点击上传图片</div>
                  </div>
                </div>

                <!-- 选项 -->
                <div v-if="q.options && q.options.length > 0" class="options-section">
                  <label>选项</label>
                  <div v-for="(opt, oi) in q.options" :key="oi" class="option-row">
                    <span class="option-label">{{ opt.label }}.</span>
                    <input v-model="opt.text" class="option-input" />
                    <button @click="q.options.splice(oi, 1)" class="btn-remove-opt" title="删除">x</button>
                  </div>
                </div>

                <!-- 答案 & 解析 -->
                <div class="form-row">
                  <div class="form-group">
                    <label>正确答案</label>
                    <input v-model="q.correct_answer" placeholder="如：A" />
                  </div>
                  <div class="form-group">
                    <label>解析</label>
                    <input v-model="q.explanation" placeholder="可选" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 提交 -->
          <div class="submit-section">
            <div v-if="submitResult" class="submit-result" :class="submitResult.type">
              {{ submitResult.type === 'success' ? '✅' : '❌' }} {{ submitResult.message }}
            </div>
            <div class="action-buttons">
              <button @click="step = 'input'" class="btn btn-secondary">返回修改</button>
              <button @click="submitAll" class="btn btn-primary" :disabled="submitting || questions.length === 0">
                {{ submitting ? '上传中...' : `提交 ${questions.length} 道题目` }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">关闭</button>
      </div>
    </div>
  </div>

  <SuccessMessageDialog :visible="showSuccess" :message="successMsg" @close="showSuccess = false" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'
import SuccessMessageDialog from './SuccessMessageDialog.vue'
import Icon from '@/components/Icon.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()
const { allQuestionTypes, fetchQuestionTypes } = questionTypeStore

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const step = ref<'input' | 'preview'>('input')
const globalCategory = ref('GESP')
const globalLevel = ref<number | null>(null)
const batchText = ref('')
const parseError = ref('')
const questions = ref<any[]>([])
const submitting = ref(false)
const submitResult = ref<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })
const showSuccess = ref(false)
const successMsg = ref('')
const imageInputs = ref<any[]>([])
const promptCopyStatus = ref('点击复制 Prompt')

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
  },
  {
    "question_text": "Python中列表是不可变数据类型",
    "question_type": "text",
    "question_code": "",
    "correct_answer": "B",
    "explanation": "列表是可变数据类型，元组才是不可变的",
    "level": 2,
    "difficulty": "easy",
    "question_date": "2025-07",
    "options": [
      {"label": "A", "value": "A", "text": "正确"},
      {"label": "B", "value": "B", "text": "错误"}
    ]
  },
  {
    "question_text": "以下程序的输出结果是？",
    "question_type": "code",
    "question_code": "for i in range(5):\\n    if i == 3:\\n        break\\nprint(i)",
    "correct_answer": "B",
    "explanation": "当i等于3时执行break跳出循环，此时i的值为3",
    "level": 3,
    "difficulty": "medium",
    "question_date": "2025-07",
    "options": [
      {"label": "A", "value": "A", "text": "2"},
      {"label": "B", "value": "B", "text": "3"},
      {"label": "C", "value": "C", "text": "4"},
      {"label": "D", "value": "D", "text": "5"}
    ]
  }
]

关键规则：
- 不要输出 category 字段
- 所有文本字段（question_text、options 的 text、explanation）输出纯文本，不要使用 Markdown 格式（如 **加粗**、\`代码\`）或 LaTeX 格式（如 $公式$、$$公式$$）
- question_type: 题目包含代码用 code，否则用 text
- question_code: code 类型必须填写代码（移除行号、添加正确缩进），text 类型留空字符串 ""
- options 的 text 必须逐字复制原文，禁止简写为"选项A"
- 判断题 options 固定为 [{"label":"A","value":"A","text":"正确"},{"label":"B","value":"B","text":"错误"}]，correct_answer 为 "A"（正确）或 "B"（错误）
- question_text 不含题号前缀
- level: 根据内容推断等级（1-8），无法判断时填 1
- question_date: 根据内容推断考试日期（YYYY-MM格式），无法判断时留空字符串 ""
- difficulty: 根据题目难度填 easy/medium/hard

题目源文本：
（将你的题目内容粘贴在这里）`)

onMounted(() => { fetchQuestionTypes() })

function difficultyLabel(d: string) {
  return { easy: '简单', medium: '中等', hard: '困难' }[d] || d
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
  if (file.size > 5 * 1024 * 1024) { alert('图片不能超过5MB'); return }
  const formData = new FormData()
  formData.append('image', file)
  try {
    const res = await axios.post(`${BASE_URL}/upload-image`, formData)
    let url = res.data.imageUrl || res.data.image_url || res.data.url || res.data.path || res.data
    if (url) {
      let normalized = normalizeImageUrl(url)
      if (!normalized) normalized = url
      if (!normalized.startsWith('http')) normalized = `${API_SERVER_BASE}${normalized.startsWith('/') ? '' : '/'}${normalized}`
      url = normalized
    }
    questions.value[index].image_url = url
  } catch (e: any) {
    alert('图片上传失败: ' + (e.response?.data?.error || e.message))
  }
  if (imageInputs.value[index]) imageInputs.value[index].value = ''
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
    submitResult.value = { type: 'success', message: `成功上传 ${count} 道题目` }
    successMsg.value = `批量上传成功，共 ${count} 道题目`
    showSuccess.value = true
    questions.value = []
    batchText.value = ''
    step.value = 'input'
  } catch (e: any) {
    const detail = e.response?.data?.details || e.response?.data?.error || e.message
    console.error('批量上传失败:', e.response?.data || e)
    submitResult.value = { type: 'error', message: '上传失败: ' + detail }
  } finally {
    submitting.value = false
  }
}

function handleClose() { emit('close') }
function handleOverlayClick() { emit('close') }
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog-container {
  background: white; border-radius: 12px; padding: 0;
  max-width: 960px; width: 95%; max-height: 92vh;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  animation: dialogSlideIn 0.2s ease-out;
  border: 1px solid #e2e8f0;
  display: flex; flex-direction: column;
  overflow: hidden;
}
@keyframes dialogSlideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.dialog-header {
  display: flex; align-items: center; gap: 12px;
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

/* 步骤一 */
.batch-upload-area { display: flex; flex-direction: column; gap: 14px; }
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
  padding: 5px 12px; border-radius: 0 7px 0 8px;
  font-size: 11px; font-weight: 600;
}
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
.batch-textarea {
  width: 100%; min-height: 200px; padding: 14px; border: none; outline: none;
  font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5;
  background: transparent; resize: vertical; color: #1e293b;
}
.parse-error {
  background: #fef2f2; color: #991b1b; padding: 10px 14px; border-radius: 8px;
  font-size: 13px; margin-top: 8px; border: 1px solid #fecaca;
}
.action-section {
  background: #f9fafb; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;
}
.action-buttons { display: flex; gap: 10px; justify-content: center; }

/* 步骤二 */
.preview-area { display: flex; flex-direction: column; gap: 14px; }
.preview-header {
  display: flex; justify-content: space-between; align-items: center;
  background: #f9fafb; padding: 12px 18px; border-radius: 10px; border: 1px solid #e2e8f0;
}
.preview-stats { display: flex; align-items: center; gap: 10px; }
.stat-badge { background: #6366f1; color: white; padding: 3px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; }
.stat-hint { color: #94a3b8; font-size: 12px; }
.questions-list { display: flex; flex-direction: column; gap: 12px; }

.question-card {
  border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
  background: #fff; transition: border-color 0.15s;
}
.question-card:hover { border-color: #cbd5e1; }
.question-card-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  background: #f9fafb; border-bottom: 1px solid #f1f5f9;
}
.question-index {
  background: #6366f1; color: white; padding: 2px 10px; border-radius: 6px;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.question-badges { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; }
.badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.badge-category { background: #eef2ff; color: #4f46e5; }
.badge-level { background: #ecfdf5; color: #065f46; }
.badge-type { background: #f3f4f6; color: #4b5563; }
.badge-easy { background: #ecfdf5; color: #065f46; }
.badge-medium { background: #fffbeb; color: #92400e; }
.badge-hard { background: #fef2f2; color: #991b1b; }
.btn-remove {
  background: none; border: none; color: #cbd5e1; padding: 4px 8px; border-radius: 4px;
  font-size: 12px; cursor: pointer; transition: all 0.15s;
}
.btn-remove:hover { background: #fef2f2; color: #ef4444; }

.question-card-body { padding: 16px; }
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
.form-group textarea { min-height: 60px; resize: vertical; }
.code-textarea { font-family: 'Courier New', monospace; font-size: 13px; background: #1e293b; color: #e2e8f0; border-color: #334155; }

/* 图片 */
.image-preview-row { display: flex; align-items: center; gap: 12px; }
.image-preview { max-width: 200px; max-height: 120px; border-radius: 8px; border: 1px solid #e2e8f0; }
.btn-remove-img {
  background: none; border: none; color: #cbd5e1; padding: 4px 8px; border-radius: 4px;
  font-size: 12px; cursor: pointer; transition: all 0.15s;
}
.btn-remove-img:hover { background: #fef2f2; color: #ef4444; }
.image-upload-area {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 20px; border: 1px dashed #d1d5db; border-radius: 8px;
  color: #94a3b8; cursor: pointer; transition: all 0.15s;
}
.image-upload-area:hover { border-color: #6366f1; background: #faf5ff; color: #6366f1; }
.upload-icon { font-size: 24px; }
.upload-text { font-size: 13px; font-weight: 500; }

/* 选项 */
.options-section label { display: block; margin-bottom: 6px; font-weight: 600; color: #374151; font-size: 13px; }
.option-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.option-label {
  background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 4px;
  font-size: 13px; font-weight: 700; min-width: 32px; text-align: center;
}
.option-input { flex: 1; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
.btn-remove-opt {
  background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 16px; padding: 4px;
}
.btn-remove-opt:hover { color: #ef4444; }

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

.btn {
  padding: 9px 18px; border-radius: 8px; font-weight: 600; font-size: 13px;
  cursor: pointer; border: none; transition: all 0.15s;
}
.btn-primary {
  background: #6366f1; color: white;
}
.btn-primary:hover { background: #4f46e5; }
.btn-primary:disabled { background: #c7d2fe; color: #94a3b8; cursor: not-allowed; }
.btn-secondary { background: white; color: #64748b; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #f9fafb; }
.btn-sm { padding: 6px 14px; font-size: 12px; }
</style>
