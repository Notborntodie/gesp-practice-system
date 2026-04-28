<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

interface Props {
  show: boolean
  title?: string
  width?: string | number
  closable?: boolean
  maskClosable?: boolean
  showFooter?: boolean
  positiveText?: string
  negativeText?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  width: 600,
  closable: true,
  maskClosable: true,
  showFooter: true,
  positiveText: '确认',
  negativeText: '取消',
  loading: false,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  positive: []
  negative: []
  close: []
}>()

function handleMaskClick() {
  if (props.maskClosable) {
    emit('update:show', false)
    emit('close')
  }
}

function handleClose() {
  emit('update:show', false)
  emit('close')
}

function handlePositive() {
  emit('positive')
}

function handleNegative() {
  emit('negative')
  emit('update:show', false)
}

// Prevent body scroll when modal is open
watch(() => props.show, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="app-dialog-overlay" @click.self="handleMaskClick">
        <div
          class="app-dialog"
          :style="{ width: typeof width === 'number' ? `${width}px` : width }"
        >
          <!-- Header -->
          <div class="dialog-header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button v-if="closable" type="button" class="close-btn" @click="handleClose" aria-label="关闭">
              <X :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="showFooter" class="dialog-footer">
            <slot name="footer">
              <div class="footer-buttons">
                <AppButton variant="secondary" @click="handleNegative">
                  {{ negativeText }}
                </AppButton>
                <AppButton variant="primary" :loading="loading" @click="handlePositive">
                  {{ positiveText }}
                </AppButton>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.app-dialog {
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
}

.footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .app-dialog,
.modal-leave-to .app-dialog {
  transform: scale(0.95);
}

.modal-enter-active .app-dialog,
.modal-leave-active .app-dialog {
  transition: transform var(--transition-normal);
}
</style>