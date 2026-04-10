<template>
  <div class="level-exams-container">
    <!-- 左侧边栏：考试类型选择器 -->
    <div class="sidebar-left">
      <div class="sidebar-title">{{ getLevelText(level) }}</div>
      <nav class="type-nav-vertical">
              <button 
                v-for="type in examTypes" 
                :key="type.key"
                @click="selectExamType(type)"
                :class="['type-menu-item', { active: selectedExamType === type.key }]"
              >
          <Icon :name="getTypeIcon(type.key)" :size="18" />
          <span>{{ type.label }}</span>
              </button>
            </nav>
      
      <!-- 等级切换 -->
      <div class="level-switcher">
        <div class="level-switcher-header">
          <Icon name="chevron-down" :size="36" class="level-arrow-icon" />
          <div class="level-switcher-title">切换等级</div>
        </div>
        <div class="level-grid">
          <div 
            class="level-item level-item-all"
            :class="{ 'active': level === 0 }"
            @click="switchLevel(0)"
          >
            全
          </div>
          <div 
            v-for="lvl in levels" 
            :key="lvl"
            class="level-item"
            :class="{ 'active': level === lvl }"
            @click="switchLevel(lvl)"
          >
            {{ lvl }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- GESP考级备考阶段横幅提示 -->
      <div v-if="shouldShowBanner" class="preparation-banner">
        <div class="banner-content">
          <Icon name="info" :size="20" />
          <div class="banner-text">
            <strong>GESP考级备考阶段</strong>
            <span>2月2日-3月14日为GESP考级备考阶段，请备考1-4级的同学们前往学习计划页面练习。</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <Icon name="loader-2" :size="24" spin />
        <p>正在加载考试列表...</p>
      </div>
      
      <div v-else-if="filteredExams.length === 0" class="empty-state">
        <Icon name="inbox" :size="48" />
        <p>该等级暂时没有可用的练习</p>
      </div>
      
      <!-- 考试列表表格 -->
      <div v-else class="exams-table-container">
        <table class="exams-table">
          <thead>
            <tr>
              <th>考试名称</th>
              <th>类型</th>
              <th>题目数</th>
              <th>描述</th>
              <th>
                <div class="th-with-refresh">
                  <span>操作</span>
                  <button @click="fetchExams" class="btn-refresh-header" :disabled="loading" title="刷新列表">
                    <Icon name="refresh-cw" :size="14" :spin="loading" />
                    <span>刷新</span>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="exam in filteredExams" :key="exam.id">
              <td class="exam-name-cell">{{ exam.name }}</td>
              <td>
                <span class="type-badge" :class="`type-${exam.type || '真题'}`">
                  {{ getTypeText(exam.type) }}
                  </span>
              </td>
              <td>{{ exam.total_questions || 0 }} 题</td>
              <td class="description-cell">{{ exam.description || '暂无描述' }}</td>
              <td>
                  <div class="action-buttons">
                  <button 
                    @click.stop="startExam(exam)" 
                    class="btn-action btn-view" 
                    title="开始练习"
                  >
                    <Icon name="play" :size="16" />
                    <span>开始练习</span>
                    </button>
                  <button @click.stop="startReview(exam)" class="btn-action btn-review" title="开始复习">
                    <Icon name="book-open" :size="16" />
                    <span>开始复习</span>
                  </button>
                  <button @click.stop="viewSubmissions(exam)" class="btn-action btn-submissions" title="查看提交">
                    <Icon name="clipboard-list" :size="16" />
                    <span>查看提交</span>
                    </button>
                    <button 
                      v-if="isTeacher" 
                    @click.stop="viewStudentSubmissions(exam)" 
                    class="btn-action btn-student-submissions" 
                    title="查看学生提交"
                    >
                    <Icon name="graduation-cap" :size="16" />
                    <span>查看学生提交</span>
                    </button>
                  </div>
              </td>
            </tr>
          </tbody>
        </table>
            </div>
          </div>

    <!-- 等级切换提示弹窗 -->
    <transition name="toast-fade">
      <div v-if="showLevelToast" class="level-toast">
        <div class="toast-content">
          <span class="toast-icon">✓</span>
          <span class="toast-text">已切换到{{ level === 0 ? '全部等级' : `GESP ${level}级` }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()

// 从路由参数获取等级，默认显示全部等级(0)
const level = ref(parseInt(route.params.level as string) || 0)

// 等级列表 (1-8，加上"全"刚好9个，3x3九宫格)
const levels = ref([1, 2, 3, 4, 5, 6, 7, 8])

// 等级切换提示弹窗
const showLevelToast = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

// 数据状态
const exams = ref<any[]>([])
const filteredExams = ref<any[]>([])
const loading = ref(false)
const selectedExam = ref<any>(null)
const selectedExamType = ref('真题')
const isBreathing = ref(false)


// 教师权限检查
const isTeacher = computed(() => {
  try {
    const userInfoStr = localStorage.getItem('userInfo')
    if (!userInfoStr) {
      return false
    }
    
    const userInfo = JSON.parse(userInfoStr)
    const roleNames: string[] = userInfo.role_names || userInfo.roles?.map((r: any) => r.name) || []
    return roleNames.includes('teacher') || roleNames.includes('admin') || roleNames.includes('super_admin')
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return false
  }
})

// 判断是否在备考期间（2月2日-3月14日）
const isPreparationPeriod = computed(() => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const startDate = new Date(currentYear, 1, 2) // 2月2日（月份从0开始）
  const endDate = new Date(currentYear, 2, 14) // 3月14日
  
  return now >= startDate && now <= endDate
})

// 判断当前等级是否为1-4级
const isLevel1To4 = computed(() => {
  return level.value >= 1 && level.value <= 4
})

// 判断是否显示横幅
const shouldShowBanner = computed(() => {
  if (!isPreparationPeriod.value) {
    return false
  }
  
  // 如果当前等级是1-4级，显示横幅
  if (isLevel1To4.value) {
    return true
  }
  
  // 如果当前等级是0（全部等级），检查列表中是否有1-4级的考试
  if (level.value === 0) {
    return filteredExams.value.some(exam => exam.level >= 1 && exam.level <= 4)
  }
  
  return false
})

// 用户信息
const userInfo = ref<any>(null)

// 考试类型选项
const examTypes = [
  { key: '真题', label: '真题' },
  { key: '专项', label: '专项' },
  { key: '模拟', label: '模拟' }
]

// 获取考试列表
async function fetchExams() {
  loading.value = true
  try {
    const params: any = {}
    if (level.value !== 0) {
      params.level = level.value
    }
    // 老师 / 管理员始终能看到全部试卷
    if (isTeacher.value) {
      params.include_all = 1
    }
    const response = await axios.get(`${BASE_URL}/exams`, { params })
    exams.value = response.data
    // 初始化过滤后的考试列表
    filterExams()
  } catch (error: any) {
    console.error('获取考试列表失败:', error)
    alert('获取考试列表失败: ' + (error.response?.data?.error || error.message))
  } finally {
    loading.value = false
  }
}

// 根据类型过滤考试
function filterExams() {
  filteredExams.value = exams.value.filter(exam => exam.type === selectedExamType.value)
  
  // 按时间排序，最新的在前面
  filteredExams.value.sort((a, b) => {
    const timeA = getExamTimeForSort(a)
    const timeB = getExamTimeForSort(b)
    return timeB.getTime() - timeA.getTime() // 降序排列，最新的在前
  })
  
  // 重置选中的考试
  if (filteredExams.value.length > 0) {
    selectedExam.value = filteredExams.value[0]
  } else {
    selectedExam.value = null
  }
}

// 选择考试类型
function selectExamType(type: any) {
  selectedExamType.value = type.key
  filterExams()
}

// 选择考试
function selectExam(exam: any) {
  selectedExam.value = exam
  
  // 触发呼吸动画
  isBreathing.value = true
  
  // 3秒后停止呼吸动画
  setTimeout(() => {
    isBreathing.value = false
  }, 6000)
}

// 等级文本
function getLevelText(level: number) {
  if (level === 0) return '全部等级'
  return `GESP ${level}级`
}

// 类型文本
function getTypeText(type: string) {
  return type || '真题'
}

// 类型图标
function getTypeIcon(type: string) {
  const iconMap: { [key: string]: string } = {
    '真题': 'file-check',
    '专项': 'target',
    '模拟': 'clipboard-list'
  }
  return iconMap[type] || 'file'
}

// 格式化考试时间
function formatExamTime(dateString: string) {
  if (!dateString) return '未知时间'
  
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  return `${year}年${month}月${day}日`
}

// 获取难度文本
function getDifficultyText(difficulty: string) {
  const difficultyMap: { [key: string]: string } = {
    'easy': '简单',
    'medium': '中等', 
    'hard': '困难'
  }
  return difficultyMap[difficulty] || '中等'
}

// 从考试名称中提取时间信息
function getExamTime(exam: any) {
  if (!exam.name) {
    return '未知时间'
  }
  
  // 正则表达式匹配年份和月份
  // 匹配格式：2024年、2024、2024年9月、2024年09月等
  const yearMatch = exam.name.match(/(\d{4})年?/)
  const monthMatch = exam.name.match(/(\d{1,2})月/)
  
  if (yearMatch) {
    const year = yearMatch[1]
    if (monthMatch) {
      const month = monthMatch[1].padStart(2, '0')
      return `${year}-${month}`
    } else {
      // 只有年份，默认显示为01月
      return `${year}-01`
    }
  }
  
  return '未知时间'
}

// 从考试名称中提取时间用于排序
function getExamTimeForSort(exam: any) {
  if (!exam.name) {
    return new Date('1900-01-01') // 未知时间的排在最后
  }
  
  const yearMatch = exam.name.match(/(\d{4})年?/)
  const monthMatch = exam.name.match(/(\d{1,2})月/)
  
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    const month = monthMatch ? parseInt(monthMatch[1]) : 1
    return new Date(year, month - 1, 1) // 月份从0开始，所以减1
  }
  
  return new Date('1900-01-01') // 无法解析时间的排在最后
}

