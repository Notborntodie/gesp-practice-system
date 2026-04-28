<template>
  <AppDialog
    v-model:show="dialogVisible"
    title="导出考试为Word文档"
    width="550"
    :show-footer="false"
  >
    <!-- Exam Info -->
    <div class="exam-info">
      <h4>{{ exam?.name }}</h4>
      <p>{{ getLevelText(exam?.level) }} - {{ getTypeText(exam?.type) }}</p>
      <div class="exam-stats">
        <AppTag type="info" size="sm">题目数量: {{ exam?.questions?.length || exam?.total_questions || 0 }}</AppTag>
        <AppTag type="default" size="sm">创建时间: {{ formatDate(exam?.created_at) }}</AppTag>
      </div>
    </div>

    <!-- Export Options -->
    <div class="export-options">
      <h5>选择导出格式</h5>
      <div class="option-group">
        <label class="option-item" :class="{ selected: exportOptions.withAnswers }">
          <input
            type="checkbox"
            v-model="exportOptions.withAnswers"
            class="checkbox-input"
          />
          <div class="option-content">
            <span class="option-label">真题（含解析）</span>
            <span class="option-desc">包含题目、选项和详细解析</span>
          </div>
        </label>
        <label class="option-item" :class="{ selected: exportOptions.withoutAnswers }">
          <input
            type="checkbox"
            v-model="exportOptions.withoutAnswers"
            class="checkbox-input"
          />
          <div class="option-content">
            <span class="option-label">真题（不含解析）</span>
            <span class="option-desc">仅包含题目和选项，适合练习</span>
          </div>
        </label>
        <label class="option-item" :class="{ selected: exportOptions.answerOnly }">
          <input
            type="checkbox"
            v-model="exportOptions.answerOnly"
            class="checkbox-input"
          />
          <div class="option-content">
            <span class="option-label">纯答案版本</span>
            <span class="option-desc">包含答案表格和解析，方便批改</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Export Preview -->
    <div class="export-preview">
      <h5>导出预览</h5>
      <div class="preview-content">
        <div
          v-if="exportOptions.withAnswers"
          class="preview-item"
          :class="{ editing: isEditingFilename && editingType === 'withAnswers' }"
        >
          <FileText :size="16" class="preview-icon" />
          <div
            v-if="!isEditingFilename || editingType !== 'withAnswers'"
            class="preview-text-container"
            @click="startEditFilename('withAnswers')"
          >
            <span class="preview-text">{{ getPreviewFilename('withAnswers') }}</span>
            <span class="edit-hint">点击编辑</span>
          </div>
          <div v-else class="filename-edit-container">
            <AppInput
              v-model="customFilenames[editingType]"
              size="sm"
              @blur="confirmEditFilename"
              @keyup.enter="confirmEditFilename"
              @keyup.escape="cancelEditFilename"
            />
            <div class="edit-actions">
              <AppButton variant="ghost" size="sm" @click="confirmEditFilename">
                <Check :size="14" />
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="cancelEditFilename">
                <X :size="14" />
              </AppButton>
            </div>
          </div>
        </div>

        <div
          v-if="exportOptions.withoutAnswers"
          class="preview-item"
          :class="{ editing: isEditingFilename && editingType === 'withoutAnswers' }"
        >
          <FileText :size="16" class="preview-icon" />
          <div
            v-if="!isEditingFilename || editingType !== 'withoutAnswers'"
            class="preview-text-container"
            @click="startEditFilename('withoutAnswers')"
          >
            <span class="preview-text">{{ getPreviewFilename('withoutAnswers') }}</span>
            <span class="edit-hint">点击编辑</span>
          </div>
          <div v-else class="filename-edit-container">
            <AppInput
              v-model="customFilenames[editingType]"
              size="sm"
              @blur="confirmEditFilename"
              @keyup.enter="confirmEditFilename"
              @keyup.escape="cancelEditFilename"
            />
            <div class="edit-actions">
              <AppButton variant="ghost" size="sm" @click="confirmEditFilename">
                <Check :size="14" />
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="cancelEditFilename">
                <X :size="14" />
              </AppButton>
            </div>
          </div>
        </div>

        <div
          v-if="exportOptions.answerOnly"
          class="preview-item"
          :class="{ editing: isEditingFilename && editingType === 'answerOnly' }"
        >
          <FileText :size="16" class="preview-icon" />
          <div
            v-if="!isEditingFilename || editingType !== 'answerOnly'"
            class="preview-text-container"
            @click="startEditFilename('answerOnly')"
          >
            <span class="preview-text">{{ getPreviewFilename('answerOnly') }}</span>
            <span class="edit-hint">点击编辑</span>
          </div>
          <div v-else class="filename-edit-container">
            <AppInput
              v-model="customFilenames[editingType]"
              size="sm"
              @blur="confirmEditFilename"
              @keyup.enter="confirmEditFilename"
              @keyup.escape="cancelEditFilename"
            />
            <div class="edit-actions">
              <AppButton variant="ghost" size="sm" @click="confirmEditFilename">
                <Check :size="14" />
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="cancelEditFilename">
                <X :size="14" />
              </AppButton>
            </div>
          </div>
        </div>

        <div v-if="!exportOptions.withAnswers && !exportOptions.withoutAnswers && !exportOptions.answerOnly" class="preview-placeholder">
          请选择至少一种导出格式
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dialog-footer">
      <AppButton variant="ghost" @click="handleCancel">取消</AppButton>
      <AppButton
        variant="primary"
        :disabled="!exportOptions.withAnswers && !exportOptions.withoutAnswers && !exportOptions.answerOnly"
        @click="handleConfirm"
      >
        导出
      </AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'

