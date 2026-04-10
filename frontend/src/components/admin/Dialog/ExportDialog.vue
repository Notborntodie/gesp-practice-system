<template>
  <div v-if="visible" class="modal-overlay" @click="handleCancel">
    <div class="export-dialog" @click.stop>
      <div class="dialog-header">
        <h3>导出考试为Word文档</h3>
        <button @click="handleCancel" class="close-btn">×</button>
      </div>
      
      <div class="dialog-content">
        <div class="exam-info">
          <h4>{{ exam?.name }}</h4>
          <p>{{ getLevelText(exam?.level) }} - {{ getTypeText(exam?.type) }}</p>
          <div class="exam-stats">
            <span class="stat">题目数量: {{ exam?.questions?.length || exam?.total_questions || 0 }}</span>
            <span class="stat">创建时间: {{ formatDate(exam?.created_at) }}</span>
          </div>
        </div>
        
        <div class="export-options">
          <h5>选择导出格式：</h5>
          <div class="option-group">
            <label class="option-item" :class="{ 'selected': exportOptions.withAnswers }">
              <input 
                type="checkbox" 
                v-model="exportOptions.withAnswers"
                class="checkbox-input"
              />
              <div class="option-content">
                <span class="checkbox-label">真题（含解析）</span>
                <span class="option-description">包含题目、选项和详细解析</span>
              </div>
            </label>
            <label class="option-item" :class="{ 'selected': exportOptions.withoutAnswers }">
              <input 
                type="checkbox" 
                v-model="exportOptions.withoutAnswers"
                class="checkbox-input"
              />
              <div class="option-content">
                <span class="checkbox-label">真题（不含解析）</span>
                <span class="option-description">仅包含题目和选项，适合练习</span>
              </div>
            </label>
            <label class="option-item" :class="{ 'selected': exportOptions.answerOnly }">
              <input 
                type="checkbox" 
                v-model="exportOptions.answerOnly"
                class="checkbox-input"
              />
              <div class="option-content">
                <span class="checkbox-label">纯答案版本</span>
                <span class="option-description">包含答案表格和解析，方便批改</span>
              </div>
            </label>
          </div>
        </div>

        <div class="export-preview">
          <h5>导出预览：</h5>
          <div class="preview-content">
            <div v-if="exportOptions.withAnswers" class="preview-item" :class="{ 'editing': isEditingFilename && editingType === 'withAnswers' }">
              <span class="preview-icon">📄</span>
              <div v-if="!isEditingFilename || editingType !== 'withAnswers'" class="preview-text-container" @click="startEditFilename('withAnswers')">
                <span class="preview-text">{{ getPreviewFilename('withAnswers') }}</span>
                <span class="edit-hint">点击编辑</span>
              </div>
              <div v-else class="filename-edit-container">
                <input 
                  v-model="customFilenames[editingType]"
                  type="text"
                  class="filename-edit-input"
                  @blur="confirmEditFilename"
                  @keyup.enter="confirmEditFilename"
                  @keyup.escape="cancelEditFilename"
                  maxlength="100"
                  ref="filenameInput"
                />
                <div class="edit-actions">
                  <button @click="confirmEditFilename" class="edit-btn confirm-btn">✓</button>
                  <button @click="cancelEditFilename" class="edit-btn cancel-btn">✗</button>
                </div>
              </div>
            </div>
            <div v-if="exportOptions.withoutAnswers" class="preview-item" :class="{ 'editing': isEditingFilename && editingType === 'withoutAnswers' }">
              <span class="preview-icon">📄</span>
              <div v-if="!isEditingFilename || editingType !== 'withoutAnswers'" class="preview-text-container" @click="startEditFilename('withoutAnswers')">
                <span class="preview-text">{{ getPreviewFilename('withoutAnswers') }}</span>
                <span class="edit-hint">点击编辑</span>
              </div>
              <div v-else class="filename-edit-container">
                <input 
                  v-model="customFilenames[editingType]"
                  type="text"
                  class="filename-edit-input"
                  @blur="confirmEditFilename"
                  @keyup.enter="confirmEditFilename"
                  @keyup.escape="cancelEditFilename"
                  maxlength="100"
                  ref="filenameInput"
                />
                <div class="edit-actions">
                  <button @click="confirmEditFilename" class="edit-btn confirm-btn">✓</button>
                  <button @click="cancelEditFilename" class="edit-btn cancel-btn">✗</button>
                </div>
              </div>
            </div>
            <div v-if="exportOptions.answerOnly" class="preview-item" :class="{ 'editing': isEditingFilename && editingType === 'answerOnly' }">
              <span class="preview-icon">📄</span>
              <div v-if="!isEditingFilename || editingType !== 'answerOnly'" class="preview-text-container" @click="startEditFilename('answerOnly')">
                <span class="preview-text">{{ getPreviewFilename('answerOnly') }}</span>
                <span class="edit-hint">点击编辑</span>
              </div>
              <div v-else class="filename-edit-container">
                <input 
                  v-model="customFilenames[editingType]"
                  type="text"
                  class="filename-edit-input"
                  @blur="confirmEditFilename"
                  @keyup.enter="confirmEditFilename"
                  @keyup.escape="cancelEditFilename"
                  maxlength="100"
                  ref="filenameInput"
                />
                <div class="edit-actions">
                  <button @click="confirmEditFilename" class="edit-btn confirm-btn">✓</button>
                  <button @click="cancelEditFilename" class="edit-btn cancel-btn">✗</button>
                </div>
              </div>
            </div>
            <div v-if="!exportOptions.withAnswers && !exportOptions.withoutAnswers && !exportOptions.answerOnly" class="preview-placeholder">
              请选择至少一种导出格式
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button @click="handleCancel" class="btn btn-cancel">取消</button>
        <button 
          @click="handleConfirm" 
          class="btn btn-confirm"
          :disabled="!exportOptions.withAnswers && !exportOptions.withoutAnswers && !exportOptions.answerOnly"
        >
          导出
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

