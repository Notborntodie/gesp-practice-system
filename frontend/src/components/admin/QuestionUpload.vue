<template>
  <div class="content-section">
    <div class="upload-header">
      <h2>上传题目</h2>
    </div>

    <div class="upload-cards-container">
      <!-- 批量上传卡片 -->
      <div class="management-card">
        <div class="management-header">
          <div class="management-title">
            <Icon name="file-text" :size="24" class="card-icon" />
            <h3>批量上传题目</h3>
            <span class="management-desc">粘贴 JSON 或使用 AI 提取，批量导入题目</span>
          </div>
          <button class="btn-action" @click="openBatchUploadDialog">
            <Icon name="plus" :size="16" />
            开始上传
          </button>
        </div>
      </div>

      <!-- 题目来源管理 -->
      <div class="management-card">
        <div class="management-header">
          <div class="management-title">
            <Icon name="tag" :size="24" class="card-icon" />
            <h3>题目来源管理</h3>
            <span class="management-desc">共 {{ allTypes.length }} 个来源</span>
          </div>
          <button class="btn-action" @click="showAddDialog = true">
            <Icon name="plus" :size="16" />
            新增来源
          </button>
        </div>

        <div class="source-list">
          <div v-for="t in allTypes" :key="t.id" class="source-item">
            <div class="source-info">
              <span class="source-name">{{ t.display_name }}</span>
              <span class="source-code">{{ t.name }}</span>
              <span v-if="t.description" class="source-desc">{{ t.description }}</span>
            </div>
            <div class="source-actions">
              <button
                v-if="isSuperAdmin"
                class="btn-delete-source"
                @click="deleteSource(t)"
                title="删除来源"
              >
                <Icon name="trash-2" :size="14" />
              </button>
            </div>
          </div>

          <div v-if="allTypes.length === 0" class="source-empty">
            暂无题目来源
          </div>
        </div>
      </div>
    </div>

    <!-- 批量上传弹窗 -->
    <BatchUploadDialog
      :visible="showBatchUploadDialog"
      @close="closeBatchUploadDialog"
    />

    <!-- 新增题目来源弹窗 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>新增题目来源</h3>
          <button class="dialog-close" @click="showAddDialog = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>显示名称 <span class="required">*</span></label>
            <input v-model="newType.display_name" type="text" placeholder="如：蓝桥杯" class="form-input" />
          </div>
          <div class="form-group">
            <label>类型标识 <span class="required">*</span></label>
            <input v-model="newType.name" type="text" placeholder="如：LANQIAO（英文大写，自动转换）" class="form-input" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="newType.description" type="text" placeholder="可选描述" class="form-input" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="showAddDialog = false">取消</button>
          <button class="btn btn-primary" @click="addSource" :disabled="adding">
            {{ adding ? '添加中...' : '确认添加' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BatchUploadDialog from './Dialog/BatchUploadDialog.vue'
import Icon from '@/components/Icon.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

const questionTypeStore = useQuestionTypeStore()
const { allTypes } = questionTypeStore

// 弹窗状态
const showBatchUploadDialog = ref(false)
const showAddDialog = ref(false)
const adding = ref(false)

// 新增来源表单
const newType = ref({ name: '', display_name: '', description: '' })

// 当前用户是否为超级管理员
const isSuperAdmin = computed(() => {
  const userInfoStr = localStorage.getItem('userInfo')
  if (!userInfoStr) return false
  try {
    const userInfo = JSON.parse(userInfoStr)
    return userInfo.roles?.some((role: any) => role.id === 4 || role.name === 'super_admin') || false
  } catch {
    return false
  }
})

// 获取当前用户ID
function getCurrentUserId(): number | null {
  const userInfoStr = localStorage.getItem('userInfo')
  if (!userInfoStr) return null
  try {
    const userInfo = JSON.parse(userInfoStr)
    return userInfo.id || null
  } catch {
    return null
  }
}

function openBatchUploadDialog() {
  showBatchUploadDialog.value = true
}

function closeBatchUploadDialog() {
  showBatchUploadDialog.value = false
}

async function addSource() {
  if (!newType.value.display_name.trim() || !newType.value.name.trim()) {
    alert('请填写显示名称和类型标识')
    return
  }

  adding.value = true
  try {
    await questionTypeStore.createQuestionType({
      name: newType.value.name,
      display_name: newType.value.display_name,
      description: newType.value.description
    }, getCurrentUserId())
    newType.value = { name: '', display_name: '', description: '' }
    showAddDialog.value = false
    alert('题目来源添加成功')
  } catch (err: any) {
    alert('添加失败: ' + (err.response?.data?.error || err.message))
  } finally {
    adding.value = false
  }
}

async function deleteSource(type: any) {
  if (!confirm(`确定要删除题目来源「${type.display_name}」吗？`)) return

  const userId = getCurrentUserId()
  try {
    await axios.delete(`${BASE_URL}/question-types/${type.id}`, {
      params: { admin_user_id: userId }
    })
    await questionTypeStore.fetchQuestionTypes(true)
    alert('删除成功')
  } catch (err: any) {
    alert('删除失败: ' + (err.response?.data?.error || err.message))
  }
}

onMounted(async () => {
  await questionTypeStore.fetchQuestionTypes()
})
</script>

<style scoped>
.content-section {
  width: 100%;
  min-height: 100vh;
  background: #f8fafc;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: 100vw;
  overflow-x: hidden;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  width: 100%;
  box-sizing: border-box;
  background: white;
  max-width: 1200px;
  margin: 0 auto;
}

.upload-cards-container {
  width: 100%;
  padding: 24px;
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-section h2 {
  margin: 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

/* 统一卡片风格 */
.management-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f1f5f9;
}

.management-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.management-title .card-icon {
  color: #6366f1;
}

.management-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.management-desc {
  font-size: 13px;
  color: #94a3b8;
  margin-left: 4px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

/* 来源列表 */
.source-list {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  transition: background 0.15s;
}

.source-item:hover {
  background: #f8fafc;
}

.source-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.source-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
}

.source-code {
  font-size: 11px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.source-desc {
  font-size: 12px;
  color: #b0b8c4;
}

.source-actions {
  display: flex;
  gap: 4px;
}

.btn-delete-source {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete-source:hover {
  background: #fef2f2;
  color: #ef4444;
}

.source-empty {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 14px;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-box {
  background: white;
  border-radius: 12px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 22px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.dialog-close:hover {
  color: #475569;
}

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.required {
  color: #ef4444;
}

.form-input {
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid #f1f5f9;
}

.btn {
  padding: 9px 18px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.btn-primary {
  background: #6366f1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f9fafb;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f1f5f9;
  color: #475569;
}
</style>
