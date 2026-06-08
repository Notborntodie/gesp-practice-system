<script setup lang="ts">
/**
 * 审批队列组件
 */

import { ref, onMounted } from 'vue'

interface Approval {
  id: number
  teacher_id: number
  action: string
  params: any
  status: string
  created_at: string
  reason?: string
}

const props = defineProps<{
  teacherId: number
  apiKey: string
}>()

const emit = defineEmits<{
  approve: [approvalId: number]
  reject: [approvalId: number]
}>()

// 审批列表
const approvals = ref<Approval[]>([])
const isAdmin = ref(false)
const selectedApproval = ref<Approval | null>(null)
const approvalReason = ref('')

// 加载审批列表
onMounted(async () => {
  await loadApprovals()
})

async function loadApprovals() {
  try {
    const response = await fetch('/api/approvals/pending', {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      approvals.value = data.approvals || []
      isAdmin.value = data.is_admin || false
    }
  } catch (e) {
    // Mock data
    approvals.value = [
      {
        id: 1,
        teacher_id: 101,
        action: 'update_question',
        params: { question_id: 123, title: '新标题' },
        status: 'pending',
        created_at: '2024-01-15 10:00'
      },
      {
        id: 2,
        teacher_id: 102,
        action: 'delete_question',
        params: { question_id: 456 },
        status: 'pending',
        created_at: '2024-01-15 11:00'
      }
    ]
    isAdmin.value = true
  }
}

// 查看详情
function viewDetails(approval: Approval) {
  selectedApproval.value = approval
}

// 批准
async function handleApprove(approval: Approval) {
  try {
    const response = await fetch(`/api/approvals/${approval.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        admin_id: props.teacherId,
        reason: approvalReason.value
      })
    })

    if (response.ok) {
      approval.status = 'approved'
      emit('approve', approval.id)
      selectedApproval.value = null
      approvalReason.value = ''
    }
  } catch (e) {
    approval.status = 'approved'
    emit('approve', approval.id)
  }
}

// 拒绝
async function handleReject(approval: Approval) {
  try {
    const response = await fetch(`/api/approvals/${approval.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        admin_id: props.teacherId,
        reason: approvalReason.value
      })
    })

    if (response.ok) {
      approval.status = 'rejected'
      emit('reject', approval.id)
      selectedApproval.value = null
      approvalReason.value = ''
    }
  } catch (e) {
    approval.status = 'rejected'
    emit('reject', approval.id)
  }
}

// 关闭详情
function closeDetails() {
  selectedApproval.value = null
  approvalReason.value = ''
}

// 获取状态样式
function getStatusClass(status: string) {
  return {
    'status-pending': status === 'pending',
    'status-approved': status === 'approved',
    'status-rejected': status === 'rejected'
  }
}

// 获取操作描述
function getActionDescription(action: string) {
  const descriptions = {
    'update_question': '修改题目',
    'delete_question': '删除题目',
    'update_exam': '修改考试',
    'delete_exam': '删除考试',
    'update_learning_plan': '修改学习计划'
  }
  return descriptions[action] || action
}
</script>

<template>
  <div class="approval-queue">
    <div class="queue-header">
      <h2>📋 审批队列</h2>
      <span class="queue-count">{{ approvals.length }} 待处理</span>
    </div>

    <div v-if="!isAdmin" class="not-admin">
      您不是管理员，无法处理审批。
    </div>

    <div v-else class="approvals-list">
      <div v-if="approvals.length === 0" class="empty-state">
        暂无待处理的审批请求。
      </div>

      <div v-for="approval in approvals" :key="approval.id" class="approval-item">
        <div class="approval-main">
          <span :class="getStatusClass(approval.status)" class="status-badge">
            {{ approval.status }}
          </span>
          <span class="approval-id">#{{ approval.id }}</span>
          <span class="approval-action">{{ getActionDescription(approval.action) }}</span>
          <span class="approval-teacher">教师 #{{ approval.teacher_id }}</span>
          <span class="approval-time">{{ approval.created_at }}</span>
        </div>

        <div class="approval-actions">
          <button @click="viewDetails(approval)" class="btn-view">
            详情
          </button>
          <button
            v-if="approval.status === 'pending'"
            @click="handleApprove(approval)"
            class="btn-approve"
          >
            批准
          </button>
          <button
            v-if="approval.status === 'pending'"
            @click="handleReject(approval)"
            class="btn-reject"
          >
            拒绝
          </button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="selectedApproval" class="details-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>审批详情 #{{ selectedApproval.id }}</h3>
          <button @click="closeDetails" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">操作</span>
            <span class="detail-value">{{ getActionDescription(selectedApproval.action) }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">提交者</span>
            <span class="detail-value">教师 #{{ selectedApproval.teacher_id }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">参数</span>
            <pre class="detail-params">{{ JSON.stringify(selectedApproval.params, null, 2) }}</pre>
          </div>

          <div class="detail-row">
            <span class="detail-label">时间</span>
            <span class="detail-value">{{ selectedApproval.created_at }}</span>
          </div>

          <div class="reason-input">
            <label>审批意见</label>
            <textarea v-model="approvalReason" placeholder="输入审批意见..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="handleApprove(selectedApproval)" class="btn-approve">
            批准
          </button>
          <button @click="handleReject(selectedApproval)" class="btn-reject">
            拒绝
          </button>
          <button @click="closeDetails" class="btn-cancel">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.approval-queue {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.queue-header h2 {
  margin: 0;
}

.queue-count {
  color: #666;
}

.not-admin {
  padding: 40px;
  text-align: center;
  color: #666;
}

.approvals-list {
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #666;
}

.approval-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 8px;
}

.approval-main {
  display: flex;
  gap: 12px;
  align-items: center;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-pending {
  background: #fff3e0;
  color: #e67e22;
}

.status-approved {
  background: #e8f8e8;
  color: #2ecc71;
}

.status-rejected {
  background: #ffebee;
  color: #e74c3c;
}

.approval-id {
  font-weight: bold;
}

.approval-action {
  color: #3498db;
}

.approval-time {
  color: #999;
  font-size: 12px;
}

.approval-actions {
  display: flex;
  gap: 8px;
}

.btn-view {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-approve {
  padding: 8px 16px;
  background: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reject {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.details-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 400px;
  background: white;
  border-radius: 8px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  background: #2c3e50;
  color: white;
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
}

.detail-row {
  display: flex;
  margin-bottom: 12px;
}

.detail-label {
  width: 80px;
  color: #666;
}

.detail-value {
  flex: 1;
}

.detail-params {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.reason-input {
  margin-top: 16px;
}

.reason-input label {
  display: block;
  margin-bottom: 4px;
}

.reason-input textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #ddd;
}

.btn-cancel {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>