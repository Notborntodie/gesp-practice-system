<template>
  <div class="knowledge-point-management">
    <div class="section-header">
      <h2>知识点管理</h2>
      <div class="header-info">
        <span class="knowledge-point-count">共 {{ knowledgePoints.length }} 个知识点</span>
        <span v-if="knowledgePointStore.isCacheValid && knowledgePointStore.hasKnowledgePoints" class="cache-indicator">
          <Icon name="package" :size="16" /> 使用缓存数据
        </span>
      </div>
      <div class="action-buttons">
        <button @click="openCreateKnowledgePointDialog" class="btn btn-primary">
          <Icon name="plus" :size="18" /> 创建知识点
        </button>
        <button @click="refreshKnowledgePoints" class="btn btn-secondary" title="刷新知识点列表">
          <Icon name="refresh-cw" :size="18" /> 刷新
        </button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <div class="filter-group">
        <label>搜索知识点：</label>
        <input 
          v-model="searchQuery" 
          @input="filterKnowledgePoints"
          type="text" 
          placeholder="搜索知识点名称..." 
          class="filter-input"
        />
      </div>
      <div class="filter-group">
        <label>级别筛选：</label>
        <select v-model="filterLevel" @change="filterKnowledgePoints" class="filter-select">
          <option value="">全部</option>
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
        <label>分类筛选：</label>
        <select v-model="filterCategory" @change="filterKnowledgePoints" class="filter-select">
          <option value="">全部分类</option>
          <option value="algorithm">算法</option>
          <option value="data_structure">数据结构</option>
          <option value="programming">编程</option>
          <option value="math">数学</option>
        </select>
      </div>
    </div>

    <!-- 知识点列表 -->
    <div class="knowledge-points-table-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner">●</div>
        <p>加载中...</p>
      </div>

      <table v-else-if="filteredKnowledgePoints.length > 0" class="knowledge-points-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>知识点名称</th>
            <th>级别</th>
            <th>分类</th>
            <th>创建时间</th>
            <th>更新时间</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(kp, index) in filteredKnowledgePoints" :key="kp.id" @click="toggleKnowledgePointExpansion(kp.id)" class="table-row">
            <td>{{ index + 1 }}</td>
            <td class="name-cell">
              <div class="knowledge-point-name-preview">
                {{ kp.name || '知识点名称加载中...' }}
              </div>
            </td>
            <td>
              <span class="level-badge">{{ getLevelText(kp.level || 1) }}</span>
            </td>
            <td>
              <span class="category-badge" :class="`category-${kp.category}`">
                {{ getCategoryName(kp.category) }}
              </span>
            </td>
            <td>{{ formatDate(kp.created_at) }}</td>
            <td>{{ formatDate(kp.updated_at) }}</td>
            <td class="description-cell">
              <div v-if="kp.description" class="description-preview">
                {{ truncateText(kp.description, 30) }}
              </div>
              <span v-else class="no-description">-</span>
            </td>
            <td @click.stop>
              <div class="action-buttons">
                <button @click="viewKnowledgePointDetails(kp.id)" class="btn-action btn-view" title="查看详情">
                  <Icon name="eye" :size="18" />
                </button>
                <button @click="editKnowledgePoint(kp)" class="btn-action btn-edit" title="编辑">
                  <Icon name="edit" :size="18" />
                </button>
                <button @click="deleteKnowledgePoint(kp)" class="btn-action btn-delete" title="删除">
                  <Icon name="trash-2" :size="18" />
                </button>
              </div>
            </td>
          </tr>
          <!-- 展开的详细信息行 -->
          <tr v-for="knowledgePoint in filteredKnowledgePoints.filter(kp => expandedKnowledgePoints.includes(kp.id))" :key="`detail-${knowledgePoint.id}`" class="detail-row">
            <td colspan="8">
              <div class="knowledge-point-details">
                <!-- 完整知识点信息 -->
                <div class="detail-section">
                  <h5>知识点详细信息</h5>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">知识点名称:</span>
                      <span class="info-value">{{ knowledgePoint.name }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">分类:</span>
                      <span class="info-value">{{ getCategoryName(knowledgePoint.category) }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">等级:</span>
                      <span class="info-value">{{ getLevelText(knowledgePoint.level) }}</span>
                    </div>
                    <div class="info-item" v-if="knowledgePoint.created_at">
                      <span class="info-label">创建时间:</span>
                      <span class="info-value">{{ formatDate(knowledgePoint.created_at) }}</span>
                    </div>
                    <div class="info-item" v-if="knowledgePoint.updated_at">
                      <span class="info-label">更新时间:</span>
                      <span class="info-value">{{ formatDate(knowledgePoint.updated_at) }}</span>
                    </div>
                  </div>
                </div>

                <!-- 完整描述信息 -->
                <div v-if="knowledgePoint.description" class="detail-section">
                  <h5>完整描述</h5>
                  <div class="description-box">
                    <p>{{ knowledgePoint.description }}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <div class="empty-icon">📭</div>
        <p>暂无知识点</p>
      </div>
    </div>

    <!-- 创建知识点弹窗 -->
    <CreateKnowledgePointDialog
      :visible="showCreateKnowledgePointDialog"
      @close="closeCreateKnowledgePointDialog"
      @created="handleKnowledgePointCreated"
    />

    <!-- 编辑知识点弹窗 -->
    <EditKnowledgePointDialog
      :visible="showEditKnowledgePointDialog"
      :knowledge-point="editingKnowledgePoint"
      @close="closeEditKnowledgePointDialog"
      @updated="handleKnowledgePointUpdated"
    />

    <!-- 删除确认弹窗 -->
    <ConfirmDialog
      :visible="showDeleteDialog"
      title="确认删除"
      message="确定要删除这个知识点吗？此操作不可撤销。"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- 成功提示弹窗 -->
    <SuccessMessageDialog
      :visible="showSuccessMessage"
      :message="successMessage"
      @close="closeSuccessMessage"
    />
  </div>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import CreateKnowledgePointDialog from './Dialog/CreateKnowledgePointDialog.vue'
import EditKnowledgePointDialog from './Dialog/EditKnowledgePointDialog.vue'
import ConfirmDialog from './Dialog/ConfirmDialog.vue'
import SuccessMessageDialog from './Dialog/SuccessMessageDialog.vue'
import { useKnowledgePointStore } from '../../stores/knowledgePointStore'
import Icon from '@/components/Icon.vue'

// Props 定义
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), {
  refreshTrigger: 0
})

