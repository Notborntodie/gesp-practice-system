<script setup lang="ts">
import { computed } from 'vue'
import { Search, X } from 'lucide-vue-next'

interface Props {
  modelValue?: string | number | null
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'search'
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  clearable?: boolean
  maxlength?: number
  showCount?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  type: 'text',
  disabled: false,
  error: '',
  size: 'md',
  fullWidth: false,
  clearable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:value': [value: string]
  keydown: [event: KeyboardEvent]
  enter: [event: KeyboardEvent]
  clear: []
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const inputClasses = computed(() => [
  'app-input',
  `input-${props.size}`,
  {
    'input-error': props.error,
    'input-disabled': props.disabled,
    'input-full-width': props.fullWidth,
    'input-with-prefix': props.type === 'search',
    'input-with-clear': props.clearable && props.modelValue,
  },
])

const charCount = computed(() => {
  if (!props.showCount || !props.maxlength) return ''
  const len = String(props.modelValue || '').length
  return `${len}/${props.maxlength}`
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emit('update:value', target.value)
}

function handleKeydown(event: KeyboardEvent) {
  emit('keydown', event)
  if (event.key === 'Enter') {
    emit('enter', event)
  }
}

function handleClear() {
  emit('update:modelValue', '')
  emit('update:value', '')
  emit('clear')
}
</script>

<template>
  <div :class="['input-wrapper', { 'input-full-width': props.fullWidth }]">
    <div :class="inputClasses">
      <Search v-if="type === 'search'" :size="16" class="input-prefix-icon" />
      <input
        :type="type === 'search' ? 'text' : type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        @input="handleInput"
        @keydown="handleKeydown"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
      />
      <span v-if="charCount" class="char-count">{{ charCount }}</span>
      <button
        v-if="clearable && modelValue && !disabled"
        type="button"
        class="clear-btn"
        @click="handleClear"
        aria-label="清除"
      >
        <X :size="14" />
      </button>
    </div>
    <p v-if="error" class="input-error-text">{{ error }}</p>
  </div>
</template>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.input-full-width { width: 100%; }

.app-input {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.app-input:hover:not(.input-disabled) {
  border-color: var(--color-border-strong);
}

.app-input:focus-within:not(.input-disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.app-input input {
  flex: 1;
  background: transparent;
  border: none;
  font-family: var(--font-family);
  color: var(--color-foreground);
  outline: none;
}

.app-input input::placeholder {
  color: var(--color-text-muted);
}

/* Sizes */
.input-sm { height: 32px; padding: 0 var(--space-2); }
.input-sm input { font-size: var(--font-size-xs); padding: 0 var(--space-2); }

.input-md { height: var(--button-height); padding: 0 var(--space-3); }
.input-md input { font-size: var(--font-size-sm); padding: 0 var(--space-1); }

.input-lg { height: var(--button-height-lg); padding: 0 var(--space-4); }
.input-lg input { font-size: var(--font-size-base); padding: 0 var(--space-2); }

/* Prefix icon */
.input-prefix-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Clear button */
.clear-btn {
  background: transparent;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
}

.clear-btn:hover {
  color: var(--color-text-secondary);
}

/* Char count */
.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding-left: var(--space-2);
}

/* States */
.input-error {
  border-color: var(--color-destructive);
}

.input-error:focus-within {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
}

.input-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}

.input-disabled input {
  cursor: not-allowed;
}

.input-error-text {
  font-size: var(--font-size-xs);
  color: var(--color-destructive);
  margin: 0;
}
</style>