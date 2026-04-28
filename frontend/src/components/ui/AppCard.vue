<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
  bordered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padding: 'md',
  hoverable: false,
  bordered: true,
})
</script>

<template>
  <div :class="[
    'app-card',
    `card-padding-${props.padding}`,
    { 'card-hoverable': props.hoverable, 'card-bordered': props.bordered }
  ]">
    <div v-if="title || $slots.header || $slots['header-extra']" class="card-header">
      <slot name="header">
        <h3 v-if="title" class="card-title">{{ title }}</h3>
        <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
      </slot>
      <div v-if="$slots['header-extra']" class="card-header-extra">
        <slot name="header-extra" />
      </div>
    </div>
    <slot name="cover" />
    <div class="card-content">
      <slot />
    </div>
    <div v-if="$slots.action" class="card-action">
      <slot name="action" />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.app-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.card-bordered {
  border: 1px solid var(--color-border);
}

.card-hoverable:hover {
  box-shadow: var(--shadow-card-hover);
  border-color: var(--color-border-strong);
}

/* Padding variants */
.card-padding-none { padding: 0; }
.card-padding-sm { padding: var(--space-3); }
.card-padding-md { padding: var(--space-4); }
.card-padding-lg { padding: var(--space-6); }

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.card-padding-none .card-header { padding: var(--space-4); border-bottom: 1px solid var(--color-border); }
.card-padding-sm .card-header { padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-3); }
.card-padding-md .card-header { padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-4); }
.card-padding-lg .card-header { padding-bottom: var(--space-5); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-5); }

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--space-1) 0 0;
}

.card-header-extra {
  flex-shrink: 0;
}

/* Content */
.card-content { flex: 1; }

/* Action (footer inside card) */
.card-action {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-4);
}

.card-padding-none .card-action { padding: var(--space-4); margin: 0; }

/* Footer (below card) */
.card-footer {
  padding-top: var(--space-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.card-padding-none .card-footer { padding: var(--space-4); border-top: 1px solid var(--color-border); }
</style>