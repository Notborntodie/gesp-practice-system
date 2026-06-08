import { ref, computed } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// 题目状态管理
export const useQuestionStore = () => {
  // 状态
  const questions = ref<any[]>([])
  const loading = ref(false)
  const lastFetchTime = ref<number>(0)
  const cacheExpiry = 30 * 60 * 1000 // 30分钟缓存过期时间（从5分钟延长到30分钟）
  const isInitialized = ref(false) // 新增：标记是否已经初始化过

  // 计算属性
  const isCacheValid = computed(() => {
    return Date.now() - lastFetchTime.value < cacheExpiry
  })

  const hasQuestions = computed(() => questions.value.length > 0)

  // 方法
  const fetchQuestions = async (forceRefresh = false) => {
    // 如果缓存有效且不强制刷新，直接返回缓存数据
    if (!forceRefresh && isCacheValid.value && hasQuestions.value) {
      console.log('使用缓存数据，跳过API调用')
      return questions.value
    }

    // 如果已经初始化过且有数据，但缓存过期，显示加载状态但不阻塞UI
    if (isInitialized.value && hasQuestions.value && !forceRefresh) {
      console.log('缓存过期，在后台刷新数据')
      // 在后台静默刷新，不显示loading状态
      refreshInBackground()
      return questions.value
    }

    loading.value = true
    try {
      console.log('开始获取题目列表...')
      const response = await axios.get(`${BASE_URL}/questions?list=1`)
      
      // 只获取基本信息，不获取详情（按需加载）
      questions.value = response.data
      lastFetchTime.value = Date.now()
      isInitialized.value = true
      
      return questions.value
    } catch (error: any) {
      console.error('获取题目列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 后台静默刷新数据
  const refreshInBackground = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/questions?list=1`)
      questions.value = response.data
      lastFetchTime.value = Date.now()
    } catch (error: any) {
      console.error('后台刷新失败:', error)
    }
  }


  // 预加载题目详情（用于用户点击查看详情时）
  const preloadQuestionDetails = async (questionId: number) => {
    const question = questions.value.find(q => q.id === questionId)
    if (question && (!question.options || !question.explanation)) {
      try {
        const detailResponse = await axios.get(`${BASE_URL}/questions/${questionId}`)
        updateQuestion(questionId, detailResponse.data)
      } catch (error: any) {
        console.warn(`预加载题目 ${questionId} 详情失败:`, error)
      }
    }
  }

  // 添加题目到缓存
  const addQuestion = (question: any) => {
    questions.value.unshift(question) // 添加到开头
  }

  // 更新缓存中的题目
  const updateQuestion = (questionId: number, updatedData: any) => {
    const index = questions.value.findIndex(q => q.id === questionId)
    if (index !== -1) {
      questions.value[index] = { ...questions.value[index], ...updatedData }
    }
  }

  // 从缓存中删除题目
  const removeQuestion = (questionId: number) => {
    const index = questions.value.findIndex(q => q.id === questionId)
    if (index !== -1) {
      questions.value.splice(index, 1)
    }
  }

  // 批量删除题目
  const removeQuestions = (questionIds: number[]) => {
    questions.value = questions.value.filter(q => !questionIds.includes(q.id))
  }

  // 清空缓存
  const clearCache = () => {
    questions.value = []
    lastFetchTime.value = 0
    isInitialized.value = false
  }

  // 获取单个题目（优先从缓存获取）
  const getQuestion = (questionId: number) => {
    return questions.value.find(q => q.id === questionId)
  }

  // 搜索题目（在缓存中搜索）
  const searchQuestions = (query: string) => {
    if (!query) return questions.value
    return questions.value.filter(q => 
      q.question_text?.toLowerCase().includes(query.toLowerCase())
    )
  }

  // 按等级过滤题目
  const filterQuestionsByLevel = (level: string) => {
    if (!level) return questions.value
    return questions.value.filter(q => String(q.level || 1) === level)
  }

  // 按日期过滤题目
  const filterQuestionsByDate = (date: string) => {
    if (!date) return questions.value
    return questions.value.filter(q => q.question_date === date)
  }

  return {
    // 状态
    questions,
    loading,
    lastFetchTime,
    isInitialized,
    
    // 计算属性
    isCacheValid,
    hasQuestions,
    
    // 方法
    fetchQuestions,
    preloadQuestionDetails,
    addQuestion,
    updateQuestion,
    removeQuestion,
    removeQuestions,
    clearCache,
    getQuestion,
    searchQuestions,
    filterQuestionsByLevel,
    filterQuestionsByDate
  }
}
