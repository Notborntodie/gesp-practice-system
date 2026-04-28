<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, X } from 'lucide-vue-next'

interface Props {
  modelValue?: string | number | null
  value?: string | number | null
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  clearable?: boolean
  disabled?: boolean
  type?: 'date' | 'datetime-local'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  clearable: true,
  disabled: false,
  type: 'date',
  fullWidth: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:value': [value: string | null]
}>()

const currentValue = computed(() => {
  const val = props.modelValue ?? props.value
  if (val === null || val === undefined) return ''
  // Convert timestamp to date string
  if (typeof val === 'number') {
    const date = new Date(val)
    return date.toISOString().split('T')[0]
  }
  return val
})

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value || null)
  emit('update:value', target.value || null)
}

function clearValue() {
  emit('update:modelValue', null)
  emit('update:value', null)
}
</script>

<template>
  <div :class="['datepicker-wrapper', { 'full-width': fullWidth }]">
    <div :class="['app-datepicker', `dp-${size}`, { 'dp-disabled': disabled, 'dp-has-value': currentValue }]">
      <Calendar :size="16" class="calendar-icon" />
      <input
        :type="type"
        :value="currentValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @change="handleChange"
      />
      <button
        v-if="clearable && currentValue && !disabled"
        type="button"
        class="clear-btn"
        @click.stop="clearValue"
        aria-label="清除"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.datepicker-wrapper {
  display: inline-block;
}

.full-width { width: 100%; }

.app-datepicker {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  gap: var(--space-2);
  transition: all var(--transition-fast);
}

.app-datepicker:hover:not(.dp-disabled) {
  border-color: var(--color-border-strong);
}

.app-datepicker:focus-within:not(.dp-disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.calendar-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.app-datepicker input {
  flex: 1;
  background: transparent;
  border: none;
  font-family: var(--font-family);
  color: var(--color-foreground);
  outline: none;
}

/* Sizes */
.dp-sm { height: 32px; padding: 0 var(--space-2); }
.dp-sm input { font-size: var(--font-size-xs); }

.dp-md { height: var(--button-height); padding: 0 var(--space-3); }
.dp-md input { font-size: var(--font-size-sm); }

.dp-lg { height: var(--button-height-lg); padding: 0 var(--space-4); }
.dp-lg input { font-size: var(--font-size-base); }

/* Clear button */
.clear-btn {
  background: transparent;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
}

.clear-btn:hover {
  color: var(--color-text-secondary);
}

/* Disabled */
.dp-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}

.dp-disabled input {
  cursor: not-allowed;
}
</style>