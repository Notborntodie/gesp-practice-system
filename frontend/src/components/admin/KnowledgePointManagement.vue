<template>
  <AdminPageTemplate
    title="知识点管理"
    :loading="loading.value"
    :total="knowledgePoints.length"
    :cache-valid="knowledgePointStore.isCacheValid.value"
    :has-cache="knowledgePointStore.hasKnowledgePoints.value"
    @refresh="refreshKnowledgePoints"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="openCreateKnowledgePointDialog">
        <Plus :size="16" />
        创建知识点
      </AppButton>
    </template>

    <!-- Filters -->
    <template #filters>
      <div class="filter-group">
        <label>搜索知识点：</label>
        <AppInput
          v-model="searchQuery"
          placeholder="搜索知识点名称..."
          @input="filterKnowledgePoints"
          clearable
        />
      </div>
      <div class="filter-group">
        <label>级别筛选：</label>
        <AppSelect
          v-model="filterLevel"
          :options="levelOptions"
          placeholder="全部级别"
          @update:model-value="filterKnowledgePoints"
        />
      </div>
      <div class="filter-group">
        <label>分类筛选：</label>
        <AppSelect
          v-model="filterCategory"
          :options="categoryOptions"
          placeholder="全部分类"
          @update:model-value="filterKnowledgePoints"
        />
      </div>
    </template>

    <!-- Content: Table -->
    <div class="knowledge-points-table-container">
      <table v-if="filteredKnowledgePoints.length > 0" class="knowledge-points-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>知识点名称</th>
            <th>级别</th>
            <th>分类</th>
            <th>创建时间</th>
            <th>更新时间</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(kp, index) in filteredKnowledgePoints"
            :key="kp.id"
            class="table-row"
            @click="toggleKnowledgePointExpansion(kp.id)"
          >
            <td>{{ index + 1 }}</td>
            <td class="name-cell">
              <div class="knowledge-point-name-preview">
                {{ kp.name || '知识点名称加载中...' }}
              </div>
            </td>
            <td>
              <AppTag type="info">{{ getLevelText(kp.level || 1) }}</AppTag>
            </td>
            <td>
              <AppTag :type="getCategoryTagType(kp.category)">
                {{ getCategoryName(kp.category) }}
              </AppTag>
            </td>
            <td>{{ formatDate(kp.created_at) }}</td>
            <td>{{ formatDate(kp.updated_at) }}</td>
            <td class="description-cell">
              <div v-if="kp.description" class="description-preview">
                {{ truncateText(kp.description, 30) }}
              </div>
              <span v-else class="no-description">-</span>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <AppButton variant="ghost" size="sm" @click="viewKnowledgePointDetails(kp)">
                  <Eye :size="16" />
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="editKnowledgePoint(kp)">
                  <Pencil :size="16" />
                </AppButton>
                <AppButton variant="destructive" size="sm" @click="deleteKnowledgePoint(kp)">
                  <Trash2 :size="16" />
                </AppButton>
              </div>
            </td>
          </tr>
          <!-- 展开的详细信息行 -->
          <tr
            v-for="knowledgePoint in filteredKnowledgePoints.filter(kp => expandedKnowledgePoints.includes(kp.id))"
            :key="`detail-${knowledgePoint.id}`"
            class="detail-row"
          >
            <td colspan="8">
              <div class="knowledge-point-details">
                <div class="detail-section">
                  <h5>知识点详细信息</h5>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">知识点名称:</span>
                      <span class="info-value">{{ knowledgePoint.name }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">分类:</span>
                      <span class="info-value">{{ getCategoryName(knowledgePoint.category) }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">等级:</span>
                      <span class="info-value">{{ getLevelText(knowledgePoint.level) }}</span>
                    </div>
                    <div class="info-item" v-if="knowledgePoint.created_at">
                      <span class="info-label">创建时间:</span>
                      <span class="info-value">{{ formatDate(knowledgePoint.created_at) }}</span>
                    </div>
                    <div class="info-item" v-if="knowledgePoint.updated_at">
                      <span class="info-label">更新时间:</span>
                      <span class="info-value">{{ formatDate(knowledgePoint.updated_at) }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="knowledgePoint.description" class="detail-section">
                  <h5>完整描述</h5>
                  <div class="description-box">
                    <p>{{ knowledgePoint.description }}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无知识点">
        <template #action>
          <AppButton variant="primary" @click="openCreateKnowledgePointDialog">
            创建第一个知识点
          </AppButton>
        </template>
      </AppEmptyState>
    </div>

    <!-- Dialogs -->
    <CreateKnowledgePointDialog
      :visible="showCreateKnowledgePointDialog"
      @close="closeCreateKnowledgePointDialog"
      @created="handleKnowledgePointCreated"
    />

    <EditKnowledgePointDialog
      :visible="showEditKnowledgePointDialog"
      :knowledge-point="editingKnowledgePoint"
      @close="closeEditKnowledgePointDialog"
      @updated="handleKnowledgePointUpdated"
    />

    <ViewKnowledgePointDialog
      :visible="showViewDialog"
      :knowledge-point="viewingKnowledgePoint"
      @close="closeViewDialog"
    />

    <AppDialog
      v-model:show="showDeleteDialog"
      title="确认删除"
      width="400"
      positive-text="删除"
      negative-text="取消"
      @positive="confirmDelete"
    >
      <p style="color: var(--color-text-secondary);">确定要删除这个知识点吗？此操作不可撤销。</p>
    </AppDialog>

    <AppDialog
      v-model:show="showSuccessMessage"
      title="操作成功"
      width="400"
      :show-footer="false"
    >
      <p style="color: var(--color-accent);">{{ successMessage }}</p>
    </AppDialog>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { BASE_URL } from '@/config/api'
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Plus, Eye, Pencil, Trash2 } from 'lucide-vue-next'

// Dialog Components
import CreateKnowledgePointDialog from './Dialog/CreateKnowledgePointDialog.vue'
import EditKnowledgePointDialog from './Dialog/EditKnowledgePointDialog.vue'
import ViewKnowledgePointDialog from './Dialog/ViewKnowledgePointDialog.vue'

// Stores
import { useKnowledgePointStore } from '../../stores/knowledgePointStore'

// Props
interface Props {
  refreshTrigger?: number
}

const props = withDefaults(defineProps<Props>(), {
  refreshTrigger: 0
})

// Store
const knowledgePointStore = useKnowledgePointStore()

// State
const filteredKnowledgePoints = ref<any[]>([])
const searchQuery = ref('')
const filterLevel = ref<string | null>(null)
const filterCategory = ref<string | null>(null)
const expandedKnowledgePoints = ref<number[]>([])

// Dialog State
const showCreateKnowledgePointDialog = ref(false)
const showEditKnowledgePointDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const showSuccessMessage = ref(false)
const successMessage = ref('')

// Edit/Delete/View Data
const editingKnowledgePoint = ref<any>(null)
const viewingKnowledgePoint = ref<any>(null)
const knowledgePointToDelete = ref<any>(null)

// From Store
const knowledgePoints = knowledgePointStore.knowledgePoints
const loading = knowledgePointStore.loading

// Filter Options
const levelOptions = computed(() => [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
])

const categoryOptions = computed(() => [
  { label: '算法', value: 'algorithm' },
  { label: '数据结构', value: 'data_structure' },
  { label: '编程', value: 'programming' },
  { label: '数学', value: 'math' },
])

// Watch knowledgePoints
watch(knowledgePoints, () => {
  filterKnowledgePoints()
}, { immediate: true })

// Fetch Knowledge Points
async function fetchKnowledgePoints(forceRefresh = false) {
  try {
    await knowledgePointStore.fetchKnowledgePoints(forceRefresh)
  } catch (error: any) {
    console.error('获取知识点失败:', error)
    alert('获取知识点失败: ' + (error.response?.data?.message || error.message))
  }
}

// Filter Knowledge Points
function filterKnowledgePoints() {
  let list = [...knowledgePoints.value]

  if (filterLevel.value) {
    list = list.filter(kp => String(kp.level || 1) === filterLevel.value)
  }

  if (filterCategory.value) {
    list = list.filter(kp => kp.category === filterCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(kp =>
      kp.name?.toLowerCase().includes(query) ||
      kp.description?.toLowerCase().includes(query)
    )
  }

  list = list.sort((a, b) => a.id - b.id)
  filteredKnowledgePoints.value = list
}

// Toggle Expansion
function toggleKnowledgePointExpansion(id: number) {
  const idx = expandedKnowledgePoints.value.indexOf(id)
  if (idx === -1) {
    expandedKnowledgePoints.value.push(id)
  } else {
    expandedKnowledgePoints.value.splice(idx, 1)
  }
}

// Edit Knowledge Point
function editKnowledgePoint(kp: any) {
  editingKnowledgePoint.value = kp
  showEditKnowledgePointDialog.value = true
}

// Delete Knowledge Point
function deleteKnowledgePoint(kp: any) {
  knowledgePointToDelete.value = kp
  showDeleteDialog.value = true
}

// Confirm Delete
async function confirmDelete() {
  if (!knowledgePointToDelete.value) return

  try {
    const response = await axios.delete(`${BASE_URL}/knowledge-points/${knowledgePointToDelete.value.id}`)

    if (response.data.message && response.data.message.includes('成功')) {
      await fetchKnowledgePoints(true)
    }

    showDeleteDialog.value = false
    knowledgePointToDelete.value = null

    showSuccessMessage.value = true
    successMessage.value = '知识点删除成功！'
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message
    if (errorMessage.includes('关联题目')) {
      alert(`无法删除知识点：${errorMessage}`)
    } else {
      alert('知识点删除失败: ' + errorMessage)
    }
  }
}

// Open Create Dialog
function openCreateKnowledgePointDialog() {
  showCreateKnowledgePointDialog.value = true
}

function closeCreateKnowledgePointDialog() {
  showCreateKnowledgePointDialog.value = false
}

async function handleKnowledgePointCreated(newKnowledgePoint: any) {
  await fetchKnowledgePoints(true)
  showSuccessMessage.value = true
  successMessage.value = '知识点创建成功！'
}

function closeEditKnowledgePointDialog() {
  showEditKnowledgePointDialog.value = false
  editingKnowledgePoint.value = null
}

async function handleKnowledgePointUpdated(updatedKnowledgePoint: any) {
  await fetchKnowledgePoints(true)
  showSuccessMessage.value = true
  successMessage.value = '知识点更新成功！'
}

async function refreshKnowledgePoints() {
  try {
    await fetchKnowledgePoints()
    showSuccessMessage.value = true
    successMessage.value = '知识点列表已刷新！'
  } catch (error: any) {
    alert('刷新失败: ' + (error.response?.data?.message || error.message))
  }
}

// Helpers
function getCategoryName(category: string) {
  const categoryMap: { [key: string]: string } = {
    'algorithm': '算法',
    'data_structure': '数据结构',
    'programming': '编程',
    'math': '数学'
  }
  return categoryMap[category] || category
}

function getCategoryTagType(category: string): 'success' | 'info' | 'warning' | 'default' {
  const typeMap: { [key: string]: 'success' | 'info' | 'warning' | 'default' } = {
    'algorithm': 'success',
    'data_structure': 'info',
    'programming': 'warning',
    'math': 'default'
  }
  return typeMap[category] || 'default'
}

function getLevelText(level: number) {
  return `GESP ${level}级`
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// View Knowledge Point Details
function viewKnowledgePointDetails(kp: any) {
  viewingKnowledgePoint.value = kp
  showViewDialog.value = true
}

function closeViewDialog() {
  showViewDialog.value = false
  viewingKnowledgePoint.value = null
}

// Watch Refresh Trigger
watch(() => props.refreshTrigger, async (newTrigger, oldTrigger) => {
  if (newTrigger && newTrigger !== oldTrigger && newTrigger > 0) {
    await fetchKnowledgePoints(true)
  }
})

onMounted(async () => {
  if (!knowledgePointStore.hasKnowledgePoints.value) {
    await fetchKnowledgePoints()
  } else {
    knowledgePointStore.fetchKnowledgePoints()
  }
})
</script>

<style scoped>
.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.knowledge-points-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.knowledge-points-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.knowledge-points-table thead {
  background: var(--color-muted);
}

.knowledge-points-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.knowledge-points-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.name-cell {
  max-width: 250px;
}

.knowledge-point-name-preview {
  font-weight: 500;
  color: var(--color-foreground);
}

.description-cell {
  max-width: 200px;
}

.description-preview {
  color: var(--color-text-secondary);
  font-style: italic;
}

.no-description {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  gap: var(--space-2);
}

/* Detail Row */
.detail-row {
  background: var(--color-muted);
}

.detail-row td {
  padding: 0;
}

.knowledge-point-details {
  padding: var(--space-6);
  background: var(--color-muted);
  margin: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.detail-section {
  margin-bottom: var(--space-5);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h5 {
  margin: 0 0 var(--space-3);
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.info-label {
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.info-value {
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.description-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  color: var(--color-text-secondary);
}

.description-box p {
  margin: 0;
  line-height: var(--line-height);
}
</style>