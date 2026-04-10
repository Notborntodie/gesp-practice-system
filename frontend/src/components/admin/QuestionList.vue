<template>
  <div class="question-management">
    <div class="section-header">
      <h2>题目管理</h2>
      <div class="header-info">
        <span class="question-count">共 {{ questions.length }} 道题目</span>
        <span v-if="questionStore.isCacheValid && questionStore.hasQuestions" class="cache-indicator">
          <Icon name="package" :size="16" /> 使用缓存数据
        </span>
      </div>
      <div class="action-buttons">
        <button @click="openCreateExamDialog" class="btn btn-primary">
          <Icon name="plus" :size="18" /> 创建考试
        </button>
        <button @click="refreshQuestions" class="btn btn-secondary" title="刷新题目列表">
          <Icon name="refresh-cw" :size="18" /> 刷新
        </button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <div class="filter-group">
        <label>搜索题目：</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索题目内容..."
          class="filter-input"
            />
          </div>
      <div class="filter-group">
        <label>题目来源：</label>
            <select v-model="filterCategory" class="filter-select">
          <option value="">全部来源</option>
              <option v-for="t in questionTypeStore.allTypes.value" :key="t.name" :value="t.name">
                {{ t.display_name || t.name }}
              </option>
            </select>
          </div>
      <div class="filter-group" v-if="filterCategory === '' || filterCategory === 'GESP'">
        <label>级别筛选：</label>
            <select v-model="filterLevel" class="filter-select">
          <option value="">全部级别</option>
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
      <div class="filter-group">
        <label>日期筛选：</label>
            <input 
              type="month" 
              v-model="filterDate" 
              class="filter-select"
              placeholder="按日期筛选"
            />
          </div>
      <div class="filter-group">
        <label>知识点：</label>
            <select v-model="filterKnowledgePoint" class="filter-select">
              <option value="">全部知识点</option>
              <option v-for="kp in knowledgePoints" :key="kp.id" :value="kp.id">
                {{ kp.name }} ({{ kp.category === 'algorithm' ? '算法' : kp.category === 'data_structure' ? '数据结构' : kp.category === 'programming' ? '编程' : kp.category === 'math' ? '数学' : kp.category }})
              </option>
            </select>
          </div>
        </div>
        
    <!-- 批量操作栏 -->
    <div v-if="selectedQuestions.length > 0" class="batch-toolbar">
      <span class="selected-info">已选择 {{ selectedQuestions.length }} 道题目</span>
      <div class="batch-actions">
            <button @click="selectAll" class="btn-action">全选</button>
            <button @click="clearSelection" class="btn-action">取消选择</button>
        <button @click="openBatchEditDialog" class="btn-action btn-edit">批量编辑</button>
        <button @click="batchDelete" class="btn-action btn-delete">批量删除</button>
      </div>
    </div>

    <!-- 题目列表 -->
    <div class="questions-table-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner">●</div>
        <p>加载中...</p>
      </div>

      <table v-else-if="filteredQuestions.length > 0" class="questions-table">
        <thead>
          <tr>
            <th style="width: 50px;">
              <input 
                type="checkbox" 
                :checked="selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0"
                @change="selectAll"
                class="table-checkbox"
              />
            </th>
            <th>序号</th>
            <th>题目内容</th>
            <th>分类</th>
            <th>级别</th>
            <th>难度</th>
            <th>类型</th>
            <th>创建时间</th>
            <th>正确答案</th>
            <th>知识点</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(q, index) in filteredQuestions" :key="q.id" @click="toggleQuestionExpansion(q.id)" class="table-row">
            <td @click.stop>
              <input 
                type="checkbox" 
                :checked="selectedQuestions.includes(q.id)"
                @change="toggleQuestionSelection(q.id)"
                class="table-checkbox"
              />
            </td>
            <td>{{ q.question_number || (index + 1) }}</td>
            <td class="question-content-cell">
              <div class="question-preview">
                {{ truncateText(q.question_text || '题目内容加载中...', 50) }}
            </div>
              <div v-if="(q.images && q.images.length > 0) || q.image_url" class="has-images-indicator">
                📸 {{ getImageCount(q) }}张图片
              </div>
            </td>
            <td>
              <span class="category-badge" :class="`category-${(q.category || 'GESP').toLowerCase()}`">
                {{ getCategoryText(q.category || 'GESP') }}
              </span>
            </td>
            <td>
              <span v-if="(q.category || 'GESP') === 'GESP'" class="level-badge">{{ getLevelText(q.level || 1) }}</span>
              <span v-else class="no-level">-</span>
            </td>
            <td>
              <span class="difficulty-badge" :class="`difficulty-${q.difficulty || 'medium'}`">
                {{ getDifficultyText(q.difficulty || 'medium') }}
              </span>
            </td>
            <td>{{ q.question_type === 'code' ? '代码题' : '文本题' }}</td>
            <td>{{ formatDate(q.created_at) }}</td>
            <td class="answer-cell">{{ q.correct_answer }}</td>
            <td class="knowledge-points-cell">
              <div v-if="q.knowledge_points && q.knowledge_points.length > 0" class="knowledge-tags">
                <span 
                  v-for="kp in q.knowledge_points.slice(0, 2)" 
                  :key="kp.id"
                  class="knowledge-tag-mini"
                >
                  {{ kp.name }}
              </span>
                <span v-if="q.knowledge_points.length > 2" class="more-tags">
                  +{{ q.knowledge_points.length - 2 }}
                </span>
              </div>
              <span v-else class="no-tags">-</span>
            </td>
            <td @click.stop>
              <div class="action-buttons">
                <button @click="openEditDialog(q)" class="btn-action btn-edit" title="编辑">
                  <Icon name="edit" :size="18" />
                </button>
                <button @click="deleteQuestion(q.id)" class="btn-action btn-delete" title="删除">
                  <Icon name="trash-2" :size="18" />
              </button>
            </div>
            </td>
          </tr>
          <!-- 展开的详细信息行 -->
          <tr v-for="question in filteredQuestions.filter(q => expandedQuestions.includes(q.id))" :key="`detail-${question.id}`" class="detail-row">
            <td colspan="11">
              <div class="question-details">
                <!-- 预加载题目详情 -->
                <div v-if="!question.options && !question.explanation" class="loading-details">
                  <div class="loading-spinner-small"></div>
                  <span>正在加载详细信息...</span>
                </div>
                
                <!-- 完整题目内容 -->
                <div class="detail-section">
                  <h5>完整题目内容</h5>
                  <div class="question-full-text">
                    {{ question.question_text || '题目内容加载中...' }}
                  </div>
                </div>

                <!-- 题目图片 -->
                <div v-if="(question.images && question.images.length > 0) || question.image_url" class="detail-section">
                  <h5>题目图片</h5>
                  <div class="images-preview-grid">
                    <div 
                      v-if="question.image_url"
                      class="preview-image-item"
                      @click="openImageModal(getImageUrl(question.image_url))"
                    >
                      <img 
                        :src="getImageUrl(question.image_url)" 
                        :alt="`题目图片`"
                        class="preview-image"
                      />
                      <div class="preview-image-overlay">
                        <span class="preview-image-count">主</span>
                      </div>
                    </div>
                    <div 
                      v-for="(image, imageIndex) in (question.images || [])" 
                      :key="imageIndex"
                      class="preview-image-item"
                      @click="openImageModal(getImageUrl(image.image_url))"
                    >
                      <img 
                        :src="getImageUrl(image.image_url)" 
                        :alt="`附加图片 ${imageIndex + 1}`"
                        class="preview-image"
                      />
                      <div class="preview-image-overlay">
                        <span class="preview-image-count">{{ imageIndex + 1 }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 题目代码（如果是代码题） -->
                <div v-if="question.question_code" class="detail-section">
                  <h5>题目代码</h5>
                  <div class="code-block">
                    <pre>{{ question.question_code }}</pre>
                  </div>
                </div>

                <!-- 选项列表 -->
                <div v-if="question.options && question.options.length > 0" class="detail-section">
                  <h5>选项列表</h5>
                  <div class="options-list">
                    <div 
                      v-for="option in question.options" 
                      :key="option.label || option.option_label"
                      class="option-item"
                      :class="{ 'option-correct': (option.value || option.option_value) === question.correct_answer }"
                    >
                      <span class="option-label">{{ option.label || option.option_label }}.</span>
                      <div class="option-content">
                        <div v-if="(option.text || option.option_text) && (option.text || option.option_text).includes('\n')" class="option-code-block">
                          <pre>{{ option.text || option.option_text }}</pre>
                        </div>
                        <span v-else class="option-text">{{ option.text || option.option_text }}</span>
                      </div>
                      <span v-if="(option.value || option.option_value) === question.correct_answer" class="correct-indicator">✓</span>
                    </div>
                  </div>
                </div>

                <!-- 解释说明 -->
                <div v-if="question.explanation" class="detail-section">
                  <h5>解释说明</h5>
                  <div class="explanation-box">
                    <p>{{ question.explanation }}</p>
                  </div>
                </div>

                <!-- 题目统计 -->
                <div class="detail-section">
                  <h5>题目统计</h5>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-label">原始编号</span>
                      <span class="stat-value">#{{ question.question_number }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">使用次数</span>
                      <span class="stat-value">{{ question.usage_count || 0 }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">正确率</span>
                      <span class="stat-value">{{ question.correct_rate || 'N/A' }}%</span>
                    </div>
                    <div class="stat-item" v-if="question.question_date">
                      <span class="stat-label">题目日期</span>
                      <span class="stat-value">{{ question.question_date }}</span>
                    </div>
                  </div>
                </div>
            </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <div class="empty-icon">📭</div>
        <p>暂无题目</p>
      </div>
    </div>

    <!-- 添加确认弹窗 -->
    <ConfirmDialog
      :visible="showDeleteDialog"
      title="确认删除"
      message="确定要删除这道题目吗？此操作不可撤销。"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    

    <!-- 成功提示弹窗 -->
    <SuccessMessageDialog
      :visible="showSuccessMessage"
      :message="successMessage"
      @close="closeSuccessMessage"
    />

    <!-- 批量删除确认弹窗 -->
    <ConfirmDialog
      :visible="showBatchDeleteDialog"
      title="确认批量删除"
      :message="`确定要删除选中的 ${selectedQuestions.length} 道题目吗？此操作不可撤销。`"
      @confirm="confirmBatchDelete"
      @cancel="cancelBatchDelete"
    />
    
    <!-- 图片模态框 -->
    <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
      <div class="image-modal-content" @click.stop>
        <button @click="closeImageModal" class="image-modal-close">×</button>
        <img :src="selectedImageUrl" alt="题目图片" class="modal-image" />
      </div>
    </div>

    <!-- 创建考试弹窗 -->
    <CreateExamDialog
      :visible="showCreateExamDialog"
      :selected-questions="selectedQuestionObjects"
      @close="closeCreateExamDialog"
      @created="handleExamCreated"
      @remove-question="handleRemoveQuestion"
      @move-question="handleMoveQuestion"
      @clear-all-selection="handleClearAllSelection"
    />

    <!-- 批量编辑弹窗 -->
    <BatchEditDialog
      :visible="showBatchEditDialog"
      :selected-questions="selectedQuestionObjects"
      @close="closeBatchEditDialog"
      @updated="handleBatchEditUpdated"
    />
  </div>
</template>

<script setup lang="ts">import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'

function getImageUrl(url: string | undefined): string {
  if (!url || !url.trim()) return ''
  const n = normalizeImageUrl(url)
  if (!n) return ''
  if (n.startsWith('http://') || n.startsWith('https://')) return n
  return n.startsWith('/') ? `${API_SERVER_BASE}${n}` : `${API_SERVER_BASE}/${n}`
}

import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import ConfirmDialog from './Dialog/ConfirmDialog.vue'
import SuccessMessageDialog from './Dialog/SuccessMessageDialog.vue'
import CreateExamDialog from './Dialog/CreateExamDialog.vue'
import BatchEditDialog from './Dialog/BatchEditDialog.vue'
import { useQuestionStore } from '../../stores/questionStore'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import Icon from '@/components/Icon.vue'

// Props 定义
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), {
  refreshTrigger: 0
})

