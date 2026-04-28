<template>
  <div class="test-editor-page">
    <!-- Header -->
    <div class="editor-header">
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" />
        返回测试列表
      </AppButton>
      <h2 class="editor-title">{{ isEditMode ? '编辑测试' : '创建测试' }}</h2>
      <div class="header-actions">
        <AppButton variant="primary" :disabled="saving" :loading="saving" @click="saveTest">
          <Save :size="16" />
          保存
        </AppButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-wrap">
      <div class="loading-spinner"></div>
      <p>加载测试...</p>
    </div>

    <!-- Form -->
    <div v-else class="editor-body">
      <!-- Basic Info -->
      <div class="form-section">
        <h5 class="section-title">基本信息</h5>
        <div class="form-grid">
          <AppFormField label="名称" required>
            <AppInput v-model="form.name" placeholder="测试名称" />
          </AppFormField>
          <AppFormField label="限时(分钟)">
            <AppInput v-model.number="form.time_limit_minutes" type="number" />
          </AppFormField>
        </div>

        <AppFormField label="说明">
          <AppTextarea v-model="form.description" rows="2" placeholder="可选" />
        </AppFormField>

        <div class="form-grid">
          <AppFormField label="开始时间">
            <AppInput v-model="form.start_time" type="datetime-local" />
          </AppFormField>
          <AppFormField label="结束时间">
            <AppInput v-model="form.end_time" type="datetime-local" />
          </AppFormField>
        </div>

        <div class="checkbox-row">
          <label class="checkbox-label">
            <input v-model="form.is_public" type="checkbox" class="checkbox-input" />
            <span>公开可见</span>
          </label>
        </div>
      </div>

      <!-- Objective Questions (Exams) -->
      <div class="form-section">
        <div class="section-header">
          <h5 class="section-title">客观题练习 <span v-if="form.exams.length > 0">({{ form.exams.length }})</span></h5>
          <AppButton variant="ghost" size="sm" @click="openExamSelector">
            <Plus :size="14" />
            选择试卷
          </AppButton>
        </div>

        <div v-if="form.exams.length === 0" class="empty-state">
          <p>暂未选择试卷</p>
        </div>

        <div v-else class="selected-items">
          <div v-for="(exam, idx) in form.exams" :key="idx" class="selected-item">
            <div class="item-info">
              <span class="item-name">{{ exam.exam_name || `试卷 #${exam.exam_id}` }}</span>
              <AppTag type="info" size="sm">{{ exam.category || 'GESP' }}{{ exam.level ? ` ${exam.level}级` : '' }}</AppTag>
              <AppTag v-if="exam.type" type="default" size="sm">{{ exam.type }}</AppTag>
              <AppTag v-if="exam.total_questions" type="default" size="sm">{{ exam.total_questions }}题</AppTag>
            </div>
            <AppInput
              v-model.number="exam.score_weight"
              placeholder="满分"
              size="sm"
              type="number"
              style="width: 80px;"
            />
            <AppButton variant="ghost" size="sm" @click="removeExam(idx)">
              <X :size="16" />
            </AppButton>
          </div>
        </div>
      </div>

      <!-- OJ Problems -->
      <div class="form-section">
        <div class="section-header">
          <h5 class="section-title">编程题 <span v-if="form.oj_problems.length > 0">({{ form.oj_problems.length }})</span></h5>
          <AppButton variant="ghost" size="sm" @click="openOJSelector">
            <Plus :size="14" />
            选择题目
          </AppButton>
        </div>

        <div v-if="form.oj_problems.length === 0" class="empty-state">
          <p>暂未选择题目</p>
        </div>

        <div v-else class="selected-items">
          <div v-for="(oj, idx) in form.oj_problems" :key="idx" class="selected-item">
            <div class="item-info">
              <span class="item-name">{{ oj.title || `题目 #${oj.problem_id}` }}</span>
              <AppTag type="info" size="sm">{{ oj.category || 'GESP' }}{{ oj.level ? ` ${oj.level}级` : '' }}</AppTag>
            </div>
            <AppInput
              v-model.number="oj.score_weight"
              placeholder="满分"
              size="sm"
              type="number"
              style="width: 80px;"
            />
            <AppButton variant="ghost" size="sm" @click="removeOJProblem(idx)">
              <X :size="16" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Exam Selector Dialog -->
    <ExamSelectorDialog
      :visible="showExamSelector"
      @close="showExamSelector = false"
      @select="handleExamSelect"
    />

    <!-- OJ Selector Dialog -->
    <OJSelectorDialog
      :visible="showOJSelector"
      @close="showOJSelector = false"
      @select="handleOJSelect"
    />

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
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'

