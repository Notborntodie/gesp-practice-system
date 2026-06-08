<script setup lang="ts">
/**
 * 结果预览组件
 */

import { ref, computed } from 'vue'

const props = defineProps<{
  data: any
}>()

const emit = defineEmits<{
  close: []
  download: []
  edit: []
}>()

const previewMode = ref<'json' | 'text' | 'table'>('json')
const isExpanded = ref(false)

// 格式化 JSON 显示
const formattedJson = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2)
  } catch {
    return '无法格式化'
  }
})

// 切换预览模式
function toggleMode() {
  const modes = ['json', 'text', 'table']
  const currentIndex = modes.indexOf(previewMode.value)
  previewMode.value = modes[(currentIndex + 1) % modes.length] as any
}

// 复制内容
function copyContent() {
  navigator.clipboard.writeText(formattedJson.value)
}

// 下载
function handleDownload() {
  emit('download')
}

// 编辑
function handleEdit() {
  emit('edit')
}

// 关闭
function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="result-preview" v-if="data">
    <div class="preview-header">
      <span class="preview-title">📄 结果预览</span>
      <div class="preview-actions">
        <button @click="toggleMode" class="btn-mode">
          {{ previewMode }}
        </button>
        <button @click="copyContent" class="btn-copy">
          复制
        </button>
        <button @click="handleDownload" class="btn-download">
          下载
        </button>
        <button @click="handleEdit" class="btn-edit">
          编辑
        </button>
        <button @click="handleClose" class="btn-close">
          ✕
        </button>
      </div>
    </div>

    <div class="preview-content" :class="{ expanded: isExpanded }">
      <!-- JSON 模式 -->
      <pre v-if="previewMode === 'json'" class="json-view">{{ formattedJson }}</pre>

      <!-- 文本模式 -->
      <div v-if="previewMode === 'text'" class="text-view">
        <div v-if="data.title" class="result-title">
          <h3>{{ data.title }}</h3>
        </div>
        <div v-if="data.description" class="result-description">
          {{ data.description }}
        </div>
        <div v-if="data.questions" class="result-list">
          <div v-for="(q, i) in data.questions" :key="i" class="result-item">
            <span class="item-id">#{{ q.id || i + 1 }}</span>
            <span class="item-title">{{ q.title }}</span>
          </div>
        </div>
      </div>

      <!-- 表格模式 -->
      <table v-if="previewMode === 'table' && Array.isArray(data)" class="table-view">
        <thead>
          <tr>
            <th v-for="key in Object.keys(data[0] || {})" :key="key">{{ key }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in data" :key="i">
            <td v-for="key in Object.keys(row)" :key="key">{{ row[key] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button @click="isExpanded = !isExpanded" class="expand-toggle">
      {{ isExpanded ? '收起' : '展开' }}
    </button>
  </div>
</template>

<style scoped>
.result-preview {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 14px;
  font-weight: bold;
}

.preview-actions {
  display: flex;
  gap: 4px;
}

.preview-actions button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.preview-actions button:hover {
  background: #f5f5f5;
}

.preview-content {
  max-height: 200px;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
}

.preview-content.expanded {
  max-height: 500px;
}

.json-view {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  margin: 0;
}

.text-view {
  font-size: 14px;
}

.result-title h3 {
  margin: 0 0 8px 0;
}

.result-description {
  color: #666;
  margin-bottom: 12px;
}

.result-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 4px;
}

.item-id {
  color: #3498db;
  font-weight: bold;
}

.table-view {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table-view th,
.table-view td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.table-view th {
  background: #f5f5f5;
}

.expand-toggle {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}
</style>