// Props
interface Props {
  visible: boolean
  exam: any
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  confirm: [options: { withAnswers: boolean; withoutAnswers: boolean; answerOnly: boolean; customFilenames?: { withAnswers?: string; withoutAnswers?: string; answerOnly?: string } }]
  cancel: []
}>()

// 响应式数据
const exportOptions = ref({
  withAnswers: false,
  withoutAnswers: false,
  answerOnly: false
})

const customFilenames = ref({
  withAnswers: '',
  withoutAnswers: '',
  answerOnly: ''
})
const isEditingFilename = ref(false)
const editingType = ref<'withAnswers' | 'withoutAnswers' | 'answerOnly' | null>(null)

// 监听弹窗显示状态，重置选项
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    exportOptions.value = {
      withAnswers: false,
      withoutAnswers: false,
      answerOnly: false
    }
    customFilenames.value = {
      withAnswers: '',
      withoutAnswers: '',
      answerOnly: ''
    }
    isEditingFilename.value = false
    editingType.value = null
  }
})

// 方法
function handleConfirm() {
  if (!exportOptions.value.withAnswers && !exportOptions.value.withoutAnswers && !exportOptions.value.answerOnly) {
    return
  }
  
  // 直接触发导出事件，由父组件处理实际的导出逻辑
  emit('confirm', { 
    ...exportOptions.value,
    customFilenames: {
      withAnswers: customFilenames.value.withAnswers.trim() || undefined,
      withoutAnswers: customFilenames.value.withoutAnswers.trim() || undefined,
      answerOnly: customFilenames.value.answerOnly.trim() || undefined
    }
  })
}

function handleCancel() {
  emit('cancel')
}

