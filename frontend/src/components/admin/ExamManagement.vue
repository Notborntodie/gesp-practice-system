<template>
  <AdminPageTemplate
    title="练习管理"
    :loading="loading"
    :total="exams.length"
    :cache-valid="examStore.isCacheValid"
    :has-cache="examStore.hasExams"
    @refresh="refreshExams"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="openCreateExam" title="从题库选题组卷">
        <Plus :size="16" />
        创建练习
      </AppButton>
      <AppButton variant="secondary" @click="openExamBatchUpload" title="批量上传题目并自动创建练习">
        <Upload :size="16" />
        上传练习
        <AppTag type="success" size="sm" class="new-badge">新</AppTag>
      </AppButton>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="filter-group">
        <label>搜索考试：</label>
        <AppInput
          v-model="searchQuery"
          placeholder="搜索考试名称..."
          clearable
        />
      </div>
      <div class="filter-group">
        <label>题目来源：</label>
        <AppSelect
          v-model="filterCategory"
          :options="categoryOptions"
          placeholder="全部来源"
        />
      </div>
      <div v-if="filterCategory === '' || filterCategory === 'GESP'" class="filter-group">
        <label>级别筛选：</label>
        <AppSelect
          v-model="filterLevel"
          :options="levelOptions"
          placeholder="全部"
        />
      </div>
      <div class="filter-group">
        <label>类型筛选：</label>
        <AppSelect
          v-model="filterType"
          :options="typeOptions"
          placeholder="全部类型"
        />
      </div>
    </template>

    <!-- Content: Table -->
    <div class="exam-table-container">
      <table v-if="filteredExams.length > 0" class="exam-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>考试名称</th>
            <th>题目来源</th>
            <th>级别</th>
            <th>类型</th>
            <th>题目数量</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(exam, index) in filteredExams"
            :key="exam.id"
            class="table-row"
            @click="toggleExamExpansion(exam.id)"
          >
            <td>{{ index + 1 }}</td>
            <td class="name-cell">
              <div class="exam-name">{{ exam.name || '考试名称加载中...' }}</div>
              <div v-if="exam.description" class="exam-desc">{{ truncateText(exam.description, 40) }}</div>
            </td>
            <td>
              <AppTag :type="getCategoryTagType(exam.category)">
                {{ getCategoryText(exam.category || 'GESP') }}
              </AppTag>
            </td>
            <td>
              <AppTag v-if="(exam.category || 'GESP') === 'GESP'" type="info">
                GESP {{ exam.level || 1 }}级
              </AppTag>
              <span v-else class="no-level">-</span>
            </td>
            <td>
              <AppTag :type="getTypeTagType(exam.type)">
                {{ exam.type || '真题' }}
              </AppTag>
            </td>
            <td>{{ exam.questions?.length || exam.question_count || 0 }}</td>
            <td>{{ formatDate(exam.created_at) }}</td>
            <td @click.stop>
              <div class="row-actions">
                <AppButton variant="ghost" size="sm" @click="openExportDialog(exam)">
                  <Download :size="16" />
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="openEditDialog(exam)">
                  <Pencil :size="16" />
                </AppButton>
                <AppButton variant="destructive" size="sm" @click="deleteExam(exam.id)">
                  <Trash2 :size="16" />
                </AppButton>
              </div>
            </td>
          </tr>

          <!-- 详情展开行 -->
          <tr
            v-for="examDetail in filteredExams.filter(e => expandedExams.includes(e.id))"
            :key="`detail-${examDetail.id}`"
            class="detail-row"
          >
            <td colspan="8">
              <div class="exam-details">
                <div class="detail-section">
                  <h5>考试详细信息</h5>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">考试ID:</span>
                      <span class="info-value">#{{ examDetail.id }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">考试等级:</span>
                      <span class="info-value">{{ (examDetail.category || 'GESP') === 'GESP' ? `GESP ${examDetail.level}级` : '-' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">题目来源:</span>
                      <span class="info-value">{{ getCategoryText(examDetail.category || 'GESP') }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">题目总数:</span>
                      <span class="info-value">{{ examDetail.questions?.length || examDetail.total_questions || 0 }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="examDetail.description" class="detail-section">
                  <h5>考试描述</h5>
                  <div class="description-box">
                    <p>{{ examDetail.description }}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无考试" />
    </div>

    <!-- Dialogs -->
    <AppDialog
      v-model:show="showDeleteDialog"
      title="确认删除"
      width="400"
      positive-text="删除"
      negative-text="取消"
      @positive="confirmDelete"
    >
      <p style="color: var(--color-text-secondary);">确定要删除这场考试吗？此操作不可撤销。</p>
    </AppDialog>

    <AppDialog
      v-model:show="showSuccessMessage"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>

    <ExportDialog
      :visible="showExportDialog"
      :exam="examToExport"
      @confirm="handleExportConfirm"
      @cancel="cancelExport"
    />
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, watch, inject } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Download, Pencil, Trash2, Plus, Upload } from 'lucide-vue-next'

// Dialog Components
import ExportDialog from './Dialog/ExportDialog.vue'

// Stores
import { useExamStore } from '@/stores/examStore'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import docxExportService from '@/services/docxExportService'

// Inject
const openExamEditor = inject<(examId?: number) => void>('openExamEditor')
const openExamBatchUpload = inject<() => void>('openExamBatchUpload')

function openCreateExam() {
  openExamEditor?.()
}

// Props
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), { refreshTrigger: 0 })

const examStore = useExamStore()
const questionTypeStore = useQuestionTypeStore()

