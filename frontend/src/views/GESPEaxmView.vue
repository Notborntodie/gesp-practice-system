<template>
  <!-- 全页面加载界面 -->
  <div v-if="loading" class="loading-overlay">
    <div class="loading-container">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <div class="loading-text">
        <h2>练习加载中</h2>
        <p>正在准备练习内容，请稍候...</p>
      </div>
    </div>
  </div>

  <div v-else class="exam-layout">
    <div class="exam-content exam-content-flex-row">
      <!-- 新的 exam 卡片容器，占屏幕70% -->
      <div class="exam-card-wrapper">
        <!-- 第一层级：考试级别头部 -->
        <div class="exam-level-header">
          <div class="exam-level-header-content">
            <!-- 考试标题 -->
            <div class="exam-title-section">
              <h2 class="exam-title">{{ examInfo.name || 'GESP 考试' }}</h2>
              <span class="exam-level-badge" v-if="examInfo.category === 'GESP' || !examInfo.category">GESP {{ examInfo.level || 1 }}级</span>
              <span class="exam-category-badge" :class="'category-' + (examInfo.category || 'GESP').toLowerCase()">
                {{ getCategoryText(examInfo.category) }}
              </span>
              <!-- 自由练习状态标识 -->
              <span class="submission-mode-badge free-practice-badge" title="自由练习模式，可以随时练习">
                <Icon name="zap" :size="14" />
                <span>自由练习</span>
              </span>
            </div>
            
            <!-- 进度信息 - 可点击图标 -->
            <div class="exam-progress-section">
              <button class="progress-icon-btn" @click="showProgressModal = true" title="查看进度">
                <Icon name="bar-chart-3" :size="20" />
                <span class="progress-text">进度</span>
                <span class="progress-badge">{{ answeredCount }}/{{ questions.length }}</span>
              </button>
            </div>
            
            <!-- 提交按钮和模式指示器 -->
            <div class="exam-actions-section">
              <button 
                v-if="practiceMode === 'exam'"
                class="btn btn-primary submit-btn-header" 
                @click="submitAnswers" 
                :disabled="loading || questions.length === 0 || submitting"
                :class="{ 'btn-loading': submitting }"
              >
                <span v-if="!submitting" class="btn-content">
                  <Icon name="rocket" :size="16" />
                  <span>提交答题</span>
                </span>
                <span v-else class="btn-content">
                  <Icon name="loader-2" :size="16" spin />
                  <span>提交中...</span>
                </span>
              </button>
              <div v-else class="mode-indicator">
                <div class="review-mode-container">
                  <span class="review-mode-text">{{ getModeText(practiceMode) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 第二层级：题目内容 -->
        <div class="question-content-wrapper">
          <div class="question-main">
            <!-- 左侧切换箭头 -->
            <button 
              class="question-nav-arrow question-nav-arrow-left" 
              @click="prevQuestion" 
              :disabled="currentQuestionIndex === 0"
              title="上一题"
            >
              <Icon name="arrow-left" :size="32" />
            </button>
            
            <transition name="fade-slide" mode="out-in">
              <div v-if="questions.length > 0" :key="currentQuestionIndex" class="question-card">
            <div class="question-card-header">
              <div class="question-number">
                <span class="number-badge">{{ currentQuestionIndex + 1 }}</span>
                <span class="level-badge" v-if="examInfo.category === 'GESP' || !examInfo.category">GESP {{ currentQuestion.level }}级</span>
                <span class="question-date" v-if="currentQuestion.question_date">
                  <Icon name="calendar" :size="16" />
                  <span>{{ formatDate(currentQuestion.question_date) }}</span>
                </span>
              </div>
              <div :class="answers[currentQuestionIndex] ? 'status-answered' : 'status-unanswered'">
                {{ answers[currentQuestionIndex] ? '已回答' : '未作答' }}
              </div>
            </div>
            
            <!-- 统一的内容滚动区域 - 左右分栏 -->
            <div class="question-content-unified">
              <!-- 左侧：题目内容、图片、代码 -->
              <div class="question-left-panel">
                <!-- 题目文本 -->
                <div class="content-section question-text-section">
                  <div class="section-content">
                    <p class="question-text">{{ currentQuestion.question_text }}</p>
                  </div>
                </div>
                
                <!-- 题目图片显示 -->
                <div v-if="(currentQuestion.images && currentQuestion.images.length > 0) || (currentQuestion.image_url && currentQuestion.image_url.trim())" 
                     class="content-section images-section">
                  <div class="section-content">
                    <div class="images-grid">
                      <!-- 显示题目主图片 -->
                      <div 
                        v-if="currentQuestion.image_url && currentQuestion.image_url.trim()"
                        class="image-item"
                        @click="openImageModal(currentQuestion.image_url)"
                      >
                        <img 
                          :src="getImageUrl(currentQuestion.image_url)" 
                          :alt="`题目图片`"
                          class="question-image"
                          @error="handleImageError($event)"
                          @load="handleImageLoad($event)"
                        />
                      </div>
                      <!-- 显示附加图片 -->
                      <template v-for="(image, index) in (currentQuestion.images || [])" :key="`image-${index}`">
                        <div 
                          v-if="image && image.image_url && image.image_url.trim()"
                          class="image-item"
                          @click="openImageModal(image.image_url)"
                        >
                          <img 
                            :src="getImageUrl(image.image_url)" 
                            :alt="`附加图片 ${index + 1}`"
                            class="question-image"
                            @error="handleImageError($event)"
                            @load="handleImageLoad($event)"
                          />
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
                
                <!-- 代码题目显示 -->
                <div v-if="currentQuestion.question_type === 'code'" class="content-section code-section">
                  <div class="section-content">
                    <pre v-if="currentQuestion.question_code" v-highlight class="code-block"><code class="language-cpp">{{ currentQuestion.question_code }}</code></pre>
                    <div v-else class="code-placeholder">
                      <Icon name="info" :size="20" />
                      <p>暂无代码内容</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 右侧：选项部分 -->
              <div class="question-right-panel">
                <div class="content-section options-section">
                  <div class="section-content">
                    <div class="options-list">
                      <label 
                        v-for="option in currentQuestion.options" 
                        :key="option.label || option.option_label" 
                        class="option-item"
                        :class="{ 'option-selected': answers[currentQuestionIndex] === (option.value || option.option_value) }"
                        @click="selectOption((option.value || option.option_value) || '')"
                      >
                        <span class="option-label">{{ option.label || option.option_label }}.</span>
                        <div class="option-content">
                          <div v-if="(option.text || option.option_text) && (option.text || option.option_text || '').includes('\n')" v-highlight class="option-code-block">
                            <pre><code>{{ option.text || option.option_text }}</code></pre>
                          </div>
                          <span v-else class="option-text">{{ option.text || option.option_text }}</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
        
        <!-- 右侧切换箭头 -->
        <button 
          class="question-nav-arrow question-nav-arrow-right" 
          @click="nextQuestion" 
          :disabled="currentQuestionIndex === questions.length - 1"
          title="下一题"
        >
          <Icon name="arrow-right" :size="32" />
        </button>
          </div>
          
          <!-- 右侧解析栏 -->
          <div v-if="practiceMode === 'review'" class="sidebar-explanation">   
            <div class="question-explanation">
              <transition name="explanation-slide" mode="out-in">
                <div v-show="showExplain" class="explanation-content" key="explanation">
                  <p>{{ currentQuestion.explanation }}</p>
                </div>
              </transition>
            </div>
          </div>
          
          <!-- 考试模式和课堂模式下的右侧占位区域 -->
          <div v-if="practiceMode === 'exam' || practiceMode === 'classroom'" class="sidebar-placeholder">
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 浮动题目解析按钮 -->
  <div v-if="practiceMode === 'review'" class="floating-ai-button">
    <button class="ai-button" @click="toggleAIPanel">
      <span class="ai-button-text">题目解析</span>
      <Icon name="lightbulb" :size="20" />
    </button>
  </div>

  <!-- 题目解析面板 -->
  <transition name="fade">
    <div v-if="showAIPanel" class="ai-panel">
      <div class="ai-panel-header">
        <h3>题目解析</h3>
        <button class="ai-close-btn" @click="toggleAIPanel">
          <Icon name="x" :size="18" />
        </button>
      </div>
      <div class="ai-panel-content">
        <div v-if="loading" class="ai-placeholder">
          <Icon name="loader-2" :size="20" spin class="ai-placeholder-icon" />
          正在加载解析...
        </div>
        <div v-else-if="currentQuestion.explanation">
          <div class="ai-response-header">
            <Icon name="lightbulb" :size="20" />
            题目解析
          </div>
          <div class="explanation-content">
            <p>{{ currentQuestion.explanation }}</p>
          </div>
        </div>
        <div v-else class="ai-placeholder">
          <Icon name="info" :size="20" class="ai-placeholder-icon" />
          该题目暂无解析内容
        </div>
      </div>
    </div>
  </transition>
  
  <!-- 图片模态框 -->
  <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
    <div class="image-modal-content" @click.stop>
      <button @click="closeImageModal" class="image-modal-close">×</button>
      <img :src="getImageUrl(selectedImageUrl)" alt="题目图片" class="modal-image" @error="handleImageError($event)" />
    </div>
  </div>

  <!-- 提交结果弹窗 -->
  <div v-if="showSubmitResult" class="submit-result-modal-overlay" @click="showSubmitResult = false">
    <div class="submit-result-modal-content" @click.stop>
      <div class="submit-result-header">
        <h3>{{ testAttemptId ? '客观题已提交' : '考试提交成功！' }}</h3>
        <button @click="showSubmitResult = false" class="submit-result-close">×</button>
      </div>
      <div class="submit-result-body">
        <template v-if="testAttemptId">
          <p class="test-submit-hint">本次作答已记录，交卷时将按最后一次提交计分。请返回 Test 页面继续作答或交卷。</p>
        </template>
        <template v-else>
          <div class="result-summary">
            <div class="score-section">
              <div class="score-circle">
                <span class="score-number">{{ submitResult?.score || 0 }}</span>
                <span class="score-label">分</span>
              </div>
              <div class="score-info">
                <p class="exam-name">{{ examInfo.name }}</p>
                <p class="attempt-info">第 {{ submitResult?.attempt_number || 1 }} 次尝试</p>
              </div>
            </div>
            
            <div class="result-details">
              <div class="detail-item">
                <span class="detail-label">总题数:</span>
                <span class="detail-value">{{ submitResult?.total_questions || 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">正确题数:</span>
                <span class="detail-value correct">{{ submitResult?.correct_count || 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">错误题数:</span>
                <span class="detail-value incorrect">{{ (submitResult?.total_questions || 0) - (submitResult?.correct_count || 0) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">正确率:</span>
                <span class="detail-value">{{ submitResult?.total_questions ? Math.round((submitResult.correct_count / submitResult.total_questions) * 100) : 0 }}%</span>
              </div>
            </div>
          </div>
          
          <div class="result-message">
            <p v-if="submitResult?.score >= 90" class="message excellent">
              <Icon name="sparkles" :size="18" /> 优秀！你的表现非常出色！
            </p>
            <p v-else-if="submitResult?.score >= 80" class="message good">
              <Icon name="thumbs-up" :size="18" /> 良好！继续保持！
            </p>
            <p v-else-if="submitResult?.score >= 60" class="message pass">
              <Icon name="check-circle" :size="18" /> 及格！还有提升空间。
            </p>
            <p v-else class="message need-improvement">
              <Icon name="trending-up" :size="18" /> 需要努力！建议多练习相关知识点。
            </p>
          </div>
        </template>
      </div>
      <div class="submit-result-footer">
        <button v-if="testAttemptId" @click="showSubmitResult = false" class="btn btn-primary">关闭</button>
        <button v-else @click="goBackToLevelExams" class="btn btn-primary">返回考试列表</button>
      </div>
    </div>
  </div>

  <!-- 退出确认弹窗 -->
  <div v-if="showExitConfirmDialog" class="exit-confirm-modal-overlay" @click="cancelExit">
    <div class="exit-confirm-modal-content" @click.stop>
      <div class="exit-confirm-header">
        <h3>确认退出练习</h3>
        <button @click="cancelExit" class="exit-confirm-close">×</button>
      </div>
      <div class="exit-confirm-body">
        <div class="exit-confirm-icon"><Icon name="alert-triangle" :size="48" /></div>
        <p class="exit-confirm-message">
          您确定要退出当前练习吗？<br>
          <span class="exit-confirm-warning">未完成的答题进度将会丢失！</span>
        </p>
        <div class="exit-confirm-info">
          <div class="info-item">
            <span class="info-label">已答题数:</span>
            <span class="info-value">{{ answeredCount }}/{{ questions.length }}</span>
          </div>
          <div class="info-label">当前模式:</div>
          <span class="info-value">{{ getModeText(practiceMode) }}</span>
        </div>
      </div>
      <div class="exit-confirm-footer">
        
        <button @click="confirmExit" class="btn btn-danger">
          确认退出
        </button>
      </div>
    </div>
  </div>

  <!-- 进度弹窗 -->
  <div v-if="showProgressModal" class="progress-modal-overlay" @click="showProgressModal = false">
    <div class="progress-modal-content" @click.stop>
      <div class="progress-modal-header">
        <h3>答题进度</h3>
        <button @click="showProgressModal = false" class="progress-modal-close">
          <Icon name="x" :size="18" />
        </button>
      </div>
      <div class="progress-modal-body">
        <div class="progress-summary">
          <div class="summary-item">
            <span class="summary-label">总题数:</span>
            <span class="summary-value">{{ questions.length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">已答题:</span>
            <span class="summary-value answered">{{ answeredCount }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">未答题:</span>
            <span class="summary-value unanswered">{{ questions.length - answeredCount }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">完成度:</span>
            <span class="summary-value">{{ Math.round(progressPercentage) }}%</span>
          </div>
        </div>
        <div class="progress-bar-full">
          <div class="progress-fill-full" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <div class="questions-grid">
          <div 
            v-for="(question, index) in questions" 
            :key="index"
            class="question-item"
            :class="{
              'question-item--active': index === currentQuestionIndex,
              'question-item--answered': answers[index],
              'question-item--unanswered': !answers[index]
            }"
            @click="handleQuestionClick(index)"
          >
            <span class="question-item-number">{{ index + 1 }}</span>
            <Icon 
              v-if="answers[index]" 
              name="check-circle" 
              :size="14" 
              class="question-item-icon"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 提示弹窗 -->
  <div v-if="showAlertDialog" class="alert-modal-overlay" @click="closeAlertDialog">
    <div class="alert-modal-content" @click.stop>
      <div class="alert-modal-header">
        <h3>{{ alertTitle }}</h3>
        <button @click="closeAlertDialog" class="alert-modal-close">×</button>
      </div>
      <div class="alert-modal-body">
        <div class="alert-icon">⚠️</div>
        <p class="alert-message">{{ alertMessage }}</p>
      </div>
      <div class="alert-modal-footer">
        <button @click="closeAlertDialog" class="btn btn-primary">
          好吧，知道了
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">import { BASE_URL, API_SERVER_BASE, normalizeImageUrl } from '@/config/api'

import { defineComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useQuestionTypeStore } from '@/stores/questionTypeStore'
// 导入 highlight.js 库和样式
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

// 定义接口类型
interface Option {
  label?: string;
  value?: string;
  text?: string;
  option_label?: string;
  option_value?: string;
  option_text?: string;
}

interface Question {
  id: number;
  exam_id: number;
  question_number: number;
  question_text: string;
  question_type: string;
  question_code?: string;
  correct_answer: string;
  explanation: string;
  level: number;
  difficulty: string;
  image_url?: string;
  created_at: string;
  question_date?: string; // 新增题目日期字段
  options: Option[];
  images?: { image_url: string }[]; // 新增图片属性
}

interface ExamInfo {
  id: number;
  name: string;
  level: number;
  category: string;
  description: string;
  total_questions: number;
}

export default defineComponent({
  name: 'PracticeView',
  directives: {
    // 自定义指令：代码高亮 - 统一使用 C++ 渲染
    highlight: {
      mounted(el: HTMLElement) {
        // 当元素挂载到 DOM 后立即执行高亮
        const codeElements = el.querySelectorAll('code');
        codeElements.forEach((codeEl: Element) => {
          const codeElement = codeEl as HTMLElement;
          if (codeElement.textContent) {
            try {
              // 统一使用 C++ 语言高亮
              const result = hljs.highlight(codeElement.textContent, { 
                language: 'cpp',
                ignoreIllegals: true 
              });
              codeElement.innerHTML = result.value;
              codeElement.className = 'hljs language-cpp';
              console.log('✅ C++ 高亮成功');
            } catch (error) {
              console.error('❌ C++ 高亮失败:', error);
            }
          }
        });
      },
      updated(el: HTMLElement) {
        // 当元素更新时重新执行高亮
        const codeElements = el.querySelectorAll('code');
        codeElements.forEach((codeEl: Element) => {
          const codeElement = codeEl as HTMLElement;
          if (codeElement.textContent && !codeElement.classList.contains('hljs')) {
            try {
              // 统一使用 C++ 语言高亮
              const result = hljs.highlight(codeElement.textContent, { 
                language: 'cpp',
                ignoreIllegals: true 
              });
              codeElement.innerHTML = result.value;
              codeElement.className = 'hljs language-cpp';
              console.log('✅ C++ 高亮更新成功');
            } catch (error) {
              console.error('❌ C++ 高亮更新失败:', error);
            }
          }
        });
      }
    }
  },
  components: {
    Icon
  },
  data() {
    const router = useRouter();
    return {
      questionTypeStore: useQuestionTypeStore(),
      BASE_URL: `${BASE_URL}`,
      EXAM_ID: null as number | null,
      loading: true,
      error: null as string | null,
      examInfo: {} as ExamInfo,
      questions: [] as Question[],
      answers: [] as string[],
      currentQuestionIndex: 0, // 当前题目索引
      showExplain: false, // 控制解析是否展开
      highlightUnanswered: false, // 控制未答题高亮
      // 题目解析相关
      showAIPanel: false,
      // 新增图片模态框相关
      showImageModal: false,
      selectedImageUrl: '',
      // 提交相关状态
      submitting: false,
      showSubmitResult: false,
      submitResult: null as any,
      userInfo: null as any,
      router: router,
      // 模式相关状态
      practiceMode: 'exam', // 'exam' 或 'review'
      showExplanation: false, // 复习模式下是否显示解析
      // 退出确认相关状态
      showExitConfirmDialog: false,
      // 提示弹窗相关状态
      showAlertDialog: false,
      alertMessage: '',
      alertTitle: '',
      // 进度弹窗状态
      showProgressModal: false,
      // 浏览器事件处理器引用
      beforeUnloadHandler: null as ((event: BeforeUnloadEvent) => void) | null,
      popStateHandler: null as ((event: PopStateEvent) => void) | null,
      keyboardHandler: null as ((event: KeyboardEvent) => void) | null,
      // 题目导航分页
      currentQuestionPage: 0,
      questionsPerPage: 5,
      // 来源信息
      fromPlan: false,
      fromTaskView: false,
      planId: null as string | null,
      taskId: null as string | null,
      // 聚合考试 attempt（从 /exam/:id?testAttemptId= 进入时使用 Test 提交接口）
      testAttemptId: null as string | null
    };
  },
  computed: {
    progressPercentage() {
      const answeredCount = this.answeredCount;
      return this.questions.length > 0 ? (answeredCount / this.questions.length) * 100 : 0;
    },
    answeredCount() {
      return this.answers.filter(answer => answer !== null && answer !== undefined && answer !== '').length;
    },
    currentQuestion(): Question {
      return this.questions[this.currentQuestionIndex] || {} as Question;
    },
    totalQuestionPages() {
      return Math.ceil(this.questions.length / this.questionsPerPage);
    },
    visibleQuestions() {
      const start = this.currentQuestionPage * this.questionsPerPage;
      const end = Math.min(start + this.questionsPerPage, this.questions.length);
      return this.questions.slice(start, end).map((q, idx) => ({
        ...q,
        index: start + idx
      }));
    }
  },
  mounted() {
    // 从路由参数获取考试ID
    const route = useRoute();
    this.EXAM_ID = parseInt(route.params.examId as string) || 1;
    // 获取用户信息
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      this.userInfo = JSON.parse(userInfoStr);
    }
    // 获取练习模式和来源信息
    const urlParams = new URLSearchParams(window.location.search);
    this.practiceMode = urlParams.get('mode') || 'exam';
    this.showExplanation = this.practiceMode === 'review';
    
    // 检查是否从计划页面进入
    const fromPlan = urlParams.get('from') === 'plan';
    const fromTaskView = urlParams.get('from') === 'taskview';
    const planId = urlParams.get('planId') || null;
    const taskId = urlParams.get('taskId') || null;
    const testAttemptId = urlParams.get('testAttemptId') || null;
    
    // 保存来源信息到组件数据中（空字符串转换为 null）
    this.fromPlan = fromPlan;
    this.planId = (planId && planId.trim() !== '') ? planId : null;
    this.taskId = (taskId && taskId.trim() !== '') ? taskId : null;
    this.fromTaskView = fromTaskView;
    this.testAttemptId = (testAttemptId && testAttemptId.trim() !== '') ? testAttemptId : null;
    
    // 调试日志
    console.log('🔍 [GESPEaxmView] URL参数检查:', {
      from: urlParams.get('from'),
      fromPlan,
      fromTaskView,
      planId: this.planId,
      taskId: this.taskId,
      fullUrl: window.location.href
    });

    this.loadExamData();
    this.questionTypeStore.fetchQuestionTypes();

    // 添加浏览器返回键拦截
    this.setupBeforeUnload();
    
    // 添加键盘事件监听
    this.setupKeyboardShortcuts();
    
    // 监听 NavBar 触发的退出请求
    window.addEventListener('exitExamRequest', this.handleExitExamRequest);
    
    // 页面加载完成后滚动到合适位置
    this.$nextTick(() => {
      setTimeout(() => {
        this.scrollToQuestionTop();
      }, 500); // 延迟500ms确保数据加载完成
    });
  },
  watch: {
    // 监听路由参数变化，重新加载数据
    '$route.params.examId': {
      handler(newExamId: string) {
        this.EXAM_ID = parseInt(newExamId) || 1;
        this.loadExamData();
      },
      immediate: false
    }
  },
  beforeUnmount() {
    // 清理事件监听器
    this.cleanupBeforeUnload();
    this.cleanupKeyboardShortcuts();
    window.removeEventListener('exitExamRequest', this.handleExitExamRequest);
  },
  methods: {
    getCategoryText(category: string) {
      const type = this.questionTypeStore.allTypes.find((t: any) => t.name === category)
      return type?.display_name || category || 'GESP'
    },
    async loadExamData() {
      if (!this.EXAM_ID) {
        this.error = '无效的考试ID';
        this.loading = false;
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const response = await fetch(`${this.BASE_URL}/exam/${this.EXAM_ID}`);
        if (!response.ok) {
          throw new Error(`获取考试信息失败: ${response.status}`);
        }
        const data = await response.json();
        this.examInfo = data.exam;
        this.questions = data.questions;
        this.answers = Array(this.questions.length).fill('');
        this.currentQuestionIndex = 0;
        
        // 调试信息：检查题目数据
        console.log('加载的题目数据:', this.questions);
        if (this.questions.length > 0) {
          console.log('第一题数据:', this.questions[0]);
          console.log('第一题类型:', this.questions[0].question_type);
          console.log('第一题代码:', this.questions[0].question_code);
          console.log('第一题是否有代码内容:', !!this.questions[0].question_code);
          console.log('第一题代码长度:', this.questions[0].question_code?.length || 0);
          console.log('第一题图片URL:', this.questions[0].image_url);
          console.log('第一题附加图片:', this.questions[0].images);
        }
        
        // 处理图片URL，避免 HTTPS 下 Mixed Content（如 http://ip:3000/uploads/xxx）
        this.questions = this.questions.map((q: Question) => {
          if (q.image_url) {
            q.image_url = normalizeImageUrl(q.image_url) || q.image_url;
            if (!q.image_url.startsWith('http://') && !q.image_url.startsWith('https://')) {
              q.image_url = q.image_url.startsWith('/')
                ? `${API_SERVER_BASE}${q.image_url}`
                : `${API_SERVER_BASE}/${q.image_url}`;
            }
          }
          if (q.images && q.images.length > 0) {
            q.images = q.images.map((img: any) => {
              if (img.image_url) {
                img.image_url = normalizeImageUrl(img.image_url) || img.image_url;
                if (!img.image_url.startsWith('http://') && !img.image_url.startsWith('https://')) {
                  img.image_url = img.image_url.startsWith('/')
                    ? `${API_SERVER_BASE}${img.image_url}`
                    : `${API_SERVER_BASE}/${img.image_url}`;
                }
              }
              return img;
            });
          }
          return q;
        });
        
        // 等待DOM更新完成，然后保存考试信息到localStorage
        await this.$nextTick();
        
        // 延迟设置考试信息，确保页面完全加载后再显示
        setTimeout(() => {
          localStorage.setItem('currentExamInfo', JSON.stringify(this.examInfo));
          this.loading = false;
          
          // 数据加载完成后滚动到合适位置
          setTimeout(() => {
            this.scrollToQuestionTop();
            // 应用代码高亮
            this.highlightCode();
          }, 300);
        }, 500); // 延迟500ms确保所有数据都准备好
        
      } catch (error) {
        this.error = error instanceof Error ? error.message : '加载考试信息失败';
        this.loading = false;
      }
    },
    async submitAnswers() {
      const unansweredCount = this.answers.filter(answer => !answer).length;
      if (unansweredCount > 0) {
        this.highlightUnanswered = true;
        this.alertTitle = '题目未完成';
        this.alertMessage = `还有 ${unansweredCount} 道题目未回答，请完成所有题目后再提交。`;
        this.showAlertDialog = true;
        return;
      }
      this.highlightUnanswered = false;
      
      // 检查用户是否登录
      if (!this.userInfo || !this.userInfo.id) {
        this.alertTitle = '登录提示';
        this.alertMessage = '请先登录后再提交答案';
        this.showAlertDialog = true;
        return;
      }
      
      this.submitting = true;
      try {
        // 准备提交数据
        const answers = this.questions.map((question, index) => ({
          question_id: question.id,
          user_answer: this.answers[index]
        }));
        
        const submitData = {
          user_id: this.userInfo.id,
          exam_id: this.EXAM_ID,
          answers: answers
        };
        
        console.log('提交数据:', submitData);
        
        // 判断使用哪种提交接口：Test 聚合考试 > 学习任务 > 普通
        let submitUrl = `${this.BASE_URL}/submit-exam`;
        const isTestAttemptSubmission = this.testAttemptId && this.testAttemptId.trim() !== '';
        const isTaskSubmission = !isTestAttemptSubmission && this.fromTaskView && this.taskId && this.taskId.trim() !== '';
        
        if (isTestAttemptSubmission) {
          submitUrl = `${this.BASE_URL}/tests/attempts/${this.testAttemptId}/submit-exam`;
          console.log('✅ [GESPEaxmView] 使用 Test 聚合考试提交接口:', submitUrl);
        } else if (isTaskSubmission) {
          submitUrl = `${this.BASE_URL}/learning-tasks/${this.taskId}/submit-exam`;
          console.log('✅ [GESPEaxmView] 使用任务内提交接口:', submitUrl, {
            fromTaskView: this.fromTaskView,
            taskId: this.taskId,
            planId: this.planId
          });
        } else {
          console.log('⚠️ [GESPEaxmView] 使用普通提交接口', {
            testAttemptId: this.testAttemptId,
            fromTaskView: this.fromTaskView,
            taskId: this.taskId
          });
        }
        
        const response = await fetch(submitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(submitData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '提交失败');
        }
        
        const result = await response.json();
        console.log('提交结果:', result);
        
        // 显示提交结果
        this.submitResult = result;
        this.showSubmitResult = true;
        
        // 通知父组件提交状态已更新
        this.notifySubmissionUpdate();
        
      } catch (error) {
        console.error('提交失败:', error);
        alert(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        this.submitting = false;
      }
    },
    goToQuestion(idx: number) {
      this.currentQuestionIndex = idx;
      this.showExplain = false;
      // 复习模式下切换题目时隐藏解析
      if (this.practiceMode === 'review') {
        this.showAIPanel = false;
      }
      // 自动更新题目页码
      this.currentQuestionPage = Math.floor(idx / this.questionsPerPage);
      // 滚动到题目顶部
      this.scrollToQuestionTop();
      // 应用代码高亮
      this.highlightCode();
    },
    // 处理进度弹窗中的题目点击
    handleQuestionClick(index: number) {
      this.goToQuestion(index);
      // 跳转后自动关闭弹窗
      this.showProgressModal = false;
    },
    prevQuestionPage() {
      if (this.currentQuestionPage > 0) {
        this.currentQuestionPage--;
      }
    },
    nextQuestionPage() {
      if (this.currentQuestionPage < this.totalQuestionPages - 1) {
        this.currentQuestionPage++;
      }
    },
    prevQuestion() {
      if (this.currentQuestionIndex > 0) {
        this.currentQuestionIndex--;
        this.showExplain = false;
        // 复习模式下切换题目时隐藏解析
        if (this.practiceMode === 'review') {
          this.showAIPanel = false;
        }
        // 自动更新题目页码
        this.currentQuestionPage = Math.floor(this.currentQuestionIndex / this.questionsPerPage);
        // 滚动到题目顶部
        this.scrollToQuestionTop();
        // 应用代码高亮
        this.highlightCode();
      }
    },
    nextQuestion() {
      if (this.currentQuestionIndex < this.questions.length - 1) {
        this.currentQuestionIndex++;
        this.showExplain = false;
        // 复习模式下切换题目时隐藏解析
        if (this.practiceMode === 'review') {
          this.showAIPanel = false;
        }
        // 自动更新题目页码
        this.currentQuestionPage = Math.floor(this.currentQuestionIndex / this.questionsPerPage);
        // 滚动到题目顶部
        this.scrollToQuestionTop();
        // 应用代码高亮
        this.highlightCode();
      }
    },
    selectOption(value: string) {
      this.answers[this.currentQuestionIndex] = value;
      // 在复习模式下保持原有逻辑，不自动显示解析
      this.autoNext();
    },
    autoNext() {
      // 保持原有的自动跳转逻辑
      if (this.currentQuestionIndex < this.questions.length - 1) {
        setTimeout(() => this.nextQuestion(), 200);
      }
    },
    toggleAIPanel() {
      this.showAIPanel = !this.showAIPanel;
    },
    openImageModal(imageUrl: string) {
      this.selectedImageUrl = imageUrl;
      this.showImageModal = true;
    },
    closeImageModal() {
      this.showImageModal = false;
      this.selectedImageUrl = '';
    },
    // 返回对应等级的考试列表
    goBackToLevelExams() {
      this.showSubmitResult = false;
      const urlParams = new URLSearchParams(window.location.search);
      const testId = urlParams.get('testId') || null;
      const from = urlParams.get('from');
      const planId = urlParams.get('planId') || null;
      const taskId = urlParams.get('taskId') || null;
      if (this.testAttemptId && testId && testId.trim() !== '') {
        this.router.push(`/tests/${testId}`);
        return;
      }
      const hasValidTaskParams = from === 'taskview' && 
                                  planId && planId.trim() !== '' && 
                                  taskId && taskId.trim() !== '';
      if (hasValidTaskParams) {
        console.log('✅ [GESPEaxmView] 从任务页面进入，返回到任务页面', { planId, taskId });
        this.router.push(`/plan/${planId}/tasks/${taskId}?tab=exercises`);
      } else if (this.fromPlan) {
        console.log('✅ [GESPEaxmView] 从计划页面进入，返回到计划页面');
        this.router.push('/plan');
      } else {
        console.log('⚠️ [GESPEaxmView] 返回到级别考试列表', { from, planId, taskId });
        this.router.push(`/level-exams/${this.examInfo.level}`);
      }
    },
    showExitConfirm() {
      this.showExitConfirmDialog = true;
    },
    // 处理 NavBar 触发的退出请求
    handleExitExamRequest() {
      this.showExitConfirm();
    },
    // 确认退出练习
    confirmExit() {
      this.showExitConfirmDialog = false;
      this.cleanupBeforeUnload();
      localStorage.removeItem('currentExamInfo');
      const urlParams = new URLSearchParams(window.location.search);
      const testId = urlParams.get('testId') || null;
      const from = urlParams.get('from');
      const planId = urlParams.get('planId') || null;
      const taskId = urlParams.get('taskId') || null;
      if (this.testAttemptId && testId && testId.trim() !== '') {
        this.router.push(`/tests/${testId}`);
        return;
      }
      const hasValidTaskParams = from === 'taskview' && 
                                  planId && planId.trim() !== '' && 
                                  taskId && taskId.trim() !== '';
      if (hasValidTaskParams) {
        console.log('✅ [GESPEaxmView] 从任务页面退出，返回到任务页面', { planId, taskId });
        this.router.push(`/plan/${planId}/tasks/${taskId}?tab=exercises`);
      } else if (this.fromPlan) {
        console.log('✅ [GESPEaxmView] 从计划页面退出，返回到计划页面');
        this.router.push('/plan');
      } else {
        this.router.push(`/level-exams/${this.examInfo.level}`);
      }
    },
    // 取消退出
    cancelExit() {
      this.showExitConfirmDialog = false;
    },
    // 关闭提示弹窗
    closeAlertDialog() {
      this.showAlertDialog = false;
      this.alertMessage = '';
      this.alertTitle = '';
    },
    // 格式化日期显示（只显示年份和月份）
    formatDate(dateString: string) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit'
        });
      } catch (error) {
        console.error('日期格式化错误:', error);
        return dateString;
      }
    },
    // 滚动到题目顶部
    scrollToQuestionTop() {
      // 使用 nextTick 确保 DOM 更新后再滚动
      this.$nextTick(() => {
        // 计算exam-header的高度（NavBar 48px + exam-header 42px = 90px）
        const headerHeight = 90;
        
        // 尝试找到题目卡片
        const questionCard = document.querySelector('.question-card');
        if (questionCard) {
          // 计算题目卡片相对于视口的位置
          const rect = questionCard.getBoundingClientRect();
          const scrollTop = window.pageYOffset + rect.top;
          
          // 滚动到题目卡片顶部，但要为固定header留出空间
          const targetScrollTop = scrollTop - headerHeight - 60; // header高度 + 更多间距
          
          // 平滑滚动到合适位置
          window.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        } else {
          // 如果找不到题目卡片，尝试滚动到exam-content
          const examContent = document.querySelector('.exam-content');
          if (examContent) {
            const rect = examContent.getBoundingClientRect();
            const scrollTop = window.pageYOffset + rect.top;
            const targetScrollTop = scrollTop - headerHeight - 40;
            
            window.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          } else {
            // 最后备用方案：滚动到header下方
            window.scrollTo({
              top: headerHeight,
              behavior: 'smooth'
            });
          }
        }
      });
    },
    // 设置浏览器返回键拦截
    setupBeforeUnload() {
      // 拦截浏览器返回键和页面刷新
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        // 阻止默认行为
        event.preventDefault();
        // 显示确认对话框
        event.returnValue = '您确定要离开吗？未完成的答题进度将会丢失！';
        return '您确定要离开吗？未完成的答题进度将会丢失！';
      };

      // 拦截浏览器返回键（使用popstate事件）
      const handlePopState = (event: PopStateEvent) => {
        // 阻止默认的返回行为
        event.preventDefault();
        // 显示退出确认弹窗
        this.showExitConfirm();
        // 重新推入当前状态，防止页面真的返回
        window.history.pushState(null, '', window.location.href);
      };

      // 添加事件监听器
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      
      // 推入一个历史状态，用于拦截返回键
      window.history.pushState(null, '', window.location.href);

      // 保存事件监听器的引用，用于清理
      this.beforeUnloadHandler = handleBeforeUnload;
      this.popStateHandler = handlePopState;
    },
    // 清理事件监听器
    cleanupBeforeUnload() {
      if (this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      }
      if (this.popStateHandler) {
        window.removeEventListener('popstate', this.popStateHandler);
      }
    },
    // 设置键盘快捷键
    setupKeyboardShortcuts() {
      const handleKeyboard = (event: KeyboardEvent) => {
        // 如果用户正在输入框中输入，不触发快捷键
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        // 左方向键 - 上一题
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.prevQuestion();
        }
        
        // 右方向键 - 下一题
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.nextQuestion();
        }
      };
      
      // 添加事件监听器
      window.addEventListener('keydown', handleKeyboard);
      
      // 保存事件监听器的引用，用于清理
      this.keyboardHandler = handleKeyboard;
    },
    // 清理键盘快捷键监听器
    cleanupKeyboardShortcuts() {
      if (this.keyboardHandler) {
        window.removeEventListener('keydown', this.keyboardHandler);
      }
    },
    // 代码高亮处理方法 - 统一使用 C++ 渲染
    highlightCode() {
      // 使用双重 nextTick 确保 DOM 完全渲染
      this.$nextTick(() => {
        this.$nextTick(() => {
          // 再增加一个小延迟，确保 transition 动画完成
          setTimeout(() => {
            try {
              console.log('开始执行 C++ 代码高亮...');
              console.log('当前题目:', this.currentQuestion);
              console.log('当前题目类型:', this.currentQuestion.question_type);
              console.log('当前题目代码:', this.currentQuestion.question_code);
              
              // 高亮题目代码
              const codeBlocks = document.querySelectorAll('.code-block code');
              const hasCode = this.currentQuestion?.question_type === 'code' && this.currentQuestion?.question_code;
              if (hasCode && codeBlocks.length === 0) {
                console.warn('⚠️ 未找到代码块，可能是 DOM 还未渲染完成');
              }
              
              codeBlocks.forEach((block, index) => {
                console.log(`处理代码块 ${index + 1}:`, block);
                
                if (block && block.textContent) {
                  try {
                    // 统一使用 C++ 语言高亮
                    const result = hljs.highlight(block.textContent, { 
                      language: 'cpp',
                      ignoreIllegals: true 
                    });
                    block.innerHTML = result.value;
                    block.className = 'hljs language-cpp';
                    console.log('✅ C++ 高亮完成');
                  } catch (highlightError) {
                    console.error(`代码块 ${index + 1} C++ 高亮失败:`, highlightError);
                  }
                }
              });
              
              // 高亮选项中的代码
              const optionCodeBlocks = document.querySelectorAll('.option-code-block code');
              console.log('找到选项代码块数量:', optionCodeBlocks.length);
              
              optionCodeBlocks.forEach((block, index) => {
                console.log(`处理选项代码块 ${index + 1}:`, block);
                if (block && block.textContent) {
                  try {
                    // 统一使用 C++ 语言高亮
                    const result = hljs.highlight(block.textContent, { 
                      language: 'cpp',
                      ignoreIllegals: true 
                    });
                    block.innerHTML = result.value;
                    block.className = 'hljs language-cpp';
                    console.log('✅ 选项代码块 C++ 高亮完成');
                  } catch (highlightError) {
                    console.error(`选项代码块 ${index + 1} C++ 高亮失败:`, highlightError);
                  }
                }
              });
              
              console.log('🎉 C++ 代码高亮处理完成');
            } catch (error) {
              console.error('❌ 代码高亮处理失败:', error);
              console.error('错误详情:', error);
            }
          }, 100); // 增加 100ms 延迟
        });
      });
    },
    // 通知提交状态更新
    notifySubmissionUpdate() {
      // 使用 localStorage 存储提交状态更新事件
      const submissionUpdate = {
        examId: this.EXAM_ID,
        timestamp: Date.now(),
        action: 'submission_completed'
      };
      localStorage.setItem('submissionUpdate', JSON.stringify(submissionUpdate));
      
      // 触发自定义事件
      const event = new CustomEvent('submissionUpdated', {
        detail: { examId: this.EXAM_ID }
      });
      window.dispatchEvent(event);
    },
    // 获取模式文本
    getModeText(mode: string): string {
      switch (mode) {
        case 'exam':
          return '考试模式';
        case 'review':
          return '复习模式';
        case 'classroom':
          return '课堂模式';
        default:
          return '考试模式';
      }
    },
    // 获取完整的图片URL（规范化以避免 HTTPS 下 Mixed Content）
    getImageUrl(url: string | undefined): string {
      if (!url || !url.trim()) return '';
      const normalized = normalizeImageUrl(url);
      if (!normalized) return '';
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        const base = API_SERVER_BASE;
        return normalized.startsWith('/') ? `${base}${normalized}` : `${base}/${normalized}`;
      }
      return normalized;
    },
    // 图片加载错误处理
    handleImageError(event: Event) {
      const img = event.target as HTMLImageElement;
      console.error('图片加载失败:', img.src);
      // 可以设置一个默认的占位图
      // img.src = '/placeholder-image.png';
    },
    // 图片加载成功处理
    handleImageLoad(event: Event) {
      const img = event.target as HTMLImageElement;
      console.log('图片加载成功:', img.src);
    },
  }
});
</script>

<style scoped>
/* 重置和基础样式 */
* {
  box-sizing: border-box;
}

/* 全页面加载界面样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 50%, #06b6d4 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  animation: loadingFadeIn 0.5s ease-out;
}

@keyframes loadingFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  text-align: center;
  color: white;
}

.loading-spinner {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid transparent;
  border-top: 4px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.spinner-ring:nth-child(1) {
  animation-delay: 0s;
  border-top-color: rgba(255, 255, 255, 0.9);
}

.spinner-ring:nth-child(2) {
  animation-delay: 0.3s;
  border-top-color: rgba(255, 255, 255, 0.7);
  transform: scale(0.8);
}

.spinner-ring:nth-child(3) {
  animation-delay: 0.6s;
  border-top-color: rgba(255, 255, 255, 0.5);
  transform: scale(0.6);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: textPulse 2s ease-in-out infinite;
}

.loading-text p {
  font-size: 1.2rem;
  font-weight: 500;
  margin: 0;
  opacity: 0.9;
  animation: textFade 3s ease-in-out infinite;
}

@keyframes textPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

@keyframes textFade {
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.6;
  }
}

.exam-layout {
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
}


.progress-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  margin: 0;
  min-width: 90px;
}

.progress-info span {
  font-size: 11px;
  font-weight: 600;
  color: #1e293b;
}

.progress-bar {
  width: 90px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(30,144,255,0.08);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 60%, #38bdf8 100%);
  border-radius: 4px;
  transition: width 0.3s;
}

/* 新增横向flex布局 - 居中布局 */
.exam-content-flex-row {
  display: flex;
  flex-direction: row;
  gap: 32px;
  width: 100% !important;
  max-width: 1800px !important;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: center;
  margin-top: 20px; /* 为 NavBar 留出少量空间 */
  margin-bottom: 60px; /* 为底部固定的 exam-header 留出空间 */
  padding-bottom: 0;
  justify-content: center;
}

/* 新的 exam 卡片容器 - 占屏幕90% */
.exam-card-wrapper {
  width: 90%;
  max-width: 1800px; /* 增加最大宽度以适应更宽的布局 */
  margin: 80px auto 0; /* 下移卡片，从40px增加到80px */
  display: flex;
  flex-direction: column;
  gap: 0;
  background: transparent;
}

/* 第一层级：考试级别头部 */
.exam-level-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 20px 20px 0 0;
  padding: 12px 32px; /* 上下变窄，从20px减少到12px */
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15); /* 只保留顶部和两侧阴影，移除底部阴影 */
  border: none; /* 完全移除边框 */
  border-bottom: none; /* 移除底部边框，与第二层级紧贴 */
  margin-bottom: 0; /* 确保没有外边距 */
  position: relative;
  z-index: 1; /* 确保在第一层级 */
}

.exam-level-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: transparent; /* 确保透明，显示父元素的主题色背景 */
}

