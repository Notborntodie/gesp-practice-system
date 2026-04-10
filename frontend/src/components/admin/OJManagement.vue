<template>
  <div class="oj-management">
    <!-- 筛选器 -->
    <div class="filters">
      <div class="filter-group">
        <label>级别筛选：</label>
        <select v-model="selectedLevel" @change="fetchProblems" class="filter-select">
          <option value="">全部</option>
          <option value="1">GESP 1级</option>
          <option value="2">GESP 2级</option>
          <option value="3">GESP 3级</option>
          <option value="4">GESP 4级</option>
          <option value="5">GESP 5级</option>
          <option value="6">GESP 6级</option>
        </select>
      </div>
      <div class="upload-action">
        <button @click="showUploadDialog = true" class="btn btn-primary">
          <span class="btn-icon">+</span> 上传新题目
        </button>
      </div>
    </div>

    <!-- 题目列表 -->
    <div class="problems-table-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner">●</div>
        <p>加载中...</p>
      </div>

      <table v-else-if="problems.length > 0" class="problems-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>级别</th>
            <th>发布日期</th>
            <th>提交数</th>
            <th>通过数</th>
            <th>通过率</th>
            <th>时间限制</th>
            <th>内存限制</th>
            <th class="col-bank-visible">题库可见</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="problem in problems" :key="problem.id">
            <td>{{ problem.id }}</td>
            <td class="title-cell">{{ problem.title }}</td>
            <td>
              <span class="level-badge">GESP {{ problem.level }}级</span>
            </td>
            <td>{{ formatDate(problem.publish_date) }}</td>
            <td>{{ problem.total_submissions || 0 }}</td>
            <td>{{ problem.accepted_submissions || 0 }}</td>
            <td>
              <span class="pass-rate">
                {{ calculatePassRate(problem.total_submissions, problem.accepted_submissions) }}%
              </span>
            </td>
            <td>{{ problem.time_limit }}ms</td>
            <td>{{ problem.memory_limit }}MB</td>
            <td class="bank-visible-cell">
              <button
                type="button"
                class="bank-visible-toggle"
                :class="{ on: isBankVisible(problem), loading: togglingId === problem.id }"
                :disabled="togglingId === problem.id"
                :title="isBankVisible(problem) ? '对学生可见（SmartOJ / 等级题库）' : '对学生不可见（仅计划与测试）'"
                @click="toggleBankVisible(problem)"
              >
                <span class="toggle-slider"></span>
              </button>
            </td>
            <td>
              <div class="action-buttons">
                <button @click="viewProblem(problem.id)" class="btn-action btn-view" title="查看详情">
                  <Icon name="eye" :size="18" />
                </button>
                <button @click="editProblem(problem.id)" class="btn-action btn-edit" title="编辑">
                  <Icon name="edit" :size="18" />
                </button>
                <button @click="deleteProblem(problem.id)" class="btn-action btn-delete" title="删除">
                  <Icon name="trash-2" :size="18" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <Icon name="inbox" :size="64" class="empty-icon" />
        <p>暂无题目</p>
      </div>
    </div>

    <!-- 上传对话框 -->
    <SingleOJUploadDialog
      :visible="showUploadDialog"
      @close="showUploadDialog = false"
      @success="handleUploadSuccess"
    />

    <!-- 编辑对话框 -->
    <EditOJDialog
      :visible="showEditDialog"
      :problem="editingProblem"
      @close="showEditDialog = false; editingProblem = null"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import SingleOJUploadDialog from './Dialog/SingleOJUploadDialog.vue'
import EditOJDialog from './Dialog/EditOJDialog.vue'
import Icon from '@/components/Icon.vue'

const router = useRouter()

const selectedLevel = ref('')
const problems = ref<any[]>([])
const loading = ref(false)
const showUploadDialog = ref(false)
const showEditDialog = ref(false)
const editingProblem = ref<any>(null)
const togglingId = ref<number | null>(null)

function isBankVisible(problem: any): boolean {
  return problem.bank_visible !== undefined ? !!problem.bank_visible : true
}

