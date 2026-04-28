<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  type?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent'
  size?: 'sm' | 'md'
  bordered?: boolean
  round?: boolean
  closable?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'md',
  bordered: false,
  round: true,
  closable: false,
  disabled: false,
})

const emit = defineEmits<{
  close: []
  click: []
}>()

const tagClasses = computed(() => [
  'app-tag',
  `tag-${props.type}`,
  `tag-${props.size}`,
  {
    'tag-bordered': props.bordered,
    'tag-round': props.round,
    'tag-closable': props.closable,
    'tag-disabled': props.disabled,
  },
])

function handleClose() {
  if (!props.disabled) {
    emit('close')
  }
}

function handleClick() {
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <span :class="tagClasses" @click="handleClick">
    <slot />
    <button
      v-if="closable"
      type="button"
      class="tag-close-btn"
      @click.stop="handleClose"
      aria-label="关闭"
    >
      <X :size="12" />
    </button>
  </span>
</template>

<style scoped>
.app-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tag-round {
  border-radius: var(--radius-full);
}

/* Sizes */
.tag-sm {
  padding: 2px var(--space-2);
  font-size: 11px;
}

/* Type variants */
.tag-default {
  background: var(--color-muted);
  color: var(--color-text-secondary);
}

.tag-default.tag-bordered {
  border: 1px solid var(--color-border);
}

.tag-success,
.tag-accent {
  background: rgba(5, 150, 105, 0.12);
  color: var(--color-accent);
}

.tag-success.tag-bordered,
.tag-accent.tag-bordered {
  border: 1px solid rgba(5, 150, 105, 0.3);
}

.tag-warning {
  background: rgba(217, 119, 6, 0.12);
  color: var(--color-warning);
}

.tag-warning.tag-bordered {
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.tag-error {
  background: rgba(220, 38, 38, 0.12);
  color: var(--color-destructive);
}

.tag-error.tag-bordered {
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.tag-info {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
}

.tag-info.tag-bordered {
  border: 1px solid rgba(37, 99, 235, 0.3);
}

/* Close button */
.tag-close-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: inherit;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.tag-close-btn:hover {
  opacity: 1;
}

/* Disabled */
.tag-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tag-disabled .tag-close-btn {
  cursor: not-allowed;
}
</style>