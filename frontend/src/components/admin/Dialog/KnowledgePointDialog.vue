<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">📚</div>
        <h3 class="dialog-title">知识点管理</h3>
        <button @click="handleClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <!-- 添加知识点表单 -->
        <div class="knowledge-points-form">
          <h5>添加新知识点</h5>
          <div class="form-row">
            <div class="form-group">
              <label>知识点名称：</label>
              <input v-model="newKnowledgePoint.name" placeholder="如：链表基础" />
            </div>
            <div class="form-group">
              <label>分类：</label>
              <select v-model="newKnowledgePoint.category">
                <option value="algorithm">算法</option>
                <option value="data_structure">数据结构</option>
                <option value="programming">编程</option>
                <option value="math">数学</option>
              </select>
            </div>
            <div class="form-group">
              <label>等级：</label>
              <select v-model="newKnowledgePoint.level">
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
          </div>
          <div class="form-group">
            <label>描述：</label>
            <textarea v-model="newKnowledgePoint.description" placeholder="知识点详细描述"></textarea>
          </div>
          <button @click="addKnowledgePoint" class="btn btn-secondary">添加知识点</button>
        </div>
        
        <!-- 现有知识点列表 -->
        <div class="knowledge-points-list">
          <div class="list-header">
            <h5>现有知识点</h5>
            <div class="filter-controls">
              <label>按等级过滤：</label>
              <select v-model="selectedLevel" @change="filterKnowledgePoints" class="level-filter">
                <option value="">全部等级</option>
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
          </div>
          <div class="filter-info" v-if="selectedLevel">
            <span>显示 {{ filteredKnowledgePoints.length }} 个 GESP {{ selectedLevel }}级 知识点</span>
          </div>
          <div class="knowledge-points-grid">
            <div v-for="kp in filteredKnowledgePoints" :key="kp.id" class="knowledge-point-item">
              <div class="kp-info">
                <span class="kp-name">{{ kp.name }}</span>
                <span class="kp-category">{{ getCategoryName(kp.category) }}</span>
                <span class="kp-level">GESP {{ kp.level }}级</span>
              </div>
              <div class="kp-actions">
                <button @click="editKnowledgePoint(kp)" class="btn-edit" title="编辑">✏️</button>
                <button @click="deleteKnowledgePoint(kp)" class="btn-delete" title="删除">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">关闭</button>
      </div>
    </div>
  </div>
  
  <!-- 编辑知识点弹窗 -->
  <div v-if="showEditDialog" class="dialog-overlay" @click="closeEditDialog">
    <div class="dialog-container edit-dialog" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">✏️</div>
        <h3 class="dialog-title">编辑知识点</h3>
        <button @click="closeEditDialog" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div class="form-row">
          <div class="form-group">
            <label>知识点名称：</label>
            <input v-model="editingKnowledgePoint.name" placeholder="如：链表基础" />
          </div>
          <div class="form-group">
            <label>分类：</label>
            <select v-model="editingKnowledgePoint.category">
              <option value="algorithm">算法</option>
              <option value="data_structure">数据结构</option>
              <option value="programming">编程</option>
              <option value="math">数学</option>
            </select>
          </div>
          <div class="form-group">
            <label>等级：</label>
            <select v-model="editingKnowledgePoint.level">
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
        </div>
        <div class="form-group">
          <label>描述：</label>
          <textarea v-model="editingKnowledgePoint.description" placeholder="知识点详细描述"></textarea>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="closeEditDialog" class="btn btn-secondary">取消</button>
        <button @click="saveEditKnowledgePoint" class="btn btn-primary">保存</button>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div v-if="showDeleteDialog" class="dialog-overlay" @click="closeDeleteDialog">
    <div class="dialog-container delete-dialog" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">⚠️</div>
        <h3 class="dialog-title">确认删除</h3>
        <button @click="closeDeleteDialog" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <p>确定要删除知识点 <strong>"{{ deletingKnowledgePoint?.name }}"</strong> 吗？</p>
        <p class="warning-text">此操作不可撤销！</p>
      </div>
      <div class="dialog-actions">
        <button @click="closeDeleteDialog" class="btn btn-secondary">取消</button>
        <button @click="confirmDeleteKnowledgePoint" class="btn btn-danger">删除</button>
      </div>
    </div>
  </div>

  <!-- 成功提示弹窗 -->
  <SuccessMessageDialog
    :visible="showSuccessMessage"
    :message="successMessage"
    @close="closeSuccessMessage"
  />
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, onMounted } from 'vue'
import axios from 'axios'
import SuccessMessageDialog from './SuccessMessageDialog.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const knowledgePoints = ref<any[]>([])
const filteredKnowledgePoints = ref<any[]>([])
const selectedLevel = ref('')
const newKnowledgePoint = ref({
  name: '',
  description: '',
  category: 'data_structure',
  level: 1
})