.exam-title-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.exam-title {
  margin: 0;
  color: white;
  font-size: 1.4rem; /* 稍微减小字体以适应变窄的header */
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.exam-level-badge {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
  color: white;
  padding: 6px 14px; /* 稍微减小内边距以适应变窄的header */
  border-radius: 18px;
  font-weight: 700;
  font-size: 0.9rem; /* 稍微减小字体 */
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.exam-category-badge {
  padding: 6px 14px;
  border-radius: 18px;
  font-weight: 700;
  font-size: 0.9rem;
}

.exam-category-badge.category-gesp { background: rgba(59,130,246,0.2); color: #93c5fd; }
.exam-category-badge.category-csp_j { background: rgba(34,197,94,0.2); color: #86efac; }
.exam-category-badge.category-csp_s { background: rgba(34,197,94,0.2); color: #86efac; }
.exam-category-badge.category-noi_p { background: rgba(245,158,11,0.2); color: #fcd34d; }
.exam-category-badge.category-noi_a { background: rgba(245,158,11,0.2); color: #fcd34d; }
.exam-category-badge.category-noi_ioi { background: rgba(236,72,153,0.2); color: #f9a8d4; }
.exam-category-badge.category-leetcode { background: rgba(168,85,247,0.2); color: #d8b4fe; }
.exam-category-badge.category-other { background: rgba(148,163,184,0.2); color: #cbd5e1; }

/* 提交模式状态徽章样式 */
.submission-mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 18px;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 4px 12px rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.submission-mode-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255,255,255,0.3);
}

/* 自由练习徽章 - 紫色主题（更醒目） */
.free-practice-badge {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border-color: rgba(139, 92, 246, 0.6);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
}

.free-practice-badge:hover {
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
}

.free-practice-badge :deep(.lucide-icon) {
  color: white;
}

.exam-progress-section {
  display: flex;
  align-items: center;
}

/* 进度图标按钮样式 */
.progress-icon-btn {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
  position: relative;
}

.progress-icon-btn:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.2) 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 255, 255, 0.3);
}

.progress-icon-btn:active {
  transform: translateY(0);
}

.progress-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.progress-badge {
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.exam-actions-section {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 第二层级：题目内容容器 */
.question-content-wrapper {
  background: #ffffff; /* 底色设为白色 */
  border-radius: 0 0 20px 20px;
  box-shadow: 0 6px 24px -4px rgba(30, 144, 255, 0.15);
  border: 1.5px solid rgba(30, 144, 255, 0.2); /* 统一边框 */
  border-top: none; /* 完全移除顶部边框，与第一层级紧贴 */
  padding: 24px;
  padding-top: 24px; /* 确保顶部内边距 */
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center; /* 内容居中 */
  margin-top: -2px; /* 负边距，向上覆盖第一层级底部，消除白色间隙 */
  position: relative;
  z-index: 0; /* 确保在第二层级 */
}

/* 左侧占位区域 */
.sidebar-placeholder-left {
  width: 500px;
  min-width: 500px;
  max-width: 500px;
  flex-shrink: 0;
  order: 1;
}


/* 侧边栏item样式 - 可爱风格 */
.sidebar-item {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 3px solid #d1d5db;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(30,144,255,0.15);
  flex-shrink: 0;
  margin: 0;
  aspect-ratio: 1;
  color: #374151;
  overflow: hidden;
  transform: scale(1);
}

.sidebar-item::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
  transform: rotate(45deg);
  transition: all 0.6s ease;
  opacity: 0;
}

.sidebar-item:hover::before {
  opacity: 1;
  animation: shimmer 1.5s ease-in-out;
}

@keyframes shimmer {
  0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
  100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

.sidebar-item:hover {
  transform: scale(1.1) translateY(-2px);
  box-shadow: 0 8px 20px rgba(30,144,255,0.25);
  border-color: #1e90ff;
}

/* 新增：高亮当前题目 */
.sidebar-item--active {
  border: 3px solid #1e90ff;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #1e90ff;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(30,144,255,0.3);
  transform: scale(1.05);
  animation: activePulse 2s ease-in-out infinite;
}

@keyframes activePulse {
  0%, 100% { 
    box-shadow: 0 6px 16px rgba(30,144,255,0.3);
    transform: scale(1.05);
  }
  50% { 
    box-shadow: 0 8px 20px rgba(30,144,255,0.4);
    transform: scale(1.08);
  }
}

/* 新增：已作答 */
.sidebar-item--answered {
  border: 3px solid #22c55e;
  background: linear-gradient(135deg, #e7f9ef 0%, #d1fae5 100%);
  color: #22c55e;
  box-shadow: 0 4px 12px rgba(34,197,94,0.2);
  position: relative;
}

.sidebar-item--answered::after {
  content: '✓';
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  background: #22c55e;
  color: white;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(34,197,94,0.3);
  animation: checkmarkBounce 0.6s ease-out;
}

@keyframes checkmarkBounce {
  0% { transform: scale(0) rotate(0deg); }
  50% { transform: scale(1.2) rotate(180deg); }
  100% { transform: scale(1) rotate(360deg); }
}

/* 新增：未作答高亮 */
.sidebar-item--unanswered {
  border: 3px solid #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #ef4444;
  box-shadow: 0 4px 12px rgba(239,68,68,0.2);
  animation: warningPulse 1.5s ease-in-out infinite;
}

@keyframes warningPulse {
  0%, 100% { 
    box-shadow: 0 4px 12px rgba(239,68,68,0.2);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 6px 16px rgba(239,68,68,0.3);
    transform: scale(1.02);
  }
}

/* 题号数字 */
.sidebar-number {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
  color: inherit;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.sidebar-item:hover .sidebar-number {
  transform: scale(1.1);
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.sidebar-item:active {
  transform: scale(0.95);
  transition: all 0.1s ease;
}

.sidebar-item:active .sidebar-number {
  transform: scale(0.9);
}


/* 主体区域 - 在新结构中占满容器 */
.question-main {
  width: 100%;
  max-width: 100%; /* 移除宽度限制，使其更宽 */
  margin: 0 auto; /* 水平居中 */
  flex-shrink: 0;
  overflow: visible;
  order: 2;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center; /* 内容居中 */
  gap: 32px;
}



/* 题目卡片 - 增加高度和宽度 */
.question-card {
  background: transparent;
  border: 2px solid #1e90ff; /* 添加主题蓝色边框 */
  border-radius: 16px; /* 添加圆角，与header圆角匹配 */
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.15); /* 添加阴影 */
  transition: all 0.3s ease;
  padding: 0;
  overflow: hidden; /* 确保内容不会溢出圆角 */
  flex: 1;
  height: auto !important; /* 改为自适应高度 */
  min-height: 600px;
  max-height: none;
  display: flex;
  flex-direction: column;
  margin: 0;
  flex-shrink: 1;
  box-sizing: border-box;
}

/* 题目切换箭头样式 */
.question-nav-arrow {
  background: rgba(30, 144, 255, 0.1);
  backdrop-filter: blur(10px);
  color: #1e90ff;
  border: 2px solid rgba(30, 144, 255, 0.3);
  border-radius: 12px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
  flex-shrink: 0;
  z-index: 10;
  position: relative;
}

.question-nav-arrow:hover:not(:disabled) {
  background: rgba(30, 144, 255, 0.2);
  border-color: rgba(30, 144, 255, 0.5);
  color: #0c7cd5;
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.question-nav-arrow:active:not(:disabled) {
  transform: scale(0.95);
}

.question-nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.05);
}

.question-nav-arrow-left {
  order: 1;
}

.question-card {
  order: 2;
}

.question-nav-arrow-right {
  order: 3;
}

/* 统一的内容滚动区域 - 改为左右分栏布局 */
.question-content-unified {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  height: calc(100% - 80px); /* 减去头部高度 */
  display: flex;
  flex-direction: row; /* 改为横向布局 */
  gap: 16px; /* 左右间隙 */
  min-height: 600px;
  max-height: 1100px;
  padding: 16px;
}

/* 左侧面板 - 题目内容、图片、代码 - 3份 */
.question-left-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
}

/* 右侧面板 - 选项 - 2份 */
.question-right-panel {
  flex: 2;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-left: 8px;
}

/* 内容区域通用样式 - 更有趣的设计 */
.content-section {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(224, 242, 254, 0.4) 100%); /* 使用半透明主题色 */
  backdrop-filter: blur(12px); /* 增强毛玻璃效果 */
  border-radius: 20px;
  margin: 0; /* 移除margin，使用gap来控制间距 */
  box-shadow: 0 8px 32px rgba(30,144,255,0.15);
  overflow: hidden;
  border: 2px solid #1e90ff; /* 使用主题蓝色边框 */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

/* 左侧面板中的content-section */
.question-left-panel .content-section {
  flex-shrink: 0;
}

/* 右侧面板的options-section占满高度 */
.question-right-panel .options-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #1e90ff, #38bdf8, #06b6d4, #1e90ff);
  background-size: 200% 100%;
}

/* 区域头部样式 - 减少内边距 */
.section-header {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.section-header i {
  color: #1e90ff;
  font-size: 1rem;
}

/* 区域内容样式 - 更有趣的设计 */
.section-content {
  padding: 20px;
  background: transparent;
  position: relative;
  z-index: 1;
}

/* 题目文本区域 - 更有趣的设计 */
.question-text-section .section-content {
  padding: 24px;
}

.question-text {
  font-size: 1.1rem;
  color: #1e293b;
  font-weight: 600;
  line-height: 1.8;
  margin: 0;
  text-align: left;
  word-wrap: break-word;
  word-break: break-word;
  white-space: normal !important;
  position: relative;
  padding: 16px;
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.3) 100%); /* 使用主题色半透明背景 */
  backdrop-filter: blur(8px);
  border-radius: 16px;
  border-left: 4px solid #1e90ff;
  box-shadow: 0 4px 16px rgba(30,144,255,0.15);
}

/* 图片区域优化 - 更有趣的设计 */
.images-section .section-content {
  padding: 20px;
}

.images-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-item {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
  cursor: pointer;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(224, 242, 254, 0.5) 100%); /* 使用半透明主题色 */
  backdrop-filter: blur(8px);
  border: 3px solid rgba(30, 144, 255, 0.25); /* 使用主题色边框 */
}

.question-image {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  display: block;
  transition: all 0.3s ease;
  background: #f8fafc;
}

/* 代码区域优化 - 更有趣的设计 */
.code-section .section-content {
  padding: 20px;
}

.code-block {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(224, 242, 254, 0.5) 100%); /* 使用半透明主题色 */
  backdrop-filter: blur(10px);
  color: #1e293b;
  padding: 24px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 14px;
  font-weight: bold;
  line-height: 1.7;
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  border-radius: 16px;
  border: 3px solid #1e90ff;
  box-shadow: 0 8px 32px rgba(30, 144, 255, 0.25);
  position: relative;
}

/* highlight.js 语法高亮样式增强 */
.code-block code {
  background: transparent !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

/* highlight.js 主题样式调整 - 保持语法高亮颜色 */
.code-block code.hljs {
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  /* 不覆盖 highlight.js 的颜色，让它使用默认的语法高亮颜色 */
}

/* 行号样式 */
.code-block.line-numbers {
  padding-left: 3.8em;
  counter-reset: linenumber;
}

.code-block.line-numbers > code {
  position: relative;
  white-space: inherit;
}

.code-block.line-numbers .line-numbers-rows {
  position: absolute;
  pointer-events: none;
  top: 0;
  font-size: 100%;
  left: -3.8em;
  width: 3em;
  letter-spacing: -1px;
  border-right: 1px solid #999;
  user-select: none;
  counter-reset: linenumber;
}

.code-block.line-numbers .line-numbers-rows > span {
  pointer-events: none;
  display: block;
  counter-increment: linenumber;
}

.code-block.line-numbers .line-numbers-rows > span:before {
  content: counter(linenumber);
  color: #999;
  display: block;
  padding-right: 0.8em;
  text-align: right;
}

/* 代码语法高亮样式 */
.code-block code {
  color: #1e293b;
  font-weight: bold;
}

/* 为代码中的关键字添加特殊样式 */
.code-block code .keyword {
  color: #dc2626;
  font-weight: 700;
}

.code-block code .string {
  color: #059669;
  font-weight: 500;
}

.code-block code .comment {
  color: #6b7280;
  font-style: italic;
}

.code-block code .number {
  color: #7c3aed;
  font-weight: 600;
}

/* 代码显示区域的滚动条样式 */
.code-block::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.code-block::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 6px;
}

.code-block::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
  border: 2px solid #f1f5f9;
}

.code-block::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.code-block::-webkit-scrollbar-corner {
  background: #f1f5f9;
}

.code-block::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #06b6d4, #1e90ff, #38bdf8);
  border-radius: 16px 16px 0 0;
}

.code-placeholder {
  padding: 20px;
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.4) 0%, rgba(186, 230, 253, 0.3) 100%); /* 使用主题色 */
  backdrop-filter: blur(8px);
  color: #64748b;
  text-align: center;
  font-style: italic;
  border-radius: 12px;
  margin: 16px;
  border: 2px dashed rgba(30, 144, 255, 0.3); /* 使用主题色边框 */
  font-size: 14px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.code-placeholder i {
  font-size: 24px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.code-placeholder p {
  margin: 0;
  font-size: 14px;
}

/* 选项区域优化 - 更有趣的设计 */
.options-section .section-content {
  padding: 20px;
  max-height: none; /* 移除高度限制 */
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* 左右面板的滚动条样式 */
.question-left-panel::-webkit-scrollbar,
.question-right-panel::-webkit-scrollbar,
.options-section .section-content::-webkit-scrollbar {
  width: 8px;
}

.question-left-panel::-webkit-scrollbar-track,
.question-right-panel::-webkit-scrollbar-track,
.options-section .section-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.question-left-panel::-webkit-scrollbar-thumb,
.question-right-panel::-webkit-scrollbar-thumb,
.options-section .section-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  border: 2px solid #f1f5f9;
}

.question-left-panel::-webkit-scrollbar-thumb:hover,
.question-right-panel::-webkit-scrollbar-thumb:hover,
.options-section .section-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.option-item {
  display: flex;
  align-items: flex-start; /* 改为顶部对齐，适应长文本 */
  gap: 12px;
  padding: 16px 20px;
  border-radius: 16px;
  border: 3px solid rgba(30, 144, 255, 0.25); /* 使用主题色边框 */
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(224, 242, 254, 0.4) 100%); /* 使用半透明主题色 */
  backdrop-filter: blur(8px);
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
  word-break: break-word;
  color: #374151;
  min-height: 60px;
  max-height: none; /* 移除最大高度限制 */
  position: relative;
  overflow: hidden; /* 改回hidden，用于光效动画 */
  transform: perspective(1000px) rotateX(0deg);
}