// 使用题目store
const questionStore = useQuestionStore()
const questionTypeStore = useQuestionTypeStore()

// 本地状态
const searchQuery = ref('')
const filterCategory = ref('')
const filterLevel = ref('')
const filterDate = ref('')
const filterKnowledgePoint = ref('')
const expandedQuestions = ref<number[]>([])

// 知识点数据
const knowledgePoints = ref<any[]>([])

// 从store获取状态
const { questions, loading } = questionStore

// 添加弹窗相关数据
const showDeleteDialog = ref(false)
const questionToDelete = ref<number | null>(null)




// 成功提示相关数据
const showSuccessMessage = ref(false)
const successMessage = ref('')

// 图片模态框相关数据
const showImageModal = ref(false)
const selectedImageUrl = ref('')

// 批量选择相关数据
const selectedQuestions = ref<number[]>([])
const selectedQuestionObjects = ref<any[]>([])
const showBatchDeleteDialog = ref(false)

// 创建考试弹窗相关数据
const showCreateExamDialog = ref(false)

// 批量编辑弹窗相关数据
const showBatchEditDialog = ref(false)





// 获取题目列表
async function fetchQuestions(forceRefresh = false) {
  try {
    await questionStore.fetchQuestions(forceRefresh)
  } catch (error: any) {
    console.error('获取题目列表失败:', error)
    alert('获取题目列表失败: ' + (error.response?.data?.error || error.message))
  }
}

