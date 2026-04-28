<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check, X } from 'lucide-vue-next'

interface Option {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  modelValue?: string | number | null | Array<string | number>
  value?: string | number | null | Array<string | number>
  options?: Option[]
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  clearable?: boolean
  disabled?: boolean
  multiple?: boolean
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [],
  placeholder: '请选择',
  size: 'md',
  clearable: true,
  disabled: false,
  multiple: false,
  fullWidth: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null | Array<string | number>]
  'update:value': [value: string | number | null | Array<string | number>]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const currentValue = computed(() => props.modelValue ?? props.value)

const displayLabel = computed(() => {
  if (!currentValue.value) return props.placeholder
  if (props.multiple && Array.isArray(currentValue.value)) {
    if (currentValue.value.length === 0) return props.placeholder
    const labels = currentValue.value.map(v => {
      const opt = props.options.find(o => o.value === v)
      return opt?.label || v
    })
    return labels.join(', ')
  }
  const opt = props.options.find(o => o.value === currentValue.value)
  return opt?.label || currentValue.value
})

const selectClasses = computed(() => [
  'app-select',
  `select-${props.size}`,
  {
    'select-open': isOpen.value,
    'select-disabled': props.disabled,
    'select-full-width': props.fullWidth,
    'select-has-value': currentValue.value && (!props.multiple || (Array.isArray(currentValue.value) && currentValue.value.length > 0)),
  },
])

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function selectOption(option: Option) {
  if (option.disabled) return

  if (props.multiple) {
    const currentArray = Array.isArray(currentValue.value) ? [...currentValue.value] : []
    const index = currentArray.indexOf(option.value)
    if (index > -1) {
      currentArray.splice(index, 1)
    } else {
      currentArray.push(option.value)
    }
    emit('update:modelValue', currentArray)
    emit('update:value', currentArray)
  } else {
    emit('update:modelValue', option.value)
    emit('update:value', option.value)
    isOpen.value = false
  }
}

function clearValue() {
  emit('update:modelValue', props.multiple ? [] : null)
  emit('update:value', props.multiple ? [] : null)
}

function isSelected(option: Option) {
  if (props.multiple && Array.isArray(currentValue.value)) {
    return currentValue.value.includes(option.value)
  }
  return currentValue.value === option.value
}

// Close dropdown on outside click
function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
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
  <div ref="dropdownRef" :class="['select-wrapper', { 'select-full-width': fullWidth }]">
    <div :class="selectClasses" @click="toggleDropdown">
      <span :class="['select-display', { 'placeholder': !currentValue || (multiple && Array.isArray(currentValue) && currentValue.length === 0) }]">
        {{ displayLabel }}
      </span>
      <div class="select-icons">
        <button
          v-if="clearable && currentValue && (!multiple || (Array.isArray(currentValue) && currentValue.length > 0)) && !disabled"
          type="button"
          class="clear-btn"
          @click.stop="clearValue"
          aria-label="清除"
        >
          <X :size="14" />
        </button>
        <ChevronDown :size="16" class="chevron-icon" :class="{ 'chevron-up': isOpen }" />
      </div>
    </div>

    <div v-if="isOpen" class="select-dropdown">
      <ul class="option-list">
        <li
          v-for="option in options"
          :key="option.value"
          :class="['option-item', { 'selected': isSelected(option), 'disabled': option.disabled }]"
          @click="selectOption(option)"
        >
          <span class="option-label">{{ option.label }}</span>
          <Check v-if="isSelected(option)" :size="16" class="check-icon" />
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.select-wrapper {
  position: relative;
  display: inline-block;
}

.select-full-width { width: 100%; }

.app-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: var(--space-2);
}

.app-select:hover:not(.select-disabled) {
  border-color: var(--color-border-strong);
}

.app-select:focus-within:not(.select-disabled),
.select-open:not(.select-disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.select-display {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.placeholder {
  color: var(--color-text-muted);
}

/* Sizes */
.select-sm { height: 32px; padding: 0 var(--space-2); }
.select-md { height: var(--button-height); padding: 0 var(--space-3); }
.select-lg { height: var(--button-height-lg); padding: 0 var(--space-4); }

/* Icons */
.select-icons {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.chevron-icon {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.chevron-up {
  transform: rotate(180deg);
}

.clear-btn {
  background: transparent;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
}

.clear-btn:hover {
  color: var(--color-text-secondary);
}

/* Dropdown */
.select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  z-index: 100;
  max-height: 256px;
  overflow-y: auto;
}

.option-list {
  list-style: none;
  padding: var(--space-1) 0;
  margin: 0;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.option-item:hover:not(.disabled) {
  background: rgba(37, 99, 235, 0.08);
}

.option-item.selected {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
}

.option-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-label {
  flex: 1;
}

.check-icon {
  color: var(--color-primary);
}

/* Disabled state */
.select-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}
</style>