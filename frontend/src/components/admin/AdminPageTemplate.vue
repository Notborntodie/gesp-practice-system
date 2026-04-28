<script setup lang="ts">
import { computed } from 'vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppFilterBar from '@/components/ui/AppFilterBar.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

interface Props {
  title: string
  description?: string
  loading?: boolean
  total?: number
  cacheValid?: boolean
  hasCache?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  cacheValid: false,
  hasCache: false,
})

const emit = defineEmits<{
  refresh: []
}>()
</script>

<template>
  <div class="admin-page">
    <!-- Page Header -->
    <AppPageHeader :title="title" :description="description">
      <template #info>
        <span class="item-count">共 {{ total }} 条数据</span>
        <span v-if="cacheValid && hasCache" class="cache-indicator">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          使用缓存数据
        </span>
      </template>
      <template #actions>
        <slot name="header-actions" />
        <button class="btn-refresh" @click="emit('refresh')" title="刷新数据">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          刷新
        </button>
      </template>
    </AppPageHeader>

    <!-- Filter Bar -->
    <AppFilterBar v-if="$slots.filters">
      <template #filters>
        <slot name="filters" />
      </template>
      <template #actions>
        <slot name="filter-actions" />
      </template>
    </AppFilterBar>

    <!-- Batch Toolbar (shown when items selected) -->
    <div v-if="$slots['batch-toolbar']" class="batch-toolbar-wrapper">
      <slot name="batch-toolbar" />
    </div>

    <!-- Content Area -->
    <div class="admin-content">
      <!-- Loading State -->
      <AppEmptyState v-if="loading" type="loading" description="加载中..." />

      <!-- Empty State -->
      <AppEmptyState v-else-if="$slots.empty && !loading" type="empty">
        <template #action>
          <slot name="empty-action" />
        </template>
      </AppEmptyState>

      <!-- Main Content -->
      <slot v-else />

      <!-- Footer (pagination, etc.) -->
      <div v-if="$slots.footer" class="admin-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.item-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.cache-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  background: rgba(5, 150, 105, 0.12);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--button-height);
  padding: 0 var(--space-4);
  background: var(--color-surface);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-refresh:hover {
  background: var(--color-muted);
  border-color: var(--color-border-strong);
}

.batch-toolbar-wrapper {
  padding-bottom: var(--space-4);
}

.admin-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.admin-footer {
  padding-top: var(--space-4);
}
</style>