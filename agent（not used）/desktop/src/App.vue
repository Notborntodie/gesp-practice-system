<script setup lang="ts">
/**
 * GESP Agent 桌面应用入口
 */

import { ref, computed, onMounted } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import ResultPreview from './components/ResultPreview.vue'
import WorkflowSteps from './components/WorkflowSteps.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import SkillLibrary from './components/SkillLibrary.vue'
import ApprovalQueue from './components/ApprovalQueue.vue'
import TaskScheduler from './components/TaskScheduler.vue'
import WechatConnect from './components/WechatConnect.vue'

// 应用状态
const isInitialized = ref(false)
const isConnected = ref(false)
const currentView = ref('chat')  // chat, settings, skills, approvals, tasks
const agentStatus = ref('idle')
const errorMessage = ref('')
const showSettings = ref(false)

// Session 数据
const sessionId = ref('')
const messages = ref<any[]>([])
const currentWorkflow = ref<any[]>([])
const previewData = ref<any>(null)

// 用户信息
const teacherId = ref(0)
const teacherName = ref('')
const apiKey = ref('')
const quotaUsed = ref(0)
const quotaLimit = ref(100)

// 统计
const stats = ref({
  llmCalls: 0,
  mcpCalls: 0,
  skillsUsed: 0,
  errorCount: 0
})

// 初始化
onMounted(async () => {
  await initializeAgent()
})

async function initializeAgent() {
  try {
    // 检查配置
    const savedConfig = localStorage.getItem('gesp_agent_config')

    if (savedConfig) {
      const config = JSON.parse(savedConfig)
      apiKey.value = config.apiKey || ''
      teacherId.value = config.teacherId || 0
    }

    // 测试连接
    if (apiKey.value) {
      isConnected.value = true
    }

    isInitialized.value = true
  } catch (e) {
    errorMessage.value = '初始化失败: ' + (e as Error).message
  }
}

// 计算属性
const statusText = computed(() => {
  switch (agentStatus.value) {
    case 'idle': return '就绪'
    case 'processing': return '处理中...'
    case 'waiting_approval': return '等待审批'
    case 'waiting_confirm': return '等待确认'
    case 'error': return '错误'
    default: return agentStatus.value
  }
})

const quotaPercent = computed(() => {
  return Math.round((quotaUsed.value / quotaLimit.value) * 100)
})

// 方法
async function sendMessage(content: string) {
  if (!content.trim()) return

  agentStatus.value = 'processing'

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content,
    timestamp: new Date().toISOString()
  })

  try {
    // 调用 Agent API
    const response = await fetch('/api/agent/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value}`
      },
      body: JSON.stringify({
        input: content,
        teacher_id: teacherId.value
      })
    })

    const result = await response.json()

    // 处理响应
    if (result.status === 'completed') {
      messages.value.push({
        role: 'assistant',
        content: result.responses?.[0] || '操作完成',
        timestamp: new Date().toISOString()
      })

      currentWorkflow.value = result.steps || []
      previewData.value = result.data
      stats.value.llmCalls++
    } else if (result.status === 'waiting_approval') {
      messages.value.push({
        role: 'assistant',
        content: result.message,
        type: 'approval_required',
        timestamp: new Date().toISOString()
      })
      agentStatus.value = 'waiting_approval'
    } else if (result.status === 'skill_executed') {
      messages.value.push({
        role: 'assistant',
        content: `Skill "${result.skill}" 执行完成`,
        timestamp: new Date().toISOString()
      })
      stats.value.skillsUsed++
    } else {
      errorMessage.value = result.message || '未知错误'
      agentStatus.value = 'error'
    }

    if (agentStatus.value !== 'waiting_approval') {
      agentStatus.value = 'idle'
    }

  } catch (e) {
    errorMessage.value = '请求失败: ' + (e as Error).message
    agentStatus.value = 'error'
    stats.value.errorCount++
  }
}

function handleApproval(approved: boolean) {
  // TODO: 发送审批响应
  agentStatus.value = 'idle'
}

