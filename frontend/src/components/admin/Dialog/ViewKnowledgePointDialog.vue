<script setup lang="ts">
import { computed } from 'vue'
import { BookOpen, Calendar, Tag, Layers } from 'lucide-vue-next'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppTag from '@/components/ui/AppTag.vue'

const props = defineProps<{
  visible: boolean
  knowledgePoint: any
}>()

const emit = defineEmits<{
  close: []
}>()

function handleClose() {
  emit('close')
}

function getCategoryName(category: string) {
  const categoryMap: Record<string, string> = {
    algorithm: '算法',
    data_structure: '数据结构',
    programming: '编程',
    math: '数学',
  }
  return categoryMap[category] || category
}

function getCategoryTagType(category: string): 'success' | 'info' | 'warning' | 'default' {
  const typeMap: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    algorithm: 'success',
    data_structure: 'info',
    programming: 'warning',
    math: 'default',
  }
  return typeMap[category] || 'default'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const hasDescription = computed(() => {
  return props.knowledgePoint?.description && props.knowledgePoint.description.trim() !== ''
})
</script>

<template>
  <AppDialog
    :show="visible"
    title="知识点详情"
    width="480"
    :show-footer="false"
    @update:show="(val) => !val && handleClose()"
  >
    <div v-if="knowledgePoint" class="detail-content">
      <!-- Basic Info -->
      <div class="detail-header">
        <div class="kp-icon">
          <BookOpen :size="24" />
        </div>
        <h4 class="kp-name">{{ knowledgePoint.name }}</h4>
      </div>

      <!-- Meta Info -->
      <div class="meta-grid">
        <div class="meta-item">
          <Tag :size="16" class="meta-icon" />
          <span class="meta-label">分类</span>
          <AppTag :type="getCategoryTagType(knowledgePoint.category)">
            {{ getCategoryName(knowledgePoint.category) }}
          </AppTag>
        </div>

        <div class="meta-item">
          <Layers :size="16" class="meta-icon" />
          <span class="meta-label">等级</span>
          <AppTag type="info">GESP {{ knowledgePoint.level || 1 }}级</AppTag>
        </div>

        <div class="meta-item">
          <Calendar :size="16" class="meta-icon" />
          <span class="meta-label">创建时间</span>
          <span class="meta-value">{{ formatDate(knowledgePoint.created_at) }}</span>
        </div>

        <div class="meta-item">
          <Calendar :size="16" class="meta-icon" />
          <span class="meta-label">更新时间</span>
          <span class="meta-value">{{ formatDate(knowledgePoint.updated_at) }}</span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="hasDescription" class="description-section">
        <h5 class="section-title">描述</h5>
        <p class="description-text">{{ knowledgePoint.description }}</p>
      </div>

      <div v-else class="empty-description">
        <p>暂无描述</p>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.kp-icon {
  width: 48px;
  height: 48px;
  background: rgba(37, 99, 235, 0.12);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.kp-name {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.meta-icon {
  color: var(--color-text-muted);
}

.meta-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.meta-value {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.description-section {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}

.description-text {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  line-height: var(--line-height);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-muted);
  border-radius: var(--radius-sm);
}

.empty-description {
  padding: var(--space-4);
  text-align: center;
  background: var(--color-muted);
  border-radius: var(--radius-sm);
}

.empty-description p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}
</style>