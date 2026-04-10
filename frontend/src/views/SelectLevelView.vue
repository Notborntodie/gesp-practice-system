<template>
  <div class="level-exams-container">
    <div class="level-exams-header">
      
      <!-- 等级选择器 -->
      <div class="level-selector">
        <div class="selector-tabs">
          <div 
            v-for="level in levels" 
            :key="level"
            class="level-tab"
            :class="{ 
              'active': selectedLevel === level,
              'disabled': isLevelDisabled(level)
            }"
            @click="!isLevelDisabled(level) && selectLevel(level)"
          >
            <span class="level-number">{{ level }}</span>
            <span class="level-label">级</span>
          </div>
        </div>
        <div class="selector-underline"></div>
      </div>
    </div>

    <div class="level-exams-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载等级列表...</p>
      </div>
      
      <div v-else-if="levels.length === 0" class="empty-state">
        <div class="empty-icon"><Icon name="book-open" :size="80" /></div>
        <h3>暂无等级</h3>
        <p>暂时没有可用的等级</p>
      </div>
      
             <div v-else class="exam-detail-layout">
         <!-- 等级详情卡片 -->
         <div class="exam-detail-section">
           <div v-if="selectedLevel" class="selected-exam-card" :class="{ 'breathing': isBreathing }" @click="enterLevel(selectedLevel)">
             <div class="selected-exam-header">
               <div class="exam-info">
                 <h3 class="exam-name">{{ getLevelText(selectedLevel) }}</h3>
               </div>
               <div class="exam-actions-header">
                 <div class="enter-level-hint-header">
                   <span class="hint-text">点击卡片进入等级</span>
                   <span class="hint-text-short">进入等级</span>
                   <Icon name="arrow-right" :size="20" class="hint-icon" />
                 </div>
               </div>
             </div>
             
             <div class="selected-exam-content">
               <div class="exam-stats">
                 <div class="stat-item knowledge-content">
                   <span class="stat-label">知识内容（C++）</span>
                   <span class="stat-value">{{ getKnowledgeContent(selectedLevel) }}</span>
                 </div>
                 <div class="stat-item knowledge-goal">
                   <span class="stat-label">知识目标</span>
                   <span class="stat-value">{{ getKnowledgeGoal(selectedLevel) }}</span>
                 </div>
               </div>
             </div>
             
           </div>
           
           <div v-else class="no-selection-placeholder">
             <div class="placeholder-icon"><Icon name="book-open" :size="80" /></div>
             <h3>选择等级</h3>
             <p>点击上方的等级标签开始</p>
           </div>
         </div>

       </div>
    </div>

    
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'

const router = useRouter()

// 数据状态
const levels = ref([1, 2, 3, 4, 5, 6, 7, 8])
const loading = ref(false)
const selectedLevel = ref<number | null>(null)

// 呼吸动画状态
const isBreathing = ref(false)

// NavBar级别锁定状态
const navBarLevelLocked = ref(false)
const navBarSelectedLevel = ref<number | null>(null)

// 检查NavBar级别锁定状态
function checkNavBarLevelLock() {
  const isLocked = localStorage.getItem('navBarLevelLocked') === 'true'
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  
  if (isLocked && isLoggedIn) {
    const savedLevel = localStorage.getItem('userGespLevel')
    if (savedLevel) {
      const level = parseInt(savedLevel, 10)
      if (level >= 1 && level <= 8) {
        navBarLevelLocked.value = true
        navBarSelectedLevel.value = level
        return
      }
    }
  }
  
  navBarLevelLocked.value = false
  navBarSelectedLevel.value = null
}

// 检查级别是否被禁用
function isLevelDisabled(level: number): boolean {
  if (!navBarLevelLocked.value || navBarSelectedLevel.value === null) {
    return false
  }
  return level !== navBarSelectedLevel.value
}