// 获取知识点列表
async function fetchKnowledgePoints() {
  try {
    const response = await axios.get(`${BASE_URL}/knowledge-points`)
    knowledgePoints.value = response.data
  } catch (error: any) {
    console.error('获取知识点列表失败:', error)
    // 不显示错误提示，因为这不是关键功能
  }
}

// 过滤题目
const filteredQuestions = computed(() => {
  let list = [...questionStore.questions.value] // 创建副本避免修改原始数据

  // 按分类过滤
  if (filterCategory.value) {
    list = list.filter(q => (q.category || 'GESP') === filterCategory.value)
  }

  // 按等级过滤（仅GESP分类有级别）
  if (filterLevel.value) {
    list = list.filter(q => String(q.level || 1) === filterLevel.value)
  }
  
  // 按日期过滤
  if (filterDate.value) {
    list = list.filter(q => q.question_date === filterDate.value)
  }
  
  // 按知识点过滤
  if (filterKnowledgePoint.value) {
    list = list.filter(q => {
      if (!q.knowledge_points || !Array.isArray(q.knowledge_points)) {
        return false
      }
      return q.knowledge_points.some((kp: any) => kp.id === parseInt(filterKnowledgePoint.value))
    })
  }
  
  // 按搜索关键词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(q => 
      q.question_text?.toLowerCase().includes(query) ||
      q.question_code?.toLowerCase().includes(query) ||
      q.correct_answer?.toLowerCase().includes(query)
    )
  }
  
  // 按题号排序
  list = list.sort((a, b) => {
    const aNumber = a.question_number || 0
    const bNumber = b.question_number || 0
    return aNumber - bNumber
  })
  
  return list
})

