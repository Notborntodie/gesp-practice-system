<template>
  <div class="nav-bar">
    <div class="nav-content">
      <!-- 左侧：标题 -->
      <div class="nav-left">
        <div class="nav-logo">
          <img src="/logo.png" alt="信奥成长计划" class="logo-image" />
          <span class="logo-text">信奥成长计划</span>
        </div>
      </div>
      
      <!-- 中间：横向菜单或考试标题 -->
      <div class="nav-center">
        <!-- 考试页面或OJ页面显示标题 -->
        <div v-if="isExamPage || isOJPage" class="exam-title-center">
          <div class="exam-title-container">
            <h2 class="exam-title-text">{{ examTitle }}</h2>
          </div>
        </div>
        <!-- 普通页面显示横向菜单 -->
        <nav v-else class="main-nav">
          <div 
            v-for="item in visibleMenuItems" 
            :key="item.key"
            class="nav-menu-item-wrapper"
          >
            <button 
              @click="handleMainMenuClick(item)"
              :class="['nav-menu-item', { active: activeMainMenu === item.key }]"
            >
              {{ item.label }}
              <Icon v-if="(item as any).comingSoon" name="rocket" :size="14" class="coming-soon-icon" />
            </button>
          </div>
        </nav>
      </div>
      
      <!-- 右侧：级别选择器和用户下拉菜单或退出按钮 -->
      <div class="nav-right">
        <!-- OJ页面或考试页面显示退出按钮 -->
        <div v-if="isOJPage || isExamPage" class="oj-exit-btn">
          <button @click="isOJPage ? exitOJ() : exitExam()" class="exit-oj-btn" type="button">
            退出
          </button>
        </div>
        <!-- 普通页面显示用户下拉菜单 -->
        <div v-else-if="!isExamPage">
          <div v-if="isLoggedIn" class="user-dropdown">
            <button @click="toggleDropdown" class="user-btn">
              <div class="user-avatar">
                {{ userInfo?.real_name ? userInfo.real_name.charAt(0) : (userInfo?.username ? userInfo.username.charAt(0) : '我') }}
              </div>
              <div class="user-info">
                <span class="user-name">{{ userInfo?.real_name || userInfo?.username || '我的' }}</span>
              </div>
              <span class="dropdown-arrow" :class="{ 'open': isDropdownOpen }">▼</span>
            </button>
            <div v-if="isDropdownOpen" class="dropdown-menu">
              <button @click="goToProfile" class="dropdown-item">
                <Icon name="user" :size="18" class="item-icon" />
                个人中心
              </button>
              <button v-if="isAdmin" @click="goToAdmin" class="dropdown-item">
                <Icon name="settings" :size="18" class="item-icon" />
                管理后台
              </button>
              <button v-if="isTeacher" @click="goToTeacher" class="dropdown-item">
                <Icon name="graduation-cap" :size="18" class="item-icon" />
                教师管理
              </button>
              <div class="dropdown-divider"></div>
              <button @click="logout" class="dropdown-item logout-item">
                <Icon name="log-out" :size="18" class="item-icon" />
                退出登录
              </button>
            </div>
          </div>
          <!-- 未登录状态的占位元素 -->
          <div v-else class="nav-placeholder">
            <div class="placeholder-content">
              <span class="placeholder-text">请先登录</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 等级切换提示弹窗 -->
    <transition name="toast-fade">
      <div v-if="showLevelToast" class="level-toast">
        <div class="toast-content">
          <span class="toast-icon">✓</span>
          <span class="toast-text">已切换到GESP {{ userGespLevel }}级</span>
        </div>
      </div>
    </transition>
    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'

const router = useRouter()
const route = useRoute()
const isLoggedIn = ref(false)
const userInfo = ref<any>(null)
const isDropdownOpen = ref(false)
const activeMainMenu = ref('gesp')

const isDark = ref(false)
const isAdminView = ref(false)
const examTitle = ref('')
const isExamPage = ref(false)
const isOJPage = ref(false)
let examCheckInterval: ReturnType<typeof setInterval> | null = null

// 级别变化相关
const showLevelToast = ref(false)
const userGespLevel = ref<number>(1)
let toastTimer: ReturnType<typeof setTimeout> | null = null