// 开始编辑文件名
function startEditFilename(type: 'withAnswers' | 'withoutAnswers' | 'answerOnly') {
  isEditingFilename.value = true
  editingType.value = type
  // 如果还没有自定义文件名，使用完整的预览文件名
  if (!customFilenames.value[type].trim()) {
    customFilenames.value[type] = getPreviewFilename(type).replace('.docx', '') // 移除.docx后缀，让用户编辑
  }
  // 下一帧聚焦输入框
  nextTick(() => {
    const input = document.querySelector('.filename-edit-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 确认编辑文件名
function confirmEditFilename() {
  isEditingFilename.value = false
  editingType.value = null
}

// 取消编辑文件名
function cancelEditFilename() {
  if (editingType.value) {
    customFilenames.value[editingType.value] = '' // 清空当前编辑的文件名
  }
  isEditingFilename.value = false
  editingType.value = null
}

function getLevelText(level: number) {
  return `GESP ${level}级`
}

function getTypeText(type: string) {
  return type || '真题'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0]
}

// 计算预览文件名
function getPreviewFilename(type: 'withAnswers' | 'withoutAnswers' | 'answerOnly'): string {
  // 如果有自定义文件名，直接使用（添加.docx后缀）
  if (customFilenames.value[type].trim()) {
    const filename = customFilenames.value[type].trim()
    // 如果已经包含.docx后缀，直接返回
    if (filename.endsWith('.docx')) {
      return filename
    }
    // 否则添加.docx后缀
    return `${filename}.docx`
  }
  
  // 没有自定义文件名时，使用默认格式
  const baseName = props.exam?.name || '考试'
  let suffix = ''
  if (type === 'withAnswers') suffix = '含解析'
  else if (type === 'withoutAnswers') suffix = '不含解析'
  else if (type === 'answerOnly') suffix = '纯答案'
  const date = getCurrentDate()
  return `${baseName}_${suffix}_${date}.docx`
}
</script>

<style scoped>
/* 导出弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.export-dialog {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 550px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #87ceeb 0%, #1e90ff 100%);
  color: white;
  border-radius: 16px 16px 0 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.dialog-content {
  padding: 24px;
}

.exam-info {
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
  border-radius: 12px;
  border: 1px solid #b6e0fe;
}

.exam-info h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.exam-info p {
  margin: 0 0 12px 0;
  color: #64748b;
  font-size: 14px;
}

.exam-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat {
  background: rgba(30, 144, 255, 0.1);
  color: #1e90ff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.export-options {
  margin-bottom: 24px;
}

.export-options h5 {
  margin: 0 0 16px 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.option-item:hover {
  background: #f1f5f9;
  border-color: #b6e0fe;
}

.option-item.selected {
  background: linear-gradient(135deg, #e0f2fe 0%, #b6e0fe 100%);
  border-color: #1e90ff;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.15);
}

.checkbox-input {
  width: 20px;
  height: 20px;
  accent-color: #1e90ff;
  cursor: pointer;
  margin-top: 2px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.checkbox-label {
  font-size: 15px;
  color: #374151;
  font-weight: 600;
  cursor: pointer;
}

.option-description {
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
}


.export-preview {
  margin-bottom: 24px;
}

.export-preview h5 {
  margin: 0 0 12px 0;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.preview-content {
  background: #f9fafb;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.preview-item:hover {
  border-color: #1e90ff;
  background: #f8fafc;
}

.preview-item.editing {
  border-color: #1e90ff;
  background: #f0f9ff;
  box-shadow: 0 0 0 2px rgba(30, 144, 255, 0.1);
}

.preview-text-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
}

.preview-text-container:hover .edit-hint {
  opacity: 1;
}

.edit-hint {
  font-size: 11px;
  color: #1e90ff;
  opacity: 0;
  transition: opacity 0.2s ease;
  font-style: italic;
}

.filename-edit-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.filename-edit-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #1e90ff;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  font-family: monospace;
}

.filename-edit-input:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 2px rgba(30, 144, 255, 0.2);
}

.edit-actions {
  display: flex;
  gap: 4px;
}

.edit-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.confirm-btn {
  background: #10b981;
  color: white;
}

.confirm-btn:hover {
  background: #059669;
}

.cancel-btn {
  background: #ef4444;
  color: white;
}

.cancel-btn:hover {
  background: #dc2626;
}

.preview-icon {
  font-size: 16px;
}

.preview-text {
  font-size: 13px;
  color: #374151;
  font-family: monospace;
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px 24px;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-cancel:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.btn-confirm {
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(30, 144, 255, 0.4);
}

.btn-confirm:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}


/* 响应式设计 */
@media (max-width: 768px) {
  .export-dialog {
    width: 95%;
    max-width: none;
  }
  
  .dialog-content {
    padding: 16px;
  }
  
  .exam-info {
    padding: 16px;
  }
  
  .exam-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .option-item {
    padding: 12px;
  }
  
  .dialog-footer {
    padding: 12px 16px 16px 16px;
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