// 使用知识点store
const knowledgePointStore = useKnowledgePointStore()

// 本地状态
const filteredKnowledgePoints = ref<any[]>([])
const searchQuery = ref('')
const filterLevel = ref('')
const filterCategory = ref('')
const expandedKnowledgePoints = ref<number[]>([])

// 弹窗状态管理
const showCreateKnowledgePointDialog = ref(false)
const showEditKnowledgePointDialog = ref(false)
const showDeleteDialog = ref(false)
const showSuccessMessage = ref(false)
const successMessage = ref('')

// 编辑和删除相关数据
const editingKnowledgePoint = ref<any>(null)
const knowledgePointToDelete = ref<any>(null)

// 从store获取状态 - 保持响应性
const knowledgePoints = knowledgePointStore.knowledgePoints
const loading = knowledgePointStore.loading

// 监听knowledgePoints变化，自动更新过滤结果
watch(knowledgePoints, () => {
  filterKnowledgePoints()
}, { immediate: true })

// 获取知识点列表
async function fetchKnowledgePoints(forceRefresh = false) {
  try {
    await knowledgePointStore.fetchKnowledgePoints(forceRefresh)
    // watcher会自动处理过滤
  } catch (error: any) {
    console.error('获取知识点失败:', error)
    alert('获取知识点失败: ' + (error.response?.data?.message || error.message))
  }
}

// 过滤知识点
function filterKnowledgePoints() {
  let list = [...knowledgePoints.value]
  
  // 按等级过滤
  if (filterLevel.value) {
    list = list.filter(kp => String(kp.level || 1) === filterLevel.value)
  }
  
  // 按分类过滤
  if (filterCategory.value) {
    list = list.filter(kp => kp.category === filterCategory.value)
  }
  
  // 按搜索关键词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(kp => 
      kp.name?.toLowerCase().includes(query) ||
      kp.description?.toLowerCase().includes(query)
    )
  }
  
  // 按ID排序
  list = list.sort((a, b) => a.id - b.id)
  
  filteredKnowledgePoints.value = list
}

// 切换知识点展开状态
function toggleKnowledgePointExpansion(id: number) {
  const idx = expandedKnowledgePoints.value.indexOf(id)
  if (idx === -1) {
    expandedKnowledgePoints.value.push(id)
  } else {
    expandedKnowledgePoints.value.splice(idx, 1)
  }
}

// 编辑知识点
function editKnowledgePoint(kp: any) {
  editingKnowledgePoint.value = kp
  showEditKnowledgePointDialog.value = true
}

// 删除知识点
function deleteKnowledgePoint(kp: any) {
  knowledgePointToDelete.value = kp
  showDeleteDialog.value = true
}

// 确认删除
async function confirmDelete() {
  if (!knowledgePointToDelete.value) return
  
  try {
    const response = await axios.delete(`${BASE_URL}/knowledge-points/${knowledgePointToDelete.value.id}`)
    
    // 检查删除是否成功
    if (response.data.message && response.data.message.includes('成功')) {
      console.log('知识点删除成功，强制刷新缓存')
      
      // 强制刷新缓存以获取最新数据
      await fetchKnowledgePoints(true)
    }
    
    // 关闭弹窗
    showDeleteDialog.value = false
    knowledgePointToDelete.value = null
    
    // 显示成功提示
    showSuccessMessage.value = true
    successMessage.value = '知识点删除成功！'
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message
    if (errorMessage.includes('关联题目')) {
      alert(`无法删除知识点：${errorMessage}`)
    } else {
      alert('知识点删除失败: ' + errorMessage)
    }
  }
}