// 编辑相关
const showEditDialog = ref(false)
const editingKnowledgePoint = ref({
  id: null,
  name: '',
  description: '',
  category: 'data_structure',
  level: 1
})

// 删除相关
const showDeleteDialog = ref(false)
const deletingKnowledgePoint = ref<any>(null)

// 成功提示相关
const showSuccessMessage = ref(false)
const successMessage = ref('')

// 获取知识点列表
async function fetchKnowledgePoints() {
  try {
          const response = await axios.get(`${BASE_URL}/knowledge-points`)
    knowledgePoints.value = response.data
    filterKnowledgePoints()
  } catch (error) {
    console.error('获取知识点失败:', error)
  }
}

// 过滤知识点
function filterKnowledgePoints() {
  if (!selectedLevel.value) {
    filteredKnowledgePoints.value = [...knowledgePoints.value]
  } else {
    const level = parseInt(selectedLevel.value)
    filteredKnowledgePoints.value = knowledgePoints.value.filter(kp => kp.level === level)
  }
}

// 添加知识点
async function addKnowledgePoint() {
  try {
          const response = await axios.post(`${BASE_URL}/knowledge-points`, newKnowledgePoint.value)
    // 显示成功提示
    successMessage.value = '知识点添加成功！'
    showSuccessMessage.value = true
    
    newKnowledgePoint.value = { name: '', description: '', category: 'data_structure', level: 1 }
    await fetchKnowledgePoints()
  } catch (error: any) {
    alert('知识点添加失败: ' + error.response?.data?.message || error.message)
  }
}

// 编辑知识点
function editKnowledgePoint(kp: any) {
  editingKnowledgePoint.value = { ...kp }
  showEditDialog.value = true
}

// 保存编辑的知识点
async function saveEditKnowledgePoint() {
  try {
    const response = await axios.put(`${BASE_URL}/knowledge-points/${editingKnowledgePoint.value.id}`, {
      name: editingKnowledgePoint.value.name,
      description: editingKnowledgePoint.value.description,
      category: editingKnowledgePoint.value.category,
      level: editingKnowledgePoint.value.level
    })
    
    // 显示成功提示
    successMessage.value = '知识点更新成功！'
    showSuccessMessage.value = true
    
    closeEditDialog()
    await fetchKnowledgePoints()
  } catch (error: any) {
    alert('知识点更新失败: ' + (error.response?.data?.message || error.message))
  }
}

// 删除知识点
function deleteKnowledgePoint(kp: any) {
  deletingKnowledgePoint.value = kp
  showDeleteDialog.value = true
}

