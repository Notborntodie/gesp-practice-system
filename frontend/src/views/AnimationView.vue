<template>
  <div class="animation-container">
    <!-- 浅蓝色header -->
    <header class="animation-header">
      <button 
        class="back-nav-arrow" 
        @click="goBack" 
        title="返回"
      >
        <Icon name="arrow-left" :size="28" />
      </button>
      <h1 class="header-title">{{ animationTitle }}</h1>
      <div class="header-actions">
        <button 
          class="link-btn" 
          @click="showLinkDialog = true" 
          title="生成链接"
        >
          <Icon name="link" :size="20" />
          <span class="link-btn-text">生成链接</span>
        </button>
      </div>
    </header>
    
    <!-- 链接生成弹窗 -->
    <transition name="modal-fade">
      <div v-if="showLinkDialog" class="link-modal-overlay" @click="showLinkDialog = false">
        <div class="link-modal" @click.stop>
          <div class="link-modal-header">
            <h3 class="link-modal-title">生成分享链接</h3>
            <button class="link-modal-close" @click="showLinkDialog = false">
              <Icon name="x" :size="20" />
            </button>
          </div>
          <div class="link-modal-body">
            <label class="link-label">分享链接：</label>
            <div class="link-input-wrapper">
              <input 
                ref="linkInputRef"
                type="text" 
                :value="generatedLink" 
                readonly
                class="link-input"
                @click="selectLink"
              />
              <button class="copy-btn" @click="copyLink" title="复制链接">
                <Icon name="copy" :size="18" />
              </button>
            </div>
            <p class="link-tip">复制此链接即可分享给他人，无需登录即可访问</p>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- 复制成功提示 -->
    <transition name="toast-fade">
      <div v-if="showCopyToast" class="copy-toast">
        <div class="toast-content">
          <Icon name="check-circle" :size="18" />
          <span>链接已复制到剪贴板！</span>
        </div>
      </div>
    </transition>
    
    <!-- 嵌入的动画iframe -->
    <div v-if="!animationUrl" class="loading-animation">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <template v-else>
      <iframe 
        v-show="!loadError"
        :src="animationUrl" 
        class="animation-iframe"
        frameborder="0"
        allowfullscreen
        @load="onIframeLoad"
        @error="onIframeError"
        :key="animationUrl"
      ></iframe>
      <div v-if="loadError" class="error-message">
      <Icon name="alert-circle" :size="24" />
      <p>无法加载动画文件</p>
      <p class="error-detail">{{ loadError }}</p>
      <a :href="animationUrl" target="_blank" class="btn-open-direct">直接打开文件</a>
      <p class="error-tip">若直接打开也失败，可能是动画文件未部署到服务器（animation-*.html 为教师上传，需同步到生产环境）</p>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()

// 从路由参数获取动画信息
const animationId = computed(() => route.params.id as string)
const animationUrl = ref('')
const animationTitle = ref('N皇后问题')
const showLinkDialog = ref(false)
const showCopyToast = ref(false)
const linkInputRef = ref<HTMLInputElement | null>(null)
const loadError = ref('')

// 返回上一页
const goBack = () => {
  router.back()
}

// 生成分享链接
const generatedLink = computed(() => {
  const baseUrl = window.location.origin
  const currentPath = route.path
  const queryParams = new URLSearchParams()
  
  // 保留所有查询参数
  if (route.query.url) {
    queryParams.set('url', route.query.url as string)
  }
  if (route.query.name) {
    queryParams.set('name', route.query.name as string)
  }
  
  // 如果有动画ID，也包含在路径中
  let sharePath = currentPath
  if (animationId.value && !route.query.url) {
    // 如果没有URL参数，使用ID路径
    sharePath = `/animation/${animationId.value}`
  }
  
  const queryString = queryParams.toString()
  return `${baseUrl}${sharePath}${queryString ? '?' + queryString : ''}`
})

// 选择链接文本
const selectLink = () => {
  if (linkInputRef.value) {
    linkInputRef.value.select()
  }
}

// 复制链接
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(generatedLink.value)
    showCopyToast.value = true
    setTimeout(() => {
      showCopyToast.value = false
    }, 2000)
  } catch (error) {
    // 降级方案：使用传统方法复制
    if (linkInputRef.value) {
      linkInputRef.value.select()
      try {
        document.execCommand('copy')
        showCopyToast.value = true
        setTimeout(() => {
          showCopyToast.value = false
        }, 2000)
      } catch (err) {
        console.error('复制失败:', err)
        alert('复制失败，请手动复制链接：\n' + generatedLink.value)
      }
    }
  }
}

// iframe加载成功
const onIframeLoad = () => {
  loadError.value = ''
  console.log('动画iframe加载成功:', animationUrl.value)
}