// 获取平均难度
function getAverageDifficulty(questions: any[]) {
  if (!questions || questions.length === 0) return 'N/A'
  
  const difficultyMap: { [key: string]: number } = { easy: 1, medium: 2, hard: 3 }
  const total = questions.reduce((sum, q) => {
    return sum + (difficultyMap[q.difficulty] || 2)
  }, 0)
  
  const average = total / questions.length
  if (average <= 1.5) return '简单'
  if (average <= 2.5) return '中等'
  return '困难'
}

// 获取代码题数量
function getCodeQuestionCount(questions: any[]) {
  if (!questions) return 0
  return questions.filter(q => q.question_type === 'code').length
}

// 获取文本题数量
function getTextQuestionCount(questions: any[]) {
  if (!questions) return 0
  return questions.filter(q => q.question_type === 'text').length
}

// 返回上一页
function goBack() {
  router.push('/select-level')
}

// 跳转到创建考试页面
function goToCreateExam() {
  router.push('/admin/create-exam')
}

// 查看提交记录
function viewSubmissions(exam: any) {
  router.push(`/exam-submissions/${exam.id}`)
}

// 开始练习
function startExam(exam: any) {
  router.push(`/exam/${exam.id}`)
}

// 开始复习
function startReview(exam: any) {
  router.push(`/exam/${exam.id}?mode=review`)
}

