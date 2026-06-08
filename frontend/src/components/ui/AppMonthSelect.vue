<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, X } from 'lucide-vue-next'
import { buildMonthOptions, buildMonthRangeOptions, normalizeMonthValue } from '@/utils/monthOptions'

interface Props {
  modelValue?: string | null
  value?: string | null
  placeholder?: string
  availableMonths?: unknown[]
  size?: 'sm' | 'md' | 'lg'
  clearable?: boolean
  disabled?: boolean
  fullWidth?: boolean
  minYear?: number
  maxYear?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '选择月份',
  availableMonths: undefined,
  size: 'md',
  clearable: true,
  disabled: false,
  fullWidth: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:value': [value: string]
  change: [value: string]
  clear: []
}>()

const currentValue = computed(() => normalizeMonthValue(props.modelValue ?? props.value))

const effectiveMinYear = computed(() => props.minYear ?? new Date().getFullYear() - 5)
const effectiveMaxYear = computed(() => props.maxYear ?? new Date().getFullYear() + 2)

const options = computed(() => {
  if (props.availableMonths?.length) {
    const values = [...props.availableMonths, currentValue.value]
    return buildMonthOptions(values)
  }

  return buildMonthRangeOptions(effectiveMinYear.value, effectiveMaxYear.value, currentValue.value)
})

function updateValue(value: string) {
  emit('update:modelValue', value)
  emit('update:value', value)
  emit('change', value)
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  updateValue(target.value)
}

function clearValue() {
  updateValue('')
  emit('clear')
}
</script>

<template>
  <div :class="['month-select-wrapper', { 'full-width': fullWidth }]">
    <div :class="['app-month-select', `month-${size}`, { 'month-disabled': disabled, 'month-has-value': currentValue }]">
      <Calendar :size="16" class="month-icon" />
      <select :value="currentValue" :disabled="disabled" @change="handleChange">
        <option value="">{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <button
        v-if="clearable && currentValue && !disabled"
        type="button"
        class="clear-btn"
        @click.stop="clearValue"
        aria-label="清除月份"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.month-select-wrapper {
  display: inline-block;
}

.full-width {
  width: 100%;
}

.app-month-select {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 136px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.app-month-select:hover:not(.month-disabled) {
  border-color: var(--color-border-strong);
}

.app-month-select:focus-within:not(.month-disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.month-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.app-month-select select {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-family);
  color: var(--color-foreground);
  cursor: pointer;
}

.month-sm {
  height: 32px;
  padding: 0 var(--space-2);
}

.month-sm select {
  font-size: var(--font-size-xs);
}

.month-md {
  height: var(--button-height);
  padding: 0 var(--space-3);
}

.month-md select {
  font-size: var(--font-size-sm);
}

.month-lg {
  height: var(--button-height-lg);
  padding: 0 var(--space-4);
}

.month-lg select {
  font-size: var(--font-size-base);
}

.clear-btn {
  display: flex;
  align-items: center;
  padding: var(--space-1);
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--color-text-secondary);
}

.month-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}

.month-disabled select {
  cursor: not-allowed;
}
</style>