/* 光效扫过动画 */
.option-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(30, 144, 255, 0.1), transparent);
  transition: left 0.6s ease;
  pointer-events: none; /* 确保不影响文本选择 */
  z-index: 0;
}

.option-item:hover::before {
  left: 100%;
}

/* hover时的3D效果 */
.option-item:hover {
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.8) 0%, rgba(186, 230, 253, 0.6) 100%); /* 使用主题色半透明 */
  backdrop-filter: blur(10px);
  color: #1e90ff;
  font-weight: 700;
  border-color: #1e90ff;
  transform: perspective(1000px) rotateX(2deg) translateY(-4px) scale(1.02);
  box-shadow: 0 12px 32px rgba(30,144,255,0.3);
}

/* 选中状态的样式 */
.option-selected {
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.9) 0%, rgba(186, 230, 253, 0.7) 100%); /* 使用主题色半透明 */
  backdrop-filter: blur(10px);
  color: #1e90ff;
  font-weight: 700;
  border-color: #1e90ff;
  box-shadow: 0 4px 16px rgba(30,144,255,0.3);
}

.option-label {
  font-weight: 700;
  color: #1e90ff;
  margin-right: 8px;
  min-width: 20px;
  text-align: center;
  font-size: 0.85rem;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  padding: 4px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(30,144,255,0.25);
  position: relative;
  z-index: 1; /* 确保标签在光效上方 */
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  line-height: 1.6;
  font-weight: 600;
  white-space: normal; /* 确保文本正常换行 */
  overflow-wrap: break-word; /* 长单词换行 */
  hyphens: auto; /* 自动连字符 */
  max-width: none; /* 移除最大宽度限制 */
  position: relative;
  z-index: 1; /* 确保文本在光效上方 */
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1; /* 确保内容在光效上方 */
}