// iframe加载失败
const onIframeError = () => {
  loadError.value = '无法加载动画文件，请检查文件是否存在'
  console.error('动画iframe加载失败:', animationUrl.value)
}

// 加载动画信息
onMounted(() => {
  // 从路由查询参数获取动画信息
  const url = route.query.url as string
  const name = route.query.name as string
  
  if (name) {
    animationTitle.value = name
  }
  
  if (url) {
    // 确保URL是绝对路径（以/开头），使用完整 URL 确保 iframe 正确加载
    const path = url.startsWith('/') ? url : `/${url}`
    animationUrl.value = new URL(path, window.location.origin).href
    console.log('设置动画URL:', animationUrl.value)
  } else if (animationId.value) {
    // 如果没有URL，尝试从ID构建本地路径
    animationUrl.value = `/html/${animationId.value}.html`
    console.log('使用动画ID构建URL:', animationUrl.value)
  } else {
    loadError.value = '缺少动画URL或ID参数'
  }
})
</script>

<style scoped>
.animation-container {
  width: 100vw; /* 使用视口宽度 */
  height: calc(100vh - 48px); /* 减去 NavBar 的高度 */
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.animation-header {
  width: 100%;
  height: 48px;
  background-color: #e6f3ff; /* 浅蓝色 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
}

.header-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-size: 24px;
  font-weight: bold;
  color: #1e90ff;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.link-btn {
  background: rgba(30, 144, 255, 0.15);
  backdrop-filter: blur(10px);
  color: #1e90ff;
  border: 2px solid rgba(30, 144, 255, 0.3);
  border-radius: 10px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
  font-size: 14px;
  font-weight: 500;
}

.link-btn:hover {
  background: rgba(30, 144, 255, 0.25);
  border-color: rgba(30, 144, 255, 0.5);
  color: #0c7cd5;
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.link-btn:active {
  transform: scale(0.95);
}

.link-btn-text {
  white-space: nowrap;
}

.link-btn :deep(.lucide-icon) {
  flex-shrink: 0;
}

/* 链接生成弹窗 */
.link-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.link-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.link-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.link-modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.link-modal-close {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.link-modal-close:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.link-modal-body {
  padding: 24px;
}

.link-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 8px;
}

.link-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.link-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-family: monospace;
  color: #1e293b;
  background: #f8fafc;
  cursor: text;
  transition: all 0.2s ease;
}

.link-input:focus {
  outline: none;
  border-color: #1e90ff;
  background: white;
}

.copy-btn {
  background: #1e90ff;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: #0c7cd5;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(30, 144, 255, 0.3);
}

.copy-btn:active {
  transform: translateY(0);
}

.copy-btn :deep(.lucide-icon) {
  flex-shrink: 0;
}

.link-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

/* 复制成功提示 */
.copy-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: none;
}

.toast-content {
  background: rgba(30, 144, 255, 0.95);
  backdrop-filter: blur(10px);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4);
  font-size: 14px;
  font-weight: 500;
}

.toast-content :deep(.lucide-icon) {
  flex-shrink: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .link-modal,
.modal-fade-leave-to .link-modal {
  transform: scale(0.95) translateY(-10px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.animation-iframe {
  width: 100%;
  flex: 1;
  border: none;
  display: block;
  margin: 0;
  padding: 0;
}

/* 返回按钮样式 */
.back-nav-arrow {
  background: rgba(30, 144, 255, 0.15);
  backdrop-filter: blur(10px);
  color: #1e90ff;
  border: 2px solid rgba(30, 144, 255, 0.3);
  border-radius: 10px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
}

.back-nav-arrow:hover {
  background: rgba(30, 144, 255, 0.2);
  border-color: rgba(30, 144, 255, 0.5);
  color: #0c7cd5;
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.back-nav-arrow:active {
  transform: scale(0.95);
}

.back-nav-arrow :deep(.lucide-icon) {
  flex-shrink: 0;
}

/* 加载和错误状态 */
.loading-animation {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #64748b;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #1e90ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  color: #dc2626;
  text-align: center;
}

.error-message p {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.error-detail {
  font-size: 14px;
  color: #64748b;
  font-weight: normal;
}

.btn-open-direct {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  margin-top: 8px;
}

.btn-open-direct:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.error-tip {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 12px;
  max-width: 400px;
  line-height: 1.5;
}
</style>

<style>
/* 全局样式：确保动画页面占满整个宽度 */
/* 覆盖 main.css 中的 grid 布局 */
body:has(.animation-container) #app {
  display: block !important;
  grid-template-columns: none !important;
  width: 100% !important;
}

body:has(.animation-container) .main-content {
  width: 100% !important;
  max-width: 100% !important;
}
</style>