// 主菜单项
const mainMenuItems = [
  { key: 'home', label: '主页', route: '/home', disabled: false },
  { key: 'plan', label: '学习计划', route: '/plan', disabled: false },
  { key: 'gesp', label: 'GESP 客观题', route: '/select' },
  { key: 'smartoj', label: 'GESP 编程题', route: '/smartoj', disabled: false },
  { key: 'teacher', label: '教师管理', route: '/teacher', disabled: false }
]

// 过滤后的菜单项（根据用户权限）
const visibleMenuItems = computed(() => {
  return mainMenuItems.filter(item => {
    // 教师管理菜单项只有教师才能看到
    if (item.key === 'teacher') {
      return isTeacher.value
    }
    return true
  })
})

const checkTheme = () => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 检查登录状态
const checkLoginStatus = () => {
  isLoggedIn.value = localStorage.getItem('isLoggedIn') === 'true'
  if (isLoggedIn.value) {
    const userInfoStr = localStorage.getItem('userInfo')
    if (userInfoStr) {
      userInfo.value = JSON.parse(userInfoStr)
    }
    // 读取用户设置的GESP级别
    loadUserGespLevel()
  } else {
    userInfo.value = null
    userGespLevel.value = 1
  }
}

// 加载用户GESP级别
const loadUserGespLevel = () => {
  const savedLevel = localStorage.getItem('userGespLevel')
  if (savedLevel) {
    const level = parseInt(savedLevel, 10)
    if (level >= 1 && level <= 8) {
      userGespLevel.value = level
    } else {
      userGespLevel.value = 1
    }
  } else {
    userGespLevel.value = 1
  }
}

// 监听级别变化事件（从其他组件触发）
const handleGespLevelChanged = (event: CustomEvent) => {
  const newLevel = event.detail.level
  if (newLevel >= 1 && newLevel <= 8) {
    userGespLevel.value = newLevel
    // 显示提示弹窗
    showLevelToast.value = true
    // 清除之前的定时器
    if (toastTimer) {
      clearTimeout(toastTimer)
    }
    // 2秒后淡出
    toastTimer = setTimeout(() => {
      showLevelToast.value = false
      toastTimer = null
    }, 2000)
  }
}

// 检查是否为考试页面或OJ页面
const checkExamPage = () => {
  const currentPath = route.path
  // 检测考试页面：包括 /exam/ 和 /plan-exam/
  isExamPage.value = currentPath.includes('/exam/') || currentPath.includes('/plan-exam/')
  // 检测OJ做题页：路径以/smartoj/或/plan-smartoj/开头且不是列表页
  isOJPage.value = (currentPath.startsWith('/smartoj/') && currentPath !== '/smartoj') ||
                    (currentPath.startsWith('/plan-smartoj/') && currentPath !== '/plan-smartoj')
  
  if (isExamPage.value) {
    // 显示客观题模式
    examTitle.value = '客观题模式'
    // 清除定时器
    if (examCheckInterval) {
      clearInterval(examCheckInterval as any)
      examCheckInterval = null
    }
  } else if (isOJPage.value) {
    // OJ页面显示编程题模式
    examTitle.value = '编程题模式'
    // 清除定时器
    if (examCheckInterval) {
      clearInterval(examCheckInterval as any)
      examCheckInterval = null
    }
  } else {
    examTitle.value = ''
    // 清除定时器
    if (examCheckInterval) {
      clearInterval(examCheckInterval as any)
      examCheckInterval = null
    }
  }
}

// 跳转到登录页
const goToLogin = () => {
  router.push('/login')
}

// 退出OJ页面
const exitOJ = () => {
  const currentPath = route.path
  const urlParams = new URLSearchParams(window.location.search)
  const from = urlParams.get('from')
  const planId = urlParams.get('planId')
  const taskId = urlParams.get('taskId')

  // 如果是任务内OJ页面（/plan-smartoj/），触发退出确认弹窗
  if (currentPath.includes('/plan-smartoj/')) {
    // 触发 PlanSmartOJView 中的退出确认弹窗
    window.dispatchEvent(new CustomEvent('exitOJRequest'))
  } else if (from === 'taskview' && planId && taskId) {
    router.push(`/plan/${planId}/tasks/${taskId}?tab=programming`);
  } else if (from === 'plan-submissions') {
    router.push('/plan/submissions');
  } else if (from) {
    router.push('/plan');
  } else {
    router.push(`/smartoj`);
  }
}