.option-code-block {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(224, 242, 254, 0.5) 100%); /* 使用半透明主题色 */
  backdrop-filter: blur(8px);
  border: 2px solid #1e90ff;
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0;
  overflow-x: auto;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15);
}

.option-code-block pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  font-weight: bold;
  line-height: 1.5;
  color: #1e293b;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: transparent !important;
}

/* 选项代码块的语法高亮样式 */
.option-code-block code {
  background: transparent !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

/* 选项代码块的 highlight.js 样式 - 保持语法高亮颜色 */
.option-code-block code.hljs {
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  /* 不覆盖 highlight.js 的颜色，让它使用默认的语法高亮颜色 */
}

/* 解析区域 - 固定高度和宽度 */
.question-explanation {
  margin-top: 16px;
  background: #f3f4f6;
  border-left: 4px solid #1e90ff;
  border-radius: 8px;
  padding: 16px 20px;
  height: 100px !important;
  overflow-y: auto;
  flex-shrink: 0;
  width: 100% !important;
  box-sizing: border-box;
}

.question-explanation h5 {
  margin: 0 0 6px 0;
  color: #374151;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 解析动画效果 */
.explanation-slide-enter-active {
  animation: explanationSlideIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.explanation-slide-leave-active {
  animation: explanationSlideOut 0.4s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

@keyframes explanationSlideIn {
  0% {
    opacity: 0;
    transform: translateX(100px) scale(0.8) rotateY(-15deg);
    filter: blur(4px);
  }
  50% {
    opacity: 0.7;
    transform: translateX(20px) scale(0.95) rotateY(-5deg);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1) rotateY(0deg);
    filter: blur(0);
  }
}

@keyframes explanationSlideOut {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1) rotateY(0deg);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-50px) scale(0.8) rotateY(10deg);
    filter: blur(3px);
  }
}

