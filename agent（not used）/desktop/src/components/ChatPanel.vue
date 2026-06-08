<script setup lang="ts">
/**
 * 对话面板组件
 */

import { ref, computed, onMounted, nextTick } from 'vue'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  type?: string
}

const props = defineProps<{
  messages: Message[]
  status: string
}>()

const emit = defineEmits<{
  send: [content: string]
  clear: []
}>()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const isTyping = computed(() => props.status === 'processing')

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 监听消息变化
onMounted(() => {
  scrollToBottom()
})

// 发送消息
function handleSend() {
  if (!inputText.value.trim()) return

  emit('send', inputText.value)
  inputText.value = ''

  scrollToBottom()
}

// 清空对话
function handleClear() {
  emit('clear')
}

// 格式化时间
function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取消息样式类
function getMessageClass(msg: Message) {
  return {
    'message-user': msg.role === 'user',
    'message-assistant': msg.role === 'assistant',
    'message-system': msg.role === 'system',
    'message-approval': msg.type === 'approval_required'
  }
}
</script>

<template>
  <div class="chat-panel">
    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-list">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="hamster-welcome">🐹</div>
        <p>欢迎使用 GESP Agent！</p>
        <p>请输入您的需求，例如：</p>
        <ul>
          <li>"查询二级排序题目"</li>
          <li>"创建一道循环题目"</li>
          <li>"查看学生张三的进度"</li>
          <li>"生成本周学情报告"</li>
        </ul>
      </div>

      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="getMessageClass(msg)"
        class="message-item"
      >
        <div class="message-header">
          <span class="message-role">
            {{ msg.role === 'user' ? '👤 教师' : '🐹 Agent' }}
          </span>
          <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <div class="message-content">
          {{ msg.content }}
        </div>

        <!-- 审批按钮 -->
        <div v-if="msg.type === 'approval_required'" class="approval-actions">
          <button class="btn-approve" @click="emit('send', '同意审批')">
            同意
          </button>
          <button class="btn-reject" @click="emit('send', '拒绝审批')">
            拒绝
          </button>
        </div>
      </div>

      <!-- 正在输入指示 -->
      <div v-if="isTyping" class="typing-indicator">
        <span class="hamster-running">🐹</span>
        <span class="typing-text">正在思考...</span>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <textarea
        v-model="inputText"
        placeholder="输入您的需求..."
        rows="3"
        @keydown.ctrl.enter="handleSend"
      ></textarea>

      <div class="input-actions">
        <button @click="handleClear" class="btn-clear" :disabled="messages.length === 0">
          清空对话
        </button>
        <button @click="handleSend" class="btn-send" :disabled="!inputText.trim() || isTyping">
          发送 (Ctrl+Enter)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.hamster-welcome {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state ul {
  list-style: none;
  padding: 0;
  color: #3498db;
}

.empty-state li {
  padding: 4px 0;
}

.message-item {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
}

.message-user {
  background: #e8f4f8;
  border-left: 4px solid #3498db;
}

.message-assistant {
  background: #f0f0f0;
  border-left: 4px solid #2ecc71;
}

.message-system {
  background: #fff3e0;
  border-left: 4px solid #e67e22;
}

.message-approval {
  background: #ffebee;
  border-left: 4px solid #e74c3c;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
}

.approval-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
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

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f0f0;
  border-radius: 8px;
}

.hamster-running {
  font-size: 20px;
  animation: bounce 0.5s infinite;
}

.typing-text {
  color: #666;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.input-area {
  padding: 16px;
  border-top: 1px solid #ddd;
  background: #fafafa;
}

.input-area textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: none;
  font-size: 14px;
}

.input-area textarea:focus {
  outline: none;
  border-color: #3498db;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.btn-clear {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>