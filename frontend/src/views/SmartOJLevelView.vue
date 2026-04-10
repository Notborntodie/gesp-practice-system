<template>
  <div class="smartoj-container">
    <!-- 左侧边栏 -->
    <div class="sidebar-left">
      <div class="sidebar-title">{{ getLevelText() }}</div>
      
      <!-- 时间过滤器 -->
      <div class="date-filter-section" v-if="availableDates.length > 0">
        <div class="filter-label">
          <Icon name="calendar" :size="16" />
          <span>时间筛选</span>
        </div>
        <select 
          v-model="selectedDate" 
          class="date-select"
          @change="handleDateChange"
        >
          <option value="">全部时间</option>
          <option 
            v-for="date in availableDates" 
            :key="date" 
            :value="date"
          >
            {{ formatDateOption(date) }}
          </option>
        </select>
      </div>
      
      <!-- 等级切换 -->
      <div class="level-switcher">
        <div class="level-switcher-header">
          <Icon name="chevron-down" :size="36" class="level-arrow-icon" />
          <div class="level-switcher-title">切换等级</div>
        </div>
        <div class="level-grid">
          <div 
            class="level-item level-item-all"
            :class="{ 'active': selectedLevel === '' }"
            @click="selectLevel(0)"
          >
            全
          </div>
          <div 
            v-for="lvl in levels" 
            :key="lvl"
            class="level-item"
            :class="{ 
              'active': selectedLevel === lvl.toString(),
              'disabled': isLevelDisabled(lvl)
            }"
            @click="!isLevelDisabled(lvl) && selectLevel(lvl)"
          >
            {{ lvl }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <div v-if="loading" class="loading-state">
        <Icon name="loader-2" :size="24" spin />
        <p>正在加载题目列表...</p>
      </div>
      
      <div v-else-if="filteredProblems.length === 0" class="empty-state">
        <Icon name="inbox" :size="48" />
        <p>暂无符合条件的题目</p>
      </div>
      
      <!-- 题目列表表格 -->
      <div v-else class="problems-table-container">
        <table class="problems-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>标题</th>
              <th>级别</th>
              <th>发布日期</th>
              <th>提交数</th>
              <th>通过数</th>
              <th>通过率</th>
              <th>
                <div class="th-with-refresh">
                  <span>操作</span>
                  <button @click="fetchProblems" class="btn-refresh-header" :disabled="loading" title="刷新列表">
                    <Icon name="refresh-cw" :size="14" :spin="loading" />
                    <span>刷新</span>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="problem in filteredProblems" :key="problem.id">
              <td>{{ problem.id }}</td>
              <td class="title-cell">{{ problem.title }}</td>
              <td>
                <span class="level-badge">GESP {{ problem.level }}级</span>
              </td>
              <td>{{ formatDate(problem.date) }}</td>
              <td>{{ problem.totalSubmissions }}</td>
              <td>{{ problem.acceptedSubmissions }}</td>
              <td>
                <span class="pass-rate">{{ problem.passRate }}%</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button @click="goToProblem(problem.id)" class="btn-action btn-view" title="开始练习">
                    <Icon name="play" :size="16" />
                    <span>开始练习</span>
                  </button>
                  <button @click.stop="viewSubmissions(problem.id)" class="btn-action btn-submissions" title="查看提交">
                    <Icon name="clipboard-list" :size="16" />
                    <span>查看提交</span>
                  </button>
                  <button 
                    v-if="isTeacher" 
                    @click.stop="viewStudentSubmissions(problem.id)" 
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
  </div>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Icon from '@/components/Icon.vue'

const router = useRouter()

// 筛选条件
const selectedLevel = ref('')
const selectedDate = ref('')

// 等级数据
const levels = ref([1, 2, 3, 4, 5, 6, 7, 8])

// 检查级别是否被禁用（已移除限制，始终返回false）
function isLevelDisabled(level: number): boolean {
  return false
}

// 题目数据
const problems = ref<any[]>([])
const loading = ref(false)
const pagination = ref({
  page: 1,
  pageSize: 100,
  total: 0
})

// 获取等级文本
function getLevelText() {
  if (!selectedLevel.value) return '全部等级'
  const level = parseInt(selectedLevel.value)
  return `GESP ${level}级`
}

// 从API获取题目列表
async function fetchProblems() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    }
    
    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }
    // 老师 / 管理员始终能看到全部 OJ 题
    if (isTeacher.value) {
      params.include_all = 1
    }
    
    const response = await axios.get(`${BASE_URL}/oj/problems`, { params })
    
    if (response.data.success) {
      problems.value = response.data.data.map((problem: any) => ({
        id: problem.id,
        title: problem.title,
        level: problem.level,
        date: problem.publish_date,
        shortDescription: truncateDescription(problem.description),
        totalSubmissions: problem.total_submissions || 0,
        acceptedSubmissions: problem.accepted_submissions || 0,
        passRate: problem.total_submissions > 0 
          ? ((problem.accepted_submissions / problem.total_submissions) * 100).toFixed(1)
          : 0
      }))
      
      if (response.data.pagination) {
        pagination.value.total = response.data.pagination.total
      }
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 截取描述文本
function truncateDescription(desc: string, maxLength: number = 80): string {
  if (!desc) return ''
  if (desc.length <= maxLength) return desc
  return desc.substring(0, maxLength) + '...'
}

// 从题目中提取所有可用的年月
const availableDates = computed(() => {
  const dates = new Set<string>()
  problems.value.forEach((problem) => {
    if (problem.date) {
      try {
        const date = new Date(problem.date)
        if (!isNaN(date.getTime())) {
          const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          dates.add(yearMonth)
        }
      } catch (error) {
        console.warn('日期解析失败:', problem.date, error)
      }
    }
  })
  return Array.from(dates).sort().reverse()
})

// 筛选后的题目列表
const filteredProblems = computed(() => {
  return problems.value.filter((problem) => {
    const matchLevel = !selectedLevel.value || problem.level.toString() === selectedLevel.value
    
    let matchDate = true
    if (selectedDate.value && problem.date) {
      const problemDate = new Date(problem.date)
      const problemYearMonth = `${problemDate.getFullYear()}-${String(problemDate.getMonth() + 1).padStart(2, '0')}`
      matchDate = problemYearMonth === selectedDate.value
    }
    
    return matchLevel && matchDate
  })
})

// 跳转到题目详情页
const goToProblem = (problemId: number) => {
  router.push(`/smartoj/${problemId}`)
}

// 查看提交记录
const viewSubmissions = (problemId: number) => {
  router.push(`/oj-submissions/${problemId}`)
}

// 检查用户是否为教师 / 管理员
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

// 查看学生提交记录
const viewStudentSubmissions = (problemId: number) => {
  try {
    const userInfoStr = localStorage.getItem('userInfo')
    if (!userInfoStr) {
      alert('请先登录')
      return
    }
    
    const userInfo = JSON.parse(userInfoStr)
    if (!userInfo.id) {
      alert('无法获取用户ID')
      return
    }
    
    router.push(`/teacher/${userInfo.id}/oj-submissions/${problemId}`)
  } catch (error) {
    console.error('获取用户信息失败:', error)
    alert('获取用户信息失败')
  }
}

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
    })
  } catch (error) {
    console.error('日期格式化错误:', error)
    return dateString
  }
}