// State
const { exams, loading } = examStore
const searchQuery = ref('')
const filterCategory = ref<string | null>(null)
const filterLevel = ref<string | null>(null)
const filterType = ref<string | null>(null)
const expandedExams = ref<number[]>([])

// Dialog State
const showDeleteDialog = ref(false)
const examToDelete = ref<number | null>(null)
const showSuccessMessage = ref(false)
const successMessage = ref('')
const showExportDialog = ref(false)
const examToExport = ref<any>(null)

// Filter Options
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

const levelOptions = [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
]

const typeOptions = [
  { label: '真题', value: '真题' },
  { label: '模拟', value: '模拟' },
  { label: '专项', value: '专项' },
]

// Filtered Exams
const filteredExams = computed(() => {
  let list = [...exams.value]

  if (filterCategory.value) {
    list = list.filter(e => (e.category || 'GESP') === filterCategory.value)
  }
  if (filterLevel.value) {
    list = list.filter(e => String(e.level || 1) === filterLevel.value)
  }
  if (filterType.value) {
    list = list.filter(e => (e.type || '真题') === filterType.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e => e.name?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
  }
  return list
})

// Toggle Expansion
function toggleExamExpansion(id: number) {
  const idx = expandedExams.value.indexOf(id)
  if (idx === -1) {
    expandedExams.value.push(id)
    const exam = exams.value.find(e => e.id === id)
    if (exam && !exam.questions) {
      examStore.preloadExamDetails(id)
    }
  } else {
    expandedExams.value.splice(idx, 1)
  }
}

// Helpers
function truncateText(text: string, max: number) {
  if (!text || text.length <= max) return text
  return text.substring(0, max) + '...'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}

function getCategoryText(category: string) {
  const types = questionTypeStore.allTypes.value || []
  const type = types.find((t: any) => t.name === category)
  return type?.display_name || category || 'GESP'
}

function getCategoryTagType(category: string): 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    'GESP': 'info',
    'CSP_J': 'success',
    'CSP_S': 'success',
  }
  return map[category] || 'default'
}

function getTypeTagType(type: string): 'success' | 'warning' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'default'> = {
    '真题': 'success',
    '模拟': 'warning',
    '专项': 'default',
  }
  return map[type] || 'success'
}

// Fetch
async function fetchExams(forceRefresh = false) {
  try {
    await examStore.fetchExams(forceRefresh)
  } catch (error: any) {
    console.error('获取考试列表失败:', error)
    alert('获取考试列表失败: ' + (error.response?.data?.error || error.message))
  }
}

function refreshExams() {
  fetchExams(true)
  showSuccessMessage.value = true
  successMessage.value = '考试列表已刷新！'
}

// Actions
function openEditDialog(exam: any) {
  openExamEditor?.(exam.id)
}

function openExportDialog(exam: any) {
  examToExport.value = exam
  showExportDialog.value = true
}

function cancelExport() {
  showExportDialog.value = false
  examToExport.value = null
}

async function handleExportConfirm(options: { withAnswers: boolean; withoutAnswers: boolean; answerOnly: boolean }) {
  try {
    let examData = examToExport.value
    if (!examData.questions?.length) {
      await examStore.preloadExamDetails(examData.id)
      examData = examStore.getExam(examData.id) || examData

      if (!examData.questions?.length) {
        const response = await axios.get(`${BASE_URL}/exams/${examData.id}`)
        examData = response.data
      }
    }

    await docxExportService.exportExam(examData, options)
    showExportDialog.value = false
    examToExport.value = null
    showSuccessMessage.value = true
    successMessage.value = '考试导出成功！'
  } catch (error: any) {
    console.error('导出考试失败:', error)
    alert('导出考试失败: ' + (error.message || '未知错误'))
  }
}

function deleteExam(id: number) {
  examToDelete.value = id
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!examToDelete.value) return

  try {
    await examStore.deleteExam(examToDelete.value)
    showDeleteDialog.value = false
    examToDelete.value = null
    showSuccessMessage.value = true
    successMessage.value = '考试删除成功！'
  } catch (error: any) {
    console.error('删除考试失败:', error)
    alert('删除考试失败: ' + (error.response?.data?.error || error.message))
  }
}

// Watch Refresh Trigger
watch(() => props.refreshTrigger, async (newVal, oldVal) => {
  if (newVal && newVal !== oldVal && newVal > 0) {
    await fetchExams(true)
  }
})

onMounted(async () => {
  questionTypeStore.fetchQuestionTypes()
  await fetchExams()
})

// KeepAlive 重新激活时强制刷新列表（从编辑器/上传页返回后）
onActivated(async () => {
  await fetchExams(true)
})
</script>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Table */
.exam-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.exam-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.exam-table thead {
  background: var(--color-muted);
}

.exam-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.exam-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.name-cell {
  max-width: 250px;
}

.exam-name {
  font-weight: 500;
  color: var(--color-foreground);
}

.exam-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.no-level {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--space-2);
}

/* Detail Row */
.detail-row {
  background: var(--color-muted);
}

.detail-row td {
  padding: 0;
}

.exam-details {
  padding: var(--space-5);
  margin: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.detail-section {
  margin-bottom: var(--space-5);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h5 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.info-value {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  font-weight: 500;
}

.description-box {
  padding: var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-sm);
}

.description-box p {
  margin: 0;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.new-badge {
  margin-left: var(--space-1);
  font-size: 10px;
  line-height: 1;
  padding: 1px 4px;
}
</style>