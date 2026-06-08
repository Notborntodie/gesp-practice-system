<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { Search, FileText, Eye } from 'lucide-vue-next'
import BaseTeacherSection from './BaseTeacherSection.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const router = useRouter()
const questionTypeStore = useQuestionTypeStore()

// 筛选状态
const selectedLevel = ref<string | null>(null)
const selectedCategory = ref<string | null>(null)
const searchQuery = ref('')
const exams = ref<any[]>([])
const examsLoading = ref(false)

// 用户信息
const userInfo = ref<any>(null)

// 来源选项
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
})

// 级别选项
const levelOptions = [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' }
]

// 过滤后的考试列表
const filteredExams = computed(() => {
  let result = exams.value

  // 按题目来源筛选
  if (selectedCategory.value) {
    result = result.filter(exam => (exam.category || 'GESP') === selectedCategory.value)
  }

  // 按级别筛选（仅当来源为 GESP 或未选择来源时）
  if (selectedLevel.value && (!selectedCategory.value || selectedCategory.value === 'GESP')) {
    result = result.filter(exam => exam.level === Number(selectedLevel.value))
  }

  // 按搜索关键词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(exam => {
      const name = (exam.name || '').toLowerCase()
      return name.includes(query)
    })
  }

  return result
})

// 获取来源标签样式
function getCategoryTagType(category: string): string {
  const types: Record<string, string> = {
    'GESP': 'primary',
    'CSP_J': 'success',
    'CSP_S': 'warning',
    'NOI_P': 'info',
    'NOI_A': 'default',
    'NOI_IOI': 'destructive',
    'Other': 'default'
  }
  return types[category] || 'default'
}

// 获取来源显示文本
function getCategoryText(category: string): string {
  const type = questionTypeStore.getQuestionTypeByName(category)
  return type?.display_name || category || 'GESP'
}

// 获取考试列表
async function fetchExams() {
  if (!userInfo.value) return

  examsLoading.value = true
  try {
    const response = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })

    let examList = []
    if (response.data.data?.exams) {
      examList = response.data.data.exams
    } else if (response.data.exams) {
      examList = response.data.exams
    } else if (Array.isArray(response.data.data)) {
      examList = response.data.data
    } else if (Array.isArray(response.data)) {
      examList = response.data
    }

    exams.value = examList
  } catch (error: any) {
    console.error('获取考试列表失败:', error)
  } finally {
    examsLoading.value = false
  }
}

// 处理考试点击
function handleExamClick(exam: any) {
  if (!userInfo.value) return

  router.push({
    path: `/teacher/${userInfo.value.id}/submissions`,
    query: {
      exam_id: exam.id.toString(),
      fromSection: 'objective-submissions',
      fromTeacherView: 'true'
    }
  })
}

// 获取用户信息
function getUserInfo() {
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
  }
}

onMounted(async () => {
  getUserInfo()
  await questionTypeStore.fetchQuestionTypes()
  if (userInfo.value) {
    await fetchExams()
  }
})

// 监听用户信息变化
watch(() => {
  const userInfoStr = localStorage.getItem('userInfo')
  return userInfoStr ? JSON.parse(userInfoStr) : null
}, (newUserInfo) => {
  if (newUserInfo && !userInfo.value) {
    userInfo.value = newUserInfo
    fetchExams()
  }
}, { immediate: true })
</script>

<template>
  <BaseTeacherSection title="客观题提交">
    <template #filters>
      <div class="filters-container">
        <div class="search-box">
          <Search :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索考试名称..."
            class="search-input"
          />
        </div>
        <div class="filter-group">
          <label class="filter-label">题目来源：</label>
          <AppSelect
            v-model="selectedCategory"
            :options="categoryOptions"
            placeholder="全部来源"
          />
        </div>
        <div v-if="!selectedCategory || selectedCategory === 'GESP'" class="filter-group">
          <label class="filter-label">级别：</label>
          <AppSelect
            v-model="selectedLevel"
            :options="levelOptions"
            placeholder="全部级别"
          />
        </div>
      </div>
    </template>

    <template #header-right>
      <span class="count-info">共 {{ filteredExams.length }} 个考试</span>
    </template>

    <template #content>
      <AppEmptyState v-if="examsLoading" type="loading" description="正在加载考试列表..." />

      <AppEmptyState v-else-if="filteredExams.length === 0" type="empty" description="当前筛选条件下没有考试" />

      <div v-else class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>考试名称</th>
              <th>题目来源</th>
              <th>级别</th>
              <th>类型</th>
              <th>总题数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="exam in filteredExams"
              :key="exam.id"
              class="table-row"
              @click="handleExamClick(exam)"
            >
              <td class="name-cell">{{ exam.name || '未知考试' }}</td>
              <td>
                <AppTag :type="getCategoryTagType(exam.category || 'GESP')">
                  {{ getCategoryText(exam.category || 'GESP') }}
                </AppTag>
              </td>
              <td>
                <AppTag v-if="(exam.category || 'GESP') === 'GESP'" type="info">
                  GESP {{ exam.level }}级
                </AppTag>
                <span v-else class="no-level">-</span>
              </td>
              <td>
                <AppTag type="default">
                  {{ exam.type || '真题' }}
                </AppTag>
              </td>
              <td>{{ exam.total_questions || 0 }} 题</td>
              <td @click.stop>
                <AppButton variant="primary" size="sm" @click="handleExamClick(exam)">
                  <Eye :size="14" />
                  查看
                </AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseTeacherSection>
</template>

<style scoped>
.filters-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-width: 200px;
}

.search-input {
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  outline: none;
  width: 100%;
  padding: 0;
}

.search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.count-info {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.data-table-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  width: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: var(--space-3) var(--space-4);
  background: rgba(37, 99, 235, 0.05);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.02);
}

.name-cell {
  font-weight: 500;
}

.no-level {
  color: var(--color-text-muted);
}
</style>