/* 为解析内容添加额外的视觉效果 */
.explanation-content {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 12px;
  height: auto !important;
  min-height: 300px;
  overflow-y: auto;
  width: 100% !important;
  box-sizing: border-box;
  word-wrap: break-word;
  word-break: break-word;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(30,144,255,0.15);
  position: relative;
  backdrop-filter: blur(10px);
}

.explanation-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1e90ff, #38bdf8, #06b6d4);
  border-radius: 12px 12px 0 0;
  animation: gradientShift 3s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% {
    background: linear-gradient(90deg, #1e90ff, #38bdf8, #06b6d4);
  }
  50% {
    background: linear-gradient(90deg, #06b6d4, #1e90ff, #38bdf8);
  }
}

/* 解析内容文字的动画效果 */
.explanation-content p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
  animation: textFadeIn 0.8s ease-out 0.3s both;
}

@keyframes textFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}



/* 头部提交按钮样式 - 与SmartOJView的绿色按钮保持一致 */
.submit-btn-header {
  padding: 8px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%); /* 与SmartOJView的btn-test绿色一致 */
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); /* 与SmartOJView一致 */
  transition: all 0.3s ease;
  margin-left: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-btn-header:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4); /* 与SmartOJView一致 */
  background: linear-gradient(135deg, #059669 0%, #10b981 100%); /* 与SmartOJView的hover绿色一致 */
}