// 分类切换时自动清除级别筛选（非GESP分类没有级别）
watch(filterCategory, (newVal) => {
  if (newVal && newVal !== 'GESP') {
    filterLevel.value = ''
  }
})

// 切换题目展开状态
function toggleQuestionExpansion(id: number) {
  const idx = expandedQuestions.value.indexOf(id)
  if (idx === -1) {
    expandedQuestions.value.push(id)
    // 预加载题目详情
    const question = questionStore.questions.value.find(q => q.id === id)
    if (question && (!question.options || !question.explanation)) {
      questionStore.preloadQuestionDetails(id)
    }
  } else {
    expandedQuestions.value.splice(idx, 1)
  }
}

// 编辑题目 - 使用批量编辑弹窗
async function openEditDialog(q: any) {
  // 清空当前选择
  selectedQuestions.value = []
  selectedQuestionObjects.value = []
  
  // 选择当前题目
  selectedQuestions.value = [q.id]
  
  // 确保题目详情已加载
  if (!q.options || !q.explanation) {
    await questionStore.preloadQuestionDetails(q.id)
    // 重新获取完整的题目数据
    const updatedQuestion = questionStore.questions.value.find(question => question.id === q.id)
    if (updatedQuestion) {
      selectedQuestionObjects.value = [updatedQuestion]
    } else {
      selectedQuestionObjects.value = [q]
    }
  } else {
    selectedQuestionObjects.value = [q]
  }
  
  // 打开批量编辑弹窗
  showBatchEditDialog.value = true
}

