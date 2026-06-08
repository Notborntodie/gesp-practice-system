<template>
  <section class="content-section">
    <div class="section-header">
      <div class="header-left">
        <h2>{{ title }}</h2>
        <slot name="filters"></slot>
      </div>
      <div class="header-right">
        <slot name="header-right"></slot>
      </div>
    </div>

    <div class="table-container">
      <slot name="content"></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<style scoped>
.content-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.section-header .header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.section-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-foreground);
}

.section-header .header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.table-container {
  flex: 1;
  min-height: 0;
}
</style>

