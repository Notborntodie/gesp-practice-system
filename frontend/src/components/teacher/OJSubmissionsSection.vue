<template>
  <BaseTeacherSection title="OJ提交">
    <template #filters>
      <div class="filters-container">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索题目名称..."
            class="search-input"
          />
          <Icon name="search" :size="18" class="search-icon" />
        </div>
        <div class="level-filter">
          <label>级别筛选：</label>
          <select v-model="selectedOJLevel" @change="handleOJLevelChange" class="level-select">
            <option value="">全部级别</option>
            <option v-for="level in [1, 2, 3, 4, 5, 6, 7, 8]" :key="level" :value="level">
              {{ level }}级
            </option>
          </select>
        </div>
      </div>
    </template>
    
    <template #header-right>
      <span class="count-info">共 {{ filteredOJProblems.length }} 道题目</span>
    </template>
    
    <template #content>
      <div v-if="ojProblemsLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载题目列表...</p>
      </div>
      <div v-else-if="filteredOJProblems.length === 0" class="empty-state">
        <Icon name="code" :size="64" class="empty-icon" />
        <h3>暂无题目</h3>
        <p>当前筛选条件下没有题目</p>
      </div>
      <div v-else class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>题目名称</th>
              <th>级别</th>
              <th>总提交数</th>
              <th>通过数</th>
              <th>通过率</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="problem in filteredOJProblems" 
              :key="problem.id"
              class="table-row"
              @click="handleProblemClick(problem)"
            >
              <td>
                <div class="exam-name-cell">
                  <span class="exam-name-text">{{ problem.title || '未知题目' }}</span>
                </div>
              </td>
              <td>
                <span class="exam-level-badge">{{ problem.level }}级</span>
              </td>
              <td>
                <span class="question-count">{{ problem.total_submissions || 0 }}</span>
              </td>
              <td>
                <span class="question-count">{{ problem.accepted_submissions || 0 }}</span>
              </td>
              <td>
                <span class="pass-rate" :class="getPassRateClass(problem)">
                  {{ getPassRate(problem) }}%
                </span>
              </td>
              <td class="date-cell">{{ formatDate(problem.publish_date) }}</td>
              <td>
                <div class="action-buttons" @click.stop>
                  <button @click="handleProblemClick(problem)" class="btn-action btn-view" title="查看提交记录">
                    <Icon name="eye" :size="18" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseTeacherSection>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import BaseTeacherSection from './BaseTeacherSection.vue'
import Icon from '@/components/Icon.vue'

const router = useRouter()

// 从 localStorage 恢复筛选状态
const getInitialSelectedOJLevel = () => {
  const saved = localStorage.getItem('teacherView_selectedOJLevel')
  if (!saved || saved === 'null') return null
  const num = Number(saved)
  return isNaN(num) ? saved : num
}

const selectedOJLevel = ref<number | string | null>(getInitialSelectedOJLevel())
const searchQuery = ref('')
const ojProblems = ref<any[]>([])
const ojProblemsLoading = ref(false)

// 获取用户信息
const userInfo = ref<any>(null)

// 过滤后的OJ题目列表
const filteredOJProblems = computed(() => {
  let result = ojProblems.value
  
  // 按级别筛选
  if (selectedOJLevel.value !== null && selectedOJLevel.value !== '') {
    result = result.filter(problem => problem.level === selectedOJLevel.value)
  }
  
  // 按搜索关键词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(problem => {
      const title = (problem.title || '').toLowerCase()
      return title.includes(query)
    })
  }
  
  return result
})

// 计算通过率
function getPassRate(problem: any) {
  if (!problem.total_submissions || problem.total_submissions === 0) return '0.0'
  const rate = (problem.accepted_submissions || 0) / problem.total_submissions * 100
  return rate.toFixed(1)
}

// 获取通过率样式类
function getPassRateClass(problem: any) {
  const rate = parseFloat(getPassRate(problem))
  if (rate >= 80) return 'excellent'
  if (rate >= 60) return 'good'
  if (rate >= 40) return 'pass'
  return 'fail'
}

// 格式化日期
function formatDate(dateString: string) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 处理OJ级别筛选变化
function handleOJLevelChange() {
  // 保存筛选状态到 localStorage
  if (selectedOJLevel.value === null || selectedOJLevel.value === '') {
    localStorage.setItem('teacherView_selectedOJLevel', 'null')
  } else {
    localStorage.setItem('teacherView_selectedOJLevel', String(selectedOJLevel.value))
  }
  fetchOJProblems()
}