// Dialogs
import ExamSelectorDialog from './Dialog/ExamSelectorDialog.vue'
import OJSelectorDialog from './Dialog/OJSelectorDialog.vue'

// Lucide Icons
import { ArrowLeft, Save, Plus, X } from 'lucide-vue-next'

// Inject
const testEditorTestId = inject<Ref<number | undefined>>('testEditorTestId')

// Get user ID from localStorage
function getUserId(): number | null {
  try {
    const s = localStorage.getItem('userInfo')
    if (!s) return null
    const u = JSON.parse(s)
    return u?.id ?? null
  } catch {
    return null
  }
}

// State
const loading = ref(false)
const saving = ref(false)
const showExamSelector = ref(false)
const showOJSelector = ref(false)

// Dialog State
const showSuccessDialog = ref(false)
const successMessage = ref('')
const showErrorDialog = ref(false)
const errorMessage = ref('')

const form = ref({
  name: '',
  description: '',
  time_limit_minutes: 120,
  start_time: '',
  end_time: '',
  is_public: true,
  exams: [] as { exam_id: number; exam_name?: string; category?: string; level?: number; type?: string; total_questions?: number; score_weight: number | null }[],
  oj_problems: [] as { problem_id: number; title?: string; category?: string; level?: number; score_weight: number }[]
})

// Computed
const isEditMode = computed(() => !!testEditorTestId?.value)
const testId = computed(() => testEditorTestId?.value)

function goBack() {
  window.location.href = '/admin/tests'
}

// Load test for edit - 使用管理端API
async function loadTest() {
  if (!testId.value) return
  const uid = getUserId()
  if (!uid) {
    errorMessage.value = '请先登录'
    showErrorDialog.value = true
    return
  }
  loading.value = true
  try {
    const { data } = await axios.get(`${BASE_URL}/admin/tests/${testId.value}`, {
      params: { user_id: uid }
    })
    if (data.success) {
      const t = data.data
      form.value = {
        name: t.name || '',
        description: t.description || '',
        time_limit_minutes: t.time_limit_minutes || 120,
        start_time: t.start_time || '',
        end_time: t.end_time || '',
        is_public: t.is_public === 1 || t.is_public === true,
        exams: (t.exams || []).map((e: any) => ({
          exam_id: e.exam_id,
          exam_name: e.exam_name,
          category: e.category,
          level: e.level,
          type: e.type,
          total_questions: e.total_questions,
          score_weight: e.score_weight || null
        })),
        oj_problems: (t.oj_problems || []).map((o: any) => ({
          problem_id: o.problem_id,
          title: o.title,
          category: o.category,
          level: o.level,
          score_weight: o.score_weight || 100
        }))
      }
    }
  } catch (e: any) {
    console.error(e)
    errorMessage.value = e.response?.data?.error || '加载测试失败'
    showErrorDialog.value = true
    setTimeout(() => goBack(), 1500)
  } finally {
    loading.value = false
  }
}

// Open selectors
function openExamSelector() {
  showExamSelector.value = true
}

function openOJSelector() {
  showOJSelector.value = true
}

