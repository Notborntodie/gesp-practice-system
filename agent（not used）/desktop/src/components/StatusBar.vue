<script setup lang="ts">
/**
 * 状态栏组件
 */

import { computed } from 'vue'

interface Stats {
  llmCalls: number
  mcpCalls: number
  skillsUsed: number
  errorCount: number
}

const props = defineProps<{
  status: string
  statusText: string
  quotaPercent: number
  stats: Stats
}>()

// 状态图标
const statusIcon = computed(() => {
  switch (props.status) {
    case 'idle': return '🐹'
    case 'processing': return '🏃'
    case 'waiting_approval': return '⏸️'
    case 'waiting_confirm': return '❓'
    case 'error': return '⚠️'
    default: return '🐹'
  }
})

// 额度颜色
const quotaColor = computed(() => {
  if (props.quotaPercent > 80) return '#e74c3c'
  if (props.quotaPercent > 50) return '#e67e22'
  return '#2ecc71'
})
</script>

<template>
  <footer class="status-bar">
    <div class="status-left">
      <span class="status-icon">{{ statusIcon }}</span>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <div class="status-center">
      <span class="stats-item">
        LLM: {{ stats.llmCalls }}
      </span>
      <span class="stats-item">
        MCP: {{ stats.mcpCalls }}
      </span>
      <span class="stats-item">
        Skills: {{ stats.skillsUsed }}
      </span>
      <span class="stats-item" :class="{ error: stats.errorCount > 0 }">
        错误: {{ stats.errorCount }}
      </span>
    </div>

    <div class="status-right">
      <div class="quota-bar">
        <div
          class="quota-fill"
          :style="{ width: quotaPercent + '%', background: quotaColor }"
        ></div>
      </div>
      <span class="quota-text">{{ quotaPercent }}%</span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: #2c3e50;
  color: white;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 20px;
}

.status-text {
  font-size: 14px;
}

.status-center {
  display: flex;
  gap: 16px;
}

.stats-item {
  font-size: 12px;
}

.stats-item.error {
  color: #e74c3c;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quota-bar {
  width: 100px;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.quota-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.quota-text {
  font-size: 12px;
}
</style>