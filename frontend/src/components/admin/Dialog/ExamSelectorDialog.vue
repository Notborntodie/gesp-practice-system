<template>
  <AppDialog
    v-model:show="dialogVisible"
    title="选择试卷"
    width="700"
    :show-footer="false"
  >
    <!-- Search and Filter -->
    <div class="search-section">
      <AppInput
        v-model="searchKeyword"
        placeholder="搜索试卷名称..."
        clearable
      />
      <AppSelect
        v-model="selectedCategory"
        :options="categoryOptions"
        placeholder="题目来源"
      />
      <AppSelect
        v-model="selectedLevel"
        :options="levelOptions"
        placeholder="全部级别"
      />
    </div>

    <!-- Exam List -->
    <div class="exam-list">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
      <AppEmptyState v-else-if="filteredExams.length === 0" type="empty" description="暂无试卷" />
      <div
        v-else
        v-for="exam in filteredExams"
        :key="exam.id"
        class="exam-item"
        :class="{ selected: selectedExams.includes(exam.id) }"
        @click="toggleExam(exam.id)"
      >
        <div class="exam-info">
          <div class="exam-title">{{ exam.name }}</div>
          <div class="exam-meta">
            <AppTag type="info" size="sm">{{ getCategoryLabel(exam.category) }}{{ exam.level ? ` ${exam.level}级` : '' }}</AppTag>
            <AppTag type="default" size="sm">{{ exam.question_count || exam.total_questions || 0 }}题</AppTag>
            <AppTag v-if="exam.type" type="default" size="sm">{{ exam.type }}</AppTag>
          </div>
        </div>
        <div class="exam-checkbox">
          <CheckCircle2 v-if="selectedExams.includes(exam.id)" :size="24" class="checked" />
          <Circle v-else :size="24" class="unchecked" />
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dialog-footer">
      <div class="selected-count">
        <AppTag type="primary">已选择: {{ selectedExams.length }}</AppTag>
      </div>
      <div class="footer-actions">
        <AppButton variant="ghost" @click="$emit('close')">取消</AppButton>
        <AppButton variant="primary" :disabled="selectedExams.length === 0" @click="handleConfirm">
          确定
        </AppButton>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { CheckCircle2, Circle } from 'lucide-vue-next'

// Stores
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const questionTypeStore = useQuestionTypeStore()

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits(['close', 'select'])

// Dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: () => emit('close')
})

const loading = ref(false)
const exams = ref<any[]>([])
const selectedExams = ref<number[]>([])
const searchKeyword = ref('')
const selectedCategory = ref('')
const selectedLevel = ref('')

// Category options from store
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value || []
  return [
    { label: '全部来源', value: '' },
    ...types.map((t: any) => ({ label: t.display_name || t.name, value: t.name }))
  ]
})

// Level options - 根据选择的来源动态生成
const levelOptions = computed(() => {
  const levels = [
    { label: '全部级别', value: '' }
  ]
  // GESP 有1-8级
  if (selectedCategory.value === 'GESP' || selectedCategory.value === '') {
    for (let n = 1; n <= 8; n++) {
      levels.push({ label: `GESP ${n}级`, value: String(n) })
    }
  }
  // 其他来源可能有自己的级别体系，这里可以扩展
  return levels
})

// Get category label
function getCategoryLabel(category: string): string {
  const types = questionTypeStore.allTypes.value || []
  const type = types.find((t: any) => t.name === category)
  return type?.display_name || category || 'GESP'
}

// Filtered exams
const filteredExams = computed(() => {
  let result = exams.value

  // 先按来源筛选
  if (selectedCategory.value) {
    result = result.filter(exam => exam.category === selectedCategory.value)
  }

  // 再按等级筛选
  if (selectedLevel.value) {
    result = result.filter(exam => String(exam.level) === selectedLevel.value)
  }

  // 最后按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(exam => exam.name.toLowerCase().includes(keyword))
  }

  return result
})

// Fetch exams
async function fetchExams() {
  loading.value = true
  try {
    const response = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })

    if (Array.isArray(response.data)) {
      exams.value = response.data
    } else if (response.data.success) {
      exams.value = response.data.data || []
    } else {
      exams.value = []
    }
  } catch (error) {
    console.error('获取试卷列表失败:', error)
    exams.value = []
  } finally {
    loading.value = false
  }
}

// Toggle selection
function toggleExam(examId: number) {
  const index = selectedExams.value.indexOf(examId)
  if (index > -1) {
    selectedExams.value.splice(index, 1)
  } else {
    selectedExams.value.push(examId)
  }
}

// Confirm selection
function handleConfirm() {
  emit('select', selectedExams.value)
}

// Reset when dialog opens
watch(() => props.visible, (visible) => {
  if (visible) {
    selectedExams.value = []
    searchKeyword.value = ''
    selectedCategory.value = ''
    selectedLevel.value = ''
    fetchExams()
    questionTypeStore.fetchQuestionTypes()
  }
})

onMounted(() => {
  questionTypeStore.fetchQuestionTypes()
})
</script>

<style scoped>
.search-section {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.search-section > * {
  flex: 1;
}

.search-section > *:first-child {
  flex: 2;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 400px;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-3);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.exam-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.exam-item:hover {
  border-color: var(--color-primary-light);
  background: var(--color-muted);
}

.exam-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-lightest);
}

.exam-info {
  flex: 1;
}

.exam-title {
  color: var(--color-foreground);
  font-weight: 600;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
}

.exam-meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.exam-checkbox .checked {
  color: var(--color-primary);
}

.exam-checkbox .unchecked {
  color: var(--color-text-muted);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
}
</style>