<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  rows: 3,
  disabled: false,
  error: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaClasses = computed(() => [
  'app-textarea',
  { 'textarea-error': props.error, 'textarea-disabled': props.disabled },
])

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <textarea
    :class="textareaClasses"
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    @input="handleInput"
  />
</template>

<style scoped>
.app-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  line-height: var(--line-height);
  resize: vertical;
  transition: all var(--transition-fast);
}

.app-textarea::placeholder {
  color: var(--color-text-muted);
}

.app-textarea:hover:not(.textarea-disabled) {
  border-color: var(--color-border-strong);
}

.app-textarea:focus:not(.textarea-disabled) {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
  outline: none;
}

.textarea-error {
  border-color: var(--color-destructive);
}

.textarea-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}
</style>