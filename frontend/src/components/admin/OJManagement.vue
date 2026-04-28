<template>
  <AdminPageTemplate
    title="OJ 题目管理"
    :loading="loading"
    :total="problems.length"
    @refresh="fetchProblems"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="openOJCreate?.()">
        <Plus :size="16" />
        上传新题目
      </AppButton>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="filter-group">
        <label>题目来源：</label>
        <AppSelect
          v-model="selectedCategory"
          :options="categoryOptions"
          placeholder="全部"
          @update:model-value="fetchProblems"
        />
      </div>
      <div v-if="selectedCategory === '' || selectedCategory === 'GESP'" class="filter-group">
        <label>级别筛选：</label>
        <AppSelect
          v-model="selectedLevel"
          :options="levelOptions"
          placeholder="全部"
          @update:model-value="fetchProblems"
        />
      </div>
    </template>

    <!-- Content: Table -->
    <div class="oj-table-container">
      <table v-if="problems.length > 0" class="oj-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>题目来源</th>
            <th v-if="selectedCategory === '' || selectedCategory === 'GESP'">级别</th>
            <th>发布日期</th>
            <th>提交数</th>
            <th>通过数</th>
            <th>通过率</th>
            <th>时间限制</th>
            <th>内存限制</th>
            <th class="col-bank">题库可见</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="problem in problems" :key="problem.id">
            <td>{{ problem.id }}</td>
            <td class="title-cell">{{ problem.title }}</td>
            <td>
              <AppTag :type="getCategoryTagType(problem.category)">
                {{ getCategoryText(problem.category) }}
              </AppTag>
            </td>
            <td v-if="selectedCategory === '' || selectedCategory === 'GESP'">
              <AppTag v-if="problem.level" type="info">GESP {{ problem.level }}级</AppTag>
              <span v-else class="no-level">-</span>
            </td>
            <td>{{ formatDate(problem.publish_date) }}</td>
            <td>{{ problem.total_submissions || 0 }}</td>
            <td>{{ problem.accepted_submissions || 0 }}</td>
            <td>
              <span class="pass-rate">{{ calculatePassRate(problem.total_submissions, problem.accepted_submissions) }}%</span>
            </td>
            <td>{{ problem.time_limit }}ms</td>
            <td>{{ problem.memory_limit }}MB</td>
            <td class="bank-cell">
              <button
                type="button"
                :class="['toggle-btn', { 'on': isBankVisible(problem), 'loading': togglingId === problem.id }]"
                :disabled="togglingId === problem.id"
                :title="isBankVisible(problem) ? '对学生可见' : '对学生不可见'"
                @click="toggleBankVisible(problem)"
              >
                <span class="toggle-slider"></span>
              </button>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <AppButton variant="ghost" size="sm" @click="viewProblem(problem.id)">
                  <Eye :size="16" />
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="editProblem(problem.id)">
                  <Pencil :size="16" />
                </AppButton>
                <AppButton variant="destructive" size="sm" @click="deleteProblem(problem.id)">
                  <Trash2 :size="16" />
                </AppButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无题目" />
    </div>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Plus, Eye, Pencil, Trash2 } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

// Inject
const openOJCreate = inject<() => void>('openOJCreate')
const openOJEditor = inject<(id: number) => void>('openOJEditor')

const questionTypeStore = useQuestionTypeStore()

// State
const selectedCategory = ref<string | null>(null)
const selectedLevel = ref<string | null>(null)
const problems = ref<any[]>([])
const loading = ref(false)
const togglingId = ref<number | null>(null)

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
]

// Bank Visible Toggle
function isBankVisible(problem: any): boolean {
  return problem.bank_visible !== undefined ? !!problem.bank_visible : true
}

async function toggleBankVisible(problem: any) {
  if (togglingId.value === problem.id) return
  const next = !isBankVisible(problem)
  togglingId.value = problem.id
  try {
    await axios.put(`${BASE_URL}/oj/problems/${problem.id}`, { bank_visible: next })
    problem.bank_visible = next ? 1 : 0
  } catch (e: any) {
    console.error('更新题库可见失败:', e)
    alert('更新失败: ' + (e.response?.data?.error || e.message))
  } finally {
    togglingId.value = null
  }
}

// Category Helpers
function getCategoryText(category: string) {
  const types = questionTypeStore.allTypes.value || []
  const type = types.find((t: any) => t.name === category)
  return type?.display_name || category || 'GESP'
}

function getCategoryTagType(category: string): 'success' | 'info' | 'warning' | 'default' {
  const typeMap: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    'GESP': 'info',
    'CSP_J': 'success',
    'CSP_S': 'success',
    'NOI_P': 'warning',
    'NOI_A': 'warning',
    'NOI_IOI': 'default',
    'leetcode': 'default',
    'other': 'default',
  }
  return typeMap[category?.toUpperCase()] || 'default'
}

// Fetch Problems
async function fetchProblems() {
  loading.value = true
  try {
    const params: any = { page: 1, pageSize: 100, include_all: 1 }
    if (selectedCategory.value) params.category = selectedCategory.value
    if (selectedLevel.value) params.level = selectedLevel.value

    const response = await axios.get(`${BASE_URL}/oj/problems`, { params })
    if (response.data.success) {
      problems.value = response.data.data
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
    alert('获取题目列表失败')
  } finally {
    loading.value = false
  }
}

// Helpers
function calculatePassRate(total: number, accepted: number): string {
  if (!total || total === 0) return '0.0'
  return ((accepted / total) * 100).toFixed(1)
}

function formatDate(dateString: string) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// Actions
function viewProblem(id: number) {
  window.location.href = `/smartoj/${id}`
}

function editProblem(id: number) {
  openOJEditor?.(id)
}

async function deleteProblem(id: number) {
  if (!confirm('确定要删除这道题目吗？此操作不可恢复！')) return

  try {
    await axios.delete(`${BASE_URL}/oj/problems/${id}`)
    alert('题目删除成功')
    fetchProblems()
  } catch (error: any) {
    console.error('删除题目失败:', error)
    alert('删除题目失败: ' + (error.response?.data?.error || error.message))
  }
}

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
  fetchProblems()
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
.oj-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.oj-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.oj-table thead {
  background: var(--color-muted);
}

.oj-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.oj-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.oj-table tbody tr:hover {
  background: rgba(37, 99, 235, 0.04);
}

.title-cell {
  font-weight: 500;
  color: var(--color-primary);
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-level {
  color: var(--color-text-muted);
}

.pass-rate {
  font-weight: 500;
  color: var(--color-accent);
}

.col-bank {
  width: 80px;
  text-align: center;
}

.bank-cell {
  text-align: center;
}

/* Toggle Button */
.toggle-btn {
  position: relative;
  width: 40px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: var(--color-border-strong);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.toggle-btn:hover:not(:disabled) {
  background: var(--color-text-muted);
}

.toggle-btn.on {
  background: var(--color-primary);
}

.toggle-btn.on:hover:not(:disabled) {
  background: var(--color-secondary);
}

.toggle-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform var(--transition-fast);
}

.toggle-btn.on .toggle-slider {
  transform: translateX(18px);
}

/* Row Actions */
.row-actions {
  display: flex;
  gap: var(--space-2);
}
</style>