.submit-btn-header:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3); /* 与SmartOJView一致 */
}

.submit-btn-header.btn-loading {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%); /* 与SmartOJView的loading绿色一致 */
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.5); /* 与SmartOJView一致 */
}

.submit-btn-header:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 按钮内容包装器样式 - 与SmartOJView保持一致 */
.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s ease;
}

.btn-content i {
  font-size: 16px;
  transition: transform 0.3s ease;
}

.submit-btn-header:not(:disabled):hover .btn-content i:not(.fa-spin) {
  transform: scale(1.2);
}

/* 按钮加载状态样式 - 与SmartOJView保持一致 */
.btn-loading {
  position: relative;
}

.btn-loading::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}


/* 题目卡片头部样式优化 - 更有趣的设计 */
.question-card-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 6px 28px; /* 上下变窄，从24px减少到6px，非常窄 */
  border-bottom: 3px solid #e0f2fe;
  border-radius: 14px 14px 0 0; /* 圆角 = card圆角(16px) - 边框宽度(2px) = 14px */
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
  margin: 0; /* 正常边距 */
  width: 100%; /* 正常宽度 */
  box-sizing: border-box; /* 确保包含边框 */
}

.question-card-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1.5" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="80" r="1" fill="rgba(255,255,255,0.1)"/></svg>');
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.question-number {
  display: flex;
  align-items: center;
  gap: 12px;
}

