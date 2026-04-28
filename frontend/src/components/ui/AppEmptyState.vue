<script setup lang="ts">
import { Loader2, Inbox, AlertCircle } from 'lucide-vue-next'

interface Props {
  type?: 'empty' | 'loading' | 'error'
  description?: string
  showIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'empty',
  showIcon: true,
})
</script>

<template>
  <div :class="['app-empty-state', `state-${type}`]">
    <!-- Loading state -->
    <div v-if="type === 'loading'" class="state-container">
      <Loader2 v-if="showIcon" :size="32" class="loading-icon" />
      <p v-if="description">{{ description }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="type === 'error'" class="state-container">
      <AlertCircle v-if="showIcon" :size="48" class="error-icon" />
      <p v-if="description" class="state-description">{{ description }}</p>
      <slot name="action" />
    </div>

    <!-- Empty state -->
    <div v-else class="state-container">
      <Inbox v-if="showIcon" :size="48" class="empty-icon" />
      <p v-if="description" class="state-description">{{ description }}</p>
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.app-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  min-height: 200px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}

.loading-icon {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-icon {
  color: var(--color-destructive);
}

.empty-icon {
  color: var(--color-text-muted);
}

.state-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.state-loading p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>