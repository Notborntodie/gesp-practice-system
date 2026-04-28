<script setup lang="ts">
interface Props {
  label: string
  required?: boolean
  error?: string
}

withDefaults(defineProps<Props>(), {
  required: false,
  error: '',
})
</script>

<template>
  <div class="form-field">
    <label class="field-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>
    <div class="field-content">
      <slot />
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-foreground);
}

.required-mark {
  color: var(--color-destructive);
  margin-left: var(--space-1);
}

.field-content {
  flex: 1;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-destructive);
  margin: 0;
}
</style>