// 获取等级列表
async function fetchLevels() {
  loading.value = true
  try {
    // 模拟加载
    await new Promise(resolve => setTimeout(resolve, 500))
    // 从localStorage读取用户设置的级别，如果没有则默认选择第一个等级
    const savedLevel = localStorage.getItem('userGespLevel')
    if (savedLevel) {
      const level = parseInt(savedLevel, 10)
      if (level >= 1 && level <= 8 && levels.value.includes(level)) {
        selectedLevel.value = level
      } else if (levels.value.length > 0) {
        selectedLevel.value = levels.value[0]
      }
    } else if (levels.value.length > 0) {
      selectedLevel.value = levels.value[0]
    }
  } catch (error: any) {
    console.error('获取等级列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 监听级别变化事件（从NavBar触发）
function handleGespLevelChanged(event: CustomEvent) {
  const newLevel = event.detail.level
  if (newLevel >= 1 && newLevel <= 8 && levels.value.includes(newLevel)) {
    selectedLevel.value = newLevel
    // 更新NavBar级别锁定状态
    checkNavBarLevelLock()
    // 触发呼吸动画
    isBreathing.value = true
    setTimeout(() => {
      isBreathing.value = false
    }, 6000)
  }
}

// 选择等级
function selectLevel(level: number) {
  // 如果NavBar级别已锁定，且选择的级别不是NavBar选中的级别，则不允许选择
  if (navBarLevelLocked.value && navBarSelectedLevel.value !== null && level !== navBarSelectedLevel.value) {
    return
  }
  
  selectedLevel.value = level
  // 保存级别到localStorage
  localStorage.setItem('userGespLevel', level.toString())
  // 注意：不清除NavBar级别锁定，保持锁定状态
  // 触发自定义事件，通知NavBar级别已更改
  window.dispatchEvent(new CustomEvent('gespLevelChanged', { detail: { level } }))
  
  // 触发呼吸动画
  isBreathing.value = true
  
  // 6秒后停止呼吸动画
  setTimeout(() => {
    isBreathing.value = false
  }, 6000)
}

// 等级文本
function getLevelText(level: number) {
  return `GESP ${level}级`
}

// 获取题目数量
function getQuestionCount(level: number) {
  const questionCounts: { [key: number]: number } = {
    1: 50, 2: 60, 3: 70, 4: 80, 5: 100, 6: 120, 7: 150, 8: 200
  }
  return questionCounts[level] || 50
}

// 获取难度等级
function getDifficulty(level: number) {
  if (level <= 2) return '简单'
  if (level <= 5) return '中等'
  return '困难'
}

// 获取目标人群
function getTargetAudience(level: number) {
  if (level <= 3) return '初学者'
  if (level <= 8) return '进阶者'
  return '高级者'
}

// 获取预计时间
function getEstimatedTime(level: number) {
  if (level <= 3) return '30分钟'
  if (level <= 8) return '45分钟'
  return '60分钟'
}

// 获取等级描述
function getLevelDescription(level: number) {
  const descriptions: { [key: number]: string } = {
    1: 'GESP 1级适合编程初学者，涵盖基础语法和简单算法概念。',
    2: 'GESP 2级进一步巩固基础，引入更多编程思维训练。',
    3: 'GESP 3级开始涉及中等难度的算法和数据结构。',
    4: 'GESP 4级包含更复杂的编程技巧和算法应用。',
    5: 'GESP 5级适合有一定基础的学员，涵盖高级编程概念。',
    6: 'GESP 6级包含高级算法和复杂问题解决技巧。',
    7: 'GESP 7级涵盖更深入的编程技术和算法优化。',
    8: 'GESP 8级是最高级别，涵盖最前沿的编程技术。'
  }
  return descriptions[level] || '该等级适合对应水平的学员进行练习。'
}

// 获取知识内容
function getKnowledgeContent(level: number) {
  const contents: { [key: number]: string } = {
    1: '计算机基础与编程环境 • 计算机历史 • 变量的定义与使用 • 基本数据类型（整型、浮点型、字符型、布尔型） • 控制语句结构（顺序、循环、选择） • 基本运算（算术运算、关系运算、逻辑运算） • 输入输出语句',
    2: '计算机的存储与网络 • 程序设计语言的特点 • 流程图的概念与描述 • ASCII 编码 • 数据类型的转换 • 多层分支/循环结构 • 常用数学函数（绝对值函数、平方根函数、max 函数、min 函数）',
    3: '数据编码（原码、反码、补码） • 进制转换（二进制、八进制、十进制、十六进制） • 位运算（与（&）、或（|）、非（~）、异或（^）、左移（<<）、右移(>>)） • 算法的概念与描述（自然语言描述、流程图描述、伪代码描述） • C++一维数组基本应用 • 字符串及其函数 • 算法：枚举法 • 算法：模拟法',
    4: '函数的定义与调用 • 形参与实参、作用域 • C++指针类型的概念及基本应用 • 函数参数传递的概念（C++值传递、引用传递、指针传递） • C++结构体 • C++二维数组与多维数组基本应用• 算法：递推 • 算法：排序概念和稳定性 • 算法：排序算法（冒泡排序、插入排序、选择排序） • 简单算法复杂度的估算（含多项式、指数复杂度） • 文件重定向与文件读写操作 • 异常处理',
    5: '初等数论 • （C++）数组模拟高精度加法、减法、乘法、除法 • 单链表、双链表、循环链表 • 辗转相除法（也称欧几里得算法）素数表的埃氏筛法和线性筛法 • 唯一分解定理 • 二分查找/二分答案（也称二分枚举法） • 贪心算法 • 分治算法（归并排序和快速排序） • 递归 • 算法复杂度的估算（含多项式、指数、对数复杂度）',
    6: '待补充',
    7: '待补充',
    8: '待补充'
  }
  return contents[level] || '知识内容待补充'
}

// 获取知识目标
function getKnowledgeGoal(level: number) {
  const goals: { [key: number]: string } = {
    1: '掌握顺序、循环、分支的简单程序结构，可以使用集成开发环境进行编程与调试，通过编程基础知识的学习，完成单一功能的程序设计。',
    2: '掌握程序基本设计，能够使用简单数学函数。可以独立完成包含分支语句、循环语句等比较综合的案例，可以使用分支循环嵌套结构。',
    3: '掌握数据编码、进制转换、位运算等知识，掌握一维数组、字符串及函数的使用，能够独立使用模拟法、枚举法解决对应的算法问题。',
    4: '掌握函数的定义、调用及函数参数传递的方法；掌握二维数组与多维数组的使用技巧；掌握常用排序算法、文件读写和异常处理的使用。能够解决递推相关问题。',
    5: '掌握初等数论，线性表的知识，二分法、分治法、贪心法的思想，完成指定功能的程序。C++掌握数组模拟高精度的运算。',
    6: '待补充',
    7: '待补充',
    8: '待补充'
  }
  return goals[level] || '知识目标待补充'
}

// 直接进入等级
function enterLevel(level: number) {
  router.push(`/level-exams/${level}`)
}



onMounted(() => {
  fetchLevels()
  // 检查NavBar级别锁定状态
  checkNavBarLevelLock()
  // 监听级别变化事件
  window.addEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('gespLevelChanged', handleGespLevelChanged as EventListener)
})
</script>

<style scoped>
.level-exams-container {
  width: 100vw;
  min-height: 100vh;
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  overflow-x: hidden;
}

.level-exams-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 30px;
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  border-bottom: 2px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  position: fixed;
  top: 48px; /* NavBar 的高度 */
  left: 0;
  right: 0;
  z-index: 999;
  backdrop-filter: blur(10px);
  background: linear-gradient(135deg, rgba(135, 206, 235, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
  width: 100%;
  gap: 2px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.level-exams-header h2 {
  margin: 0;
  color: #1e90ff;
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
}

.exam-count {
  color: #64748b;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  margin: 0;
  color: #1e293b;
  font-weight: 700;
  font-size: 1.8rem;
  letter-spacing: 0.01em;
  font-family: 'SF Pro Display', 'Inter', 'Segoe UI', 'Roboto', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: left;
  line-height: 1.3;
  position: relative;
  padding-left: 0;
  margin-left: 0;
}

.exam-count {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

/* 等级选择器样式 */
.level-selector {
  margin-top: 4px;
  width: 100%;
}

.selector-tabs {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  position: relative;
}

.level-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  position: relative;
}

.level-tab:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: #1e90ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.2);
}

.level-tab.active {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-color: #1e90ff;
  color: white;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.level-tab.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  background: rgba(200, 200, 200, 0.5);
}

.level-tab.disabled:hover {
  background: rgba(200, 200, 200, 0.5);
  border-color: transparent;
  transform: none;
  box-shadow: none;
}

.level-number {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.level-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.selector-underline {
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, #1e90ff 50%, transparent 100%);
  margin-top: 16px;
  border-radius: 2px;
  opacity: 0.6;
}

.level-exams-content {
  flex: 1;
  padding: 24px 32px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  margin-top: 80px; /* 为固定的header留出空间：60px(NavBar) + 20px(header) */
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #64748b;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #1e90ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1e90ff;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 24px 0;
  color: #64748b;
  font-size: 16px;
}

/* 等级详情布局 */
.exam-detail-layout {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 40px;
}

/* 等级详情卡片 */
.exam-detail-section {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 48px;
}

.selected-exam-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(30,144,255,0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 400px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.selected-exam-card.breathing {
  animation: breathe 2s ease-in-out infinite;
}

.selected-exam-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 32px 80px rgba(30,144,255,0.25);
  border-color: #1e90ff;
  animation: none;
}

/* 呼吸动画 */
@keyframes breathe {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.selected-exam-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 36px;
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  border-bottom: 2px solid #b6e0fe;
  flex-shrink: 0;
  gap: 20px;
}

.exam-name {
  margin: 0;
  color: white;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.exam-actions-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.enter-level-hint-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  cursor: pointer;
}

.enter-level-hint-header:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.enter-level-hint-header .hint-text {
  display: block;
}

.enter-level-hint-header .hint-text-short {
  display: none;
}

.enter-level-hint-header .hint-icon {
  font-size: 18px;
  font-weight: bold;
  transition: transform 0.3s ease;
}

.enter-level-hint-header:hover .hint-icon {
  transform: translateX(4px);
}



.exam-status {
  display: flex;
  align-items: center;
}

.status-indicator {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}

.selected-exam-content {
  padding: 32px 36px 40px 36px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.exam-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px 24px;
  background: #f8fafc;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  gap: 12px;
}

.stat-item:hover {
  background: #f1f5f9;
  border-color: #1e90ff;
}

.stat-label {
  color: #64748b;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-value {
  color: #1e293b;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  text-align: left;
}

.knowledge-content .stat-value {
  max-height: 280px;
  overflow-y: auto;
}

/* 圆圈标记样式 */
.knowledge-content .stat-value {
  position: relative;
}

.knowledge-content .stat-value::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 8px;
  width: 4px;
  height: 4px;
  background: #1e90ff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(30, 144, 255, 0.2);
}

.knowledge-goal .stat-value {
  max-height: 200px;
  overflow-y: auto;
}


/* 未选择状态占位符 */
.no-selection-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 600px;
  background: white;
  border: 2px dashed #e2e8f0;
  border-radius: 24px;
  color: #64748b;
  text-align: center;
}

.placeholder-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.6;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1e90ff;
}

.no-selection-placeholder h3 {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
}

.no-selection-placeholder p {
  margin: 0;
  font-size: 18px;
}




.card-footer {
  padding: 24px 28px;
  background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
  border-top: 1px solid #b6e0fe;
  display: flex;
  justify-content: flex-end;
}

.level-identifier {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

/* 按钮样式 */
.btn {
  flex: 1;
  padding: 18px 24px;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(107,114,128,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30,144,255,0.3);
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .exam-detail-layout {
    padding: 0 20px;
  }
  
  .selected-exam-card {
    min-height: 350px;
  }
}

@media (max-width: 1200px) {
  .exam-detail-layout {
    padding: 0 20px;
  }
  
  .exam-detail-section {
    max-width: 700px;
  }
}

@media (max-width: 768px) {
  .level-exams-header {
    padding: 3px 20px;
  }
  
  .level-exams-header h2 {
    font-size: 1.5rem;
  }
  
  .exam-count {
    font-size: 0.9rem;
  }
  
  .level-exams-content {
    margin-top: 65px;
    padding: 20px 16px;
  }

  .exam-detail-layout {
    gap: 20px;
    padding: 0 16px;
  }

  .exam-detail-section {
    padding-top: 30px;
  }

  .selected-exam-card {
    min-height: 300px;
  }

  .selected-exam-header {
    padding: 24px 28px;
    flex-direction: column;
    gap: 16px;
  }

  .enter-level-hint-header {
    padding: 10px 16px;
    font-size: 14px;
  }

  .enter-level-hint-header .hint-text {
    display: none;
  }

  .enter-level-hint-header .hint-text-short {
    display: block;
  }

  .selected-exam-content {
    padding: 24px 28px 32px 28px;
  }


  .exam-stats {
    grid-template-columns: 1fr;
  }
  
  .exam-name {
    font-size: 24px;
  }

  .level-selector {
    margin-top: 2px;
  }

  .selector-tabs {
    gap: 12px;
  }

  .level-tab {
    padding: 10px 16px;
  }

  .level-number {
    font-size: 16px;
  }

  .level-label {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .level-exams-header {
    padding: 2px 16px;
  }
  
  .level-exams-header h2 {
    font-size: 1.3rem;
  }
  
  .exam-count {
    font-size: 0.85rem;
  }

  .level-exams-content {
    margin-top: 48px;
    padding: 16px;
  }

  .selected-exam-card {
    min-height: 280px;
  }

  .enter-level-hint-header {
    padding: 8px 12px;
    font-size: 13px;
  }

  .level-selector {
    margin-top: 1px;
  }

  .exam-detail-section {
    padding-top: 25px;
  }

  .selector-tabs {
    gap: 8px;
  }

  .level-tab {
    padding: 8px 12px;
  }

  .level-number {
    font-size: 14px;
  }

  .level-label {
    font-size: 11px;
  }
  
  .exam-name {
    font-size: 20px;
  }
}

@media (max-width: 360px) {
  .enter-level-hint-header {
    padding: 6px 10px;
    font-size: 12px;
  }

  .level-selector {
    margin-top: 0px;
  }

  .exam-detail-section {
    padding-top: 20px;
  }

  .selector-tabs {
    gap: 6px;
  }

  .level-tab {
    padding: 6px 10px;
  }

  .level-number {
    font-size: 13px;
  }

  .level-label {
    font-size: 10px;
  }
}
</style>
