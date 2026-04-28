<template>
  <div class="oj-samples-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBackToEditor">
        <ArrowLeft :size="16" />
        返回题目编辑
      </AppButton>
      <h2 class="editor-title">评测样例 #{{ problemId }}</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="saving" :loading="saving" @click="saveSamples">
          <Save :size="16" />
          保存
        </AppButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-wrap">
      <div class="loading-spinner"></div>
      <p>加载样例...</p>
    </div>

    <!-- Samples List -->
    <div v-else class="editor-body">
      <div class="samples-list">
        <div
          v-for="(sample, index) in samples"
          :key="index"
          class="sample-card"
        >
          <div class="sample-header">
            <span class="sample-number">{{ index + 1 }}</span>
            <div class="sample-settings">
              <label class="checkbox-inline">
                <input v-model="sample.is_displayed" type="checkbox" />
                展示样例
              </label>
              <label class="checkbox-inline">
                <input v-model="sample.is_hidden" type="checkbox" />
                隐藏测试
              </label>
            </div>
            <AppButton variant="ghost" size="sm" @click="removeSample(index)">
              <Trash2 :size="16" />
            </AppButton>
          </div>

          <div class="sample-grid">
            <AppFormField label="输入">
              <AppTextarea v-model="sample.input" rows="4" placeholder="输入内容" code />
            </AppFormField>
            <AppFormField label="输出">
              <AppTextarea v-model="sample.output" rows="4" placeholder="输出内容" code />
            </AppFormField>
          </div>

          <AppFormField label="说明">
            <AppTextarea v-model="sample.explanation" rows="2" placeholder="样例说明（可选）" />
          </AppFormField>
        </div>
      </div>

      <AppButton variant="secondary" @click="addSample">
        <Plus :size="16" />
        添加样例
      </AppButton>
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

    <!-- Error Dialog -->
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
import { BASE_URL } from '@/config/api'
import type { Ref } from 'vue'

// UI Components
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Lucide Icons
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-vue-next'

// Inject
const ojEditorProblemId = inject<Ref<number | undefined>>('ojEditorProblemId')

// State
const loading = ref(false)
const saving = ref(false)
const samples = ref<any[]>([])

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

// Computed
const problemId = computed(() => ojEditorProblemId?.value)

function goBackToEditor() {
  if (problemId.value) {
    window.location.href = `/admin/oj-editor/${problemId.value}`
  } else {
    window.location.href = '/admin/oj'
  }
}

async function loadSamples() {
  if (!problemId.value) return
  loading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/oj/problems/${problemId.value}/all`)
    if (data.success && Array.isArray(data.data?.samples)) {
      samples.value = data.data.samples.map((s: any) => ({
        input: s.input || '',
        output: s.output || '',
        explanation: s.explanation || '',
        is_displayed: !!s.is_displayed,
        is_hidden: !!s.is_hidden,
        sort_order: s.sort_order || 0
      }))
    }
  } catch (e: any) {
    console.error(e)
    alert('加载样例失败')
    goBackToEditor()
  } finally {
    loading.value = false
  }
}

function addSample() {
  samples.value.push({
    input: '',
    output: '',
    explanation: '',
    is_displayed: samples.value.length === 0,
    is_hidden: false,
    sort_order: samples.value.length + 1
  })
}

function removeSample(index: number) {
  samples.value.splice(index, 1)
}

async function saveSamples() {
  if (samples.value.length === 0) {
    errorMessage.value = '请添加至少一个样例'
    showErrorDialog.value = true
    return
  }
  saving.value = true
  try {
    const payload = samples.value.map((s, idx) => ({
      input: s.input,
      output: s.output,
      explanation: s.explanation || '',
      is_displayed: !!s.is_displayed,
      is_hidden: !!s.is_hidden,
      sort_order: idx + 1
    }))
    await axios.put(`${BASE_URL}/oj/problems/${problemId.value}/samples`, { samples: payload })
    successMessage.value = '样例保存成功！'
    showSuccessDialog.value = true
  } catch (e: any) {
    errorMessage.value = e.response?.data?.error || e.message
    showErrorDialog.value = true
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSamples()
})
</script>

<style scoped>
.oj-samples-page {
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
}

.samples-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.sample-card {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.sample-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.sample-number {
  background: var(--color-primary);
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.sample-settings {
  display: flex;
  gap: var(--space-3);
}

.checkbox-inline {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.checkbox-inline input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.sample-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

@media (max-width: 768px) {
  .sample-grid {
    grid-template-columns: 1fr;
  }
}
</style>