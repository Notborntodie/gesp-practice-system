<template>
    <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
      <div class="dialog-container" @click.stop>
        <div class="dialog-header">
          <div class="dialog-icon">💻</div>
          <h3 class="dialog-title">SmartOJ 题目上传</h3>
          <button @click="handleClose" class="close-btn">×</button>
        </div>
        <div class="dialog-content">
          <div class="upload-mode-toggle">
            <button type="button" class="btn btn-secondary" :class="{ active: uploadMode === 'json' }" @click="uploadMode = 'json'">
              JSON 上传
            </button>
            <button type="button" class="btn btn-secondary" :class="{ active: uploadMode === 'form' }" @click="uploadMode = 'form'">
              表单上传
            </button>
          </div>

          <form v-if="uploadMode === 'form'" @submit.prevent="uploadOJProblem" class="question-form">
            <!-- 基本信息 -->
            <div class="form-row">
              <div class="form-group">
                <label>题目标题：<span class="required">*</span></label>
                <input v-model="problem.title" required placeholder="如：两数之和" />
              </div>
              <div class="form-group">
                <label>分类：</label>
                <select v-model="problem.category">
                  <option value="">请选择分类</option>
                  <option v-for="type in allQuestionTypes" :key="type.name" :value="type.name">
                    {{ type.display_name || type.name }}
                  </option>
                </select>
              </div>
              <div class="form-group" v-if="problem.category === 'GESP'">
                <label>GESP 等级：<span class="required">*</span></label>
                <select v-model="problem.level" required>
                  <option value="1">GESP 1级</option>
                  <option value="2">GESP 2级</option>
                  <option value="3">GESP 3级</option>
                  <option value="4">GESP 4级</option>
                  <option value="5">GESP 5级</option>
                  <option value="6">GESP 6级</option>
                </select>
              </div>
            </div>
  
            <div class="form-group">
              <label>题目描述：<span class="required">*</span></label>
              <textarea v-model="problem.description" required placeholder="详细描述题目要求..." rows="6"></textarea>
            </div>
  
            <div class="form-group">
              <label>输入格式：<span class="required">*</span></label>
              <textarea v-model="problem.input_format" required placeholder="如：**第一行**：两个整数 n 和 target" rows="4"></textarea>
            </div>
  
            <div class="form-group">
              <label>输出格式：<span class="required">*</span></label>
              <textarea v-model="problem.output_format" required placeholder="如：**一行**：两个整数，表示数组下标" rows="4"></textarea>
            </div>
  
            <div class="form-group">
              <label>数据范围：</label>
              <textarea v-model="problem.data_range" placeholder="如：2 ≤ n ≤ 1000" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>视频讲解链接：</label>
              <input v-model="problem.video_url" placeholder="如：https://example.com/video.mp4" />
            </div>

            <!-- 限制条件 -->
            <div class="form-row">
              <div class="form-group">
                <label>时间限制 (ms)：</label>
                <input v-model.number="problem.time_limit" type="number" placeholder="如：1000" />
              </div>
              <div class="form-group">
                <label>内存限制 (MB)：</label>
                <input v-model.number="problem.memory_limit" type="number" placeholder="如：256" />
              </div>
              <div class="form-group">
                <label>发布日期：</label>
                <input v-model="problem.publish_date" type="date" />
              </div>
            </div>
  
            <!-- 测试样例 -->
            <div class="samples-section">
              <div class="section-header">
                <label>测试样例：</label>
                <button type="button" @click="addSample" class="btn btn-secondary">添加样例</button>
              </div>
              
              <div v-for="(sample, index) in problem.samples" :key="index" class="sample-item">
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
                      <input type="checkbox" v-model="sample.is_hidden" />
                      隐藏样例（用于评测）
                    </label>
                  </div>
                  <div class="form-group">
                    <label>排序：</label>
                    <input v-model.number="sample.sort_order" type="number" placeholder="显示顺序" />
                  </div>
                </div>
              </div>
            </div>

          </form>

          <div v-else class="json-upload">
            <div class="form-group">
              <label>
                OJ 题目 JSON 模版：<span class="required">*</span>
                <span class="json-hint">直接复制/编辑此 JSON，然后点击“上传题目”。</span>
              </label>
              <textarea v-model="jsonText" required rows="16" class="json-textarea"></textarea>
            </div>

            <div v-if="jsonError" class="json-error">
              {{ jsonError }}
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="handleClose" class="btn btn-secondary">取消</button>
          <button @click="uploadOJProblem" class="btn btn-primary" :disabled="uploading">
            {{ uploading ? '上传中...' : '上传题目' }}
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

  import { ref, onMounted } from 'vue'
  import axios from 'axios'
  import SuccessMessageDialog from './SuccessMessageDialog.vue'
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
  const uploadMode = ref<'json' | 'form'>('json')
  
  // 成功提示相关
  const showSuccessMessage = ref(false)
  const successMessage = ref('')
  const jsonError = ref('')
  const todayStr = new Date().toISOString().split('T')[0]

  function getJsonTemplate() {
    // 注意：字段名需要与后端 `/api/oj/upload` 一致
    return JSON.stringify(
      {
        title: '两数之和',
        description: '题目描述：给定两个整数，输出它们的和。',
        input_format: '一行包含两个整数 a 和 b。',
        output_format: '一行输出 a+b。',
        data_range: '-10^9 <= a,b <= 10^9',
        video_url: '',
        time_limit: 1000,
        memory_limit: 256,
        level: 3,
        publish_date: todayStr,
        bank_visible: true,
        samples: [
          {
            input: '1 2',
            output: '3',
            explanation: '',
            is_hidden: false,
            is_displayed: true,
            sort_order: 1
          }
        ]
      },
      null,
      2
    )
  }

  const jsonText = ref(getJsonTemplate())
  
  const problem = ref({
    title: '',
    description: '',
    input_format: '',
    output_format: '',
    data_range: '',
    video_url: '',
    time_limit: 1000,
    memory_limit: 256,
    level: '3',
    category: 'GESP',
    publish_date: todayStr,
    bank_visible: 1,
    samples: [] as any[]
  })

  function applyJsonToProblem() {
    jsonError.value = ''
    let data: any = null
    try {
      data = JSON.parse(jsonText.value)
    } catch (e: any) {
      jsonError.value = 'JSON 解析失败：' + (e?.message || String(e))
      return false
    }

    if (!data || typeof data !== 'object') {
      jsonError.value = 'JSON 顶层必须是对象'
      return false
    }

    const samples = data.samples
    if (!Array.isArray(samples) || samples.length === 0) {
      jsonError.value = 'samples 必须是非空数组'
      return false
    }

    // 将数值转换成字符串，避免后端校验中把 0 当成缺失
    const normalizedSamples = samples.map((s: any, idx: number) => {
      const input = s?.input ?? ''
      const output = s?.output ?? ''
      return {
        input: String(input),
        output: String(output),
        explanation: s?.explanation ?? '',
        is_hidden: !!s?.is_hidden,
        is_displayed: s?.is_displayed === undefined ? true : !!s?.is_displayed,
        sort_order: s?.sort_order ?? idx + 1
      }
    })

    // 后端要求这些字段至少要非空
    const requiredFields = ['title', 'description', 'input_format', 'output_format']
    for (const k of requiredFields) {
      if (data[k] === undefined || data[k] === null || data[k] === '') {
        jsonError.value = `缺少必要字段：${k}`
        return false
      }
    }

    problem.value = {
      title: String(data.title),
      description: String(data.description),
      input_format: String(data.input_format),
      output_format: String(data.output_format),
      data_range: data.data_range ? String(data.data_range) : '',
      video_url: data.video_url ? String(data.video_url) : '',
      time_limit: Number(data.time_limit ?? 1000),
      memory_limit: Number(data.memory_limit ?? 256),
      category: data.category || 'GESP',
      level: data.level ? String(data.level) : '',
      publish_date: data.publish_date ? String(data.publish_date) : todayStr,
      bank_visible: data.bank_visible === undefined ? 1 : (data.bank_visible ? 1 : 0),
      samples: normalizedSamples
    }

    return true
  }
  
  // 添加样例
  function addSample() {
    problem.value.samples.push({
      input: '',
      output: '',
      explanation: '',
      is_hidden: false,
      sort_order: problem.value.samples.length + 1
    })
  }
  
  // 删除样例
  function removeSample(index: number) {
    problem.value.samples.splice(index, 1)
    // 重新排序
    problem.value.samples.forEach((sample, idx) => {
      sample.sort_order = idx + 1
    })
  }
  
  // 上传OJ题目
  async function uploadOJProblem() {
    if (uploadMode.value === 'json') {
      const ok = applyJsonToProblem()
      if (!ok) return
      if (!problem.value.samples || problem.value.samples.length === 0) {
        alert('请至少提供一个测试样例')
        return
      }
    }

    if (!problem.value.title || !problem.value.description || 
        !problem.value.input_format || !problem.value.output_format) {
      alert('请填写必填字段（标题、描述、输入格式、输出格式）')
      return
    }
  
    if (problem.value.samples.length === 0) {
      alert('请至少添加一个测试样例')
      return
    }
  
    uploading.value = true
    try {
      const response = await axios.post(`${BASE_URL}/oj/upload`, {
        ...problem.value,
        level: problem.value.category === 'GESP' ? parseInt(problem.value.level) : null
      })
      
      // 显示成功提示
      successMessage.value = `题目上传成功！题目ID: ${response.data.data.problem_id}，共创建 ${response.data.data.sample_count} 个测试样例`
      showSuccessMessage.value = true
      
      // 重置表单
      resetForm()
      
      // 通知父组件刷新列表
      emit('success')
      
      // 延迟关闭对话框
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (error: any) {
      alert('题目上传失败: ' + (error.response?.data?.error || error.message))
    } finally {
      uploading.value = false
    }
  }
  
  function resetForm() {
    problem.value = {
      title: '',
      description: '',
      input_format: '',
      output_format: '',
      data_range: '',
      video_url: '',
      time_limit: 1000,
      memory_limit: 256,
      category: 'GESP',
      level: '3',
      publish_date: todayStr,
      bank_visible: 1,
      samples: []
    }
    jsonText.value = getJsonTemplate()
    jsonError.value = ''
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
    max-width: 800px;
    width: 95%;
    max-height: 90vh;
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
    background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
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
    border-color: #1e90ff;
    box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.2);
  }
  
  .code-textarea {
    font-family: 'Courier New', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
    background-color: #1e293b;
    color: #f8fafc;
    border: 1.5px solid #475569;
    border-radius: 10px;
    padding: 16px;
    resize: vertical;
    min-height: 200px;
  }
  
  .code-hint {
    margin-top: 8px;
    color: #64748b;
    font-size: 12px;
  }
  
  .image-preview {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .image-preview img {
    max-width: 200px;
    max-height: 150px;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
  }
  
  .btn-remove-image {
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
  
  .btn-remove-image:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }
  
  .options-section {
    margin-bottom: 20px;
  }
  
  .options-section label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
  }
  
  .option-item {
    margin-bottom: 12px;
    padding: 16px;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
  }
  
  .option-inputs {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .option-label,
  .option-value,
  .option-text {
    padding: 8px 12px;
    border: 1.5px solid #b6e0fe;
    border-radius: 6px;
    font-size: 14px;
    background: white;
  }
  
  .option-label {
    width: 60px;
    text-align: center;
  }
  
  .option-value {
    width: 80px;
    text-align: center;
  }
  
  .option-text {
    flex: 1;
    min-width: 150px;
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
  
  .knowledge-points-selection {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .kp-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #374151;
    padding: 8px 12px;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 6px;
    transition: all 0.2s ease;
    cursor: pointer;
  }
  
  .kp-checkbox:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
  
  .kp-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #1e90ff;
  }
  
  .required {
    color: #ef4444;
    margin-left: 4px;
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
    color: #1e90ff;
    font-size: 16px;
    font-weight: 600;
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
    accent-color: #1e90ff;
    cursor: pointer;
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
    background: #1e90ff;
    color: white;
    border: none;
  }
  
  .btn-primary:hover {
    background: #1976d2;
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
  </style>
 