// 删除题目
function deleteQuestion(id: number) {
  questionToDelete.value = id
  showDeleteDialog.value = true
}

// 确认删除
async function confirmDelete() {
  if (!questionToDelete.value) return
  
  try {
    const response = await axios.delete(`${BASE_URL}/questions/${questionToDelete.value}`)
    
    // 从缓存中删除题目，不重新加载整个列表
    questionStore.removeQuestion(questionToDelete.value)
    
    // 关闭弹窗
    showDeleteDialog.value = false
    questionToDelete.value = null
    
    // 显示成功提示
    showSuccessMessage.value = true
    successMessage.value = '题目删除成功！'
  } catch (error: any) {
    console.error('删除题目失败:', error)
    alert('删除题目失败: ' + error.response?.data?.error || error.message)
  }
}

// 取消删除
function cancelDelete() {
  showDeleteDialog.value = false
  questionToDelete.value = null
}

// 关闭成功提示
function closeSuccessMessage() {
  showSuccessMessage.value = false
  successMessage.value = ''
}

// 打开图片模态框
function openImageModal(imageUrl: string) {
  selectedImageUrl.value = imageUrl
  showImageModal.value = true
}

// 关闭图片模态框
function closeImageModal() {
  showImageModal.value = false
  selectedImageUrl.value = ''
}





// 分类文本 — 从 question_types 表动态获取
function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find(t => t.name === category)
  return type?.display_name || category
}

// 难度文本
function getDifficultyText(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

// 等级文本
function getLevelText(level: number) {
  return `GESP ${level}级`
}

// 时间格式化
function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}

// 批量选择相关方法
function toggleQuestionSelection(questionId: number) {
  const index = selectedQuestions.value.indexOf(questionId)
  if (index === -1) {
    selectedQuestions.value.push(questionId)
    // 添加题目对象到selectedQuestionObjects
    const question = questionStore.questions.value.find(q => q.id === questionId)
    if (question) {
      selectedQuestionObjects.value.push(question)
    }
  } else {
    selectedQuestions.value.splice(index, 1)
    // 从selectedQuestionObjects中移除
    selectedQuestionObjects.value.splice(index, 1)
  }
}

function selectAll() {
  if (selectedQuestions.value.length === filteredQuestions.value.length) {
    // 如果已经全选，则取消全选
    selectedQuestions.value = []
    selectedQuestionObjects.value = []
  } else {
    // 全选当前过滤后的题目
    selectedQuestions.value = filteredQuestions.value.map(q => q.id)
    selectedQuestionObjects.value = [...filteredQuestions.value]
  }
}

function clearSelection() {
  selectedQuestions.value = []
  selectedQuestionObjects.value = []
}

function batchDelete() {
  if (selectedQuestions.value.length === 0) {
    alert('请先选择要删除的题目')
    return
  }
  showBatchDeleteDialog.value = true
}

async function confirmBatchDelete() {
  try {
    // 批量删除选中的题目
    const deletePromises = selectedQuestions.value.map(id => 
      axios.delete(`${BASE_URL}/questions/${id}`)
    )
    
    await Promise.all(deletePromises)
    
    // 从缓存中批量删除题目，不重新加载整个列表
    questionStore.removeQuestions(selectedQuestions.value)
    
    // 清空选择
    selectedQuestions.value = []
    showBatchDeleteDialog.value = false
    
    // 显示成功提示
    showSuccessMessage.value = true
    successMessage.value = `成功删除 ${deletePromises.length} 道题目！`
  } catch (error: any) {
    console.error('批量删除失败:', error)
    alert('批量删除失败: ' + (error.response?.data?.error || error.message))
  }
}