// 查看学生提交记录
function viewStudentSubmissions(exam: any) {
  // 获取用户信息
  try {
    const userInfoStr = localStorage.getItem('userInfo')
    if (!userInfoStr) {
      alert('请先登录')
      router.push('/login')
      return
    }
    userInfo.value = JSON.parse(userInfoStr)
    
    // 直接跳转到学生提交记录页面（显示所有学生）
    const route = `/teacher/${userInfo.value.id}/submissions`
    if (exam.id) {
      router.push({ path: route, query: { exam_id: exam.id.toString() } })
    } else {
      router.push(route)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    alert('获取用户信息失败')
  }
}

// 切换等级
function switchLevel(newLevel: number) {
  if (newLevel !== level.value) {
    level.value = newLevel
    // 切换等级时自动选择"真题"类型
    selectedExamType.value = '真题'
    // 保存到 sessionStorage（当前会话）
    sessionStorage.setItem('levelExamsSelectedLevel', newLevel.toString())
    // 保存到 localStorage
    if (newLevel > 0) {
      localStorage.setItem('userGespLevel', newLevel.toString())
    }
    // 更新路由
    router.replace(`/level-exams/${newLevel}`)
    // 重新获取考试列表
    fetchExams()
    
    // 显示提示弹窗
    showLevelToast.value = true
    if (toastTimer) {
      clearTimeout(toastTimer)
    }
    toastTimer = setTimeout(() => {
      showLevelToast.value = false
      toastTimer = null
    }, 2000)
  }
}

onMounted(() => {
  // 从 sessionStorage 读取当前会话选中的等级
  const sessionLevel = sessionStorage.getItem('levelExamsSelectedLevel')
  if (sessionLevel !== null) {
    const savedLevel = parseInt(sessionLevel)
    if (!isNaN(savedLevel) && level.value !== savedLevel) {
      level.value = savedLevel
      router.replace(`/level-exams/${savedLevel}`)
    }
  }
  fetchExams()
})
</script>

<style scoped>
.level-exams-container {
  width: 100vw;
  min-height: calc(100vh - 48px);
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  overflow-x: hidden;
  position: fixed;
  top: 48px; /* NavBar 高度 */
  left: 0;
  right: 0;
  bottom: 0;
}

/* 左侧边栏 */
.sidebar-left {
  width: 160px;
  min-width: 160px;
  background: linear-gradient(135deg, #5ba3d9 0%, #7ec8e3 100%);
  padding: 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: fixed;
  top: 48px;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-title {
  color: white;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  margin-bottom: 4px;
}

.type-nav-vertical {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.type-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  text-align: left;
}

.type-menu-item:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.type-menu-item.active {
  background: rgba(255,255,255,0.95);
  color: #1e90ff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  margin-left: 160px;
  padding: 12px 32px;
  min-height: calc(100vh - 48px);
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #64748b;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #64748b;
  gap: 12px;
}

/* 考试列表表格 */
.exams-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
}

.exams-table {
  width: 100%;
  border-collapse: collapse;
}

.exams-table thead {
  background: linear-gradient(135deg, #5ba3d9 0%, #7ec8e3 100%);
}

.exams-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.exams-table th:last-child,
.exams-table td:last-child {
  min-width: 280px;
}

.exams-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
}

.exams-table tbody tr {
  transition: all 0.2s ease;
}

.exams-table tbody tr:hover {
  background: #f8fafc;
}

.exam-name-cell {
  font-weight: 500;
  color: #1e90ff;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.description-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.type-真题 { 
  background: linear-gradient(135deg, #5ba3d9 0%, #7ec8e3 100%);
  color: white;
}
.type-模拟 { 
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
}
.type-专项 { 
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.btn-action :deep(.lucide-icon) {
  font-size: 14px;
  flex-shrink: 0;
  color: inherit;
}

.btn-view {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2);
}

.btn-view:hover {
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.btn-review {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
}

.btn-review:hover {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-submissions {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
}

.btn-submissions:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-student-submissions {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
}

.btn-student-submissions:hover {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

/* 表头刷新按钮 */
.th-with-refresh {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn-refresh-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 10px;
  background: #1e90ff;
  border: 1px solid #1e90ff;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh-header:hover {
  background: #0c7cd5;
  border-color: #0c7cd5;
}

.btn-refresh-header:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 侧边栏等级切换 */
.level-switcher {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.level-switcher-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10px;
}

.level-arrow-icon {
  color: white;
  animation: bounce 1.5s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(4px);
  }
}

.level-switcher-title {
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.level-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: rgba(255,255,255,0.15);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.level-item:hover {
  background: rgba(255,255,255,0.3);
  transform: scale(1.05);
}

.level-item.active {
  background: white;
  color: #1e90ff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar-left {
    width: 60px;
    min-width: 60px;
    padding: 16px 8px;
  }
  
  .sidebar-title {
    font-size: 12px;
    padding: 8px 0;
  }

  .type-menu-item {
    padding: 10px;
    justify-content: center;
  }
  
  .type-menu-item span {
    display: none;
  }

  .main-content {
    margin-left: 60px;
    padding: 16px;
  }

  .level-switcher-title {
    display: none;
  }

  .level-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }
  
  .level-item {
    font-size: 12px;
  }

  .exams-table th,
  .exams-table td {
    padding: 12px 10px;
    font-size: 12px;
  }

  .description-cell {
    max-width: 150px;
  }
  
  .btn-action span {
    display: none;
  }
}

@media (max-width: 480px) {
  .exams-table th,
  .exams-table td {
    padding: 10px 8px;
    font-size: 11px;
  }
}

/* 等级切换提示弹窗样式 */
.level-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  pointer-events: none;
}

.toast-content {
  background: linear-gradient(135deg, #5ba3d9 0%, #7ec8e3 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.4);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
}

.toast-icon {
  font-size: 1.2rem;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-text {
  color: #ffffff;
  font-weight: 600;
}

/* 弹窗淡入淡出动画 */
.toast-fade-enter-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-fade-enter-to {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-fade-leave-active {
  transition: opacity 0.3s ease-in, transform 0.3s ease-in;
}

.toast-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

/* GESP考级备考阶段横幅 */
.preparation-banner {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  animation: slideDown 0.5s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: white;
}

.banner-content :deep(.lucide-icon) {
  flex-shrink: 0;
  margin-top: 2px;
  color: white;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-text strong {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.banner-text span {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.95;
}

/* 禁用按钮样式 */
.btn-action.btn-disabled {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%) !important;
  color: rgba(255, 255, 255, 0.7) !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
  opacity: 0.7;
}

.btn-action.btn-disabled:hover {
  transform: none !important;
  box-shadow: none !important;
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%) !important;
}
</style>
