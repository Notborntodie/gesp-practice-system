<template>
  <AppDialog
    v-model:show="dialogVisible"
    title="学习计划详情"
    width="1000"
    :show-footer="false"
  >
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="planData">
      <!-- Plan Info -->
      <div class="plan-info-section">
        <div class="info-header">
          <h4>{{ planData.plan.name }}</h4>
          <AppTag type="primary">GESP {{ planData.plan.level }}级</AppTag>
        </div>
        <p class="plan-description">{{ planData.plan.description }}</p>

        <div class="plan-stats">
          <div class="stat-item">
            <span class="stat-label">完成进度</span>
            <span class="stat-value">{{ planData.plan.progress || 0 }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已完成任务</span>
            <span class="stat-value">{{ planData.plan.completed_tasks || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总任务数</span>
            <span class="stat-value">{{ planData.plan.total_tasks || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- Tasks -->
      <div class="tasks-section">
        <h5>学习任务</h5>
        <div v-if="planData.tasks && planData.tasks.length > 0" class="tasks-list">
          <div
            v-for="(task, index) in planData.tasks"
            :key="task.id"
            class="task-detail-item"
          >
            <div class="task-detail-header">
              <div class="task-title-row">
                <span class="task-number">{{ index + 1 }}</span>
                <h6>{{ task.name }}</h6>
                <AppTag v-if="task.is_exam_mode" type="warning" size="sm">考试模式</AppTag>
              </div>
              <AppTag :type="getTaskStatusType(task)" size="sm">
                {{ getTaskStatusText(task) }}
              </AppTag>
            </div>

            <p class="task-description">{{ task.description }}</p>

            <div v-if="task.review_content" class="review-section">
              <div class="review-label">
                <BookOpen :size="16" />
                复习内容
              </div>
              <div class="review-content">{{ task.review_content }}</div>
              <a v-if="task.review_video_url" :href="task.review_video_url" target="_blank" class="video-link">
                <Video :size="14" />
                观看复习视频
              </a>
            </div>

            <div class="task-time">
              <Clock :size="14" />
              {{ formatDateTime(task.start_time) }} - {{ formatDateTime(task.end_time) }}
            </div>

            <div class="task-exercises-info">
              <div class="exercise-count">
                <FileText :size="14" />
                客观题: {{ task.exam_count || 0 }}套
              </div>
              <div class="exercise-count">
                <Code :size="14" />
                OJ题: {{ task.oj_count || 0 }}道
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-tasks">
          <p>暂无任务</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dialog-footer">
      <AppButton variant="ghost" @click="$emit('close')">关闭</AppButton>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'

// Lucide Icons
import { BookOpen, Video, Clock, FileText, Code } from 'lucide-vue-next'

// Props
interface Props {
  visible: boolean
  planId: number | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits(['close'])

// Dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: () => emit('close')
})

// State
const loading = ref(false)
const planData = ref<any>(null)

// Fetch plan detail
async function fetchPlanDetail() {
  if (!props.planId) return

  loading.value = true
  try {
    const response = await axios.get(`${BASE_URL}/learning-plans/${props.planId}/admin`)
    console.log('📡 [PlanDetailDialog] 管理员API响应:', response.data)

    if (response.data.success) {
      const data = response.data.data

      planData.value = {
        plan: {
          id: data.id,
          name: data.name,
          description: data.description,
          level: data.level,
          start_time: data.start_time,
          end_time: data.end_time,
          is_active: data.is_active,
          total_tasks: data.tasks?.length || 0
        },
        tasks: (data.tasks || []).map((task: any) => ({
          id: task.id,
          name: task.name,
          description: task.description,
          review_content: task.review_content,
          review_video_url: task.review_video_url,
          start_time: task.start_time,
          end_time: task.end_time,
          is_completed: task.is_completed || false,
          is_exam_mode: task.is_exam_mode || false,
          exam_count: task.exams?.length || 0,
          oj_count: task.oj_problems?.length || 0
        }))
      }

      console.log('✅ [PlanDetailDialog] 计划详情加载成功')
    } else {
      console.warn('⚠️ [PlanDetailDialog] 响应success为false')
      alert('获取计划详情失败')
    }
  } catch (error: any) {
    console.error('❌ [PlanDetailDialog] 获取计划详情失败:', error)
    const errorMsg = error.response?.data?.message || error.message || '获取计划详情失败'
    alert(`获取计划详情失败: ${errorMsg}`)
  } finally {
    loading.value = false
  }
}

// Format datetime
function formatDateTime(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Task status
function getTaskStatusType(task: any): 'success' | 'warning' | 'default' {
  if (task.is_completed) return 'success'

  const now = new Date()
  const start = new Date(task.start_time)
  const end = new Date(task.end_time)

  if (now < start) return 'warning'
  if (now > end) return 'default'
  return 'success'
}

function getTaskStatusText(task: any): string {
  if (task.is_completed) return '已完成'

  const now = new Date()
  const start = new Date(task.start_time)
  const end = new Date(task.end_time)

  if (now < start) return '未开始'
  if (now > end) return '已过期'
  return '进行中'
}

watch(() => props.visible, (newVal) => {
  if (newVal && props.planId) {
    fetchPlanDetail()
  }
})
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-3);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.plan-info-section {
  padding: var(--space-4);
  background: var(--color-primary-lightest);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-light);
  margin-bottom: var(--space-4);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.info-header h4 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.plan-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  margin: 0 0 var(--space-4);
}

.plan-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.stat-item {
  background: var(--color-surface);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  text-align: center;
  border: 1px solid var(--color-border);
}

.stat-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  margin-bottom: var(--space-2);
}

.stat-value {
  display: block;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.tasks-section {
  margin-top: var(--space-4);
}

.tasks-section h5 {
  color: var(--color-foreground);
  font-size: var(--font-size-base);
  font-weight: 700;
  margin: 0 0 var(--space-3);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.task-detail-item {
  background: var(--color-surface);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  transition: all var(--transition-fast);
}

.task-detail-item:hover {
  border-color: var(--color-primary-light);
}

.task-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.task-number {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--font-size-xs);
}

.task-detail-header h6 {
  margin: 0;
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.task-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  margin: 0 0 var(--space-3);
}

.review-section {
  padding: var(--space-3);
  background: var(--color-accent-lightest);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-accent-light);
  margin-bottom: var(--space-3);
}

.review-label {
  color: var(--color-accent-dark);
  font-weight: 600;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.review-content {
  color: var(--color-accent-dark);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  margin-bottom: var(--space-2);
}

.video-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary);
  font-weight: 600;
  font-size: var(--font-size-sm);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.video-link:hover {
  color: var(--color-secondary);
}

.task-time {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-2);
}

.task-exercises-info {
  display: flex;
  gap: var(--space-4);
}

.exercise-count {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.no-tasks {
  text-align: center;
  padding: var(--space-4);
  color: var(--color-text-muted);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .plan-stats {
    grid-template-columns: 1fr;
  }
}
</style>