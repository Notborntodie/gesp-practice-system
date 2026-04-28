<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { AlertTriangle, Check, X } from 'lucide-vue-next'

interface Props {
  positiveText?: string
  negativeText?: string
  danger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  positiveText: '确认',
  negativeText: '取消',
  danger: false,
})

const emit = defineEmits<{
  positive: []
  negative: []
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function handlePositive() {
  emit('positive')
  close()
}

function handleNegative() {
  emit('negative')
  close()
}

function handleClickOutside(event: MouseEvent) {
  if (popupRef.value && !popupRef.value.contains(event.target as Node)) {
    if (triggerRef.value && !triggerRef.value.contains(event.target as Node)) {
      close()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app-confirm-dialog">
    <div ref="triggerRef" class="trigger-wrapper" @click="open">
      <slot name="trigger" />
    </div>

    <Transition name="popup">
      <div v-if="isOpen" ref="popupRef" class="confirm-popup">
        <div class="confirm-content">
          <AlertTriangle v-if="danger" :size="20" class="warning-icon" />
          <slot />
        </div>
        <div class="confirm-buttons">
          <button type="button" class="btn-cancel" @click="handleNegative">
            <X :size="14" />
            {{ negativeText }}
          </button>
          <button type="button" :class="['btn-confirm', { 'btn-danger': danger }]" @click="handlePositive">
            <Check :size="14" />
            {{ positiveText }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-confirm-dialog {
  position: relative;
  display: inline-block;
}

.trigger-wrapper {
  display: inline-flex;
}

/* Popup */
.confirm-popup {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-3);
  z-index: 100;
  min-width: 200px;
  white-space: nowrap;
}

.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.warning-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.confirm-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.btn-cancel,
.btn-confirm {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: var(--color-muted);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-cancel:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}

.btn-confirm {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
}

.btn-confirm:hover {
  background: #1d4ed8;
}

.btn-confirm.btn-danger {
  background: var(--color-destructive);
}

.btn-confirm.btn-danger:hover {
  background: #b91c1c;
}

/* Transitions */
.popup-enter-active,
.popup-leave-active {
  transition: all var(--transition-fast);
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>