// 取消删除
function cancelDelete() {
  showDeleteDialog.value = false
  knowledgePointToDelete.value = null
}

// 打开创建知识点弹窗
function openCreateKnowledgePointDialog() {
  showCreateKnowledgePointDialog.value = true
}

// 关闭创建知识点弹窗
function closeCreateKnowledgePointDialog() {
  showCreateKnowledgePointDialog.value = false
}

// 处理知识点创建成功
async function handleKnowledgePointCreated(newKnowledgePoint: any) {
  console.log('handleKnowledgePointCreated 被调用，数据:', newKnowledgePoint)
  
  // 强制刷新缓存以获取最新数据
  await fetchKnowledgePoints(true)
  
  showSuccessMessage.value = true
  successMessage.value = '知识点创建成功！'
}

// 关闭编辑知识点弹窗
function closeEditKnowledgePointDialog() {
  showEditKnowledgePointDialog.value = false
  editingKnowledgePoint.value = null
}

// 处理知识点更新成功
async function handleKnowledgePointUpdated(updatedKnowledgePoint: any) {
  console.log('handleKnowledgePointUpdated 被调用，数据:', updatedKnowledgePoint)
  
  // 强制刷新缓存以获取最新数据
  await fetchKnowledgePoints(true)
  
  showSuccessMessage.value = true
  successMessage.value = '知识点更新成功！'
}

// 关闭成功提示
function closeSuccessMessage() {
  showSuccessMessage.value = false
  successMessage.value = ''
}

// 手动刷新知识点列表
async function refreshKnowledgePoints() {
  try {
    await fetchKnowledgePoints()
    showSuccessMessage.value = true
    successMessage.value = '知识点列表已刷新！'
  } catch (error: any) {
    alert('刷新失败: ' + (error.response?.data?.message || error.message))
  }
}

// 获取分类名称
function getCategoryName(category: string) {
  const categoryMap: { [key: string]: string } = {
    'algorithm': '算法',
    'data_structure': '数据结构',
    'programming': '编程',
    'math': '数学'
  }
  return categoryMap[category] || category
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

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 查看知识点详情（展开/收起）
function viewKnowledgePointDetails(knowledgePointId: number) {
  toggleKnowledgePointExpansion(knowledgePointId)
}

// 监听刷新触发器变化
watch(() => props.refreshTrigger, async (newTrigger, oldTrigger) => {
  if (newTrigger && newTrigger !== oldTrigger && newTrigger > 0) {
    console.log(`🔄 [KnowledgePointManagement] 检测到刷新触发器变化: ${oldTrigger} -> ${newTrigger}，开始刷新数据`)
    await fetchKnowledgePoints(true) // 强制刷新
    console.log('✅ [KnowledgePointManagement] 数据刷新完成')
  }
})

onMounted(async () => {
  console.log('📦 [KnowledgePointManagement] 组件挂载，初始化数据')
  // 只在没有缓存数据时才显示loading状态
  if (!knowledgePointStore.hasKnowledgePoints.value) {
    await fetchKnowledgePoints()
  } else {
    // 如果有缓存数据，直接使用，在后台刷新
    console.log('📋 [KnowledgePointManagement] 使用现有知识点缓存数据，在后台刷新')
    // 在后台刷新数据，watcher会自动处理过滤
    knowledgePointStore.fetchKnowledgePoints()
  }
})
</script>

<style scoped>
.knowledge-point-management {
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

.knowledge-point-count {
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

.knowledge-points-table-container {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
}

.knowledge-points-table {
  width: 100%;
  border-collapse: collapse;
}

.knowledge-points-table thead {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
}

.knowledge-points-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: white;
  white-space: nowrap;
}

.knowledge-points-table td {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #1e293b;
  max-width: 200px;
}

.knowledge-points-table tbody .table-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.knowledge-points-table tbody .table-row:hover {
  background: #f8fafc;
}

.name-cell {
  max-width: 250px;
}

.knowledge-point-name-preview {
  font-weight: 500;
  color: #1e293b;
  line-height: 1.4;
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

.category-algorithm { background: #d1fae5; color: #065f46; }
.category-data_structure { background: #e0f2fe; color: #1e40af; }
.category-programming { background: #fef3c7; color: #d97706; }
.category-math { background: #f3e8ff; color: #6b21a8; }

.description-cell {
  max-width: 200px;
}

.description-preview {
  color: #6b7280;
  font-style: italic;
  line-height: 1.4;
}

.no-description {
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

.knowledge-point-details {
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

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.info-label {
  font-weight: 600;
  color: #64748b;
  font-size: 14px;
}

.info-value {
  color: #1e293b;
  font-size: 14px;
}

.description-box {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #374151;
}

.description-box p {
  margin: 0;
  line-height: 1.6;
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
  opacity: 0.5;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #64748b;
}

.empty-state p {
  font-size: 18px;
  font-weight: 500;
}

.btn-icon {
  font-size: 16px;
  font-weight: bold;
  margin-right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons :deep(.lucide-icon) {
  flex-shrink: 0;
  color: inherit;
}
</style>