// 格式化日期选项
const formatDateOption = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const [year, month] = dateStr.split('-')
    return `${year}年${month}月`
  } catch (error) {
    console.error('日期选项格式化错误:', error)
    return dateStr
  }
}

// 处理日期变化
const handleDateChange = () => {
  // 日期变化时筛选会在 computed 属性中自动处理
}

// 选择等级
function selectLevel(level: number) {
  if (level === 0) {
    selectedLevel.value = ''
  } else {
    selectedLevel.value = level.toString()
    localStorage.setItem('userGespLevel', level.toString())
    window.dispatchEvent(new CustomEvent('gespLevelChanged', { detail: { level } }))
  }
  pagination.value.page = 1
  fetchProblems()
}

// 监听级别变化事件
function handleGespLevelChanged(event: CustomEvent) {
  const newLevel = event.detail.level
  if (newLevel >= 1 && newLevel <= 8) {
    if (selectedLevel.value !== newLevel.toString()) {
      selectedLevel.value = newLevel.toString()
      localStorage.setItem('userGespLevel', newLevel.toString())
      pagination.value.page = 1
      fetchProblems()
    }
  }
}

onMounted(() => {
  const savedLevel = localStorage.getItem('userGespLevel')
  if (savedLevel) {
    const level = parseInt(savedLevel, 10)
    if (level >= 1 && level <= 8) {
      selectedLevel.value = level.toString()
    }
  }
  fetchProblems()
  window.addEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
})
</script>

<style scoped>
.smartoj-container {
  width: 100vw;
  min-height: calc(100vh - 48px);
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  overflow-x: hidden;
  position: fixed;
  top: 48px;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 左侧边栏 */
.sidebar-left {
  width: 160px;
  min-width: 160px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
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

/* 时间过滤器 */
.date-filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-weight: 500;
}

.date-select {
  appearance: none;
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  cursor: pointer;
  width: 100%;
}

.date-select:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
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

.level-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
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

/* 题目列表表格 */
.problems-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
}

.problems-table {
  width: 100%;
  border-collapse: collapse;
}

.problems-table thead {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.problems-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.problems-table th:last-child,
.problems-table td:last-child {
  min-width: 280px;
}

.problems-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
}

.problems-table tbody tr {
  transition: all 0.2s ease;
}

.problems-table tbody tr:hover {
  background: #f8fafc;
}

.title-cell {
  font-weight: 500;
  color: #1e90ff;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.pass-rate {
  font-weight: 600;
  color: #10b981;
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
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh-header:hover {
  background: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.5);
}

.btn-refresh-header:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  
  .date-filter-section {
    padding: 6px;
  }
  
  .filter-label span {
    display: none;
  }
  
  .date-select {
    font-size: 10px;
    padding: 6px;
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
  
  .main-content {
    margin-left: 60px;
    padding: 16px;
  }
  
  .problems-table-container {
    overflow-x: auto;
  }
  
  .problems-table {
    min-width: 800px;
  }
  
  .problems-table th,
  .problems-table td {
    padding: 12px 10px;
    font-size: 12px;
  }
  
  .btn-action span {
    display: none;
  }
}

@media (max-width: 480px) {
  .problems-table th,
  .problems-table td {
    padding: 10px 8px;
    font-size: 11px;
  }
}
</style>
