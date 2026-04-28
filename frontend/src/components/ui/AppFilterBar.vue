<script setup lang="ts">
/**
 * Standard filter bar layout for admin pages.
 * Provides: filters slot (left) + actions slot (right)
 */
</script>

<template>
  <div class="app-filter-bar">
    <div class="filter-left">
      <slot name="filters" />
    </div>
    <div class="filter-right">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.app-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  flex-wrap: wrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.filter-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>