.number-badge {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  color: #1e90ff;
  padding: 4px 14px; /* 上下变窄，从10px减少到4px，适应非常窄的header */
  border-radius: 20px; /* 稍微减小圆角 */
  font-weight: 800;
  font-size: 1rem; /* 稍微减小字体 */
  box-shadow: 0 4px 12px rgba(30,144,255,0.4);
  border: 2px solid rgba(255,255,255,0.3);
  animation: numberPulse 2s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

@keyframes numberPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 更新level-badge样式 */
.level-badge {
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
  color: white;
  padding: 4px 12px; /* 上下变窄，从8px减少到4px，适应非常窄的header */
  border-radius: 16px; /* 稍微减小圆角 */
  font-weight: 700;
  font-size: 0.85rem; /* 稍微减小字体 */
  box-shadow: 0 4px 12px rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

/* 题目日期样式 - 与level-badge保持一致 */
.question-number .question-date {
  margin-left: 8px;
  font-size: 0.85rem; /* 稍微减小字体 */
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
  padding: 4px 12px; /* 上下变窄，从8px减少到4px，适应非常窄的header */
  border-radius: 16px; /* 稍微减小圆角 */
  box-shadow: 0 4px 12px rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.question-number:hover .question-date {
  background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.15) 100%);
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(255,255,255,0.3);
}

.question-date i {
  font-size: 0.9rem;
  margin-right: 6px;
  color: rgba(255,255,255,0.9);
}

/* 状态样式优化 - 更有趣的设计 */
.status-answered {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  padding: 4px 14px; /* 上下变窄，从10px减少到4px，适应非常窄的header */
  border-radius: 20px; /* 稍微减小圆角 */
  font-weight: 700;
  font-size: 0.85rem; /* 稍微减小字体 */
  box-shadow: 0 4px 12px rgba(34,197,94,0.4);
  border: 2px solid rgba(255,255,255,0.3);
  position: relative;
  z-index: 1;
  animation: statusGlow 2s ease-in-out infinite alternate;
}

@keyframes statusGlow {
  from { box-shadow: 0 6px 20px rgba(34,197,94,0.4); }
  to { box-shadow: 0 6px 20px rgba(34,197,94,0.6); }
}

.status-unanswered {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  padding: 4px 14px; /* 上下变窄，从10px减少到4px，适应非常窄的header */
  border-radius: 20px; /* 稍微减小圆角 */
  font-weight: 700;
  font-size: 0.85rem; /* 稍微减小字体 */
  box-shadow: 0 4px 12px rgba(239,68,68,0.4);
  border: 2px solid rgba(255,255,255,0.3);
  position: relative;
  z-index: 1;
  animation: statusPulse 1.5s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}


/* 动画 */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(.4,0,.2,1);
}

.fade-slide-enter, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter, .fade-leave-to {
  opacity: 0;
}

/* 响应式设计调整 */
@media (max-width: 1800px) {
  .exam-content-flex-row {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 16px;
    justify-content: center;
    margin-top: 20px;
    margin-bottom: 60px;
  }
  
  .sidebar-placeholder-left {
    width: 300px;
    min-width: 300px;
    max-width: 300px;
  }
  
  .sidebar-placeholder {
    width: 200px !important;
    min-width: 200px !important;
    max-width: 200px !important;
  }
  
  .question-main {
    width: 100% !important;
    max-width: 100% !important; /* 移除宽度限制，使其更宽 */
  }
  
  .question-card {
    width: 100% !important;
    max-width: 100% !important; /* 移除宽度限制，使其更宽 */
  }
}

@media (max-width: 1200px) {
  .sidebar-placeholder-left {
    width: 250px;
    min-width: 250px;
    max-width: 250px;
  }
  
  .sidebar-placeholder {
    width: 150px !important;
    min-width: 150px !important;
    max-width: 150px !important;
  }
  
  .question-main {
    width: 100% !important;
    max-width: 100% !important; /* 移除宽度限制，使其更宽 */
  }
  
  .question-card {
    width: 100% !important;
    max-width: 100% !important; /* 移除宽度限制，使其更宽 */
  }
}

@media (max-width: 1024px) {
  .exam-content-flex-row {
    margin-top: 20px;
    margin-bottom: 60px;
  }
  
  .sidebar-placeholder-left {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
  
  .sidebar-placeholder {
    width: 100px !important;
    min-width: 100px !important;
    max-width: 100px !important;
  }
  
  .header-center {
    padding: 0 220px;
  }
}

@media (max-width: 768px) {
  .exam-content-flex-row {
    margin-top: 20px; /* 移动端：为 NavBar 留出少量空间 */
    margin-bottom: 20px;
    padding: 0 10px;
  }
  
  /* 移动端隐藏占位区域 */
  .sidebar-placeholder-left {
    display: none;
  }
  
  .sidebar-placeholder {
    display: none !important;
  }
  
  /* 移动端左右布局改为上下布局 */
  .question-content-unified {
    flex-direction: column;
    gap: 16px;
  }
  
  .question-left-panel,
  .question-right-panel {
    flex: 1 !important;
    padding: 0;
    width: 100%;
    min-width: auto !important;
    max-width: none !important;
  }
  
  .header-left {
    left: 12px;
    gap: 12px;
  }
  
  .header-right {
    right: 12px;
  }
  
  .header-center {
    padding: 0 150px;
  }
  
  .progress-info {
    min-width: 80px;
  }
  
  .progress-info span {
    font-size: 11px;
  }
  
  .progress-bar {
    width: 80px;
    height: 4px;
  }
  
  .mini-question-item {
    width: 32px;
    height: 32px;
    font-size: 0.75rem;
  }
  
  .nav-btn {
    padding: 6px 20px;
    font-size: 0.85rem;
    min-width: 100px;
    height: auto;
  }
  
  .sidebar-explanation {
    top: 95px; /* 移动端调整sticky位置 */
    width: 100%;
    max-width: 100%;
  }
  
  /* 移动端 exam-card-wrapper 样式 */
  .exam-card-wrapper {
    width: 95%;
    max-width: 100%;
    margin: 60px auto 0; /* 移动端也下移一些 */
  }
  
  .exam-level-header {
    padding: 10px 20px; /* 移动端也变窄 */
    border-radius: 16px 16px 0 0;
  }
  
  .exam-level-header-content {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .exam-title {
    font-size: 1.2rem;
  }
  
  .question-content-wrapper {
    padding: 16px;
    border-radius: 0 0 16px 16px;
  }
  
  /* 移动端箭头样式调整 */
  .question-main {
    gap: 8px;
  }
  
  .question-nav-arrow {
    width: 44px;
    height: 44px;
  }
  
  .question-nav-arrow :deep(svg) {
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .header-left {
    left: 8px;
    gap: 8px;
  }
  
  .header-right {
    right: 8px;
  }
  
  .header-center {
    padding: 0 120px;
  }
  
  .exit-practice-btn {
    width: 40px;
    height: 40px;
    padding: 10px;
  }
  
  .submit-btn-header {
    padding: 8px 16px;
    font-size: 0.85rem;
  }
  
  /* 小屏幕箭头样式调整 */
  .question-main {
    gap: 6px;
  }
  
  .question-nav-arrow {
    width: 40px;
    height: 40px;
  }
  
  .question-nav-arrow :deep(svg) {
    width: 20px;
    height: 20px;
  }
}

.sidebar-explanation {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  padding: 20px;
  margin: 0;
  height: auto;
  align-content: start;
  justify-content: flex-start;
  position: sticky;
  top: 68px; /* 调整sticky位置，为固定的header留出空间 (NavBar 48px + 部分exam-header) */
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
  order: 3;
}

/* 右侧解析栏内的题目解析样式调整 */
.sidebar-explanation .question-explanation {
  margin-top: 0;
  background: transparent; /* 去掉背景 */
  border-left: none; /* 去掉左边框 */
  border-radius: 0; /* 去掉圆角 */
  padding: 0; /* 去掉内边距 */
  height: auto !important;
  min-height: auto; /* 去掉最小高度限制 */
  overflow-y: visible; /* 改为visible */
  flex-shrink: 0;
  width: 100% !important;
  box-sizing: border-box;
}

.sidebar-explanation .explanation-content {
  background: #f8fafc; /* 给内容区域添加背景 */
  border-radius: 12px; /* 给内容区域添加圆角 */
  padding: 16px 20px;
  margin-top: 12px;
  height: auto !important;
  min-height: 300px;
  overflow-y: auto;
  width: 100% !important;
  box-sizing: border-box;
  word-wrap: break-word;
  word-break: break-word;
  border: 1px solid #e2e8f0; /* 给内容区域添加边框 */
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); /* 给内容区域添加阴影 */
}


/* 浮动题目解析按钮样式 */
.floating-ai-button {
  position: fixed;
  right: 40px;
  bottom: 40px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.ai-button {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: #fff;
  border: none;
  border-radius: 34px; /* 椭圆形 */
  min-width: 90px;
  height: 68px;
  box-shadow: 0 4px 16px rgba(30,144,255,0.25);
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  outline: none;
  padding: 0 22px 0 18px;
  gap: 10px;
}

.ai-button-text {
  position: static;
  font-size: 1.1rem;
  background: none;
  color: #fff;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  white-space: nowrap;
  font-weight: 600;
  opacity: 1;
  pointer-events: none;
}

.ai-button i {
  font-size: 2rem;
  margin-left: 0;
}

.ai-button--loading {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 让面板绝对定位在按钮上方 - 改为浮动面板 */
.ai-panel {
  position: fixed;
  right: 40px;
  bottom: 120px; /* 按钮高度+间距 */
  width: 280px; /* 从380px缩窄到280px */
  max-height: 70vh; /* 设置最大高度为视口高度的70% */
  background: rgba(255, 255, 255, 0.08); /* 极高透明度的背景 */
  backdrop-filter: blur(25px) saturate(200%); /* 增强背景模糊效果 */
  -webkit-backdrop-filter: blur(25px) saturate(200%); /* Safari 兼容 */
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(30,144,255,0.25), 
              0 0 0 1px rgba(255, 255, 255, 0.4) inset; /* 双重阴影效果 */
  border: 1px solid rgba(255, 255, 255, 0.6);
  padding: 0;
  overflow: hidden;
  animation: aiPanelInUp 0.3s;
  z-index: 10000;
  display: flex;
  flex-direction: column;
}

/* 向上展开动画 */
@keyframes aiPanelInUp {
  from { opacity: 0; transform: translateY(40px);}
  to { opacity: 1; transform: translateY(0);}
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.3) 0%, rgba(56, 189, 248, 0.3) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: #fff;
  padding: 14px 18px; /* 缩小内边距 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); /* 增强文字阴影让文字更清晰 */
  flex-shrink: 0;
}

.ai-panel-header h3 {
  margin: 0;
  font-size: 1rem; /* 从1.2rem减小到1rem */
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}
.ai-close-btn:hover {
  background: rgba(255,255,255,0.2);
}

.ai-panel-content {
  padding: 20px;
  background: transparent;
  overflow-y: auto;
  flex: 1;
  max-height: calc(70vh - 70px); /* 减去头部高度 */
}

/* 内容区域滚动条样式 */
.ai-panel-content::-webkit-scrollbar {
  width: 6px;
}

.ai-panel-content::-webkit-scrollbar-track {
  background: rgba(241, 245, 249, 0.2);
  border-radius: 3px;
}

.ai-panel-content::-webkit-scrollbar-thumb {
  background: rgba(203, 213, 225, 0.5);
  border-radius: 3px;
}

.ai-panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}

/* AI面板中的解析内容样式 - 极高透明度玻璃效果 */
.ai-panel .explanation-content {
  background: rgba(255, 255, 255, 0.12); /* 极高透明度的背景 */
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 20px rgba(30,144,255,0.2),
              0 0 0 1px rgba(255, 255, 255, 0.3) inset;
  min-height: 150px; /* 减小最小高度 */
  height: auto;
  max-height: none; /* 允许内容自适应高度 */
}

.ai-panel .explanation-content {
  padding: 16px; /* 添加合适的内边距 */
}

.ai-panel .explanation-content p {
  color: #0c1222; /* 更深的颜色确保可读性 */
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9), 
               0 0 10px rgba(255, 255, 255, 0.5); /* 增强文字背光效果 */
  line-height: 1.7;
  font-size: 0.9rem; /* 稍微减小字体 */
}

.ai-placeholder {
  text-align: center;
  color: #0c1222;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9),
               0 0 10px rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
  padding: 30px 20px;
  border-radius: 12px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.ai-placeholder-icon {
  font-size: 2.5rem;
  color: #1e90ff;
  margin-bottom: 12px;
  text-shadow: 0 2px 4px rgba(255, 255, 255, 0.9),
               0 0 15px rgba(255, 255, 255, 0.6);
  filter: drop-shadow(0 0 8px rgba(30, 144, 255, 0.3));
}

.ai-analyze-btn {
  margin-top: 18px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 28px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(30,144,255,0.18);
  transition: all 0.2s;
}
.ai-analyze-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.ai-analyze-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
  transform: translateY(-1px) scale(1.04);
}

.ai-response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  color: #1e90ff;
  font-weight: 700;
  margin-bottom: 12px;
  background: rgba(224, 242, 254, 0.18); /* 极高透明度的天蓝色背景 */
  padding: 10px 16px;
  border-radius: 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(30, 144, 255, 0.4);
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9),
               0 0 10px rgba(255, 255, 255, 0.5);
}