function cancelBatchDelete() {
  showBatchDeleteDialog.value = false
}

// 手动刷新题目列表
async function refreshQuestions() {
  try {
    await fetchQuestions(true) // 强制刷新
    showSuccessMessage.value = true
    successMessage.value = '题目列表已刷新！'
  } catch (error: any) {
    alert('刷新失败: ' + (error.response?.data?.error || error.message))
  }
}

// 打开创建考试弹窗
function openCreateExamDialog() {
  showCreateExamDialog.value = true
}

// 关闭创建考试弹窗
function closeCreateExamDialog() {
  showCreateExamDialog.value = false
}

// 处理考试创建成功
function handleExamCreated(examId: number) {
  showSuccessMessage.value = true
  successMessage.value = '考试创建成功！'
  clearSelection()
}

// 处理移除题目
function handleRemoveQuestion(index: number) {
  // 从选中的题目ID列表中移除
  const questionId = getSelectedQuestionById(index)
  if (questionId) {
    const idIndex = selectedQuestions.value.indexOf(questionId)
    if (idIndex > -1) {
      selectedQuestions.value.splice(idIndex, 1)
    }
  }
}

// 处理移动题目
function handleMoveQuestion(data: { index: number, direction: 'up' | 'down' }) {
  // 这里可以添加移动题目的逻辑，如果需要的话
  console.log('移动题目:', data)
}

// 处理清空所有选择
function handleClearAllSelection() {
  clearSelection()
}

// 打开批量编辑弹窗
async function openBatchEditDialog() {
  if (selectedQuestions.value.length === 0) {
    alert('请先选择要编辑的题目')
    return
  }
  
  // 快速获取第一个题目的详情并打开弹窗
  const firstQuestion = await getFirstQuestionDetail()
  
  // 初始化selectedQuestionObjects，先放入第一个题目
  selectedQuestionObjects.value = firstQuestion ? [firstQuestion] : []
  
  // 如果有多个题目，先放入基本信息，然后后台加载详情
  if (selectedQuestions.value.length > 1) {
    const remainingQuestions = selectedQuestions.value.slice(1).map(id => {
      return questionStore.questions.value.find(q => q.id === id) || { id }
    })
    selectedQuestionObjects.value.push(...remainingQuestions)
  }
  
  // 立即打开弹窗
  showBatchEditDialog.value = true
  
  // 后台并行加载剩余题目的详情
  if (selectedQuestions.value.length > 1) {
    loadRemainingQuestionDetails()
  }
}

// 关闭批量编辑弹窗
function closeBatchEditDialog() {
  showBatchEditDialog.value = false
}

// 处理批量编辑更新
function handleBatchEditUpdated(updatedQuestions: any[]) {
  // 更新store中的题目数据
  updatedQuestions.forEach(question => {
    if (question.id) {
      questionStore.updateQuestion(question.id, question)
    }
  })
  
  // 强制刷新题目列表以确保数据同步
  fetchQuestions(true)
  
  // 不再显示重复的成功提示，BatchEditDialog 中已经显示了
  
  // 清空选择
  clearSelection()
}

// 根据索引获取选中的题目ID
function getSelectedQuestionById(index: number): number | null {
  return selectedQuestionObjects.value[index]?.id || null
}

// 获取选中的题目对象列表
async function getSelectedQuestionObjects() {
  const selectedObjects = []
  
  for (const id of selectedQuestions.value) {
    let question = questionStore.questions.value.find(q => q.id === id)
    
    // 如果题目没有完整的选项信息，则获取详细信息
    if (question && (!question.options || question.options.length === 0)) {
      try {
        console.log(`获取题目 ${id} 的详细信息...`)
        const response = await axios.get(`${BASE_URL}/questions/${id}`)
        question = response.data
        // 更新store中的题目信息
        questionStore.updateQuestion(id, question)
      } catch (error) {
        console.error(`获取题目 ${id} 详情失败:`, error)
      }
    }
    
    if (question) {
      selectedObjects.push(question)
    }
  }
  
  // 更新响应式变量
  selectedQuestionObjects.value = selectedObjects
  return selectedObjects
}