async function toggleBankVisible(problem: any) {
  if (togglingId.value === problem.id) return
  const next = !isBankVisible(problem)
  togglingId.value = problem.id
  try {
    await axios.put(`${BASE_URL}/oj/problems/${problem.id}`, { bank_visible: next })
    problem.bank_visible = next ? 1 : 0
  } catch (e: any) {
    console.error('更新题库可见失败:', e)
    alert('更新失败: ' + (e.response?.data?.error || e.message))
  } finally {
    togglingId.value = null
  }
}

// 获取题目列表
async function fetchProblems() {
  loading.value = true
  try {
    const params: any = {
      page: 1,
      pageSize: 100
    }
    
    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }
    params.include_all = 1 // 管理端需看到全部题目（含题库不可见）
    const response = await axios.get(`${BASE_URL}/oj/problems`, { params })
    
    if (response.data.success) {
      problems.value = response.data.data
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
    alert('获取题目列表失败')
  } finally {
    loading.value = false
  }
}

// 计算通过率
function calculatePassRate(total: number, accepted: number): string {
  if (!total || total === 0) return '0.0'
  return ((accepted / total) * 100).toFixed(1)
}

// 格式化日期
function formatDate(dateString: string) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}

// 查看题目详情
function viewProblem(id: number) {
  router.push(`/smartoj/${id}`)
}

// 编辑题目
async function editProblem(id: number) {
  console.log('🔧 [OJManagement] 开始编辑题目, ID:', id)
  try {
    // 使用 /all 接口获取完整题目详情（包括所有样例）
    const url = `${BASE_URL}/oj/problems/${id}/all`
    
    const response = await axios.get(url)

    if (response.data.success) {
      editingProblem.value = response.data.data
      console.log('📦 [OJManagement] 设置 editingProblem:', editingProblem.value)
      console.log('📊 [OJManagement] 样例数据:', editingProblem.value.samples)
      
      showEditDialog.value = true
      console.log('✅ [OJManagement] 打开编辑弹窗, showEditDialog:', showEditDialog.value)
    } else {
      console.warn('⚠️ [OJManagement] 响应success为false')
    }
  } catch (error) {
    console.error('❌ [OJManagement] 获取题目详情失败:', error)
    alert('获取题目详情失败')
  }
}

// 删除题目
async function deleteProblem(id: number) {
  if (!confirm('确定要删除这道题目吗？此操作不可恢复！')) {
    return
  }
  
  try {
    await axios.delete(`${BASE_URL}/oj/problems/${id}`)
    alert('题目删除成功')
    fetchProblems()
  } catch (error: any) {
    console.error('删除题目失败:', error)
    alert('删除题目失败: ' + (error.response?.data?.error || error.message))
  }
}

// 上传成功回调
function handleUploadSuccess() {
  showUploadDialog.value = false
  fetchProblems()
}

// 编辑成功回调
function handleEditSuccess() {
  showEditDialog.value = false
  editingProblem.value = null
  fetchProblems()
}

onMounted(() => {
  fetchProblems()
})
</script>

<style scoped>
.oj-management {
  padding: 24px;
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  border: none;
}

.upload-action {
  display: flex;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  color: #1e293b;
  font-weight: 600;
  font-size: 14px;
}

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
}

.filter-select:hover {
  border-color: #1e90ff;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
}

.filter-select:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
}

.problems-table-container {
  background: white;
  border-radius: 12px;
  border: none;
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

.problems-table td {
  padding: 16px;
  border-top: none;
  font-size: 14px;
  color: #1e293b;
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

.col-bank-visible {
  width: 90px;
  text-align: center;
}

.bank-visible-cell {
  text-align: center;
  vertical-align: middle;
}

.bank-visible-toggle {
  position: relative;
  width: 40px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: #cbd5e1;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.bank-visible-toggle:hover:not(:disabled) {
  background: #94a3b8;
}

.bank-visible-toggle.on {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.bank-visible-toggle.on:hover:not(:disabled) {
  filter: brightness(1.1);
}

.bank-visible-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.bank-visible-toggle .toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.bank-visible-toggle.on .toggle-slider {
  transform: translateX(18px);
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
  display: flex;
  justify-content: center;
  align-items: center;
  color: #64748b;
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
</style>

