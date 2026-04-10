<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <div class="dialog-icon">📝</div>
        <h3 class="dialog-title">题目详情</h3>
        <button @click="handleClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div v-if="question" class="question-detail-content">
          <!-- 题目基本信息 -->
          <div class="detail-section">
            <h5>题目信息</h5>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">题目类型:</span>
                <span class="info-value">{{ question.question_type === 'code' ? '代码题' : '文本题' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间:</span>
                <span class="info-value">{{ formatDate(question.created_at) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">题目编号:</span>
                <span class="info-value">#{{ question.question_number }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">等级:</span>
                <span class="info-value">{{ getLevelText(question.level || 1) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">难度:</span>
                <span class="info-value">{{ getDifficultyText(question.difficulty || 'medium') }}</span>
              </div>
              <div class="info-item" v-if="question.question_date">
                <span class="info-label">题目日期:</span>
                <span class="info-value">{{ question.question_date }}</span>
              </div>
            </div>
          </div>
          <!-- 题目内容 -->
          <div class="detail-section">
            <h5>题目内容</h5>
            <div class="question-text-box">
              <div class="question-text">
                {{ question.question_text || '题目内容加载中...' }}
              </div>
            </div>
          </div>
          
          <!-- 题目图片 -->
          <div v-if="(question.images && question.images.length > 0) || question.image_url" class="detail-section">
            <h5>题目图片</h5>
            <div class="images-grid">
              <!-- 显示题目主图片 -->
              <div 
                v-if="question.image_url"
                class="image-item"
              >
                <img 
                  :src="getImageUrl(question.image_url)" 
                  :alt="`题目图片`"
                  @click="openImageModal(getImageUrl(question.image_url))"
                  class="question-image"
                />
                <div class="image-info">
                  <span class="image-order">题目图片</span>
                </div>
              </div>
              <!-- 显示附加图片 -->
              <div 
                v-for="(image, index) in question.images" 
                :key="index"
                class="image-item"
              >
                <img 
                  :src="getImageUrl(image.image_url)" 
                  :alt="`附加图片 ${index + 1}`"
                  @click="openImageModal(getImageUrl(image.image_url))"
                  class="question-image"
                />
                <div class="image-info">
                  <span class="image-order">附加图片 {{ index + 1 }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- 题目代码（如果是代码题） -->
          <div v-if="question.question_code" class="detail-section">
            <h5>题目代码</h5>
            <div class="code-block">
              <pre>{{ question.question_code }}</pre>
            </div>
          </div>
          <!-- 选项列表 -->
          <div v-if="question.options && question.options.length > 0" class="detail-section">
            <h5>选项列表</h5>
            <div class="options-list">
              <div 
                v-for="option in question.options" 
                :key="option.id || option.label || option.option_label"
                class="option-item"
                :class="{ 'option-correct': (option.value || option.option_value) === question.correct_answer }"
              >
                <span class="option-label">{{ option.label || option.option_label }}.</span>
                <span class="option-text">{{ option.text || option.option_text }}</span>
                <span v-if="(option.value || option.option_value) === question.correct_answer" class="correct-indicator">✓</span>
              </div>
            </div>
          </div>
          <!-- 正确答案 -->
          <div class="detail-section">
            <h5>正确答案</h5>
            <div class="answer-box">
              <span class="correct-answer">{{ question.correct_answer }}</span>
            </div>
          </div>
          <!-- 解释说明 -->
          <div v-if="question.explanation" class="detail-section">
            <h5>解释说明</h5>
            <div class="explanation-box">
              <p>{{ question.explanation }}</p>
            </div>
          </div>
          <!-- 知识点 -->
          <div v-if="question.knowledge_points && question.knowledge_points.length > 0" class="detail-section">
            <h5>相关知识点</h5>
            <div class="knowledge-points">
              <span 
                v-for="kp in question.knowledge_points" 
                :key="kp.id"
                class="knowledge-tag"
              >
                {{ kp.name }}
              </span>
            </div>
          </div>
          <!-- 题目统计 -->
          <div class="detail-section">
            <h5>题目统计</h5>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">使用次数</span>
                <span class="stat-value">{{ question.usage_count || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">正确率</span>
                <span class="stat-value">{{ question.correct_rate || 'N/A' }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">难度</span>
                <span class="stat-value">{{ getDifficultyText(question.difficulty || 'medium') }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">选项数量</span>
                <span class="stat-value">{{ question.options ? question.options.length : 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button @click="handleClose" class="btn btn-secondary">关闭</button>
      </div>
    </div>
  </div>
  
  <!-- 图片模态框 -->
  <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
    <div class="image-modal-content" @click.stop>
      <button @click="closeImageModal" class="image-modal-close">×</button>
      <img :src="selectedImageUrl" alt="题目图片" class="modal-image" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { API_SERVER_BASE, normalizeImageUrl } from '@/config/api'

function getImageUrl(url: string | undefined): string {
  if (!url || !url.trim()) return ''
  const n = normalizeImageUrl(url)
  if (!n) return ''
  if (n.startsWith('http://') || n.startsWith('https://')) return n
  return n.startsWith('/') ? `${API_SERVER_BASE}${n}` : `${API_SERVER_BASE}/${n}`
}

const props = defineProps<{
  visible: boolean
  question: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// 图片模态框相关
const showImageModal = ref(false)
const selectedImageUrl = ref('')

function handleClose() {
  emit('close')
}

function handleOverlayClick() {
  emit('close')
}

function openImageModal(imageUrl: string) {
  selectedImageUrl.value = imageUrl
  showImageModal.value = true
}

function closeImageModal() {
  showImageModal.value = false
  selectedImageUrl.value = ''
}

function getDifficultyText(d: string) {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString()
}

function getLevelText(level: number) {
  return `GESP ${level}级`
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.dialog-container {
  background: white;
  border-radius: 18px;
  padding: 24px;
  max-width: 800px;
  width: 95%;
  box-shadow: 0 6px 24px -4px rgba(30,144,255,0.10), 0 1.5px 4px 0 rgba(0,0,0,0.03);
  animation: dialogSlideIn 0.3s ease-out;
  position: relative;
  border: 1.5px solid #b6e0fe;
}
@keyframes dialogSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(-20px);}
  to { opacity: 1; transform: scale(1) translateY(0);}
}
.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 18px 24px;
  background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
  border-radius: 12px;
  margin: -24px -24px 20px -24px;
}
.dialog-icon {
  font-size: 32px;
}
.dialog-title {
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
}
.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  font-size: 28px;
  color: white;
  cursor: pointer;
  margin-left: auto;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
.dialog-content {
  max-height: 60vh;
  overflow-y: auto;
}
.detail-section {
  margin-bottom: 20px;
}
.detail-section h5 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #1976d2;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}
.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}
.info-item {
  min-width: 120px;
}
.info-label {
  color: #64748b;
  font-size: 13px;
}
.info-value {
  color: #1e293b;
  font-size: 14px;
  margin-left: 4px;
}
.question-text-box {
  background: #e3f2fd;
  border: 1.5px solid #b6e0fe;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 8px;
}
.question-text {
  color: #1976d2;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}
.code-block {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  border: 1px solid #334155;
}
.code-block pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  transition: all 0.2s ease;
}
.option-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.option-item.option-correct {
  background: #f0fdf4;
  border-color: #10b981;
  border-left: 4px solid #10b981;
}
.option-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
  min-width: 24px;
}
.option-text {
  flex: 1;
  color: #1e293b;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
.correct-indicator {
  color: #10b981;
  font-weight: bold;
  font-size: 16px;
  margin-left: 8px;
}
.answer-box,
.explanation-box {
  background: #e3f2fd;
  border: 1.5px solid #b6e0fe;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  color: #1976d2;
}
.knowledge-points {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.knowledge-tag {
  background: #e0f2fe;
  color: #0369a1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #bae6fd;
  transition: all 0.2s ease;
}
.knowledge-tag:hover {
  background: #bae6fd;
  color: #075985;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e90ff;
}
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 15px;
}
.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1.5px solid #e2e8f0;
}
.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* 图片网格样式 */
.images-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
}

.image-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.15);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid #e2e8f0;
  background: white;
}

.image-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.25);
  border-color: #1e90ff;
}

.question-image {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  display: block;
  transition: all 0.3s ease;
  background: #f8fafc;
}

.image-item:hover .question-image {
  transform: scale(1.02);
}

.image-info {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(30, 144, 255, 0.9);
  color: white;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  backdrop-filter: blur(4px);
}

.image-order {
  display: block;
}

/* 图片模态框样式 */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(8px);
}

.image-modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.image-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}

.image-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.modal-image {
  width: 100%;
  height: auto;
  max-height: 90vh;
  object-fit: contain;
  display: block;
}
</style>