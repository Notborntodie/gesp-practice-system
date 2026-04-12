<template>
  <div class="smartoj-container">
    <!-- 左侧边栏 -->
    <div class="sidebar-left">
      <div class="sidebar-title">{{ getSidebarTitle() }}</div>

      <!-- 题目来源筛选 -->
      <nav class="type-nav-vertical">
        <button
          v-for="t in categoryOptions"
          :key="t.name"
          @click="selectCategory(t.name)"
          :class="['type-menu-item', { active: selectedCategory === t.name }]"
        >
          <Icon :name="t.icon" :size="16" />
          <span>{{ t.display_name || t.name }}</span>
        </button>
      </nav>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 二级导航栏：等级 + 搜索（仅 GESP） -->
      <div class="sub-nav-bar" v-if="selectedCategory === 'GESP'">
        <div class="sub-nav-tabs level-tabs">
          <button
            class="sub-nav-tab"
            :class="{ active: selectedLevel === '' }"
            @click="selectLevel(0)"
          >全部</button>
          <button
            v-for="lvl in levels"
            :key="lvl"
            class="sub-nav-tab"
            :class="{ active: selectedLevel === lvl.toString() }"
            @click="selectLevel(lvl)"
          >{{ lvl }}级</button>
        </div>
        <div class="sub-nav-search">
          <Icon name="search" :size="16" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索题目标题..."
            class="search-input"
          />
          <button v-if="searchKeyword" @click="searchKeyword = ''" class="search-clear">
            <Icon name="x" :size="14" />
          </button>
        </div>
      </div>

      <!-- 搜索栏（非 GESP） -->
      <div class="search-bar" v-else>
        <div class="search-box">
          <Icon name="search" :size="16" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索题目标题..."
            class="search-input"
          />
          <button v-if="searchKeyword" @click="searchKeyword = ''" class="search-clear">
            <Icon name="x" :size="14" />
          </button>
        </div>
      </div>

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
              <th>题目来源</th>
              <th v-if="!selectedCategory || selectedCategory === 'GESP'">级别</th>
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
                <span class="category-badge" :class="'category-' + (problem.category || 'GESP').toLowerCase()">
                  {{ getCategoryText(problem.category) }}
                </span>
              </td>
              <td v-if="!selectedCategory || selectedCategory === 'GESP'">
                <span class="level-badge" v-if="problem.level">GESP {{ problem.level }}级</span>
                <span class="no-level" v-else>-</span>
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
import { useQuestionTypeStore } from '@/stores/questionTypeStore'

const router = useRouter()
const questionTypeStore = useQuestionTypeStore()

// 筛选条件
const selectedCategory = ref('')
const selectedLevel = ref('')
const searchKeyword = ref('')

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

// 分类图标映射
const categoryIconMap: Record<string, string> = {
  '': 'layers',
  'GESP': 'award',
  'CSP_J': 'shield',
  'CSP_S': 'shield-check',
  'NOI_P': 'trophy',
  'NOI_A': 'crown',
  'NOI_IOI': 'globe',
  'LEETCODE': 'code',
  'Other': 'file-question'
}

// 分类选项（含"全部"）
const categoryOptions = computed(() => {
  const types = questionTypeStore.allTypes.value.map(t => ({
    ...t,
    icon: categoryIconMap[t.name] || 'tag'
  }))
  return [{ name: '', display_name: '全部', icon: 'layers' }, ...types]
})

// 获取侧边栏标题
function getSidebarTitle() {
  if (selectedCategory.value) {
    const type = questionTypeStore.allTypes.value.find(t => t.name === selectedCategory.value)
    const catText = type?.display_name || selectedCategory.value
    if (selectedCategory.value === 'GESP' && selectedLevel.value) {
      return `${catText} ${selectedLevel.value}级`
    }
    return catText
  }
  if (selectedLevel.value) return `GESP ${selectedLevel.value}级`
  return '全部题目'
}

// 获取分类显示文本
function getCategoryText(category: string) {
  const type = questionTypeStore.allTypes.value.find(t => t.name === category)
  return type?.display_name || category || 'GESP'
}

// 选择分类
function selectCategory(name: string) {
  selectedCategory.value = name
  if (name && name !== 'GESP') {
    selectedLevel.value = ''
  }
  pagination.value.page = 1
  fetchProblems()
}

// 从API获取题目列表
async function fetchProblems() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    }

    if (selectedCategory.value) {
      params.category = selectedCategory.value
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
        category: problem.category,
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

// 筛选后的题目列表
const filteredProblems = computed(() => {
  return problems.value.filter((problem) => {
    const matchLevel = !selectedLevel.value || problem.level.toString() === selectedLevel.value
    const matchSearch = !searchKeyword.value || (problem.title && problem.title.toLowerCase().includes(searchKeyword.value.toLowerCase()))
    return matchLevel && matchSearch
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
  questionTypeStore.fetchQuestionTypes()
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

/* 来源导航 */
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

/* 二级导航栏 */
.sub-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  padding: 6px 16px;
  margin-bottom: 12px;
}

.sub-nav-tabs {
  display: flex;
  gap: 4px;
}

.sub-nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.sub-nav-tab:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.sub-nav-tab.active {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
}

.sub-nav-search {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 12px;
  min-width: 200px;
  transition: all 0.2s ease;
}

.sub-nav-search:focus-within {
  border-color: #1e90ff;
  background: white;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.sub-nav-search :deep(.lucide-icon) {
  color: #94a3b8;
  flex-shrink: 0;
}

.sub-nav-search .search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1e293b;
  width: 100%;
}

.sub-nav-search .search-input::placeholder {
  color: #94a3b8;
}

.sub-nav-search .search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  flex-shrink: 0;
}

.sub-nav-search .search-clear:hover {
  color: #64748b;
  background: #e2e8f0;
}

/* 搜索栏 */
.search-bar {
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px 14px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.search-box :deep(.lucide-icon) {
  color: #94a3b8;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #1e293b;
  width: 100%;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  flex-shrink: 0;
}

.search-clear:hover {
  color: #64748b;
  background: #e2e8f0;
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

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.category-gesp { background: #dbeafe; color: #1e40af; }
.category-csp_j { background: #dcfce7; color: #166534; }
.category-csp_s { background: #dcfce7; color: #166534; }
.category-noi_p { background: #fef3c7; color: #92400e; }
.category-noi_a { background: #fef3c7; color: #92400e; }
.category-noi_ioi { background: #fce7f3; color: #9d174d; }
.category-leetcode { background: #f3e8ff; color: #6b21a8; }
.category-other { background: #f1f5f9; color: #475569; }

.no-level {
  color: #94a3b8;
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
  
  .search-box {
    padding: 6px 10px;
  }

  .search-input {
    font-size: 12px;
  }

  .sub-nav-bar {
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
  }

  .sub-nav-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .sub-nav-tab {
    padding: 6px 10px;
    font-size: 12px;
    white-space: nowrap;
  }

  .sub-nav-search {
    width: 100%;
    min-width: unset;
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
