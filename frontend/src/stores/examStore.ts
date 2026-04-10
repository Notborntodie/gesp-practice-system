import { ref, computed } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// 考试状态管理
export const useExamStore = () => {
  // 状态
  const exams = ref<any[]>([])
  const loading = ref(false)
  const lastFetchTime = ref<number>(0)
  const cacheExpiry = 30 * 60 * 1000 // 30分钟缓存过期时间
  const isInitialized = ref(false) // 标记是否已经初始化过

  // 计算属性
  const isCacheValid = computed(() => {
    return Date.now() - lastFetchTime.value < cacheExpiry
  })

  const hasExams = computed(() => exams.value.length > 0)

  // 方法
  const fetchExams = async (forceRefresh = false) => {
    // 如果缓存有效且不强制刷新，直接返回缓存数据
    if (!forceRefresh && isCacheValid.value && hasExams.value) {
      console.log('使用考试缓存数据，跳过API调用')
      return exams.value
    }

    // 如果已经初始化过且有数据，但缓存过期，显示加载状态但不阻塞UI
    if (isInitialized.value && hasExams.value && !forceRefresh) {
      console.log('考试缓存过期，在后台刷新数据')
      // 在后台静默刷新，不显示loading状态
      refreshInBackground()
      return exams.value
    }

    loading.value = true
    try {
      console.log('开始获取考试列表...')
      const response = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })

      // 只获取基本信息，不获取详情（按需加载）
      exams.value = response.data
      lastFetchTime.value = Date.now()
      isInitialized.value = true

      console.log('考试列表获取完成，共', exams.value.length, '个考试')
      return exams.value
    } catch (error: any) {
      console.error('获取考试列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 后台静默刷新数据
  const refreshInBackground = async () => {
    try {
      console.log('开始后台刷新考试数据...')
      const response = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })

      // 只获取基本信息，不获取详情（按需加载）
      exams.value = response.data
      lastFetchTime.value = Date.now()
      console.log('考试数据后台刷新完成')
    } catch (error: any) {
      console.error('考试数据后台刷新失败:', error)
    }
  }

  // 预加载考试详情（用于用户点击查看详情时）；force=true 时总是重新拉取并更新缓存
  const preloadExamDetails = async (examId: number, force = false) => {
    const exam = exams.value.find(e => e.id === examId)
    if (!force && exam && exam.questions) {
      return
    }
    try {
      const detailResponse = await axios.get(`${BASE_URL}/exams/${examId}`)
      const data = detailResponse.data
      const questions = data.questions || []
      const n = questions.length
      const base = exam || { id: examId }
      updateExam(examId, {
        ...base,
        ...data,
        questions,
        question_count: n,
        total_questions: n
      })
    } catch (error: any) {
      console.warn(`预加载考试 ${examId} 详情失败:`, error)
    }
  }

  // 添加考试到缓存
  const addExam = (exam: any) => {
    exams.value.unshift(exam) // 添加到开头
  }

  // 更新缓存中的考试
  const updateExam = (examId: number, updatedData: any) => {
    const index = exams.value.findIndex(e => e.id === examId)
    if (index !== -1) {
      exams.value[index] = { ...exams.value[index], ...updatedData }
    }
  }

  // 从缓存中删除考试
  const removeExam = (examId: number) => {
    const index = exams.value.findIndex(e => e.id === examId)
    if (index !== -1) {
      exams.value.splice(index, 1)
    }
  }

  // 批量删除考试
  const removeExams = (examIds: number[]) => {
    exams.value = exams.value.filter(e => !examIds.includes(e.id))
  }

  // 清空缓存
  const clearCache = () => {
    exams.value = []
    lastFetchTime.value = 0
    isInitialized.value = false
  }

  // 获取单个考试（优先从缓存获取）
  const getExam = (examId: number) => {
    return exams.value.find(e => e.id === examId)
  }

  // 搜索考试（在缓存中搜索）
  const searchExams = (query: string) => {
    if (!query) return exams.value
    return exams.value.filter(e => 
      e.name?.toLowerCase().includes(query.toLowerCase()) ||
      e.description?.toLowerCase().includes(query.toLowerCase())
    )
  }

  // 按等级过滤考试
  const filterExamsByLevel = (level: string) => {
    if (!level) return exams.value
    return exams.value.filter(e => String(e.level || 1) === level)
  }

  // 按类型过滤考试
  const filterExamsByType = (type: string) => {
    if (!type) return exams.value
    return exams.value.filter(e => (e.type || '真题') === type)
  }

  // 创建考试
  const createExam = async (examData: any) => {
    try {
      const response = await axios.post(`${BASE_URL}/exams`, examData)
      const newExam = response.data
      
      // 添加到缓存
      addExam(newExam)
      
      return newExam
    } catch (error: any) {
      console.error('创建考试失败:', error)
      throw error
    }
  }

  // 更新考试（PUT 仅返回 message，成功后强制拉详情并同步列表中的题量字段）
  const updateExamData = async (examId: number, examData: any) => {
    try {
      const response = await axios.put(`${BASE_URL}/exams/${examId}`, examData)
      await preloadExamDetails(examId, true)
      return response.data
    } catch (error: any) {
      console.error('更新考试失败:', error)
      throw error
    }
  }

  // 删除考试
  const deleteExam = async (examId: number) => {
    try {
      await axios.delete(`${BASE_URL}/exams/${examId}`)
      
      // 从缓存中删除
      removeExam(examId)
      
      return true
    } catch (error: any) {
      console.error('删除考试失败:', error)
      throw error
    }
  }

  return {
    // 状态
    exams,
    loading,
    lastFetchTime,
    isInitialized,
    
    // 计算属性
    isCacheValid,
    hasExams,
    
    // 方法
    fetchExams,
    preloadExamDetails,
    createExam,
    updateExamData,
    deleteExam,
    clearCache,
    getExam,
    searchExams,
    filterExamsByLevel,
    filterExamsByType,
    
    // 缓存操作方法
    addExam,
    updateExam,
    removeExam,
    removeExams
  }
}
