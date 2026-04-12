<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">✏️</div>
        <h3 class="dialog-title">编辑 OJ 题目</h3>
        <button @click="handleClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div v-if="loading" class="loading-indicator">
          <i class="fas fa-sync fa-spin"></i>
          <span>正在加载完整测试样例...</span>
        </div>
        
        <div v-if="!editForm" class="error-info">
          ⚠️ editForm 为空，检查控制台日志
        </div>
        
        <!-- 左右分栏布局 -->
        <div class="edit-preview-container" v-if="editForm">
          <!-- 左侧：编辑区 -->
          <div class="edit-panel">
            <form @submit.prevent="updateOJProblem" class="question-form">
          <!-- 基本信息 -->
          <div class="form-row">
            <div class="form-group">
              <label>题目标题：</label>
              <input v-model="editForm.title" placeholder="如：两数之和" />
            </div>
            <div class="form-group">
              <label>题目来源：</label>
              <select v-model="editForm.category">
                <option v-for="t in questionTypeStore.allTypes.value" :key="t.name" :value="t.name">
                  {{ t.display_name || t.name }}
                </option>
              </select>
            </div>
            <div class="form-group" v-if="editForm.category === 'GESP'">
              <label>GESP 等级：</label>
              <select v-model="editForm.level">
                <option value="1">GESP 1级</option>
                <option value="2">GESP 2级</option>
                <option value="3">GESP 3级</option>
                <option value="4">GESP 4级</option>
                <option value="5">GESP 5级</option>
                <option value="6">GESP 6级</option>
                <option value="7">GESP 7级</option>
                <option value="8">GESP 8级</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>题目描述：</label>
            <textarea v-model="editForm.description" placeholder="详细描述题目要求..." rows="6"></textarea>
          </div>

          <div class="form-group">
            <label>输入格式：</label>
            <textarea v-model="editForm.input_format" placeholder="如：**第一行**：两个整数 n 和 target" rows="4"></textarea>
          </div>

          <div class="form-group">
            <label>输出格式：</label>
            <textarea v-model="editForm.output_format" placeholder="如：**一行**：两个整数，表示数组下标" rows="4"></textarea>
          </div>

          <div class="form-group">
            <label>数据范围：</label>
            <textarea v-model="editForm.data_range" placeholder="如：2 ≤ n ≤ 1000" rows="3"></textarea>
          </div>

          <div class="form-group">
            <label>题目解析（文字）：</label>
            <textarea
              v-model="editForm.analysis"
              placeholder="写给学生看的文字解析，将出现在 Test 的「我的解析」中"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label>视频讲解链接：</label>
            <input v-model="editForm.video_url" placeholder="如：https://example.com/video.mp4" />
          </div>

          <!-- 限制条件 -->
          <div class="form-row">
            <div class="form-group">
              <label>时间限制 (ms)：</label>
              <input v-model.number="editForm.time_limit" type="number" placeholder="如：1000" />
            </div>
            <div class="form-group">
              <label>内存限制 (MB)：</label>
              <input v-model.number="editForm.memory_limit" type="number" placeholder="如：256" />
            </div>
            <div class="form-group">
              <label>发布日期：</label>
              <input v-model="editForm.publish_date" type="date" />
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="editForm.bank_visible" />
              题库可见（关闭后 level-exams 题库不显示，计划与测试仍可使用）
            </label>
          </div>

          <!-- 测试样例 -->
          <div class="samples-section">
            <div class="section-header">
              <label>测试样例：</label>
              <button type="button" @click="addSample" class="btn btn-secondary-small">添加样例</button>
            </div>
            
            <div v-for="(sample, index) in editForm.samples" :key="index" class="sample-item">
              <div class="sample-header">
                <h4>样例 {{ index + 1 }}</h4>
                <button type="button" @click="removeSample(index)" class="btn-remove">删除</button>
              </div>
              
              <div class="form-group">
                <label>输入：</label>
                <textarea v-model="sample.input" placeholder="如：4 9&#10;2 7 11 15" rows="3"></textarea>
              </div>
              
              <div class="form-group">
                <label>输出：</label>
                <textarea v-model="sample.output" placeholder="如：0 1" rows="2"></textarea>
              </div>
              
              <div class="form-group">
                <label>说明（可选）：</label>
                <textarea v-model="sample.explanation" placeholder="样例解释..." rows="2"></textarea>
              </div>
              
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="sample.is_displayed" />
                    展示样例（题目描述中显示）
                  </label>
                </div>
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="sample.is_hidden" />
                    隐藏样例（提交后不显示详细信息）
                  </label>
                </div>
                <div class="form-group">
                  <label>排序：</label>
                  <input v-model.number="sample.sort_order" type="number" placeholder="显示顺序" />
                </div>
              </div>
            </div>
          </div>

          <div class="form-note">
            <i class="fas fa-info-circle"></i>
            <span>注意：只有填写的字段会被更新，空字段将保持原值。测试样例更新会替换所有现有样例。<br>
            • 展示样例：勾选后会在题目描述中显示给学生<br>
            • 隐藏样例：勾选后提交代码时不显示该样例的详细信息（用于评测）</span>
          </div>
            </form>
          </div>

          <!-- 右侧：预览区 -->
          <div class="preview-panel">
            <div class="preview-sticky-header">
              <h4>📱 实时预览</h4>
            </div>
            
            <div class="preview-content">
              <!-- 题目描述预览 -->
              <div class="preview-section" v-if="editForm.description">
                <div class="preview-section-header">
                  <h5>📝 题目描述</h5>
                </div>
                <div class="preview-section-content">
                  <div v-html="renderedDescription" class="markdown-content"></div>
                </div>
              </div>

              <!-- 输入格式预览 -->
              <div class="preview-section" v-if="editForm.input_format">
                <div class="preview-section-header">
                  <h5>📥 输入格式</h5>
                </div>
                <div class="preview-section-content">
                  <div v-html="renderedInputFormat" class="markdown-content"></div>
                </div>
              </div>

              <!-- 输出格式预览 -->
              <div class="preview-section" v-if="editForm.output_format">
                <div class="preview-section-header">
                  <h5>📤 输出格式</h5>
                </div>
                <div class="preview-section-content">
                  <div v-html="renderedOutputFormat" class="markdown-content"></div>
                </div>
              </div>

              <!-- 样例预览 -->
              <div class="preview-section" v-if="editForm.samples && editForm.samples.length > 0">
                <div class="preview-section-header">
                  <h5>💡 样例</h5>
                </div>
                <div class="preview-section-content">
                  <div v-for="(sample, index) in renderedSamples" :key="index" class="sample-preview">
                    <div class="sample-block">
                      <div class="sample-label">输入 {{ index + 1 }}:</div>
                      <pre class="sample-code">{{ editForm.samples[index].input }}</pre>
                    </div>
                    <div class="sample-block">
                      <div class="sample-label">输出 {{ index + 1 }}:</div>
                      <pre class="sample-code">{{ editForm.samples[index].output }}</pre>
                    </div>
                    <div v-if="sample.explanation" class="sample-explanation">
                      <div class="sample-label">说明:</div>
                      <div v-html="sample.explanation" class="markdown-content"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 数据范围预览 -->
              <div class="preview-section" v-if="editForm.data_range">
                <div class="preview-section-header">
                  <h5>📊 数据范围</h5>
                </div>
                <div class="preview-section-content">
                  <div v-html="renderedDataRange" class="markdown-content"></div>
                </div>
              </div>

              <!-- 空状态提示 -->
              <div v-if="!editForm.description && !editForm.input_format && !editForm.output_format && !editForm.data_range && (!editForm.samples || editForm.samples.length === 0)" class="preview-empty">
                <i class="fas fa-eye-slash"></i>
                <p>开始编辑以查看预览效果</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">取消</button>
        <button @click="updateOJProblem" class="btn btn-primary" :disabled="updating">
          {{ updating ? '更新中...' : '更新题目' }}
        </button>
      </div>
    </div>
  </div>
  
  <!-- 成功提示弹窗 -->
  <SuccessMessageDialog
    :visible="showSuccessMessage"
    :message="successMessage"
    @close="closeSuccessMessage"
  />
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, watch, computed } from 'vue'
import axios from 'axios'
import SuccessMessageDialog from './SuccessMessageDialog.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import hljs from 'highlight.js'
// @ts-ignore
import katex from 'katex'