// 确认删除知识点
async function confirmDeleteKnowledgePoint() {
  try {
    const response = await axios.delete(`${BASE_URL}/knowledge-points/${deletingKnowledgePoint.value.id}`)
    
    // 显示成功提示
    successMessage.value = '知识点删除成功！'
    showSuccessMessage.value = true
    
    closeDeleteDialog()
    await fetchKnowledgePoints()
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message
    if (errorMessage.includes('关联题目')) {
      alert(`无法删除知识点：${errorMessage}`)
    } else {
      alert('知识点删除失败: ' + errorMessage)
    }
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

function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  emit('close')
}

function closeSuccessMessage() {
  showSuccessMessage.value = false
  successMessage.value = ''
}

// 关闭编辑弹窗
function closeEditDialog() {
  showEditDialog.value = false
  editingKnowledgePoint.value = {
    id: null,
    name: '',
    description: '',
    category: 'data_structure',
    level: 1
  }
}

// 关闭删除弹窗
function closeDeleteDialog() {
  showDeleteDialog.value = false
  deletingKnowledgePoint.value = null
}

onMounted(() => {
  fetchKnowledgePoints()
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog-container {
  background: white;
  border-radius: 0;
  box-shadow: none;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(-20px);}
  to { opacity: 1; transform: scale(1) translateY(0);}
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 32px;
  background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
  border-radius: 0;
  margin: 0;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.dialog-icon {
  font-size: 32px;
}

.dialog-title {
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  font-size: 28px;
  color: white;
  cursor: pointer;
  margin-left: auto;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.knowledge-points-form {
  padding: 24px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  flex-shrink: 0;
}

.knowledge-points-form h5 {
  margin: 0 0 16px 0;
  color: #1976d2;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  flex: 1;
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid #b6e0fe;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.3s ease;
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.2);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.list-header h5 {
  margin: 0;
  color: #1976d2;
  font-size: 18px;
  font-weight: 600;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-controls label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
}

.level-filter {
  padding: 8px 12px;
  border: 1.5px solid #b6e0fe;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #374151;
  min-width: 120px;
  transition: all 0.3s ease;
}

.level-filter:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.2);
}

.knowledge-points-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filter-info {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  font-size: 14px;
  color: #0369a1;
  font-weight: 500;
}

.knowledge-points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.knowledge-point-item {
  background: #e0f2fe;
  color: #1e40af;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1.5px solid #bae6fd;
  transition: all 0.2s ease;
}

.knowledge-point-item:hover {
  background: #bae6fd;
  color: #075985;
}

.kp-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.kp-name {
  flex-grow: 1;
  min-width: 120px;
}

.kp-category {
  background: #e0f2fe;
  color: #0369a1;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #bae6fd;
  white-space: nowrap;
}

.kp-level {
  background: #e0f2fe;
  color: #0369a1;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #bae6fd;
  white-space: nowrap;
}

.kp-actions {
  display: flex;
  gap: 8px;
}

.btn-edit, .btn-delete {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-edit:hover {
  background: #e0f2fe;
  transform: scale(1.1);
}

.btn-delete:hover {
  background: #fef2f2;
  transform: scale(1.1);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 32px;
  border-top: 2px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
  transform: translateY(-1px);
}

.btn-primary {
  background: #1e90ff;
  color: white;
  border: 1.5px solid #1e90ff;
}

.btn-primary:hover {
  background: #0066cc;
  border-color: #0066cc;
  transform: translateY(-1px);
}

.btn-danger {
  background: #dc2626;
  color: white;
  border: 1.5px solid #dc2626;
}

.btn-danger:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  transform: translateY(-1px);
}

.edit-dialog, .delete-dialog {
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
}

.warning-text {
  color: #dc2626;
  font-weight: 600;
  margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dialog-content {
    padding: 16px 20px;
    gap: 16px;
  }
  
  .dialog-header {
    padding: 16px 20px;
  }
  
  .dialog-actions {
    padding: 16px 20px;
  }
  
  .knowledge-points-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .filter-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .level-filter {
    min-width: 140px;
  }
}

@media (max-width: 480px) {
  .dialog-content {
    padding: 12px 16px;
  }
  
  .dialog-header {
    padding: 12px 16px;
  }
  
  .dialog-actions {
    padding: 12px 16px;
  }
  
  .knowledge-points-form {
    padding: 16px;
  }
  
  .form-row {
    flex-direction: column;
    gap: 12px;
  }
}
</style> 