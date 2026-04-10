<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">✏️</div>
        <h3 class="dialog-title">编辑知识点</h3>
        <button @click="handleClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div class="form-section">
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
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">取消</button>
        <button @click="updateKnowledgePoint" class="btn btn-primary" :disabled="!isFormValid">
          保存修改
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">import { BASE_URL } from '@/config/api'

import { ref, computed, watch } from 'vue'
import axios from 'axios'

const props = defineProps<{
  visible: boolean
  knowledgePoint: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', knowledgePoint: any): void
}>()

const editingKnowledgePoint = ref({
  id: null,
  name: '',
  description: '',
  category: 'data_structure',
  level: 1
})

// 监听props变化，更新编辑数据
watch(() => props.knowledgePoint, (newValue) => {
  if (newValue) {
    editingKnowledgePoint.value = {
      id: newValue.id,
      name: newValue.name || '',
      description: newValue.description || '',
      category: newValue.category || 'data_structure',
      level: newValue.level || 1
    }
  }
}, { immediate: true })

// 表单验证
const isFormValid = computed(() => {
  return editingKnowledgePoint.value.name.trim() !== ''
})

// 更新知识点
async function updateKnowledgePoint() {
  if (!isFormValid.value) {
    alert('请填写知识点名称')
    return
  }

  try {
    const response = await axios.put(`${BASE_URL}/knowledge-points/${editingKnowledgePoint.value.id}`, {
      name: editingKnowledgePoint.value.name.trim(),
      description: editingKnowledgePoint.value.description.trim(),
      category: editingKnowledgePoint.value.category,
      level: parseInt(editingKnowledgePoint.value.level.toString())
    })
    
    // 后端只返回成功消息，我们构造更新后的知识点对象
    if (response.data.message && response.data.message.includes('成功')) {
      // 构造更新后的知识点对象，包含用户编辑的数据
      const updatedKnowledgePoint = {
        id: editingKnowledgePoint.value.id,
        name: editingKnowledgePoint.value.name.trim(),
        description: editingKnowledgePoint.value.description.trim(),
        category: editingKnowledgePoint.value.category,
        level: parseInt(editingKnowledgePoint.value.level.toString()),
        created_at: props.knowledgePoint?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      emit('updated', updatedKnowledgePoint)
    } else {
      // 如果后端返回了完整数据，直接使用
      emit('updated', response.data)
    }
    
    // 关闭弹窗
    handleClose()
  } catch (error: any) {
    alert('更新知识点失败: ' + (error.response?.data?.message || error.message))
  }
}

function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  emit('close')
}
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
  border-radius: 18px;
  padding: 24px;
  max-width: 600px;
  width: 95%;
  max-height: 90vh;
  box-shadow: 0 6px 24px -4px rgba(30,144,255,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.03);
  animation: dialogSlideIn 0.3s ease-out;
  position: relative;
  border: 1.5px solid #b6e0fe;
  display: flex;
  flex-direction: column;
}

@keyframes dialogSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(-20px);}
  to { opacity: 1; transform: scale(1) translateY(0);}
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
  background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
  border-radius: 12px;
  margin: -24px -24px 20px -24px;
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
  padding-right: 8px;
}

.form-section {
  padding: 24px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
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

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #e2e8f0;
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

.btn-primary:disabled {
  background: #9ca3af;
  border-color: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dialog-container {
    max-width: 95%;
    margin: 20px;
  }
  
  .form-row {
    flex-direction: column;
    gap: 12px;
  }
  
  .dialog-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