// 退出考试页面
const exitExam = () => {
  const currentPath = route.path
  const urlParams = new URLSearchParams(window.location.search)
  const testAttemptId = urlParams.get('testAttemptId')
  const testId = urlParams.get('testId')

  // 从 Test 进入客观题考试页面（/exam/:id?testAttemptId=&testId=）
  // 直接按 testId 返回对应 Test，不再弹确认框
  if (currentPath.startsWith('/exam/') && testAttemptId && testId && testId.trim() !== '') {
    router.push(`/tests/${testId}`)
    return
  }

  // 其他考试页面仍然交给各自视图的退出确认弹窗处理
  window.dispatchEvent(new CustomEvent('exitExamRequest'))
}

// 退出登录
const logout = () => {
  closeDropdown()
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('userInfo')
  isLoggedIn.value = false
  userInfo.value = null
  router.push('/login')
}

// 检查当前是否在管理页面并设置活动菜单
const checkAdminView = () => {
  isAdminView.value = route.path === '/select'
  
  // 根据当前路由设置活动菜单
  if (route.path === '/') {
    activeMainMenu.value = 'home'
  } else if (route.path === '/plan' || route.path === '/plan/submissions' || route.path === '/plan/ranking') {
    activeMainMenu.value = 'plan'
  } else if (route.path === '/select' || route.path.startsWith('/level-exams/')) {
    activeMainMenu.value = 'gesp'
  } else if (route.path === '/teacher' || route.path.startsWith('/teacher/')) {
    activeMainMenu.value = 'teacher'
  } else if (route.path === '/smartoj' || route.path.startsWith('/smartoj/')) {
    activeMainMenu.value = 'smartoj'
  }
}

// 检查用户是否为管理员
const isAdmin = computed(() => {
  if (!userInfo.value) return false
  return userInfo.value.role_names?.includes('admin') || 
         userInfo.value.roles?.some((role: any) => role.name === 'admin')
})

// 检查用户是否为教师
const isTeacher = computed(() => {
  if (!userInfo.value) return false
  return userInfo.value.role_names?.includes('teacher') || 
         userInfo.value.roles?.some((role: any) => role.name === 'teacher')
})

// 检查用户是否为学生
const isStudent = computed(() => {
  if (!userInfo.value) return false
  return userInfo.value.role_names?.includes('student') || 
         userInfo.value.roles?.some((role: any) => role.name === 'student')
})

// 切换下拉菜单
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

// 关闭下拉菜单
const closeDropdown = () => {
  isDropdownOpen.value = false
}

// 跳转到个人中心
const goToProfile = () => {
  closeDropdown()
  router.push('/profile')
}

// 跳转到管理后台
const goToAdmin = () => {
  closeDropdown()
  router.push('/admin')
}

// 跳转到教师管理
const goToTeacher = () => {
  closeDropdown()
  router.push('/teacher')
}

// 处理主菜单点击
const handleMainMenuClick = (item: any) => {
  if (item.disabled) {
    if (item.comingSoon) {
      alert(`${item.label} 功能即将推出，敬请期待！`)
    } else {
      alert(`${item.label} 功能正在开发中，敬请期待！`)
    }
    return
  }
  
  activeMainMenu.value = item.key
  router.push(item.route)
}


// 监听登录状态变化
const handleStorageChange = () => {
  checkLoginStatus()
  checkExamPage()
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-dropdown')) {
    closeDropdown()
  }
}

onMounted(() => {
  checkLoginStatus()
  checkAdminView()
  checkExamPage()
  window.addEventListener('storage', handleStorageChange)
  document.addEventListener('click', handleClickOutside)
  // 监听级别变化事件
  window.addEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
  // 读取本地主题
  const theme = localStorage.getItem('theme')
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme)
    isDark.value = theme === 'dark'
  } else {
    // 跟随系统
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  }
})

// 监听路由变化
router.afterEach(() => {
  checkAdminView()
  checkExamPage()
})

// 组件卸载时移除监听
onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
  if (examCheckInterval) {
    clearInterval(examCheckInterval as any)
    examCheckInterval = null
  }
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
})
</script>

<style scoped>
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* 使用和主页面一致的渐变背景 */
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  border-bottom: 2px solid #e2e8f0;
  z-index: 1000;
  padding: 0;
  height: 48px;
  box-sizing: border-box;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
}

.nav-content {
  /* 移除 max-width 限制，让内容占满整个宽度 */
  width: 100%;
  margin: 0;
  /* 减少左右 padding，让按钮更靠近边缘 */
  padding: 0 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  flex-shrink: 0;
}

