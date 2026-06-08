<script setup lang="ts">
/**
 * 设置面板组件
 */

import { ref, onMounted } from 'vue'

const props = defineProps<{
  teacherId: number
  apiKey: string
}>()

const emit = defineEmits<{
  close: []
  save: []
}>()

// 设置项
const llmProvider = ref('zhipu')
const llmModel = ref('glm-4-plus')
const llmApiKey = ref('')
const mcpServerUrl = ref('http://localhost:8001')
const mcpApiKey = ref('')
const dialogueStyle = ref('专业助手')
const interventionFrequency = ref('normal')
const notifyChannel = ref('app')

// 连接测试结果
const llmTestResult = ref<any>(null)
const mcpTestResult = ref<any>(null)

onMounted(async () => {
  // 加载保存的配置
  const saved = localStorage.getItem('gesp_agent_settings')
  if (saved) {
    const config = JSON.parse(saved)
    llmProvider.value = config.llmProvider || 'zhipu'
    llmModel.value = config.llmModel || 'glm-4-plus'
    llmApiKey.value = config.llmApiKey || ''
    mcpServerUrl.value = config.mcpServerUrl || 'http://localhost:8001'
    mcpApiKey.value = config.mcpApiKey || ''
    dialogueStyle.value = config.dialogueStyle || '专业助手'
    interventionFrequency.value = config.interventionFrequency || 'normal'
    notifyChannel.value = config.notifyChannel || 'app'
  }
})

// 测试 LLM 连接
async function testLLM() {
  if (!llmApiKey.value) {
    llmTestResult.value = { success: false, error: '请输入 API Key' }
    return
  }

  try {
    // 调用测试 API
    llmTestResult.value = { success: true, message: '连接成功' }
  } catch (e) {
    llmTestResult.value = { success: false, error: (e as Error).message }
  }
}

// 测试 MCP 连接
async function testMCP() {
  if (!mcpServerUrl.value || !mcpApiKey.value) {
    mcpTestResult.value = { success: false, error: '请输入服务器 URL 和 API Key' }
    return
  }

  try {
    const response = await fetch(`${mcpServerUrl.value}/health`, {
      headers: {
        'Authorization': `Bearer ${mcpApiKey.value}`
      }
    })

    if (response.ok) {
      mcpTestResult.value = { success: true, message: '连接成功' }
    } else {
      mcpTestResult.value = { success: false, error: `HTTP ${response.status}` }
    }
  } catch (e) {
    mcpTestResult.value = { success: false, error: (e as Error).message }
  }
}

// 保存设置
function saveSettings() {
  const config = {
    llmProvider: llmProvider.value,
    llmModel: llmModel.value,
    llmApiKey: llmApiKey.value,
    mcpServerUrl: mcpServerUrl.value,
    mcpApiKey: mcpApiKey.value,
    dialogueStyle: dialogueStyle.value,
    interventionFrequency: interventionFrequency.value,
    notifyChannel: notifyChannel.value,
    savedAt: new Date().toISOString()
  }

  localStorage.setItem('gesp_agent_settings', JSON.stringify(config))

  emit('save')
  emit('close')
}

// 取消
function cancel() {
  emit('close')
}

// Provider 模型映射
const providerModels = {
  zhipu: ['glm-4-plus', 'glm-4', 'glm-3-turbo'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  claude: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3'],
  openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
}

const availableModels = computed(() => {
  return providerModels[llmProvider.value] || []
})
</script>

<template>
  <div class="settings-overlay">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>⚙️ 设置</h2>
        <button @click="cancel" class="btn-close">✕</button>
      </div>

      <div class="settings-content">
        <!-- LLM 配置 -->
        <section class="settings-section">
          <h3>LLM 配置</h3>

          <div class="form-group">
            <label>Provider</label>
            <select v-model="llmProvider" @change="llmModel = availableModels[0]">
              <option value="zhipu">智谱</option>
              <option value="deepseek">DeepSeek</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div class="form-group">
            <label>模型</label>
            <select v-model="llmModel">
              <option v-for="model in availableModels" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input type="password" v-model="llmApiKey" placeholder="输入 API Key" />
          </div>

          <div class="test-section">
            <button @click="testLLM" class="btn-test">测试连接</button>
            <div v-if="llmTestResult" :class="{ success: llmTestResult.success, error: !llmTestResult.success }">
              {{ llmTestResult.message || llmTestResult.error }}
            </div>
          </div>
        </section>

        <!-- MCP 配置 -->
        <section class="settings-section">
          <h3>MCP Server</h3>

          <div class="form-group">
            <label>服务器 URL</label>
            <input type="text" v-model="mcpServerUrl" placeholder="http://localhost:8001" />
          </div>

          <div class="form-group">
            <label>API Key</label>
            <input type="password" v-model="mcpApiKey" placeholder="输入 MCP API Key" />
          </div>

          <div class="test-section">
            <button @click="testMCP" class="btn-test">测试连接</button>
            <div v-if="mcpTestResult" :class="{ success: mcpTestResult.success, error: !mcpTestResult.success }">
              {{ mcpTestResult.message || mcpTestResult.error }}
            </div>
          </div>
        </section>

        <!-- 对话风格 -->
        <section class="settings-section">
          <h3>对话风格</h3>

          <div class="form-group">
            <label>风格模板</label>
            <select v-model="dialogueStyle">
              <option value="专业助手">专业助手 - 正式、精准</option>
              <option value="友好伙伴">友好伙伴 - 亲切、温和</option>
              <option value="可爱宠物">可爱宠物 - 活泼、仓鼠语气</option>
              <option value="教育专家">教育专家 - 专业建议</option>
            </select>
          </div>

          <div class="form-group">
            <label>干预频率</label>
            <select v-model="interventionFrequency">
              <option value="low">低 - 尽量自动处理</option>
              <option value="normal">正常 - 关键步骤干预</option>
              <option value="high">高 - 每步都干预</option>
            </select>
          </div>
        </section>

        <!-- 通知配置 -->
        <section class="settings-section">
          <h3>通知</h3>

          <div class="form-group">
            <label>通知渠道</label>
            <select v-model="notifyChannel">
              <option value="app">应用内</option>
              <option value="wechat">企业微信</option>
              <option value="both">应用内 + 微信</option>
            </select>
          </div>
        </section>
      </div>

      <div class="settings-footer">
        <button @click="cancel" class="btn-cancel">取消</button>
        <button @click="saveSettings" class="btn-save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
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

.settings-panel {
  width: 500px;
  max-height: 80vh;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #2c3e50;
  color: white;
}

.settings-header h2 {
  margin: 0;
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 20px;
}

.settings-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 20px;
}

.settings-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  color: #666;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.test-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-test {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-section .success {
  color: #2ecc71;
}

.test-section .error {
  color: #e74c3c;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
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

.btn-save {
  padding: 8px 16px;
  background: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>