// Lucide Icons
import { FileText, Check, X } from 'lucide-vue-next'

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

// Dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: () => emit('cancel')
})

// Reactive data
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

// Reset on dialog open
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

// Methods
function handleConfirm() {
  if (!exportOptions.value.withAnswers && !exportOptions.value.withoutAnswers && !exportOptions.value.answerOnly) {
    return
  }

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

// Filename editing
function startEditFilename(type: 'withAnswers' | 'withoutAnswers' | 'answerOnly') {
  isEditingFilename.value = true
  editingType.value = type
  if (!customFilenames.value[type].trim()) {
    customFilenames.value[type] = getPreviewFilename(type).replace('.docx', '')
  }
  nextTick(() => {
    const input = document.querySelector('.filename-edit-container input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function confirmEditFilename() {
  isEditingFilename.value = false
  editingType.value = null
}

function cancelEditFilename() {
  if (editingType.value) {
    customFilenames.value[editingType.value] = ''
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
  return new Date(dateStr).toLocaleDateString()
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0]
}

function getPreviewFilename(type: 'withAnswers' | 'withoutAnswers' | 'answerOnly'): string {
  if (customFilenames.value[type].trim()) {
    const filename = customFilenames.value[type].trim()
    if (filename.endsWith('.docx')) {
      return filename
    }
    return `${filename}.docx`
  }

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
.exam-info {
  padding: var(--space-4);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.exam-info h4 {
  margin: 0 0 var(--space-2);
  color: var(--color-foreground);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.exam-info p {
  margin: 0 0 var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.exam-stats {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.export-options {
  margin-bottom: var(--space-4);
}

.export-options h5 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.option-item:hover {
  background: var(--color-muted);
  border-color: var(--color-primary-light);
}

.option-item.selected {
  background: var(--color-primary-lightest);
  border-color: var(--color-primary);
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  cursor: pointer;
  margin-top: 2px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.option-label {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  font-weight: 500;
}

.option-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.export-preview {
  margin-bottom: var(--space-4);
}

.export-preview h5 {
  margin: 0 0 var(--space-2);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.preview-content {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  min-height: 60px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.preview-item:hover {
  border-color: var(--color-primary-light);
}

.preview-item.editing {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.preview-icon {
  color: var(--color-primary);
}

.preview-text-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1;
}

.preview-text-container:hover .edit-hint {
  opacity: 1;
}

.preview-text {
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  font-family: monospace;
}

.edit-hint {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.filename-edit-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.edit-actions {
  display: flex;
  gap: var(--space-1);
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .exam-stats {
    flex-direction: column;
    gap: var(--space-1);
  }
}
</style>