.nav-logo {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  height: 100%;
}

.logo-image {
  height: 40px;
  width: auto;
  transition: all 0.3s ease;
}

.logo-image:hover {
  transform: scale(1.05);
}

.logo-text {
  color: #ffffff;
  font-size: 1.3rem;
  font-weight: 900;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  letter-spacing: 2px;
  margin-bottom: 0px;
  padding-bottom: 2px;
}


.nav-center {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 1;
  margin: 0 20px;
}

/* 考试页面时，nav-center占满整个宽度并居中 */
.nav-center:has(.exam-title-center) {
  justify-content: center;
  margin: 0;
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
}

/* 考试标题样式 */
.exam-title-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

.exam-title-container {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 8px 24px;
  box-shadow: 0 6px 24px rgba(30, 144, 255, 0.2);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.exam-title-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.exam-title-container:hover::before {
  left: 100%;
}

.exam-title-container:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 28px rgba(30, 144, 255, 0.25);
  transform: translateY(-2px) scale(1.02);
  border-width: 5px;
}

.exam-title-text {
  margin: 0;
  color: #2c5282;
  font-weight: 900;
  font-size: 1.15rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  position: relative;
  z-index: 1;
  letter-spacing: 1px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-menu-item {
  background: transparent;
  border: none;
  color: #374151;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  letter-spacing: 0.5px;
}

.nav-menu-item:hover {
  background: rgba(30, 144, 255, 0.1);
  color: #1e90ff;
}

.nav-menu-item.active {
  background: rgba(30, 144, 255, 0.2);
  color: #1e90ff;
  font-weight: 900;
  border: 3px solid rgba(30, 144, 255, 0.3);
}

.nav-menu-item.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 4px;
  background: #1e90ff;
  border-radius: 2px;
}

.nav-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-menu-item:disabled:hover {
  background: transparent;
  color: #374151;
}

.coming-soon-icon {
  font-size: 0.8rem;
  margin-left: 4px;
  opacity: 0.7;
}

.nav-menu-item-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  flex-shrink: 0;
}

/* 用户下拉菜单样式 */
.user-dropdown {
  position: relative;
  display: inline-block;
}

.user-btn {
  background: linear-gradient(135deg, #87ceeb, #b0e0e6);
  color: #2c5282 !important;
  border: 2px solid rgba(44, 82, 130, 0.3);
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  padding: 8px 16px;
  margin: 0;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.2);
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 150px;
  letter-spacing: 0.5px;
}

.user-btn:hover {
  box-shadow: 0 6px 16px rgba(30, 144, 255, 0.3);
  transform: translateY(-2px) scale(1.05);
  border-width: 4px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(44, 82, 130, 0.2);
  color: #2c5282;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  border: 2px solid rgba(44, 82, 130, 0.3);
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
}

.user-name {
  font-weight: 800;
  font-size: 1.1rem;
  line-height: 1.2;
}


.dropdown-arrow {
  font-size: 1rem;
  transition: transform 250ms ease;
  margin-left: 6px;
  font-weight: 700;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  border: 4px solid #e2e8f0;
  min-width: 200px;
  z-index: 1000;
  overflow: hidden;
  margin-top: 10px;
  animation: dropdownFadeIn 200ms ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  width: 100%;
  padding: 16px 20px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #374151;
  transition: all 0.3s ease;
  letter-spacing: 0.3px;
}

.dropdown-item:hover {
  background-color: #f3f4f6;
}

.dropdown-item.logout-item {
  color: #dc2626;
}

/* OJ退出按钮样式 */
.oj-exit-btn {
  display: flex;
  align-items: center;
}

.exit-oj-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: 3px solid #b91c1c;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 1rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  letter-spacing: 0.5px;
}

.exit-oj-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  border-width: 5px;
}

.dropdown-item.logout-item:hover {
  background-color: #fef2f2;
}

.item-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.dropdown-divider {
  height: 1px;
  background-color: #e5e7eb;
  margin: 4px 0;
}

/* 未登录状态占位元素样式 */
.nav-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  height: 44px;
}

.placeholder-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 24px;
  background: rgba(135, 206, 235, 0.15);
  border: 4px dashed rgba(30, 144, 255, 0.4);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.placeholder-text {
  color: #64748b;
  font-size: 1.1rem;
  font-weight: 700;
  font-style: italic;
}

