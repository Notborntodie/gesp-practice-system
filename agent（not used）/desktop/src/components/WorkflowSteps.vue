<script setup lang="ts">
/**
 * 工作流步骤组件
 */

import { computed } from 'vue'

interface Step {
  step: number
  action: string
  name: string
  success?: boolean
  error?: string
  status?: string
}

const props = defineProps<{
  steps: Step[]
}>()

const emit = defineEmits<{
  intervene: [step: Step]
}>()

const completedCount = computed(() => {
  return props.steps.filter(s => s.success).length
})

const totalCount = computed(() => {
  return props.steps.length
})

const progressPercent = computed(() => {
  return Math.round((completedCount.value / totalCount.value) * 100)
})

function getStepClass(step: Step) {
  return {
    'step-success': step.success,
    'step-error': !step.success && step.error,
    'step-running': step.status === 'running'
  }
}

function getStepIcon(step: Step) {
  if (step.success) return '✅'
  if (step.error) return '❌'
  if (step.status === 'running') return '🔄'
  return '⏳'
}

function handleIntervene(step: Step) {
  emit('intervene', step)
}
</script>

<template>
  <div class="workflow-steps">
    <div class="steps-header">
      <span class="steps-title">🔧 执行步骤</span>
      <span class="steps-progress">{{ completedCount }}/{{ totalCount }} 完成</span>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <!-- 步骤列表 -->
    <div class="steps-list">
      <div
        v-for="step in steps"
        :key="step.step"
        :class="getStepClass(step)"
        class="step-item"
      >
        <span class="step-icon">{{ getStepIcon(step) }}</span>
        <span class="step-number">Step {{ step.step }}</span>
        <span class="step-name">{{ step.name }}</span>
        <span class="step-action">({{ step.action }})</span>

        <!-- 错误信息 -->
        <div v-if="step.error" class="step-error">
          {{ step.error }}
        </div>

        <!-- 干预按钮 -->
        <button
          v-if="!step.success && step.status !== 'running'"
          @click="handleIntervene(step)"
          class="btn-intervene"
        >
          干预
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-steps {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.steps-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.steps-title {
  font-size: 14px;
  font-weight: bold;
}

.steps-progress {
  font-size: 12px;
  color: #666;
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: #2ecc71;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.steps-list {
  max-height: 200px;
  overflow-y: auto;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  background: #f5f5f5;
}

.step-success {
  background: #e8f8e8;
}

.step-error {
  background: #ffebee;
}

.step-running {
  background: #fff3e0;
}

.step-icon {
  font-size: 16px;
}

.step-number {
  font-size: 12px;
  color: #666;
}

.step-name {
  font-size: 14px;
  flex: 1;
}

.step-action {
  font-size: 12px;
  color: #999;
}

.step-error {
  font-size: 12px;
  color: #e74c3c;
  margin-top: 4px;
}

.btn-intervene {
  padding: 4px 8px;
  background: #e67e22;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
</style>