// 获取第一个题目的详情（用于快速打开弹窗）
async function getFirstQuestionDetail() {
  if (selectedQuestions.value.length === 0) return null
  
  const firstId = selectedQuestions.value[0]
  let question = questionStore.questions.value.find(q => q.id === firstId)
  
  // 如果第一个题目没有完整的选项信息，则获取详细信息
  if (question && (!question.options || question.options.length === 0)) {
    try {
      console.log(`快速获取第一个题目 ${firstId} 的详细信息...`)
      const response = await axios.get(`${BASE_URL}/questions/${firstId}`)
      question = response.data
      // 更新store中的题目信息
      questionStore.updateQuestion(firstId, question)
    } catch (error) {
      console.error(`获取第一个题目 ${firstId} 详情失败:`, error)
    }
  }
  
  return question
}

// 并行获取剩余题目的详情
async function loadRemainingQuestionDetails() {
  if (selectedQuestions.value.length <= 1) return
  
  const remainingIds = selectedQuestions.value.slice(1)
  const promises = remainingIds.map(async (id) => {
    let question = questionStore.questions.value.find(q => q.id === id)
    
    // 如果题目没有完整的选项信息，则获取详细信息
    if (question && (!question.options || question.options.length === 0)) {
      try {
        console.log(`后台获取题目 ${id} 的详细信息...`)
        const response = await axios.get(`${BASE_URL}/questions/${id}`)
        question = response.data
        // 更新store中的题目信息
        questionStore.updateQuestion(id, question)
        
        // 更新selectedQuestionObjects中对应的题目
        const index = selectedQuestionObjects.value.findIndex(q => q.id === id)
        if (index !== -1) {
          selectedQuestionObjects.value[index] = question
        }
      } catch (error) {
        console.error(`后台获取题目 ${id} 详情失败:`, error)
      }
    }
    
    return question
  })
  
  // 并行执行所有请求
  await Promise.all(promises)
  console.log('所有题目详情加载完成')
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 获取图片数量
function getImageCount(question: any): number {
  let count = 0
  if (question.image_url) count++
  if (question.images && question.images.length > 0) count += question.images.length
  return count
}

// 监听刷新触发器变化
watch(() => props.refreshTrigger, async (newTrigger, oldTrigger) => {
  // 只有当触发器真正变化且不是初始值时才刷新
  if (newTrigger && newTrigger !== oldTrigger && newTrigger > 0) {
    console.log(`🔄 [QuestionList] 检测到刷新触发器变化: ${oldTrigger} -> ${newTrigger}，开始刷新数据`)
    
    // 强制刷新数据
    await fetchQuestions(true) // 传入 true 表示强制刷新
    await fetchKnowledgePoints() // 知识点数据刷新
    
    console.log('✅ [QuestionList] 数据刷新完成')
  }
})

onMounted(async () => {
  console.log('📦 [QuestionList] 组件挂载，初始化数据')

  // 获取题目类型（来源）数据
  questionTypeStore.fetchQuestionTypes()

  // 获取知识点数据
  await fetchKnowledgePoints()
  
  // 只在没有缓存数据时才显示loading状态
  if (!questionStore.hasQuestions.value) {
    await fetchQuestions()
  } else {
    // 如果有缓存数据，直接使用，在后台刷新
    console.log('📋 [QuestionList] 使用现有缓存数据，在后台刷新')
    questionStore.fetchQuestions()
  }
})
</script>

<style scoped>
.question-management {
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 0;
}

.section-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.question-count {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.cache-indicator {
  color: #10b981;
  font-size: 12px;
  font-weight: 600;
  background: #d1fae5;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.filter-group label {
  color: #1e293b;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.filter-input,
.filter-select {
  padding: 8px 16px;
  border: 2px solid #bae6fd;
  border-radius: 8px;
  background: white;
  color: #1e293b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 150px;
}

.filter-input:hover,
.filter-select:hover {
  border-color: #1e90ff;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.selected-info {
  color: #1e90ff;
  font-weight: 600;
  font-size: 14px;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.questions-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
}

.questions-table {
  width: 100%;
  border-collapse: collapse;
}

.questions-table thead {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.questions-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.questions-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
  max-width: 200px;
}

.questions-table tbody .table-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.questions-table tbody .table-row:hover {
  background: #f8fafc;
}

.table-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.question-content-cell {
  max-width: 300px;
}

.question-preview {
  font-weight: 500;
  color: #1e293b;
  line-height: 1.4;
  margin-bottom: 4px;
}

.has-images-indicator {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.level-badge {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.category-gesp { background: #dbeafe; color: #1d4ed8; }
.category-csp_j { background: #fef3c7; color: #92400e; }
.category-csp_s { background: #fce7f3; color: #9d174d; }
.category-noi_p { background: #e0e7ff; color: #3730a3; }
.category-noi_a { background: #fee2e2; color: #991b1b; }
.category-noi_ioi { background: #ede9fe; color: #5b21b6; }
.category-other { background: #f3f4f6; color: #374151; }

.no-level {
  color: #9ca3af;
  font-style: italic;
}

.difficulty-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.difficulty-easy { background: #d1fae5; color: #065f46; }
.difficulty-medium { background: #e0e7ef; color: #1e293b; }
.difficulty-hard { background: #fee2e2; color: #b91c1c; }

.answer-cell {
  font-weight: 600;
  color: #10b981;
}

.knowledge-points-cell {
  max-width: 150px;
}

.knowledge-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.knowledge-tag-mini {
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid #bae6fd;
}

.more-tags {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

.no-tags {
  color: #9ca3af;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
}

.btn-edit {
  background: #f59e0b;
  color: white;
}

.btn-edit:hover {
  background: #d97706;
  transform: translateY(-1px);
}

.btn-delete {
  background: #ef4444;
  color: white;
}

.btn-delete:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.btn-secondary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.detail-row {
  background: #f8fafc;
}

.detail-row td {
  padding: 0;
}

.question-details {
  padding: 24px;
  background: #f9fafb;
  border-radius: 8px;
  margin: 16px;
  border: 1px solid #e2e8f0;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h5 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.question-full-text {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  word-break: break-word;
}

.images-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.preview-image-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  background: white;
}

.preview-image-item:hover {
  transform: scale(1.05);
  border-color: #1e90ff;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.2);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f8fafc;
}

.preview-image-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(30, 144, 255, 0.9);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.preview-image-count {
  color: white;
  font-size: 10px;
  font-weight: 600;
}

.code-block {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  border: 1px solid #334155;
}

.code-block pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.option-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.option-item.option-correct {
  background: #f0fdf4;
  border-color: #10b981;
  border-left: 4px solid #10b981;
}

.option-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
  min-width: 24px;
}

.option-text {
  flex: 1;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.option-code-block {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 2px solid #1e90ff;
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0;
  overflow-x: auto;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.1);
}

.option-code-block pre {
  margin: 0;
  font-family: 'Courier New', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #1e293b;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.correct-indicator {
  color: #10b981;
  font-weight: bold;
  font-size: 16px;
  margin-left: 8px;
}

.explanation-box {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #374151;
}

.explanation-box p {
  margin: 0;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #1e90ff;
}

.spinner {
  font-size: 24px;
  animation: spin 1s linear infinite;
  color: #1e90ff;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
}

.loading-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: #64748b;
  font-size: 14px;
}

.loading-spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid #1e90ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 18px;
  font-weight: 500;
}

.btn-icon {
  font-size: 16px;
  font-weight: bold;
  margin-right: 4px;
}

.action-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-action :deep(.lucide-icon) {
  flex-shrink: 0;
  color: inherit;
}

/* 图片模态框样式 */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.image-modal-content {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.image-modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.image-modal-close:hover {
  background-color: #f0f0f0;
}

.modal-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  margin-top: 20px;
}
</style> 