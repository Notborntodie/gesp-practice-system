<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

interface Props {
  show: boolean
  title: string
  width?: string | number
  loading?: boolean
  showFooter?: boolean
  positiveText?: string
  negativeText?: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  width: 500,
  loading: false,
  showFooter: true,
  positiveText: '确认',
  negativeText: '取消',
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
  positive: []
  negative: []
}>()

function handleClose() {
  emit('update:show', false)
  emit('close')
}

function handlePositive() {
  if (!props.loading) {
    emit('positive')
  }
}

function handleNegative() {
  emit('negative')
  emit('update:show', false)
}

function handleOverlayClick() {
  if (!props.loading) {
    emit('update:show', false)
    emit('close')
  }
}

// Prevent body scroll when open
watch(() => props.show, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="show" class="dialog-overlay" @click.self="handleOverlayClick">
        <div
          class="dialog-container"
          :style="{ width: typeof width === 'number' ? `${width}px` : width }"
          @click.stop
        >
          <!-- Header -->
          <div class="dialog-header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button
              type="button"
              class="close-btn"
              @click="handleClose"
              aria-label="关闭"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="showFooter && $slots.footer" class="dialog-footer">
            <slot name="footer" />
          </div>
          <div v-else-if="showFooter" class="dialog-footer">
            <AppButton variant="secondary" @click="handleNegative">
              {{ negativeText }}
            </AppButton>
            <AppButton variant="primary" :loading="loading" @click="handlePositive">
              {{ positiveText }}
            </AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.dialog-container {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.dialog-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--color-muted);
  color: var(--color-foreground);
}

/* Content */
.dialog-content {
  flex: 1;
  padding: var(--space-5);
  overflow-y: auto;
}

/* Footer */
.dialog-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* Transitions */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity var(--transition-normal);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform var(--transition-normal);
}

.dialog-enter-from .dialog-container {
  transform: scale(0.95);
}

.dialog-leave-to .dialog-container {
  transform: scale(0.95);
}
</style>