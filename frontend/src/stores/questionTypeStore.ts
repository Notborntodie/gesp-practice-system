import { ref, computed } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

interface QuestionType {
  id: number
  name: string
  display_name: string
  description: string
  is_system: number
  is_active: number
  sort_order: number
  created_at?: string
  updated_at?: string
}

interface QuestionTypesResponse {
  success: boolean
  data: {
    systemTypes: QuestionType[]
    customTypes: QuestionType[]
  }
}

// 题目类型状态管理
export const useQuestionTypeStore = () => {
  // 状态
  const systemTypes = ref<QuestionType[]>([])
  const customTypes = ref<QuestionType[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchTime = ref<number>(0)
  const cacheExpiry = 30 * 60 * 1000 // 30分钟缓存过期时间
  const isInitialized = ref(false)

  // 计算属性
  const isCacheValid = computed(() => {
    return Date.now() - lastFetchTime.value < cacheExpiry
  })

  const allTypes = computed(() => {
    return [...systemTypes.value, ...customTypes.value].sort((a, b) => a.sort_order - b.sort_order)
  })

  const hasTypes = computed(() => allTypes.value.length > 0)

  // 获取题目类型列表
  const fetchQuestionTypes = async (forceRefresh = false) => {
    // 如果缓存有效且不强制刷新，直接返回缓存数据
    if (!forceRefresh && isCacheValid.value && hasTypes.value) {
      console.log('使用题目类型缓存数据，跳过API调用')
      return { systemTypes: systemTypes.value, customTypes: customTypes.value }
    }

    // 如果已经初始化过且有数据，但缓存过期，后台静默刷新
    if (isInitialized.value && hasTypes.value && !forceRefresh) {
      console.log('题目类型缓存过期，在后台刷新数据')
      refreshInBackground()
      return { systemTypes: systemTypes.value, customTypes: customTypes.value }
    }

    loading.value = true
    error.value = null
    try {
      console.log('开始获取题目类型列表...')
      const response = await axios.get<QuestionTypesResponse>(`${BASE_URL}/question-types`)

      if (response.data.success) {
        systemTypes.value = response.data.data.systemTypes
        customTypes.value = response.data.data.customTypes
        lastFetchTime.value = Date.now()
        isInitialized.value = true
        console.log('题目类型获取成功:', { system: systemTypes.value.length, custom: customTypes.value.length })
      } else {
        throw new Error('获取题目类型失败')
      }

      return { systemTypes: systemTypes.value, customTypes: customTypes.value }
    } catch (err: any) {
      console.error('获取题目类型列表失败:', err)
      error.value = err.message || '获取题目类型失败'

      // 如果是首次加载失败，提供默认的硬编码类型作为回退
      if (!isInitialized.value) {
        console.warn('使用默认题目类型作为回退')
        const defaultTypes = getDefaultTypes()
        systemTypes.value = defaultTypes.systemTypes
        customTypes.value = defaultTypes.customTypes
        isInitialized.value = true
      }

      throw err
    } finally {
      loading.value = false
    }
  }

  // 后台静默刷新数据
  const refreshInBackground = async () => {
    try {
      const response = await axios.get<QuestionTypesResponse>(`${BASE_URL}/question-types`)
      if (response.data.success) {
        systemTypes.value = response.data.data.systemTypes
        customTypes.value = response.data.data.customTypes
        lastFetchTime.value = Date.now()
      }
    } catch (err: any) {
      console.error('题目类型后台刷新失败:', err)
    }
  }

  // 创建自定义题目类型
  const createQuestionType = async (typeData: { name: string; display_name: string; description: string }, adminUserId?: number | null) => {
    try {
      const response = await axios.post(`${BASE_URL}/question-types`, { ...typeData, admin_user_id: adminUserId })
      if (response.data.success) {
        // 将新创建的类型添加到 customTypes
        customTypes.value.push(response.data.data)
        // 重新排序
        customTypes.value.sort((a, b) => a.sort_order - b.sort_order)
        return response.data.data
      }
      throw new Error('创建题目类型失败')
    } catch (err: any) {
      console.error('创建题目类型失败:', err)
      throw err
    }
  }

  // 更新题目类型
  const updateQuestionType = async (id: number, updates: Partial<QuestionType>) => {
    try {
      const response = await axios.put(`${BASE_URL}/question-types/${id}`, updates)
      if (response.data.success) {
        // 更新缓存中的类型
        const typeList = systemTypes.value.find(t => t.id === id) ? systemTypes : customTypes
        const index = typeList.value.findIndex(t => t.id === id)
        if (index !== -1) {
          typeList.value[index] = { ...typeList.value[index], ...response.data.data }
        }
        return response.data.data
      }
      throw new Error('更新题目类型失败')
    } catch (err: any) {
      console.error('更新题目类型失败:', err)
      throw err
    }
  }

  // 删除题目类型（软删除）
  const deleteQuestionType = async (id: number) => {
    try {
      const response = await axios.delete(`${BASE_URL}/question-types/${id}`)
      if (response.data.success) {
        // 从缓存中移除
        const index = customTypes.value.findIndex(t => t.id === id)
        if (index !== -1) {
          customTypes.value.splice(index, 1)
        }
        return true
      }
      throw new Error('删除题目类型失败')
    } catch (err: any) {
      console.error('删除题目类型失败:', err)
      throw err
    }
  }

  // 根据名称获取类型
  const getQuestionTypeByName = (name: string): QuestionType | undefined => {
    return allTypes.value.find(t => t.name === name)
  }

  // 清除缓存
  const clearCache = () => {
    systemTypes.value = []
    customTypes.value = []
    lastFetchTime.value = 0
    isInitialized.value = false
    error.value = null
  }

  // 默认题目类型（API 失败时的回退选项）
  const getDefaultTypes = () => {
    return {
      systemTypes: [
        { id: 1, name: 'GESP', display_name: 'GESP', description: 'GESP 1-8级真题', is_system: 1, is_active: 1, sort_order: 1 },
        { id: 2, name: 'CSP_J', display_name: 'CSP-J', description: 'CSP 普及组', is_system: 1, is_active: 1, sort_order: 2 },
        { id: 3, name: 'CSP_S', display_name: 'CSP-S', description: 'CSP 提高组', is_system: 1, is_active: 1, sort_order: 3 },
        { id: 4, name: 'NOI_P', display_name: 'NOI普及', description: 'NOI 普及组', is_system: 1, is_active: 1, sort_order: 4 },
        { id: 5, name: 'NOI_A', display_name: 'NOI提高', description: 'NOI 提高组', is_system: 1, is_active: 1, sort_order: 5 },
        { id: 6, name: 'NOI_IOI', display_name: 'NOI省选', description: 'NOI 省选/国选', is_system: 1, is_active: 1, sort_order: 6 },
        { id: 7, name: 'Other', display_name: '其他', description: '其他类型题目', is_system: 1, is_active: 1, sort_order: 99 }
      ] as QuestionType[],
      customTypes: [] as QuestionType[]
    }
  }

  return {
    // 状态
    systemTypes,
    customTypes,
    loading,
    error,
    lastFetchTime,
    isInitialized,

    // 计算属性
    isCacheValid,
    allTypes,
    allQuestionTypes: allTypes,
    hasTypes,

    // 方法
    fetchQuestionTypes,
    refreshInBackground,
    createQuestionType,
    updateQuestionType,
    deleteQuestionType,
    getQuestionTypeByName,
    clearCache
  }
}