// Handle selections
function handleExamSelect(examIds: number[]) {
  // 获取已选试卷详情
  const existingIds = form.value.exams.map(e => e.exam_id)
  const newIds = examIds.filter(id => !existingIds.includes(id))

  // 添加新试卷（需要从API获取详情）
  if (newIds.length > 0) {
    fetchExamDetails(newIds)
  }

  // 移除未选中的
  form.value.exams = form.value.exams.filter(e => examIds.includes(e.exam_id))

  showExamSelector.value = false
}

async function fetchExamDetails(examIds: number[]) {
  try {
    const { data } = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })
    const list = Array.isArray(data) ? data : (data.data || [])

    for (const id of examIds) {
      const exam = list.find((e: any) => e.id === id)
      if (exam) {
        form.value.exams.push({
          exam_id: id,
          exam_name: exam.name,
          category: exam.category,
          level: exam.level,
          type: exam.type,
          total_questions: exam.question_count || exam.total_questions,
          score_weight: null
        })
      }
    }
  } catch (e) {
    console.error('获取试卷详情失败:', e)
  }
}

function handleOJSelect(problemIds: number[]) {
  // 获取已选题目详情
  const existingIds = form.value.oj_problems.map(o => o.problem_id)
  const newIds = problemIds.filter(id => !existingIds.includes(id))

  // 添加新题目
  if (newIds.length > 0) {
    fetchOJDetails(newIds)
  }

  // 移除未选中的
  form.value.oj_problems = form.value.oj_problems.filter(o => problemIds.includes(o.problem_id))

  showOJSelector.value = false
}

async function fetchOJDetails(problemIds: number[]) {
  try {
    const { data } = await axios.get(`${BASE_URL}/oj/problems`, { params: { page: 1, pageSize: 1000, include_all: 1 } })
    const list = data.success ? (data.data || []) : []

    for (const id of problemIds) {
      const problem = list.find((p: any) => p.id === id)
      if (problem) {
        form.value.oj_problems.push({
          problem_id: id,
          title: problem.title,
          category: problem.category,
          level: problem.level,
          score_weight: 100
        })
      }
    }
  } catch (e) {
    console.error('获取题目详情失败:', e)
  }
}

function removeExam(idx: number) {
  form.value.exams.splice(idx, 1)
}

function removeOJProblem(idx: number) {
  form.value.oj_problems.splice(idx, 1)
}

async function saveTest() {
  if (!form.value.name.trim()) {
    errorMessage.value = '请输入名称'
    showErrorDialog.value = true
    return
  }
  const uid = getUserId()
  if (!uid) {
    errorMessage.value = '请先登录'
    showErrorDialog.value = true
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      time_limit_minutes: form.value.time_limit_minutes,
      start_time: form.value.start_time || null,
      end_time: form.value.end_time || null,
      is_public: form.value.is_public ? 1 : 0,
      user_id: uid,
      exams: form.value.exams.map((e, i) => ({
        exam_id: e.exam_id,
        exam_order: i + 1,
        score_weight: e.score_weight
      })),
      oj_problems: form.value.oj_problems.map((o, i) => ({
        problem_id: o.problem_id,
        problem_order: i + 1,
        score_weight: o.score_weight
      }))
    }

    if (isEditMode.value && testId.value) {
      await axios.put(`${BASE_URL}/tests/${testId.value}`, payload)
      successMessage.value = '测试保存成功！'
      showSuccessDialog.value = true
    } else {
      await axios.post(`${BASE_URL}/tests`, payload)
      successMessage.value = '测试创建成功！'
      showSuccessDialog.value = true
    }
    setTimeout(() => goBack(), 1500)
  } catch (e: any) {
    errorMessage.value = e.response?.data?.error || e.message
    showErrorDialog.value = true
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (testId.value) {
    loadTest()
  }
})
</script>

<style scoped>
.test-editor-page {
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

.form-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
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

.empty-state {
  text-align: center;
  padding: var(--space-3);
  color: var(--color-text-muted);
}

.selected-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.selected-item {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.item-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.item-name {
  font-weight: 600;
  color: var(--color-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .selected-item {
    flex-wrap: wrap;
  }

  .item-info {
    flex-wrap: wrap;
  }
}
</style>