.nav-btn, .login-btn {
  background: linear-gradient(135deg, #1e90ff, #0066cc);
  color: #fff !important;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  padding: 12px 24px;
  /* 移除按钮的 margin */
  margin: 0;
  transition: background 250ms ease, box-shadow 250ms ease, color 250ms;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.nav-btn:disabled, .login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: none;
}

.nav-btn::before, .login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 350ms ease;
}

.nav-btn:hover::before, .login-btn:hover::before {
  left: 100%;
}

.nav-btn:hover, .login-btn:hover {
  box-shadow: 0 8px 12px -2px rgb(0 0 0 / 0.15);
  transform: translateY(-2px);
}

.logout-btn {
  background: #ef4444 !important;
  color: #fff !important;
}

.logout-btn:hover {
  background: #dc2626 !important;
  box-shadow: 0 8px 12px -2px rgb(0 0 0 / 0.15);
  transform: translateY(-2px);
}


@media (max-width: 768px) {
  .logo-image {
    height: 42px;
  }
  
  .logo-text {
    font-size: 1.3rem;
  }
  .nav-content {
    padding: 0 var(--space-4);
  }
  
  .nav-center {
    margin: 0 10px;
  }
  
  .main-nav {
    gap: 4px;
  }
  
  .nav-menu-item {
    padding: 10px 16px;
    font-size: 1.1rem;
  }
  
  .animation-demo-btn {
    padding: 10px 16px;
    font-size: 1.1rem;
  }
  
  .user-btn {
    padding: 10px 18px;
    font-size: 1.1rem;
    min-width: 150px;
    gap: 10px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .user-name {
    font-size: 1rem;
  }

  .nav-placeholder {
    min-width: 140px;
    height: 40px;
  }

  .placeholder-content {
    padding: 10px 16px;
  }

  .placeholder-text {
    font-size: 0.8rem;
  }
  
  .dropdown-menu {
    min-width: 160px;
  }
  
  .nav-btn {
    padding: var(--space-2) var(--space-3);
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .nav-bar {
    height: 46px;
    padding: var(--space-2) 0;
  }
  
  .nav-content {
    padding: 0 var(--space-3);
  }
  
  .nav-left {
    gap: 8px;
  }
  
  .logo-image {
    height: 38px;
  }
  
  .logo-text {
    font-size: 1.2rem;
  }
  
  .nav-center {
    margin: 0 5px;
  }
  
  .main-nav {
    gap: 2px;
  }
  
  .nav-menu-item {
    padding: 8px 12px;
    font-size: 1rem;
  }

  .nav-right {
    gap: 8px;
  }
  
  .user-btn {
    padding: 8px 14px;
    font-size: 1rem;
    min-width: 130px;
    gap: 8px;
  }

  .user-avatar {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .user-name {
    font-size: 0.95rem;
  }

  .nav-placeholder {
    min-width: 120px;
    height: 36px;
  }

  .placeholder-content {
    padding: 8px 12px;
  }

  .placeholder-text {
    font-size: 0.75rem;
  }
  
  .dropdown-menu {
    min-width: 140px;
  }
  
  .nav-btn {
    padding: var(--space-1) var(--space-2);
    font-size: 0.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

*:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* 等级切换提示弹窗样式 */
.level-toast {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  pointer-events: none;
}

.toast-content {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  padding: 16px 28px;
  border-radius: 16px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.2rem;
  font-weight: 900;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.toast-icon {
  font-size: 1.4rem;
  font-weight: 900;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.toast-text {
  color: #ffffff;
  font-weight: 600;
}

/* 弹窗淡入淡出动画 */
.toast-fade-enter-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-fade-enter-to {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-fade-leave-active {
  transition: opacity 0.3s ease-in, transform 0.3s ease-in;
}

.toast-fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

@media (max-width: 768px) {
  .level-toast {
    top: 80px;
  }
  
  .toast-content {
    padding: 14px 24px;
    font-size: 1.1rem;
  }
  
  .toast-icon {
    width: 28px;
    height: 28px;
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .level-toast {
    top: 70px;
  }
  
  .toast-content {
    padding: 12px 20px;
    font-size: 1rem;
    gap: 10px;
  }
  
  .toast-icon {
    width: 26px;
    height: 26px;
    font-size: 1.1rem;
  }
}
</style>

