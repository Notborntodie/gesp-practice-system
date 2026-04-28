<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

interface Props {
  variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: any
  pill?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  pill: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => [
  'app-button',
  `btn-${props.variant}`,
  `btn-${props.size}`,
  {
    'btn-disabled': props.disabled || props.loading,
    'btn-loading': props.loading,
    'btn-full-width': props.fullWidth,
    'btn-pill': props.pill,
  },
])

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <Loader2 v-if="loading" :size="16" class="spin-icon" />
    <component v-if="icon && !loading" :is="icon" :size="size === 'sm' ? 14 : size === 'lg' ? 20 : 16" />
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-family);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.app-button:focus-visible {
  box-shadow: var(--shadow-focus);
  outline: none;
}

/* Sizes */
.btn-sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.btn-md {
  height: var(--button-height);
  padding: 0 var(--space-4);
  font-size: var(--font-size-sm);
}

.btn-lg {
  height: var(--button-height-lg);
  padding: 0 var(--space-6);
  font-size: var(--font-size-base);
}

.btn-full-width {
  width: 100%;
}

.btn-pill {
  border-radius: var(--radius-full);
}

/* Variants */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover:not(.btn-disabled) {
  background: #1d4ed8;
}

.btn-primary:active:not(.btn-disabled) {
  background: #1e40af;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(.btn-disabled) {
  background: var(--color-muted);
  border-color: var(--color-border-strong);
}

.btn-accent {
  background: var(--color-accent);
  color: var(--color-on-primary);
}

.btn-accent:hover:not(.btn-disabled) {
  background: #047857;
}

.btn-destructive {
  background: var(--color-destructive);
  color: var(--color-on-primary);
}

.btn-destructive:hover:not(.btn-disabled) {
  background: #b91c1c;
}

.btn-ghost {
  background: transparent;
  color: var(--color-primary);
}

.btn-ghost:hover:not(.btn-disabled) {
  background: rgba(37, 99, 235, 0.08);
}

/* Disabled */
.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading */
.btn-loading .spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>