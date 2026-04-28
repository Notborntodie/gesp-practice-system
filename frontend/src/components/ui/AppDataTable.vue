<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-vue-next'

interface Column {
  key: string
  title: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: 'left' | 'right'
  render?: (row: any, index: number) => any
}

interface Props {
  columns: Column[]
  data: any[]
  loading?: boolean
  pagination?: {
    page: number
    pageSize: number
    total?: number
    showSizePicker?: boolean
    pageSizes?: number[]
  } | false
  rowKey?: string | ((row: any) => string | number)
  maxHeight?: number
  striped?: boolean
  checkedRowKeys?: Array<string | number>
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pagination: false,
  rowKey: 'id',
  striped: true,
  checkedRowKeys: () => [],
  emptyText: '暂无数据',
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
  'update:checkedRowKeys': [keys: Array<string | number>]
  'row-click': [row: any, index: number]
}>()

const selectedRows = ref<Set<string | number>>(new Set(props.checkedRowKeys))

watch(() => props.checkedRowKeys, (newKeys) => {
  selectedRows.value = new Set(newKeys)
})

const hasCheckbox = computed(() => props.columns.some(col => col.key === '_checkbox'))

const totalPages = computed(() => {
  if (!props.pagination || !props.pagination.total) return 1
  return Math.ceil(props.pagination.total / props.pagination.pageSize)
})

function getRowKey(row: any, index: number): string | number {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row)
  }
  return row[props.rowKey] ?? index
}

function isRowSelected(row: any, index: number): boolean {
  return selectedRows.value.has(getRowKey(row, index))
}

function toggleRowSelection(row: any, index: number) {
  const key = getRowKey(row, index)
  if (selectedRows.value.has(key)) {
    selectedRows.value.delete(key)
  } else {
    selectedRows.value.add(key)
  }
  emit('update:checkedRowKeys', Array.from(selectedRows.value))
}

function handleRowClick(row: any, index: number) {
  emit('row-click', row, index)
}

function handlePageChange(page: number) {
  emit('update:page', page)
}

function handlePageSizeChange(size: number) {
  emit('update:pageSize', size)
}

function renderCell(row: any, col: Column, index: number) {
  if (col.render) {
    return col.render(row, index)
  }
  return row[col.key]
}

function getColumnWidth(col: Column): string {
  if (col.width === undefined) return 'auto'
  if (typeof col.width === 'number') return `${col.width}px`
  return col.width
}
</script>

<template>
  <div class="app-data-table">
    <!-- Loading overlay -->
    <div v-if="loading" class="table-loading-overlay">
      <Loader2 :size="24" class="spin-icon" />
      <span>加载中...</span>
    </div>

    <!-- Table -->
    <div class="table-wrapper" :style="{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }">
      <table :class="['data-table', { 'striped': striped }]">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="['table-header', `align-${col.align || 'left'}`, { 'fixed-left': col.fixed === 'left', 'fixed-right': col.fixed === 'right' }]"
              :style="{ width: getColumnWidth(col) }"
            >
              <!-- Checkbox column -->
              <template v-if="col.key === '_checkbox'">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="selectedRows.size === data.length && data.length > 0"
                  :indeterminate.prop="selectedRows.size > 0 && selectedRows.size < data.length"
                  @change="() => {
                    if (selectedRows.size === data.length) {
                      selectedRows.clear()
                    } else {
                      data.forEach((row, i) => selectedRows.add(getRowKey(row, i)))
                    }
                    emit('update:checkedRowKeys', Array.from(selectedRows))
                  }"
                />
              </template>
              <template v-else>
                {{ col.title }}
              </template>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(row, index) in data"
            :key="getRowKey(row, index)"
            :class="['table-row', { 'selected': isRowSelected(row, index) }]"
            @click="handleRowClick(row, index)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :class="['table-cell', `align-${col.align || 'left'}`, { 'fixed-left': col.fixed === 'left', 'fixed-right': col.fixed === 'right' }]"
            >
              <!-- Checkbox cell -->
              <template v-if="col.key === '_checkbox'">
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="isRowSelected(row, index)"
                  @click.stop="toggleRowSelection(row, index)"
                />
              </template>
              <template v-else>
                <component v-if="col.render" :is="renderCell(row, col, index)" />
                <span v-else>{{ renderCell(row, col, index) }}</span>
              </template>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="data.length === 0 && !loading">
            <td :colspan="columns.length" class="empty-cell">
              <div class="table-empty">
                {{ emptyText }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && pagination.total" class="table-pagination">
      <div class="pagination-info">
        共 {{ pagination.total }} 条
      </div>

      <div class="pagination-controls">
        <button
          type="button"
          :class="['pagination-btn', { 'disabled': pagination.page === 1 }]"
          :disabled="pagination.page === 1"
          @click="handlePageChange(pagination.page - 1)"
        >
          <ChevronLeft :size="16" />
        </button>

        <span class="pagination-page">
          {{ pagination.page }} / {{ totalPages }}
        </span>

        <button
          type="button"
          :class="['pagination-btn', { 'disabled': pagination.page === totalPages }]"
          :disabled="pagination.page === totalPages"
          @click="handlePageChange(pagination.page + 1)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>

      <div v-if="pagination.showSizePicker" class="pagination-size-picker">
        <select
          :value="pagination.pageSize"
          class="size-select"
          @change="handlePageSizeChange(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in (pagination.pageSizes || [10, 20, 50, 100])" :key="size" :value="size">
            {{ size }} 条/页
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-data-table {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.striped tbody tr:nth-child(even) {
  background: var(--color-muted);
}

/* Header */
.table-header {
  padding: var(--space-3) var(--space-4);
  background: var(--color-muted);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.table-header.align-center { text-align: center; }
.table-header.align-right { text-align: right; }

/* Rows */
.table-row {
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--color-border);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.table-row.selected {
  background: rgba(37, 99, 235, 0.08);
}

/* Cells */
.table-cell {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-cell.align-center { text-align: center; }
.table-cell.align-right { text-align: right; }

/* Checkbox */
.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* Empty */
.empty-cell {
  padding: var(--space-10);
}

.table-empty {
  text-align: center;
  color: var(--color-text-muted);
}

/* Loading */
.table-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  z-index: 10;
}

.app-data-table { position: relative; }

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Pagination */
.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.pagination-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-foreground);
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(.disabled) {
  background: var(--color-muted);
  border-color: var(--color-primary);
}

.pagination-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-page {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.size-select {
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  cursor: pointer;
}
</style>