const questionTypeStore = useQuestionTypeStore()
questionTypeStore.fetchQuestionTypes()

const props = defineProps<{
  visible: boolean
  problem: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const updating = ref(false)
const loading = ref(false)
const showSuccessMessage = ref(false)
const successMessage = ref('')

const editForm = ref<any>(null)

// 初始化表单数据
function initFormData(problemData: any) {
  // 处理样例数据，确保 is_displayed 和 is_hidden 字段正确映射
  const samples = problemData.samples ? problemData.samples.map((sample: any) => ({
    input: sample.input || '',
    output: sample.output || '',
    explanation: sample.explanation || '',
    // 使用后端返回的值，如果不存在则使用默认值
    is_displayed: sample.is_displayed !== undefined ? sample.is_displayed : true,
    is_hidden: sample.is_hidden !== undefined ? sample.is_hidden : false,
    sort_order: sample.sort_order || 0
  })) : []
  
  editForm.value = {
    title: problemData.title || '',
    description: problemData.description || '',
    input_format: problemData.input_format || '',
    output_format: problemData.output_format || '',
    data_range: problemData.data_range || '',
    analysis: problemData.analysis || '',
    video_url: problemData.video_url || '',
    time_limit: problemData.time_limit || 1000,
    memory_limit: problemData.memory_limit || 256,
    category: problemData.category || 'GESP',
    level: problemData.level?.toString() || '3',
    publish_date: problemData.publish_date ? new Date(problemData.publish_date).toISOString().split('T')[0] : '',
    bank_visible: problemData.bank_visible !== undefined ? !!problemData.bank_visible : true,
    samples: samples
  }
}

// 监听弹窗打开，加载数据
watch(() => props.visible, async (newVisible) => {
  if (newVisible && props.problem?.id) {
    if (props.problem) {
      initFormData(props.problem)
    }
    await loadProblemDetails()
  }
})

// 监听 problem 变化
watch(() => props.problem, () => {}, { deep: true })

// 获取题目完整详情（包括所有测试样例）
async function loadProblemDetails() {
  if (!props.problem?.id) return

  loading.value = true
  try {
    const response = await axios.get(`${BASE_URL}/oj/problems/${props.problem.id}/all`)
    const problemData = response.data.data || response.data
    initFormData(problemData)
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.error('[EditOJDialog] 获取题目详情失败:', error)
    }
    alert('获取完整题目详情失败，已加载基本信息: ' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

// 添加样例
function addSample() {
  if (!editForm.value.samples) {
    editForm.value.samples = []
  }
  editForm.value.samples.push({
    input: '',
    output: '',
    explanation: '',
    is_displayed: true,
    is_hidden: false,
    sort_order: editForm.value.samples.length + 1
  })
}

// 删除样例
function removeSample(index: number) {
  editForm.value.samples.splice(index, 1)
  // 重新排序
  editForm.value.samples.forEach((sample: any, idx: number) => {
    sample.sort_order = idx + 1
  })
}

// 更新OJ题目
async function updateOJProblem() {
  if (!props.problem?.id) {
    alert('题目ID不存在')
    return
  }

  // 构建更新数据，只包含有值的字段
  const updateData: any = {}
  
  if (editForm.value.title?.trim()) {
    updateData.title = editForm.value.title.trim()
  }
  if (editForm.value.description?.trim()) {
    updateData.description = editForm.value.description.trim()
  }
  if (editForm.value.input_format?.trim()) {
    updateData.input_format = editForm.value.input_format.trim()
  }
  if (editForm.value.output_format?.trim()) {
    updateData.output_format = editForm.value.output_format.trim()
  }
  if (editForm.value.data_range?.trim()) {
    updateData.data_range = editForm.value.data_range.trim()
  }
  if (editForm.value.analysis?.trim()) {
    updateData.analysis = editForm.value.analysis.trim()
  }
  if (editForm.value.video_url?.trim()) {
    updateData.video_url = editForm.value.video_url.trim()
  }
  if (editForm.value.time_limit) {
    updateData.time_limit = editForm.value.time_limit
  }
  if (editForm.value.memory_limit) {
    updateData.memory_limit = editForm.value.memory_limit
  }
  if (editForm.value.level) {
    updateData.level = parseInt(editForm.value.level)
  }
  if (editForm.value.category) {
    updateData.category = editForm.value.category
  }
  if (editForm.value.publish_date) {
    updateData.publish_date = editForm.value.publish_date
  }
  if (editForm.value.bank_visible !== undefined) {
    updateData.bank_visible = !!editForm.value.bank_visible
  }

  // 如果有测试样例，添加到更新数据中
  if (editForm.value.samples && editForm.value.samples.length > 0) {
    updateData.samples = editForm.value.samples
  }

  if (Object.keys(updateData).length === 0) {
    alert('请至少修改一个字段')
    return
  }

  updating.value = true
  try {
    await axios.put(`${BASE_URL}/oj/problems/${props.problem.id}`, updateData)
    
    // 显示成功提示
    successMessage.value = '题目更新成功！'
    showSuccessMessage.value = true
    
    // 通知父组件刷新列表
    emit('success')
    
    // 延迟关闭对话框
    setTimeout(() => {
      handleClose()
    }, 1500)
  } catch (error: any) {
    alert('题目更新失败: ' + (error.response?.data?.error || error.message))
  } finally {
    updating.value = false
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

// 渲染数学公式
const renderMath = (mathText: string, displayMode: boolean = false): string => {
  try {
    const cleanMathText = mathText.trim()
    return katex.renderToString(cleanMathText, {
      displayMode: displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: false,
      macros: {
        "\\f": "#1f(#2)"
      }
    })
  } catch (error) {
    console.warn('KaTeX 渲染失败:', error, '公式:', mathText)
    return `<span class="math-error">${mathText}</span>`
  }
}

// 简单的 Markdown 渲染器
const renderMarkdown = (text: string): string => {
  if (!text) return ''
  
  try {
    // Step 1: 处理长字符串换行
    let processed = text.replace(/([^\s]{50,})/g, (match) => {
      return match.replace(/(.{20})/g, '$1\u200B')
    })

    // Step 2: 提取并保护数学公式
    const mathStore: Array<{ placeholder: string; html: string; original: string }> = []
    let mathIndex = 0

    // 先处理块级数学公式 $$...$$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
      if (match.includes('__MATH_')) {
        return match
      }
      const placeholder = `__MATH_BLOCK_${mathIndex}__`
      const rendered = renderMath(content, true)
      mathStore.push({ 
        placeholder, 
        html: `<div class="math-block">${rendered}</div>`,
        original: match
      })
      mathIndex++
      return placeholder
    })

    // 再处理行内数学公式 $...$
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      if (match.includes('__MATH_')) {
        return match
      }
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return match
      }
      const placeholder = `__MATH_INLINE_${mathIndex}__`
      const rendered = renderMath(trimmedContent, false)
      mathStore.push({ 
        placeholder, 
        html: `<span class="math-inline">${rendered}</span>`,
        original: match
      })
      mathIndex++
      return placeholder
    })

    // Step 3: 基础 Markdown 处理
    // 先处理代码块（必须在换行符替换之前）
    const codeBlockStore: Array<{ placeholder: string; html: string }> = []
    let codeBlockIndex = 0
    
    // 匹配代码块：```可选语言\n代码内容\n```
    processed = processed.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`
      let html = ''
      
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value
          html = `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`
        } catch (err) {
          console.warn('代码高亮失败:', err)
          html = `<pre><code>${code.trim()}</code></pre>`
        }
      } else {
        html = `<pre><code>${code.trim()}</code></pre>`
      }
      
      codeBlockStore.push({ placeholder, html })
      codeBlockIndex++
      return placeholder
    })
    
    // 然后处理其他 Markdown 语法
    let result = processed
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // 还原代码块
    codeBlockStore.forEach(({ placeholder, html }) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(regex, html)
    })

    // Step 4: 还原数学公式
    mathStore.forEach(({ placeholder, html, original }) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(regex, html)
      const originalRegex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(originalRegex, html)
    })

    return result
  } catch (error) {
    console.error('Markdown 渲染失败:', error)
    return `<p class="render-error">渲染失败: ${error}</p>`
  }
}

// 计算属性：实时渲染预览
const renderedDescription = computed(() => renderMarkdown(editForm.value?.description || ''))
const renderedInputFormat = computed(() => renderMarkdown(editForm.value?.input_format || ''))
const renderedOutputFormat = computed(() => renderMarkdown(editForm.value?.output_format || ''))
const renderedDataRange = computed(() => renderMarkdown(editForm.value?.data_range || ''))
const renderedSamples = computed(() => {
  if (!editForm.value?.samples) return []
  return editForm.value.samples.map((sample: any) => ({
    input: sample.input,
    output: sample.output,
    explanation: renderMarkdown(sample.explanation || '')
  }))
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog-container {
  background: white;
  border-radius: 18px;
  padding: 24px;
  max-width: 1800px;
  width: 98%;
  max-height: 95vh;
  box-shadow: 0 6px 24px -4px rgba(30,144,255,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.03);
  animation: dialogSlideIn 0.3s ease-out;
  position: relative;
  border: 1.5px solid #b6e0fe;
  display: flex;
  flex-direction: column;
}

@keyframes dialogSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(-20px);}
  to { opacity: 1; transform: scale(1) translateY(0);}
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 12px;
  margin: -24px -24px 20px -24px;
}

.dialog-icon {
  font-size: 32px;
}

.dialog-title {
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  font-size: 28px;
  color: white;
  cursor: pointer;
  margin-left: auto;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  margin-bottom: 16px;
  min-width: 200px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid #b6e0fe;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.3s ease;
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.form-note {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  border: 1.5px solid #fbbf24;
  margin-top: 20px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.form-note i {
  color: #f59e0b;
  font-size: 20px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #e2e8f0;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
  transform: translateY(-1px);
}

.samples-section {
  margin-top: 24px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header label {
  font-weight: 600;
  color: #374151;
  font-size: 16px;
}

.btn-secondary-small {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary-small:hover {
  background: #e2e8f0;
  color: #475569;
  transform: translateY(-1px);
}

.sample-item {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.sample-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1.5px solid #e2e8f0;
}

.sample-header h4 {
  margin: 0;
  color: #f59e0b;
  font-size: 16px;
  font-weight: 600;
}

.btn-remove {
  background: #ef4444;
  color: white;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-remove:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #f59e0b;
  cursor: pointer;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1.5px solid #fbbf24;
  border-radius: 8px;
  margin-bottom: 16px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.loading-indicator i {
  color: #f59e0b;
  font-size: 16px;
}

.debug-info {
  margin-bottom: 16px;
  padding: 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 12px;
}

.debug-info summary {
  cursor: pointer;
  font-weight: 600;
  color: #6b7280;
  user-select: none;
}

.debug-info summary:hover {
  color: #374151;
}

.debug-info pre {
  margin: 8px 0 0 0;
  padding: 8px;
  background: #1f2937;
  color: #10b981;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.4;
}

.error-info {
  padding: 16px;
  background: #fee2e2;
  border: 1.5px solid #ef4444;
  border-radius: 8px;
  color: #991b1b;
  font-weight: 600;
  margin-bottom: 16px;
}

/* 左右分栏容器 */
.edit-preview-container {
  display: flex;
  gap: 24px;
  height: 100%;
  min-height: 0;
}

/* 左侧编辑区 */
.edit-panel {
  flex: 1;
  overflow-y: auto;
  padding-right: 12px;
  min-width: 0;
}

/* 隐藏编辑区滚动条 */
.edit-panel::-webkit-scrollbar {
  width: 6px;
}

.edit-panel::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.edit-panel::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.edit-panel::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 右侧预览区 */
.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
  border-radius: 12px;
  border: 2px solid #e0f2fe;
  overflow: hidden;
  min-width: 0;
}

.preview-sticky-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 16px 20px;
  border-bottom: 2px solid #e0f2fe;
  position: sticky;
  top: 0;
  z-index: 10;
}

.preview-sticky-header h4 {
  margin: 0;
  color: white;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* 隐藏预览区滚动条 */
.preview-content::-webkit-scrollbar {
  width: 6px;
}

.preview-content::-webkit-scrollbar-track {
  background: #f0f9ff;
  border-radius: 3px;
}

.preview-content::-webkit-scrollbar-thumb {
  background: #bae6fd;
  border-radius: 3px;
}

.preview-content::-webkit-scrollbar-thumb:hover {
  background: #7dd3fc;
}

/* 预览区段落样式 */
.preview-section {
  background: white;
  border-radius: 16px;
  margin-bottom: 20px;
  overflow: hidden;
  border: 2px solid #e0f2fe;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.08);
}

.preview-section:last-child {
  margin-bottom: 0;
}

.preview-section-header {
  background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
  padding: 12px 20px;
  border-bottom: 1px solid #bae6fd;
}

.preview-section-header h5 {
  margin: 0;
  color: #0c4a6e;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-section-content {
  padding: 20px;
  background: white;
}

/* 样例预览样式 */
.sample-preview {
  margin-bottom: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.sample-preview:last-child {
  margin-bottom: 0;
}

.sample-block {
  margin-bottom: 12px;
}

.sample-block:last-child {
  margin-bottom: 0;
}

.sample-label {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
}

.sample-code {
  margin: 0;
  padding: 12px 16px;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border: 1px solid #bae6fd;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #0c4a6e;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.sample-explanation {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

/* 空状态 */
.preview-empty {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.preview-empty i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.preview-empty p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

/* Markdown 内容样式 - 复用 SmartOJView 的样式 */
.markdown-content {
  line-height: 1.8;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 15px;
  color: #374151;
}

.markdown-content strong,
.markdown-content b {
  color: #1e293b;
  font-weight: 700;
}

.markdown-content em,
.markdown-content i {
  font-style: italic;
  color: #475569;
}

.markdown-content code {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #dc2626;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
  font-weight: 600;
  border: 1px solid #cbd5e1;
}

.markdown-content pre {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.markdown-content pre code {
  background: none;
  color: #374151;
  padding: 0;
  border: none;
  font-weight: normal;
  display: block;
}

/* 数学公式样式 */
.markdown-content .math-inline {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #bae6fd;
  display: inline-block;
  margin: 0 2px;
}

.markdown-content .math-block {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 16px;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
  text-align: center;
  margin: 12px 0;
}

.markdown-content .math-error {
  background: #fee2e2;
  color: #dc2626;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #fecaca;
  font-family: monospace;
}

.markdown-content .render-error {
  color: #dc2626;
  background: #fee2e2;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

/* Highlight.js 样式 */
.hljs {
  background: transparent;
  color: #374151;
}

.hljs-comment {
  color: #64748b;
  font-style: italic;
}

.hljs-keyword {
  color: #dc2626;
  font-weight: 700;
}

.hljs-string {
  color: #059669;
  font-weight: 500;
}

.hljs-number {
  color: #7c3aed;
  font-weight: 600;
}

.hljs-title {
  color: #7c3aed;
  font-weight: 700;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .edit-preview-container {
    flex-direction: column;
  }
  
  .preview-panel {
    max-height: 400px;
  }
}
</style>