.ai-response-content h4 {
  margin: 12px 0 6px 0;
  color: #1e90ff;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-analysis-section,
.ai-solution-section,
.ai-tips-section {
  margin-bottom: 10px;
}

.ai-tips-section ul {
  padding-left: 18px;
  margin: 0;
  color: #64748b;
  font-size: 0.98rem;
}

.ai-tips-section li {
  margin-bottom: 4px;
}

@media (max-width: 600px) {
  .floating-ai-button {
    right: 10px;
    bottom: 10px;
  }
  .ai-panel {
    width: calc(100vw - 20px); /* 留出左右边距 */
    max-width: none;
    right: 10px;
    bottom: 80px;
    left: 10px;
    max-height: 60vh;
  }
  
  .ai-panel-content {
    max-height: calc(60vh - 60px);
  }
}



/* 图片模态框样式 */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.image-modal-content {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
}

.image-modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 2rem;
  color: #333;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.image-modal-close:hover {
  background-color: #eee;
}

.modal-image {
  display: block;
  max-width: 90vw;
  max-height: 85vh;
  width: auto;
  height: auto;
  object-fit: contain;
}

/* 提交结果弹窗样式 */
.submit-result-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.submit-result-modal-content {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.submit-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: #fff;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.submit-result-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

.submit-result-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.submit-result-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.submit-result-body {
  padding: 24px;
  flex-grow: 1;
}
.test-submit-hint {
  margin: 0;
  color: #475569;
  line-height: 1.6;
  font-size: 0.95rem;
}

.result-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  width: 100%;
}

.score-section {
  display: flex;
  align-items: center;
  gap: 15px;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border-radius: 20px;
  padding: 15px 25px;
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
}

.score-circle {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 50%;
  width: 100px;
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.2);
}

.score-number {
  font-size: 3.5rem;
  font-weight: 900;
  color: #fff;
  line-height: 1;
}

.score-label {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin-top: -10px;
}

.score-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.exam-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #374151;
  margin-bottom: 5px;
}

.attempt-info {
  font-size: 0.9rem;
  color: #64748b;
}

.result-details {
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin-top: 15px;
  padding: 15px 0;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.detail-label {
  font-size: 0.8rem;
  color: #64748b;
}

.detail-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e90ff;
}

.detail-value.correct {
  color: #22c55e;
}

.detail-value.incorrect {
  color: #ef4444;
}

.result-message {
  margin-top: 15px;
  padding: 15px 20px;
  background: #f3f4f6;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.message {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
  padding: 10px 15px;
  border-radius: 10px;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
}

.message.excellent {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border: 1px solid #bae6fd;
  color: #1e90ff;
}

.message.good {
  background: linear-gradient(135deg, #e7f9ef 0%, #d1fae5 100%);
  border: 1px solid #d1fae5;
  color: #16a34a;
}

.message.pass {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border: 1px solid #bae6fd;
  color: #1e90ff;
}

.message.need-improvement {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fee2e2;
  color: #ef4444;
}

.submit-result-footer {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.submit-result-footer .btn-primary,
.submit-result-footer .btn-secondary {
  padding: 12px 30px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-result-footer .btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(30,144,255,0.2);
}

.submit-result-footer .btn-primary:hover {
  background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30,144,255,0.3);
}

.submit-result-footer .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.submit-result-footer .btn-secondary {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.2);
}

.submit-result-footer .btn-secondary:hover {
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(100, 116, 139, 0.3);
}

.mode-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 复习模式容器样式 - 参考考试标题格式 */
.review-mode-container {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 8px 18px;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.review-mode-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.review-mode-container:hover::before {
  left: 100%;
}

.review-mode-container:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.15);
  transform: translateY(-1px);
}

.review-mode-text {
  margin: 0;
  color: #2c5282;
  font-weight: 600;
  font-size: 1rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  position: relative;
  z-index: 1;
}

/* 右侧占位区域 */
.sidebar-placeholder {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  padding: 20px;
  margin: 0;
  height: auto;
  align-content: start;
  justify-content: flex-start;
  position: sticky;
  top: 68px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
  order: 3;
  flex-shrink: 0;
}

.back-btn {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border: none;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  padding: 14px 24px;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(30,144,255,0.25);
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: center;
}

.back-btn:hover {
  background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30,144,255,0.3);
}

/* 退出确认弹窗样式 */
.exit-confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.exit-confirm-modal-content {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 450px;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.exit-confirm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.exit-confirm-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

.exit-confirm-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.exit-confirm-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.exit-confirm-body {
  padding: 24px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.exit-confirm-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: pulse 2s infinite;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #f59e0b;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.exit-confirm-message {
  margin: 0 0 20px 0;
  color: #374151;
  font-size: 16px;
  line-height: 1.6;
}

.exit-confirm-warning {
  color: #ef4444;
  font-weight: 600;
  font-size: 14px;
}

.exit-confirm-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  width: 100%;
}

.exit-confirm-info .info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.exit-confirm-info .info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.info-value {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.exit-confirm-footer {
  display: flex;
  justify-content: center;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 24px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(239,68,68,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239,68,68,0.3);
}

/* 提示弹窗样式 */
.alert-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.alert-modal-content {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 400px;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.alert-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.alert-modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
}

.alert-modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.alert-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.alert-modal-body {
  padding: 24px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.alert-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: pulse 2s infinite;
}

.alert-message {
  margin: 0;
  color: #374151;
  font-size: 16px;
  line-height: 1.6;
}

.alert-modal-footer {
  display: flex;
  justify-content: center;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.alert-modal-footer .btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 140px;
  position: relative;
  overflow: hidden;
}

.alert-modal-footer .btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.6s ease;
}

.alert-modal-footer .btn-primary:hover::before {
  left: 100%;
}

.alert-modal-footer .btn-primary:hover {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
}

.alert-modal-footer .btn-primary:active {
  transform: translateY(0) scale(0.98);
}

/* 进度弹窗样式 */
.progress-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

.progress-modal-content {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  animation: slideUp 0.3s ease;
}

.progress-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: #fff;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.progress-modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-modal-close {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 18px;
  backdrop-filter: blur(10px);
}

.progress-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.progress-modal-close:active {
  transform: scale(0.95);
}

.progress-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.progress-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.summary-label {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e90ff;
}

.summary-value.answered {
  color: #22c55e;
}

.summary-value.unanswered {
  color: #ef4444;
}

.progress-bar-full {
  width: 100%;
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(30, 144, 255, 0.1);
}

.progress-fill-full {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 6px;
  transition: width 0.5s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
}

.questions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.question-item {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid #d1d5db;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.12);
  color: #374151;
  position: relative;
  overflow: hidden;
}

.question-item:hover {
  transform: scale(1.1) translateY(-2px);
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.25);
  border-color: #1e90ff;
}

.question-item--active {
  border: 2px solid #1e90ff;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #1e90ff;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  transform: scale(1.1);
  animation: activePulse 2s ease-in-out infinite;
}

.question-item--answered {
  border: 2px solid #22c55e;
  background: linear-gradient(135deg, #e7f9ef 0%, #d1fae5 100%);
  color: #22c55e;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);
}

.question-item--unanswered {
  border: 2px solid #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

.question-item-number {
  font-size: 0.9rem;
  font-weight: 800;
  color: inherit;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1;
}

.question-item-icon {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #22c55e;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* 进度弹窗滚动条样式 */
.progress-modal-body::-webkit-scrollbar,
.questions-grid::-webkit-scrollbar {
  width: 8px;
}

.progress-modal-body::-webkit-scrollbar-track,
.questions-grid::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.progress-modal-body::-webkit-scrollbar-thumb,
.questions-grid::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  border: 2px solid #f1f5f9;
}

.progress-modal-body::-webkit-scrollbar-thumb:hover,
.questions-grid::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes activePulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
    transform: scale(1.1);
  }
  50% {
    box-shadow: 0 6px 16px rgba(30, 144, 255, 0.4);
    transform: scale(1.15);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .progress-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .progress-summary {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 16px;
  }

  .questions-grid {
    grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
    gap: 10px;
  }

  .question-item {
    width: 45px;
    height: 45px;
    font-size: 0.85rem;
  }
}
</style>