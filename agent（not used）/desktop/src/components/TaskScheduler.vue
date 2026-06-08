<script setup lang="ts">
/**
 * 定时任务组件
 */

import { ref, onMounted } from 'vue'

interface Task {
  id: number
  teacher_id: number
  task_name: string
  task_type: string
  schedule_config: any
  action_config: any
  notify_channel: string
  is_active: boolean
  created_at: string
}

const props = defineProps<{
  teacherId: number
  apiKey: string
}>()

const emit = defineEmits<{
  create: [task: any]
  cancel: [taskId: number]
}>()

// 任务列表
const tasks = ref<Task[]>([])
const showCreateForm = ref(false)

// 新任务配置
const newTask = ref({
  task_name: '',
  task_type: 'cron',
  schedule_time: '08:00',
  action: 'daily_summary',
  notify_channel: 'wechat'
})

// 加载任务
onMounted(async () => {
  await loadTasks()
})

async function loadTasks() {
  try {
    const response = await fetch(`/api/tasks/${props.teacherId}`, {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      tasks.value = data.tasks || []
    }
  } catch (e) {
    // Mock data
    tasks.value = [
      {
        id: 1,
        teacher_id: props.teacherId,
        task_name: '每日摘要',
        task_type: 'cron',
        schedule_config: { time: '20:00', repeat: 'daily' },
        action_config: { action: 'daily_summary' },
        notify_channel: 'wechat',
        is_active: true,
        created_at: '2024-01-10'
      },
      {
        id: 2,
        teacher_id: props.teacherId,
        task_name: '张三提醒',
        task_type: 'condition',
        schedule_config: { condition: 'student_no_submit', days: 3 },
        action_config: { action: 'send_reminder' },
        notify_channel: 'wechat',
        is_active: true,
        created_at: '2024-01-12'
      }
    ]
  }
}

// 创建任务
async function createTask() {
  const taskData = {
    teacher_id: props.teacherId,
    task_name: newTask.value.task_name,
    task_type: newTask.value.task_type,
    schedule_config: {
      time: newTask.value.schedule_time
    },
    action_config: {
      action: newTask.value.action
    },
    notify_channel: newTask.value.notify_channel
  }

  try {
    const response = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify(taskData)
    })

    if (response.ok) {
      await loadTasks()
      showCreateForm.value = false
      newTask.value = {
        task_name: '',
        task_type: 'cron',
        schedule_time: '08:00',
        action: 'daily_summary',
        notify_channel: 'wechat'
      }
    }
  } catch (e) {
    emit('create', taskData)
    showCreateForm.value = false
  }
}

// 取消任务
async function cancelTask(taskId: number) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        task.is_active = false
      }
      emit('cancel', taskId)
    }
  } catch (e) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.is_active = false
    }
  }
}

// 获取任务类型描述
function getTaskTypeDesc(type: string) {
  const descs = {
    'cron': '定时任务',
    'condition': '条件任务',
    'once': '一次性任务'
  }
  return descs[type] || type
}

// 获取任务状态样式
function getTaskStatusClass(task: Task) {
  return {
    'task-active': task.is_active,
    'task-inactive': !task.is_active
  }
}
</script>

<template>
  <div class="task-scheduler">
    <div class="scheduler-header">
      <h2>⏰ 定时任务</h2>
      <button @click="showCreateForm = true" class="btn-create">
        + 新建任务
      </button>
    </div>

    <div class="tasks-list">
      <div v-if="tasks.length === 0" class="empty-state">
        暂无定时任务。
      </div>

      <div v-for="task in tasks" :key="task.id" :class="getTaskStatusClass(task)" class="task-item">
        <div class="task-main">
          <span class="task-name">{{ task.task_name }}</span>
          <span class="task-type">{{ getTaskTypeDesc(task.task_type) }}</span>
          <span class="task-schedule">
            {{ task.schedule_config?.time || task.schedule_config?.condition }}
          </span>
          <span class="task-channel">{{ task.notify_channel }}</span>
        </div>

        <div class="task-status">
          <span v-if="task.is_active" class="status-active">● 活跃</span>
          <span v-else class="status-inactive">● 已取消</span>
        </div>

        <div class="task-actions">
          <button
            v-if="task.is_active"
            @click="cancelTask(task.id)"
            class="btn-cancel"
          >
            取消
          </button>
          <button
            v-else
            disabled
            class="btn-cancel"
          >
            已取消
          </button>
        </div>
      </div>
    </div>

    <!-- 创建任务弹窗 -->
    <div v-if="showCreateForm" class="create-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>新建定时任务</h3>
          <button @click="showCreateForm = false" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="newTask.task_name" placeholder="例如：每日摘要" />
          </div>

          <div class="form-group">
            <label>任务类型</label>
            <select v-model="newTask.task_type">
              <option value="cron">定时任务</option>
              <option value="condition">条件任务</option>
              <option value="once">一次性任务</option>
            </select>
          </div>

          <div class="form-group">
            <label>执行时间</label>
            <input v-model="newTask.schedule_time" type="time" />
          </div>

          <div class="form-group">
            <label>执行动作</label>
            <select v-model="newTask.action">
              <option value="daily_summary">每日摘要</option>
              <option value="weekly_report">每周报告</option>
              <option value="reminder">发送提醒</option>
            </select>
          </div>

          <div class="form-group">
            <label>通知渠道</label>
            <select v-model="newTask.notify_channel">
              <option value="wechat">企业微信</option>
              <option value="app">应用内</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="showCreateForm = false" class="btn-cancel">取消</button>
          <button @click="createTask" class="btn-create">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-scheduler {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.scheduler-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.scheduler-header h2 {
  margin: 0;
}

.btn-create {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.tasks-list {
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #666;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 8px;
}

.task-active {
  background: #f5f5f5;
}

.task-inactive {
  background: #ffebee;
  opacity: 0.7;
}

.task-main {
  display: flex;
  gap: 12px;
}

.task-name {
  font-weight: bold;
}

.task-type {
  color: #666;
}

.task-schedule {
  color: #3498db;
}

.task-channel {
  color: #999;
}

.status-active {
  color: #2ecc71;
}

.status-inactive {
  color: #e74c3c;
}

.btn-cancel {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-modal {
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

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
}

.form-group input,
.form-group select {
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

.modal-footer .btn-cancel {
  background: #95a5a6;
}
</style>