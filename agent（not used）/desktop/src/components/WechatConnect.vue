<script setup lang="ts">
/**
 * 微信连接组件
 */

import { ref, onMounted } from 'vue'

const props = defineProps<{
  teacherId: number
  connected: boolean
}>()

const emit = defineEmits<{
  connect: []
  disconnect: []
}>()

// 连接状态
const isConnected = ref(props.connected)
const qrCodeUrl = ref('')
const connecting = ref(false)
const connectionError = ref('')
const wechatType = ref<'work' | 'personal'>('work')

// 发起连接
async function initiateConnection() {
  connecting.value = true
  connectionError.value = ''

  try {
    if (wechatType.value === 'work') {
      // 企业微信 - 直接使用 webhook
      isConnected.value = true
    } else {
      // 个人微信 - 需要扫码
      const response = await fetch(`/api/wechat/qrcode/${props.teacherId}`)

      if (response.ok) {
        const data = await response.json()
        qrCodeUrl.value = data.qr_code_url
      } else {
        connectionError.value = '获取二维码失败'
      }
    }
  } catch (e) {
    connectionError.value = '连接失败: ' + (e as Error).message
  }

  connecting.value = false
}

// 断开连接
async function disconnect() {
  try {
    await fetch(`/api/wechat/disconnect/${props.teacherId}`, {
      method: 'POST'
    })
  } catch (e) {
    // ignore
  }

  isConnected.value = false
  qrCodeUrl.value = ''
  emit('disconnect')
}

// 刷新二维码
async function refreshQRCode() {
  qrCodeUrl.value = ''
  await initiateConnection()
}

// 确认连接成功（模拟）
function confirmConnection() {
  isConnected.value = true
  qrCodeUrl.value = ''
  emit('connect')
}
</script>

<template>
  <div class="wechat-connect">
    <div class="connect-header">
      <h3>📱 微信连接</h3>
    </div>

    <div class="connect-content">
      <!-- 已连接状态 -->
      <div v-if="isConnected" class="connected-state">
        <div class="connection-badge">
          <span class="badge-icon">✅</span>
          <span class="badge-text">已连接</span>
        </div>
        <div class="connection-info">
          <span class="info-type">{{ wechatType === 'work' ? '企业微信' : '个人微信' }}</span>
          <span class="info-status">可接收推送通知</span>
        </div>
        <button @click="disconnect" class="btn-disconnect">
          断开连接
        </button>
      </div>

      <!-- 未连接状态 -->
      <div v-else class="disconnected-state">
        <div class="wechat-options">
          <label>
            <input type="radio" v-model="wechatType" value="work" />
            企业微信（推荐）
          </label>
          <label>
            <input type="radio" v-model="wechatType" value="personal" />
            个人微信（本地扫码）
          </label>
        </div>

        <div class="connect-description">
          <p v-if="wechatType === 'work'">
            企业微信连接后可接收审批通知、每日摘要等推送。
          </p>
          <p v-else>
            个人微信需要在本机运行扫码程序，电脑需保持运行。
          </p>
        </div>

        <!-- 二维码显示 -->
        <div v-if="qrCodeUrl" class="qrcode-display">
          <img :src="qrCodeUrl" alt="微信扫码" />
          <p>请使用微信扫码登录</p>
          <button @click="refreshQRCode">刷新二维码</button>
          <button @click="confirmConnection" class="btn-simulate">
            模拟已连接
          </button>
        </div>

        <!-- 连接按钮 -->
        <div v-else class="connect-actions">
          <button
            @click="initiateConnection"
            :disabled="connecting"
            class="btn-connect"
          >
            {{ connecting ? '连接中...' : '连接微信' }}
          </button>
        </div>

        <!-- 错误提示 -->
        <div v-if="connectionError" class="error-message">
          {{ connectionError }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wechat-connect {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.connect-header h3 {
  margin: 0 0 12px 0;
}

.connect-content {
  min-height: 100px;
}

.connected-state {
  text-align: center;
}

.connection-badge {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.badge-icon {
  font-size: 24px;
}

.badge-text {
  font-size: 16px;
  color: #2ecc71;
}

.connection-info {
  margin-bottom: 12px;
}

.info-type {
  font-weight: bold;
  margin-right: 8px;
}

.info-status {
  color: #666;
}

.btn-disconnect {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.disconnected-state {
  text-align: center;
}

.wechat-options {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.wechat-options label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.connect-description p {
  color: #666;
  font-size: 12px;
  margin-bottom: 12px;
}

.qrcode-display img {
  width: 150px;
  height: 150px;
  margin-bottom: 8px;
}

.qrcode-display p {
  color: #666;
  margin-bottom: 8px;
}

.qrcode-display button {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 4px;
}

.btn-simulate {
  background: #e67e22;
}

.connect-actions {
  margin-top: 12px;
}

.btn-connect {
  padding: 12px 24px;
  background: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-connect:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-top: 8px;
}
</style>