function toggleSettings() {
  showSettings.value = !showSettings.value
}

function switchView(view: string) {
  currentView.value = view
}

function clearMessages() {
  messages.value = []
}
</script>

<template>
  <div class="app-container">
    <!-- 顶部导航 -->
    <header class="app-header">
      <div class="logo">
        <span class="hamster-icon">🐹</span>
        <span class="app-title">GESP Agent</span>
      </div>

      <div class="header-nav">
        <button @click="switchView('chat')" :class="{ active: currentView === 'chat' }">
          对话
        </button>
        <button @click="switchView('skills')" :class="{ active: currentView === 'skills' }">
          Skills
        </button>
        <button @click="switchView('approvals')" :class="{ active: currentView === 'approvals' }">
          审批
        </button>
        <button @click="switchView('tasks')" :class="{ active: currentView === 'tasks' }">
          定时任务
        </button>
        <button @click="toggleSettings()" :class="{ active: showSettings }">
          ⚙️ 设置
        </button>
      </div>

      <div class="user-info">
        <span class="teacher-name">{{ teacherName }}</span>
        <span class="quota">额度: {{ quotaUsed }}/{{ quotaLimit }}</span>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 对话视图 -->
      <div v-if="currentView === 'chat'" class="chat-view">
        <div class="chat-area">
          <ChatPanel
            :messages="messages"
            :status="agentStatus"
            @send="sendMessage"
            @clear="clearMessages"
          />
        </div>

        <div class="right-panel">
          <!-- 工作流步骤 -->
          <WorkflowSteps
            v-if="currentWorkflow.length > 0"
            :steps="currentWorkflow"
          />

          <!-- 结果预览 -->
          <ResultPreview
            v-if="previewData"
            :data="previewData"
          />

          <!-- 微信连接 -->
          <WechatConnect
            :teacher-id="teacherId"
            :connected="false"
          />
        </div>
      </div>

      <!-- Skills 视图 -->
      <div v-if="currentView === 'skills'" class="skills-view">
        <SkillLibrary
          :teacher-id="teacherId"
          :api-key="apiKey"
        />
      </div>

      <!-- 审批视图 -->
      <div v-if="currentView === 'approvals'" class="approvals-view">
        <ApprovalQueue
          :teacher-id="teacherId"
          :api-key="apiKey"
          @approve="handleApproval(true)"
          @reject="handleApproval(false)"
        />
      </div>

      <!-- 定时任务视图 -->
      <div v-if="currentView === 'tasks'" class="tasks-view">
        <TaskScheduler
          :teacher-id="teacherId"
          :api-key="apiKey"
        />
      </div>

      <!-- 设置面板 -->
      <SettingsPanel
        v-if="showSettings"
        :teacher-id="teacherId"
        :api-key="apiKey"
        @close="showSettings = false"
        @save="initializeAgent"
      />
    </main>

    <!-- 状态栏 -->
    <StatusBar
      :status="agentStatus"
      :status-text="statusText"
      :quota-percent="quotaPercent"
      :stats="stats"
    />

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-toast">
      {{ errorMessage }}
      <button @click="errorMessage = ''">✕</button>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #2c3e50;
  color: white;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hamster-icon {
  font-size: 24px;
}

.app-title {
  font-size: 18px;
  font-weight: bold;
}

.header-nav {
  display: flex;
  gap: 8px;
}

.header-nav button {
  padding: 8px 16px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.header-nav button.active {
  background: rgba(255, 255, 255, 0.3);
}

.header-nav button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.user-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.chat-view {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
}

.chat-area {
  flex: 2;
  min-width: 400px;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 300px;
}

.skills-view,
.approvals-view,
.tasks-view {
  flex: 1;
  padding: 16px;
}

.error-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: #e74c3c;
  color: white;
  border-radius: 8px;
  display: flex;
  gap: 16px;
  align-items: center;
}

.error-toast button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
}
</style>