// 获取OJ题目列表
const fetchOJProblems = async () => {
  if (!userInfo.value) {
    console.log('用户信息未加载，跳过获取OJ题目列表')
    return
  }
  
  console.log('开始获取OJ题目列表')
  ojProblemsLoading.value = true
  try {
    const params: any = {
      page: 1,
      pageSize: 1000
    }
    
    if (selectedOJLevel.value) {
      params.level = selectedOJLevel.value
    }
    params.include_all = 1
    const response = await axios.get(`${BASE_URL}/oj/problems`, { params })
    console.log('获取OJ题目列表API响应:', response.data)
    
    if (response.data.success) {
      ojProblems.value = response.data.data || []
      console.log('OJ题目列表更新完成，题目数量:', ojProblems.value.length)
    } else {
      ojProblems.value = []
    }
  } catch (error: any) {
    console.error('获取OJ题目列表失败:', error)
    console.error('错误详情:', error.response?.data)
    alert('获取OJ题目列表失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
    ojProblems.value = []
  } finally {
    ojProblemsLoading.value = false
  }
}

// 处理题目点击
function handleProblemClick(problem: any) {
  if (!userInfo.value) {
    console.log('用户信息未加载，无法跳转')
    return
  }
  
  // 跳转到 TeacherOJSubmissionsView
  router.push({
    path: `/teacher/${userInfo.value.id}/oj-submissions/${problem.id}`,
    query: { 
      fromSection: 'oj-submissions',
      fromTeacherView: 'true'
    }
  })
}

// 获取用户信息
const getUserInfo = () => {
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
  }
}

onMounted(() => {
  getUserInfo()
  if (userInfo.value) {
    fetchOJProblems()
  }
})

// 监听用户信息变化
watch(() => {
  const userInfoStr = localStorage.getItem('userInfo')
  return userInfoStr ? JSON.parse(userInfoStr) : null
}, (newUserInfo) => {
  if (newUserInfo && !userInfo.value) {
    userInfo.value = newUserInfo
    fetchOJProblems()
  }
}, { immediate: true })

// 监听筛选状态变化，自动保存
watch(selectedOJLevel, (newLevel) => {
  if (newLevel === null || newLevel === '') {
    localStorage.setItem('teacherView_selectedOJLevel', 'null')
  } else {
    localStorage.setItem('teacherView_selectedOJLevel', String(newLevel))
  }
})
</script>

<style scoped>
.filters-container {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  padding: 16px 20px 16px 48px;
  border: 3px solid #87ceeb;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  width: 300px;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15);
}

.search-input:focus {
  outline: none;
  border-color: #1e90ff;
  border-width: 4px;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  transform: scale(1.02);
}

.search-icon {
  position: absolute;
  left: 16px;
  color: #1e90ff;
  font-size: 20px;
  pointer-events: none;
}

.level-filter {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-filter label {
  color: #64748b;
  font-weight: 600;
  font-size: 14px;
}

.level-select {
  padding: 12px 16px;
  border: 3px solid #87ceeb;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15);
}

.level-select:focus {
  outline: none;
  border-color: #1e90ff;
  border-width: 4px;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  transform: scale(1.02);
}

.count-info {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #64748b;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #1e90ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #64748b;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 16px;
}

.data-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
  width: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.data-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.data-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
}

.table-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background: #f8fafc;
}

.exam-name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.exam-name-text {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.exam-level-badge {
  font-weight: 600;
  color: #1e90ff;
  font-size: 14px;
}

.question-count {
  font-weight: 500;
  color: #1e293b;
}

.pass-rate {
  font-weight: 600;
  font-size: 14px;
}

.pass-rate.excellent {
  color: #22c55e;
}

.pass-rate.good {
  color: #3b82f6;
}

.pass-rate.pass {
  color: #f59e0b;
}

.pass-rate.fail {
  color: #ef4444;
}

.date-cell {
  color: #64748b;
  font-size: 13px;
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

.btn-view {
  background: #0ea5e9;
  color: white;
}

.btn-view:hover {
  background: #0284c7;
  transform: translateY(-1px);
}
</style>

