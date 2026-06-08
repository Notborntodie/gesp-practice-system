<template>
  <div class="my-submissions-section">
    <div class="content-section submissions-content-section">
      <div class="section-header submissions-header">
        <h4 class="section-title"><Icon name="file-text" :size="22" /> {{ sectionTitle }}</h4>
      </div>
      <div class="section-content submissions-body">
        <!-- 未登录 -->
        <div v-if="!userId && mode !== 'students'" class="empty-state">
          <div class="empty-icon"><Icon name="lock" :size="64" /></div>
          <h3>请先登录</h3>
          <p>登录后可查看编程题与客观题提交记录</p>
        </div>
        <!-- 学生提交模式但未传教师 ID -->
        <div v-else-if="mode === 'students' && !teacherId" class="empty-state">
          <div class="empty-icon"><Icon name="users" :size="64" /></div>
          <h3>无法加载</h3>
          <p>请使用教师账号从计划页进入「学生提交」</p>
        </div>
        <template v-else>
          <!-- 学生筛选（仅教师模式） -->
          <div v-if="isStudentsMode" class="student-filter-bar">
            <div class="student-search-wrap">
              <Icon name="search" :size="18" class="search-icon" />
              <input
                v-model="studentSearchKeyword"
                type="text"
                class="student-search-input"
                placeholder="搜索学生姓名..."
                @input="onStudentSearchInput"
              />
              <button
                v-if="selectedStudentId"
                type="button"
                class="student-filter-clear"
                @click="clearStudentFilter"
                title="清除筛选"
              >×</button>
            </div>
            <div class="student-dropdown-wrap">
              <select :value="selectedStudentId" class="student-select" @change="onStudentFilterChange">
                <option :value="0">全部学生（{{ studentList.length }}人）</option>
                <option
                  v-for="s in filteredStudentList"
                  :key="s.id"
                  :value="s.id"
                >{{ s.real_name || s.username }}{{ s.class_no ? `（${s.class_no}）` : '' }}</option>
              </select>
            </div>
          </div>

          <!-- 已选中的单个学生信息头 -->
          <div v-if="isStudentsMode && selectedStudentId > 0 && selectedStudentInfo" class="selected-student-header">
            <Icon name="user" :size="20" />
            <span class="selected-student-name">{{ selectedStudentInfo.real_name || selectedStudentInfo.username }}</span>
            <span v-if="selectedStudentInfo.class_no" class="selected-student-class">（{{ selectedStudentInfo.class_no }}）</span>
            <button type="button" class="btn-clear-filter" @click="clearStudentFilter">取消筛选</button>
          </div>

          <div class="tab-bar">
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'oj' }" @click="activeTab = 'oj'">
              <Icon name="code" :size="18" />
              <span>编程题</span>
              <span v-if="ojSubmissions.length > 0" class="tab-count">{{ ojSubmissions.length }}</span>
            </button>
            <button type="button" class="tab-btn" :class="{ active: activeTab === 'exam' }" @click="activeTab = 'exam'">
              <Icon name="clipboard-list" :size="18" />
              <span>客观题</span>
              <span v-if="examSubmissions.length > 0" class="tab-count">{{ examSubmissions.length }}</span>
            </button>
          </div>

          <div v-if="loading" class="loading-state">
            <div class="loading-icon"><Icon name="loader-2" :size="64" spin /></div>
            <h3>加载中...</h3>
            <p>正在获取提交记录</p>
          </div>

          <!-- 编程题列表：显示判题结果与通过数，点击打开详情 -->
          <template v-else-if="activeTab === 'oj'">
            <div v-if="ojSubmissions.length === 0" class="empty-state">
              <div class="empty-icon"><Icon name="code" :size="64" /></div>
              <h3>暂无编程题提交</h3>
              <p>去 GESP 编程题 做几道题即可在这里看到记录</p>
            </div>
            <div v-else class="submissions-list-wrap">
              <div class="list-toolbar">
                <span class="toolbar-label">每页显示</span>
                <select v-model.number="ojPageSize" class="page-size-select" @change="onOjPageSizeChange">
                  <option v-for="n in ojPageSizeOptions" :key="n" :value="n">{{ n }} 条</option>
                </select>
                <span class="toolbar-count">共 {{ ojSubmissions.length }} 条</span>
              </div>
              <ul class="submission-list">
                <li
                  v-for="item in ojSubmissions"
                  :key="'oj-' + item.id"
                  class="submission-row"
                  @click="viewOJDetail(item)"
                >
                  <div class="row-main">
                    <span class="row-title">{{ item.problem_title || `题目 #${item.problem_id}` }}</span>
                    <span v-if="mode === 'students' && (item.real_name || item.username)" class="row-student-name">{{ item.real_name || item.username }}</span>
                    <span class="row-meta">{{ formatDateTime(item.submit_time) }}</span>
                    <span v-if="item.plan_name" class="row-source source-plan" title="来自学习计划"><Icon name="book" :size="14" /> {{ item.plan_name }}</span>
                    <span v-else class="row-source source-self" title="自主练习"><Icon name="edit-3" :size="14" /> 自主练习</span>
                  </div>
                  <div class="row-right">
                    <span v-if="item.total_tests != null" class="pass-count">{{ item.passed_tests ?? 0 }}/{{ item.total_tests }}</span>
                    <span class="verdict-badge" :class="getVerdictClass(item.verdict)">{{ getVerdictText(item.verdict) }}</span>
                    <button
                      type="button"
                      class="btn-view-problem btn-oj-parse"
                      title="视频解析"
                      @click.stop="openOJVideoModal(item)"
                    >
                      <Icon name="video" :size="16" /> 视频解析
                    </button>
                    <button
                      type="button"
                      class="btn-view-problem btn-oj-parse"
                      title="文字解析"
                      @click.stop="openOJAnalysisModal(item)"
                    >
                      <Icon name="file-text" :size="16" /> 文字解析
                    </button>
                    <button
                      type="button"
                      class="btn-view-problem"
                      title="查看题目"
                      @click.stop="goToProblem(item.problem_id)"
                    >
                      <Icon name="book-open" :size="16" /> 查看题目
                    </button>
                  </div>
                </li>
              </ul>
              <a href="/oj-submissions" class="link-all" @click.prevent="goToOJSubmissionsAll">
                <Icon name="external-link" :size="16" /> 查看全部编程题提交
              </a>
            </div>
          </template>

          <!-- 客观题列表：显示分数、第几次尝试，点击打开详情 -->
          <template v-else>
            <div v-if="examSubmissions.length === 0" class="empty-state">
              <div class="empty-icon"><Icon name="clipboard-list" :size="64" /></div>
              <h3>暂无客观题提交</h3>
              <p>去 GESP 客观题 参加考试即可在这里看到记录</p>
            </div>
            <div v-else class="submissions-list-wrap">
              <ul class="submission-list">
                <li
                  v-for="item in examSubmissions"
                  :key="'exam-' + item.id"
                  class="submission-row"
                  @click="viewExamDetail(item)"
                >
                  <div class="submission-info">
                    <h4 class="row-title">{{ item.exam_name || `考试 #${item.exam_id}` }}</h4>
                    <p v-if="mode === 'students' && (item.real_name || item.username)" class="row-student-name">学生：{{ item.real_name || item.username }}</p>
                    <p class="row-meta">提交时间：{{ formatDateTime(item.submit_time) }}</p>
                    <p class="attempt-info">第 {{ item.attempt_number || 1 }} 次尝试 · {{ getLevelText(item.exam_level) }}
                      <span v-if="item.plan_name" class="row-source source-plan"><Icon name="book" :size="14" /> {{ item.plan_name }}</span>
                      <span v-else class="row-source source-self"><Icon name="edit-3" :size="14" /> 自主练习</span>
                    </p>
                  </div>
                  <div class="submission-score">
                    <span class="score" :class="getScoreClass(item.score)">{{ item.score ?? 0 }}分</span>
                  </div>
                </li>
              </ul>
              <a href="/select" class="link-all" @click.prevent="goToExamSubmissionsAll">
                <Icon name="external-link" :size="16" /> 去练习 / 考试列表
              </a>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- 客观题提交详情弹窗（与 Profile 练习记录一致） -->
    <div v-if="showExamDetailModal" class="submission-detail-modal" @click="closeExamDetailModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ mode === 'students' && (selectedExamSubmission?.real_name || selectedExamSubmission?.username) ? `${selectedExamSubmission.real_name || selectedExamSubmission.username} - ` : '' }}第 {{ selectedExamSubmission?.attempt_number || 1 }} 次提交详情</h3>
          <button type="button" class="close-btn" @click="closeExamDetailModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="examDetailLoading" class="detail-loading">
            <div class="loading-icon"><Icon name="loader-2" :size="40" spin /></div>
            <p>加载详情中...</p>
          </div>
          <template v-else>
            <div class="detail-summary">
              <div class="summary-header">
                <div class="summary-score">
                  <div class="score-circle-large" :class="getScoreClass(selectedExamSubmission?.score)">
                    <span class="score-number-large">{{ selectedExamSubmission?.score ?? 0 }}</span>
                    <span class="score-label-large">分</span>
                  </div>
                </div>
                <div class="summary-info">
                  <h4>{{ selectedExamSubmission?.exam_name || '未知考试' }}</h4>
                  <p class="summary-date">{{ formatDateTime(selectedExamSubmission?.submit_time) }}</p>
                  <div class="summary-stats">
                    <span class="stat-item">
                      <span class="stat-label">等级:</span>
                      <span class="stat-value">{{ getLevelText(selectedExamSubmission?.exam_level) }}</span>
                    </span>
                    <span class="stat-item">
                      <span class="stat-label">尝试次数:</span>
                      <span class="stat-value">{{ selectedExamSubmission?.attempt_number || 1 }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="answers-section">
              <div class="answers-section-header">
                <h4>答题详情</h4>
                <label class="only-wrong-toggle">
                  <input type="checkbox" v-model="examDetailOnlyWrong" class="only-wrong-checkbox" />
                  <span>只看错题</span>
                </label>
              </div>
              <p v-if="examDetailOnlyWrong && examSubmissionAnswersFiltered.length === 0" class="only-wrong-empty">
                本次提交没有错题
              </p>
              <div v-else class="answers-list">
                <div
                  v-for="(answer, index) in examSubmissionAnswersFiltered"
                  :key="index"
                  class="answer-item"
                  :class="{ correct: answer.is_correct, incorrect: !answer.is_correct }"
                >
                  <div class="answer-header">
                    <span class="question-number">第 {{ answer.question_number ?? index + 1 }} 题</span>
                    <span class="answer-status" :class="{ correct: answer.is_correct, incorrect: !answer.is_correct }">
                      {{ answer.is_correct ? '✓ 正确' : '✗ 错误' }}
                    </span>
                  </div>
                  <div class="question-text">{{ answer.question_text }}</div>
                  <!-- 题目代码（若有） -->
                  <div v-if="answer.question_code" class="question-code-block">
                    <pre><code>{{ answer.question_code }}</code></pre>
                  </div>
                  <!-- 题目图片（若有） -->
                  <div v-if="answer.image_url" class="question-image-wrap">
                    <img :src="answer.image_url" alt="题目图片" class="question-image" loading="lazy" />
                  </div>
                  <!-- 题目选项 -->
                  <div v-if="answer.options && answer.options.length" class="question-options">
                    <div
                      v-for="opt in answer.options"
                      :key="opt.label"
                      class="option-row"
                      :class="{
                        'option-user': opt.value === answer.user_answer,
                        'option-correct': opt.value === answer.correct_answer,
                        'option-user-wrong': opt.value === answer.user_answer && !answer.is_correct
                      }"
                    >
                      <span class="option-label">{{ opt.label }}.</span>
                      <span class="option-text">{{ opt.text }}</span>
                      <span v-if="opt.value === answer.user_answer" class="option-tag">您的答案</span>
                      <span v-if="opt.value === answer.correct_answer" class="option-tag correct-tag">正确答案</span>
                    </div>
                  </div>
                  <div class="answer-details">
                    <div class="answer-choice">
                      <span class="choice-label">您的答案:</span>
                      <span class="choice-value" :class="{ correct: answer.is_correct, incorrect: !answer.is_correct }">
                        {{ getOptionLabel(answer.options, answer.user_answer) || answer.user_answer }}
                      </span>
                    </div>
                    <div v-if="!answer.is_correct" class="correct-answer">
                      <span class="choice-label">正确答案:</span>
                      <span class="choice-value correct">{{ getOptionLabel(answer.options, answer.correct_answer) || answer.correct_answer }}</span>
                    </div>
                  </div>
                  <!-- 解析 -->
                  <div v-if="answer.explanation" class="explanation-block">
                    <div class="explanation-title">解析</div>
                    <div class="explanation-content">{{ answer.explanation }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeExamDetailModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 编程题提交详情弹窗：只显示错了几个点 + 代码 -->
    <div v-if="showOJDetailModal" class="submission-detail-modal" @click="closeOJDetailModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>提交 #{{ selectedOJDetail?.id }} 详情</h3>
          <button type="button" class="close-btn" @click="closeOJDetailModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="ojDetailLoading" class="detail-loading">
            <div class="loading-icon"><Icon name="loader-2" :size="40" spin /></div>
            <p>加载详情中...</p>
          </div>
          <template v-else-if="selectedOJDetail">
            <div class="oj-detail-brief">
              <span class="wrong-points">{{ ojWrongPointsText(selectedOJDetail) }}</span>
            </div>
            <div v-if="selectedOJDetail.code" class="code-section">
              <h4>提交的代码</h4>
              <pre class="code-block"><code>{{ selectedOJDetail.code }}</code></pre>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeOJDetailModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- OJ 题目视频解析弹窗 -->
    <div v-if="showOJVideoModal" class="submission-detail-modal" @click="closeOJVideoModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>题目视频解析 · {{ ojProblemForModal?.title || '加载中...' }}</h3>
          <button type="button" class="close-btn" @click="closeOJVideoModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="ojVideoLoading" class="detail-loading">
            <div class="loading-icon"><Icon name="loader-2" :size="40" spin /></div>
            <p>加载中...</p>
          </div>
          <template v-else>
            <div v-if="ojProblemForModal?.video_url" class="oj-video-body">
              <a
                :href="ojProblemForModal.video_url"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-video-link"
              >
                <span class="btn-video-icon">▶</span> 打开讲解视频
              </a>
              <p class="video-hint">将在新窗口打开视频链接</p>
            </div>
            <div v-else class="oj-empty-hint">
              <Icon name="video-off" :size="48" />
              <p>该题暂无讲解视频</p>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeOJVideoModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- OJ 题目文字解析弹窗 -->
    <div v-if="showOJAnalysisModal" class="submission-detail-modal" @click="closeOJAnalysisModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>题目文字解析 · {{ ojProblemForModal?.title || '加载中...' }}</h3>
          <button type="button" class="close-btn" @click="closeOJAnalysisModal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="ojAnalysisLoading" class="detail-loading">
            <div class="loading-icon"><Icon name="loader-2" :size="40" spin /></div>
            <p>加载中...</p>
          </div>
          <template v-else>
            <div v-if="ojProblemForModal?.analysis" class="oj-analysis-body markdown-content" v-html="renderMarkdown(ojProblemForModal.analysis)"></div>
            <div v-else class="oj-empty-hint">
              <Icon name="file-text" :size="48" />
              <p>该题暂无文字解析</p>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeOJAnalysisModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { BASE_URL } from '@/config/api'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import katex from 'katex'

const props = withDefaults(defineProps<{ mode?: 'mine' | 'students'; teacherId?: number }>(), {
  mode: 'mine',
  teacherId: 0
})

const router = useRouter()

const activeTab = ref<'oj' | 'exam'>('oj')
const userId = ref<number | null>(null)
const loading = ref(true)
const ojSubmissions = ref<any[]>([])
const examSubmissions = ref<any[]>([])

// 学生筛选（仅教师模式）
const studentList = ref<any[]>([])
const selectedStudentId = ref<number>(0)
const studentSearchKeyword = ref('')

const ojPageSizeOptions = [50, 100, 200, 500, 1000]
const ojPageSize = ref(200)

const sectionTitle = computed(() => (props.mode === 'students' ? '学生提交' : '我的提交'))
const isStudentsMode = computed(() => props.mode === 'students' && props.teacherId > 0)

// 按搜索关键词过滤学生列表
const filteredStudentList = computed(() => {
  const kw = studentSearchKeyword.value.trim().toLowerCase()
  if (!kw) return studentList.value
  return studentList.value.filter((s: any) => {
    const name = (s.real_name || s.username || '').toLowerCase()
    return name.includes(kw)
  })
})

// 当前选中的学生信息
const selectedStudentInfo = computed(() => {
  if (!selectedStudentId.value) return null
  return studentList.value.find((s: any) => s.id === selectedStudentId.value) || null
})

// 客观题详情弹窗
const showExamDetailModal = ref(false)
const selectedExamSubmission = ref<any>(null)
const examSubmissionAnswers = ref<any[]>([])
const examDetailLoading = ref(false)
const examDetailOnlyWrong = ref(false)
// 客观题详情列表：支持「只看错题」筛选
const examSubmissionAnswersFiltered = computed(() => {
  const list = examSubmissionAnswers.value
  if (!examDetailOnlyWrong.value) return list
  return list.filter((a: any) => !a.is_correct)
})

// 编程题详情弹窗
const showOJDetailModal = ref(false)
const selectedOJDetail = ref<any>(null)
const ojDetailLoading = ref(false)

// OJ 题目视频/文字解析弹窗（共用题目数据）
const showOJVideoModal = ref(false)
const showOJAnalysisModal = ref(false)
const ojProblemForModal = ref<{ id: number; title?: string; video_url?: string; analysis?: string } | null>(null)
const ojVideoLoading = ref(false)
const ojAnalysisLoading = ref(false)

function getUserId (): number | null {
  try {
    const raw = localStorage.getItem('userInfo')
    if (!raw) return null
    const info = JSON.parse(raw)
    return info?.id ?? null
  } catch {
    return null
  }
}

async function fetchOJSubmissions () {
  const uid = userId.value
  if (!uid) return
  try {
    const size = ojPageSize.value
    const res = await fetch(`${BASE_URL}/oj/submissions?userId=${uid}&page=1&pageSize=${size}`)
    const data = await res.json()
    if (data?.success && Array.isArray(data.data)) {
      ojSubmissions.value = data.data
    } else {
      ojSubmissions.value = []
    }
  } catch {
    ojSubmissions.value = []
  }
}

async function fetchExamSubmissions () {
  const uid = userId.value
  if (!uid) return
  try {
    const res = await fetch(`${BASE_URL}/submissions?user_id=${uid}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      examSubmissions.value = data
    } else {
      examSubmissions.value = []
    }
  } catch {
    examSubmissions.value = []
  }
}

async function fetchTeacherOJSubmissions () {
  const tid = props.teacherId
  if (!tid) return
  try {
    const size = ojPageSize.value
    let url = `${BASE_URL}/teacher/${tid}/oj-submissions?page=1&pageSize=${size}`
    if (selectedStudentId.value > 0) {
      url += `&studentId=${selectedStudentId.value}`
    }
    const res = await fetch(url)
    const data = await res.json()
    if (data?.success && Array.isArray(data.data)) {
      ojSubmissions.value = data.data
    } else {
      ojSubmissions.value = []
    }
  } catch {
    ojSubmissions.value = []
  }
}

function onOjPageSizeChange () {
  loading.value = true
  if (isStudentsMode.value) {
    fetchTeacherOJSubmissions().finally(() => { loading.value = false })
  } else {
    fetchOJSubmissions().finally(() => { loading.value = false })
  }
}

async function fetchTeacherExamSubmissions () {
  const tid = props.teacherId
  if (!tid) return
  try {
    let url = `${BASE_URL}/teacher/${tid}/submissions-list`
    if (selectedStudentId.value > 0) {
      url += `?student_id=${selectedStudentId.value}`
    }
    const res = await fetch(url)
    const data = await res.json()
    if (Array.isArray(data)) {
      examSubmissions.value = data
    } else {
      examSubmissions.value = []
    }
  } catch {
    examSubmissions.value = []
  }
}

async function fetchStudentList () {
  if (!isStudentsMode.value) return
  try {
    const res = await fetch(`${BASE_URL}/teacher/${props.teacherId}/students`)
    const data = await res.json()
    if (Array.isArray(data)) {
      // 合并同一学生多班级为一条
      const seen = new Set<number>()
      studentList.value = data.filter((s: any) => {
        if (seen.has(s.id)) return false
        seen.add(s.id)
        return true
      })
    }
  } catch {
    studentList.value = []
  }
}

function onStudentFilterChange (event: Event) {
  const val = parseInt((event.target as HTMLSelectElement).value, 10) || 0
  selectedStudentId.value = val
  studentSearchKeyword.value = ''
  reloadSubmissions()
}

function onStudentSearchInput () {
  // 搜索输入实时过滤下拉选项（通过 computed filteredStudentList）
}

function clearStudentFilter () {
  selectedStudentId.value = 0
  studentSearchKeyword.value = ''
  reloadSubmissions()
}

async function reloadSubmissions () {
  loading.value = true
  if (isStudentsMode.value) {
    await Promise.all([fetchTeacherOJSubmissions(), fetchTeacherExamSubmissions()])
  } else {
    await Promise.all([fetchOJSubmissions(), fetchExamSubmissions()])
  }
  loading.value = false
}

async function load () {
  userId.value = getUserId()
  loading.value = true
  if (isStudentsMode.value) {
    await fetchStudentList()
    await Promise.all([fetchTeacherOJSubmissions(), fetchTeacherExamSubmissions()])
  } else {
    await Promise.all([fetchOJSubmissions(), fetchExamSubmissions()])
  }
  loading.value = false
}

function formatDateTime (str: string | undefined): string {
  if (!str) return '-'
  const d = new Date(str)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function getLevelText (level: number | undefined): string {
  return level != null ? `GESP ${level}级` : '-'
}

function getScoreClass (score: number | undefined): string {
  const s = score ?? 0
  if (s >= 90) return 'excellent'
  if (s >= 80) return 'good'
  if (s >= 60) return 'pass'
  return 'fail'
}

function getVerdictClass (v: string): string {
  if (v === 'Accepted') return 'verdict-ac'
  if (['Wrong Answer', 'Runtime Error', 'Compile Error', 'Time Limit Exceeded', 'Memory Limit Exceeded'].includes(v)) return 'verdict-wa'
  return 'verdict-other'
}

function getVerdictText (v: string): string {
  const map: Record<string, string> = {
    'Accepted': '通过',
    'Wrong Answer': '答案错误',
    'Runtime Error': '运行错误',
    'Compile Error': '编译错误',
    'Time Limit Exceeded': '超时',
    'Memory Limit Exceeded': '超内存',
    'Pending': '等待中',
    'Judging': '判题中'
  }
  return map[v] || v || '-'
}

function getLanguageName (lang: string | undefined): string {
  const map: Record<string, string> = {
    'cpp': 'C++',
    'c': 'C',
    'python': 'Python',
    'python3': 'Python 3'
  }
  return map[lang || ''] || (lang || '-')
}

/** 根据选项 value 取选项的展示文案（label. text） */
function getOptionLabel (options: any[] | undefined, value: string | undefined): string {
  if (!value || !options?.length) return ''
  const opt = options.find((o: any) => o.value === value)
  if (!opt) return ''
  return opt.text ? `${opt.label}. ${opt.text}` : opt.label
}

/** 编程题提交详情：错了几个点 / 通过几个点 的文案 */
function ojWrongPointsText (detail: any): string {
  const total = detail.total_tests ?? 0
  const passed = detail.passed_tests ?? 0
  const wrong = total - passed
  if (total <= 0) return '暂无测试点信息'
  if (wrong === 0) return `通过全部 ${total} 个测试点`
  return `通过 ${passed}/${total} 个测试点，错了 ${wrong} 个点`
}

// 客观题：打开详情弹窗
async function viewExamDetail (submission: any) {
  selectedExamSubmission.value = submission
  examSubmissionAnswers.value = []
  examDetailOnlyWrong.value = false
  showExamDetailModal.value = true
  examDetailLoading.value = true
  try {
    const url = isStudentsMode.value && props.teacherId
      ? `${BASE_URL}/teacher/${props.teacherId}/students/${submission.user_id}/submissions/${submission.id}`
      : `${BASE_URL}/submissions/${submission.id}`
    const res = await fetch(url)
    const data = await res.json()
    examSubmissionAnswers.value = data.answers || []
    if (data.submission) {
      selectedExamSubmission.value = { ...selectedExamSubmission.value, ...data.submission }
    }
  } catch (e) {
    console.error('获取提交详情失败', e)
  } finally {
    examDetailLoading.value = false
  }
}

function closeExamDetailModal () {
  showExamDetailModal.value = false
  selectedExamSubmission.value = null
  examSubmissionAnswers.value = []
  examDetailOnlyWrong.value = false
}

// 编程题：打开详情弹窗
async function viewOJDetail (submission: any) {
  selectedOJDetail.value = null
  showOJDetailModal.value = true
  ojDetailLoading.value = true
  try {
    let url: string
    if (isStudentsMode.value && props.teacherId && submission.user_id) {
      url = `${BASE_URL}/teacher/${props.teacherId}/students/${submission.user_id}/oj-submissions/${submission.id}`
    } else {
      const uid = userId.value
      url = uid
        ? `${BASE_URL}/oj/submissions/${submission.id}/detail?userId=${uid}`
        : `${BASE_URL}/oj/submissions/${submission.id}/detail`
    }
    const res = await fetch(url)
    const data = await res.json()
    if (data?.success && data.data) {
      selectedOJDetail.value = data.data
    }
  } catch (e) {
    console.error('获取OJ提交详情失败', e)
  } finally {
    ojDetailLoading.value = false
  }
}

function closeOJDetailModal () {
  showOJDetailModal.value = false
  selectedOJDetail.value = null
}

/** 拉取 OJ 题目详情（含 video_url、analysis） */
async function fetchOjProblem (problemId: number): Promise<{ title?: string; video_url?: string; analysis?: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/oj/problems/${problemId}`)
    const data = await res.json()
    if (data?.success && data?.data) return data.data
    return null
  } catch (e) {
    console.error('获取题目详情失败', e)
    return null
  }
}

async function openOJVideoModal (item: any) {
  const problemId = item?.problem_id
  if (!problemId) return
  ojProblemForModal.value = { id: problemId, title: item.problem_title }
  showOJVideoModal.value = true
  ojVideoLoading.value = true
  const problem = await fetchOjProblem(problemId)
  if (problem) {
    ojProblemForModal.value = { id: problemId, title: problem.title, video_url: problem.video_url, analysis: problem.analysis }
  }
  ojVideoLoading.value = false
}

function closeOJVideoModal () {
  showOJVideoModal.value = false
  ojProblemForModal.value = null
}

async function openOJAnalysisModal (item: any) {
  const problemId = item?.problem_id
  if (!problemId) return
  ojProblemForModal.value = { id: problemId, title: item.problem_title }
  showOJAnalysisModal.value = true
  ojAnalysisLoading.value = true
  const problem = await fetchOjProblem(problemId)
  if (problem) {
    ojProblemForModal.value = { id: problemId, title: problem.title, video_url: problem.video_url, analysis: problem.analysis }
  }
  ojAnalysisLoading.value = false
}

function closeOJAnalysisModal () {
  showOJAnalysisModal.value = false
  ojProblemForModal.value = null
}

function renderMath (mathText: string, displayMode: boolean = false): string {
  try {
    const clean = mathText.trim()
    return katex.renderToString(clean, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: false,
      macros: { '\\f': '#1f(#2)' }
    })
  } catch {
    return `<span class="math-error">${mathText}</span>`
  }
}

function renderMarkdown (text: string): string {
  if (!text) return ''
  try {
    let processed = text
    const mathStore: Array<{ placeholder: string; html: string }> = []
    let mathIndex = 0
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
      if (match.includes('__MATH_')) return match
      const placeholder = `__MATH_BLOCK_${mathIndex}__`
      mathStore.push({ placeholder, html: `<div class="math-block">${renderMath(content, true)}</div>` })
      mathIndex++
      return placeholder
    })
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      if (match.includes('__MATH_')) return match
      const trimmed = content.trim()
      if (!trimmed) return match
      const placeholder = `__MATH_INLINE_${mathIndex}__`
      mathStore.push({ placeholder, html: `<span class="math-inline">${renderMath(trimmed, false)}</span>` })
      mathIndex++
      return placeholder
    })
    const codeBlockStore: Array<{ placeholder: string; html: string }> = []
    let codeBlockIndex = 0
    processed = processed.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`
      let html: string
      if (lang && hljs.getLanguage(lang)) {
        try {
          html = `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value}</code></pre>`
        } catch {
          html = `<pre><code>${code.trim()}</code></pre>`
        }
      } else {
        html = `<pre><code>${code.trim()}</code></pre>`
      }
      codeBlockStore.push({ placeholder, html })
      codeBlockIndex++
      return placeholder
    })
    let result = processed
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
    codeBlockStore.forEach(({ placeholder, html }) => {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), html)
    })
    mathStore.forEach(({ placeholder, html }) => {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), html)
    })
    return result
  } catch (err) {
    console.error('Markdown 渲染失败', err)
    return `<p class="render-error">渲染失败</p>`
  }
}

/** 进入该编程题做题页（查看题目、做题），带来源以便退出时返回 /plan/submissions */
function goToProblem (problemId: number) {
  router.push({ path: `/smartoj/${problemId}`, query: { from: 'plan-submissions' } })
}

function goToOJSubmissions (problemId: number) {
  router.push(`/oj-submissions/${problemId}`)
}

function goToOJSubmissionsAll () {
  router.push('/oj-submissions')
}

function goToExamSubmissions (examId: number) {
  router.push({ path: `/exam-submissions/${examId}`, query: { from: 'plan-submissions' } })
}

function goToExamSubmissionsAll () {
  router.push('/select')
}

onMounted(() => {
  load()
})

watch(() => [props.mode, props.teacherId], () => {
  if (isStudentsMode.value) load()
}, { immediate: false })
</script>

<style scoped>
.my-submissions-section {
  width: 100%;
}

.submissions-content-section {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(30, 144, 255, 0.15);
  border: 2px solid #e0f2fe;
}

.submissions-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 24px 32px;
  border-bottom: 4px solid #0c7cd5;
  border-radius: 20px 20px 0 0;
}

.submissions-header .section-title {
  margin: 0;
  color: white;
  font-size: 1.8rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 12px;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
  letter-spacing: 1px;
}

.submissions-body {
  padding: 24px 28px 32px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 24px);
}

/* 学生筛选栏 */
.student-filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.student-search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}

.student-search-input {
  width: 100%;
  padding: 10px 36px 10px 40px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.95rem;
  color: #1e293b;
  background: #f8fafc;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.student-search-input:focus {
  outline: none;
  border-color: #1e90ff;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.15);
}

.student-search-input::placeholder {
  color: #94a3b8;
}

.student-filter-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: #e2e8f0;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.student-filter-clear:hover {
  background: #cbd5e1;
  color: #334155;
}

.student-dropdown-wrap {
  min-width: 180px;
}

.student-select {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.95rem;
  color: #1e293b;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: auto;
}

.student-select:focus {
  outline: none;
  border-color: #1e90ff;
  background: #fff;
}

.student-select:hover {
  border-color: #7dd3fc;
}

/* 选中的学生信息头 */
.selected-student-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #93c5fd;
  border-radius: 12px;
  color: #1e40af;
  font-size: 0.95rem;
  font-weight: 600;
}

.selected-student-name {
  font-size: 1.05rem;
}

.selected-student-class {
  color: #3b82f6;
}

.btn-clear-filter {
  margin-left: auto;
  padding: 4px 12px;
  background: transparent;
  border: 1.5px solid #93c5fd;
  border-radius: 8px;
  color: #2563eb;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-filter:hover {
  background: #bfdbfe;
  border-color: #3b82f6;
}

/* 提交来源标签 */
.row-source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  margin-top: 2px;
  padding: 2px 8px;
  border-radius: 6px;
}

.source-plan {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.source-self {
  background: #f0f9ff;
  color: #0369a1;
  border: 1px solid #7dd3fc;
}

.tab-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  border: 3px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  color: #64748b;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
}

.tab-btn:hover {
  border-color: #7dd3fc;
  background: #f0f9ff;
  color: #0369a1;
}

.tab-btn.active {
  border-color: #1e90ff;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.35);
}

.tab-count {
  background: rgba(255, 255, 255, 0.35);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.9rem;
}

.tab-btn.active .tab-count {
  background: rgba(255, 255, 255, 0.4);
}

.loading-state {
  text-align: center;
  padding: 60px 32px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 4px solid #7dd3fc;
  border-radius: 20px;
}

.loading-icon {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  color: #1e90ff;
}

.loading-state h3 {
  color: #1e90ff;
  font-size: 1.5rem;
  margin: 0 0 8px 0;
  font-weight: 800;
}

.loading-state p {
  color: #0369a1;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 20px;
  border: 2px solid #bae6fd;
}

.empty-state .empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: #1e90ff;
}

.empty-state h3 {
  color: #01579b;
  font-size: 1.5rem;
  margin: 0 0 10px 0;
  font-weight: 800;
}

.empty-state p {
  color: #0277bd;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.list-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px 0;
}

.toolbar-label {
  font-size: 0.9rem;
  color: #64748b;
}

.page-size-select {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.page-size-select:focus {
  outline: none;
  border-color: #0ea5e9;
}

.toolbar-count {
  font-size: 0.85rem;
  color: #64748b;
  margin-left: auto;
}

.submissions-list-wrap {
  padding: 0;
}

.submission-list {
  list-style: none;
  margin: 0 0 20px 0;
  padding: 0;
}

.submission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 10px;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submission-row:hover {
  border-color: #1e90ff;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.2);
}

.row-main,
.submission-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submission-info .row-title {
  margin: 0;
}

.attempt-info {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.row-title {
  font-weight: 600;
  color: #1e293b;
  font-size: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-student-name {
  font-size: 0.85rem;
  color: #0ea5e9;
  margin: 2px 0 0 0;
}

.row-meta {
  font-size: 0.85rem;
  color: #64748b;
}

.row-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-view-problem {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e90ff;
  background: #f0f9ff;
  border: 2px solid #7dd3fc;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-view-problem:hover {
  background: #e0f2fe;
  border-color: #1e90ff;
  color: #0c7cd5;
}

.btn-oj-parse {
  white-space: nowrap;
}

.pass-count {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
}

.submission-score .score {
  font-size: 1.35rem;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 12px;
}

.submission-score .score.excellent {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
}

.submission-score .score.good {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
}

.submission-score .score.pass {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.submission-score .score.fail {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

.verdict-badge {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
}

.verdict-ac {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
  border: 1px solid #86efac;
}

.verdict-wa {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.verdict-other {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #fcd34d;
}

.link-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 700;
  color: #1e90ff;
  text-decoration: none;
  border: 2px solid #7dd3fc;
  border-radius: 12px;
  background: #f0f9ff;
  transition: all 0.2s ease;
}

.link-all:hover {
  background: #e0f2fe;
  border-color: #1e90ff;
  color: #0c7cd5;
}

/* OJ 视频/文字解析弹窗内容 */
.oj-video-body {
  padding: 12px 0;
  text-align: center;
}
.btn-video-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
  border-radius: 12px;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 700;
  transition: opacity 0.2s;
}
.btn-video-link:hover {
  opacity: 0.9;
}
.btn-video-icon { font-size: 1rem; }
.video-hint {
  margin: 16px 0 0 0;
  font-size: 0.9rem;
  color: #64748b;
}
.oj-empty-hint {
  text-align: center;
  padding: 32px 24px;
  color: #94a3b8;
}
.oj-empty-hint p { margin: 12px 0 0 0; font-size: 1rem; font-weight: 600; }
.oj-analysis-body {
  padding: 8px 0;
  max-height: 60vh;
  overflow-y: auto;
}
.oj-analysis-body.markdown-content {
  line-height: 1.8;
  word-wrap: break-word;
  font-size: 0.95rem;
  color: #374151;
}
.oj-analysis-body.markdown-content strong,
.oj-analysis-body.markdown-content b { color: #1e293b; font-weight: 700; }
.oj-analysis-body.markdown-content em,
.oj-analysis-body.markdown-content i { font-style: italic; color: #475569; }
.oj-analysis-body.markdown-content code {
  background: #f1f5f9;
  color: #dc2626;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}
.oj-analysis-body.markdown-content pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
  font-size: 0.85em;
}
.oj-analysis-body.markdown-content pre code { background: none; color: #374151; padding: 0; }
.oj-analysis-body.markdown-content .math-inline,
.oj-analysis-body.markdown-content .math-block { margin: 0 2px; }
.oj-analysis-body.markdown-content .math-error { background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; }
.oj-analysis-body.markdown-content .hljs { background: transparent; color: #374151; }

/* 提交详情弹窗（与 Profile 一致） */
.submission-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.submission-detail-modal .modal-content {
  background: white;
  border-radius: 18px;
  max-width: 800px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.submission-detail-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
  color: white;
}

.submission-detail-modal .modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.submission-detail-modal .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.3s;
}

.submission-detail-modal .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.submission-detail-modal .modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.detail-loading {
  text-align: center;
  padding: 40px;
}

.detail-loading .loading-icon {
  margin-bottom: 12px;
}

.detail-summary {
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.05) 0%, rgba(135, 206, 235, 0.03) 100%);
  border-radius: 12px;
  border: 1px solid rgba(30, 144, 255, 0.2);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.summary-score {
  flex-shrink: 0;
}

.score-circle-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: 700;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.score-circle-large.excellent {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.score-circle-large.good {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.score-circle-large.pass {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.score-circle-large.fail {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.score-number-large {
  font-size: 2rem;
  line-height: 1;
}

.score-label-large {
  font-size: 0.9rem;
  opacity: 0.9;
}

.summary-info h4 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: #1e293b;
}

.summary-date {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #64748b;
}

.summary-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-stats .stat-item {
  display: flex;
  gap: 6px;
  font-size: 0.9rem;
}

.summary-stats .stat-label {
  color: #64748b;
}

.summary-stats .stat-value {
  font-weight: 600;
  color: #1e293b;
}

.oj-summary .oj-verdict-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.95rem;
  text-align: center;
  color: white;
  flex-shrink: 0;
}

.oj-summary .oj-verdict-large.verdict-ac {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.oj-summary .oj-verdict-large.verdict-wa,
.oj-summary .oj-verdict-large.verdict-other {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.error-message {
  margin: 12px 0 0 0;
  padding: 10px;
  background: #fee2e2;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #991b1b;
}

.oj-detail-brief {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.oj-detail-brief .wrong-points {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
}

.code-section {
  margin-top: 0;
}

.code-section h4 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #334155;
}

.code-block {
  margin: 0;
  padding: 16px;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 10px;
  font-size: 0.85rem;
  overflow-x: auto;
  max-height: 280px;
  overflow-y: auto;
}

.answers-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.answers-section-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #334155;
}

.only-wrong-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #64748b;
  cursor: pointer;
  user-select: none;
}

.only-wrong-toggle:hover {
  color: #334155;
}

.only-wrong-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #0ea5e9;
  cursor: pointer;
}

.only-wrong-empty {
  margin: 0;
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-size: 0.95rem;
  background: #f8fafc;
  border-radius: 10px;
}

.answers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-item {
  padding: 14px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
}

.answer-item.correct {
  border-color: #86efac;
  background: #f0fdf4;
}

.answer-item.incorrect {
  border-color: #fca5a5;
  background: #fef2f2;
}

.answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.question-number {
  font-weight: 600;
  color: #475569;
}

.answer-status.correct {
  color: #16a34a;
  font-weight: 600;
}

.answer-status.incorrect {
  color: #dc2626;
  font-weight: 600;
}

.question-text {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #334155;
}

.question-code-block {
  margin: 10px 0;
  padding: 12px;
  background: #1e293b;
  border-radius: 8px;
  overflow-x: auto;
}

.question-code-block pre {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #e2e8f0;
}

.question-code-block code {
  font-family: ui-monospace, monospace;
  white-space: pre;
}

.question-image-wrap {
  margin: 10px 0;
}

.question-image-wrap .question-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  vertical-align: top;
  line-height: 1.5;
}

.question-options {
  margin: 10px 0;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.option-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.5;
}

.option-row.option-correct {
  background: #f0fdf4;
  margin: 0 -14px;
  padding: 6px 14px;
  border-radius: 6px;
  color: #166534;
  font-weight: 600;
}

.option-row.option-user-wrong {
  background: #fef2f2;
  margin: 0 -14px;
  padding: 6px 14px;
  border-radius: 6px;
  color: #991b1b;
  font-weight: 600;
}

.option-row.option-user:not(.option-user-wrong) {
  background: #f0fdf4;
  margin: 0 -14px;
  padding: 6px 14px;
  border-radius: 6px;
  color: #166534;
  font-weight: 600;
}

.option-label {
  flex-shrink: 0;
  font-weight: 600;
  color: #64748b;
}

.option-text {
  flex: 1;
}

.option-tag {
  flex-shrink: 0;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #475569;
}

.option-tag.correct-tag {
  background: #dcfce7;
  color: #166534;
}

.answer-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.explanation-block {
  margin-top: 14px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 10px;
  border: 1px solid #bae6fd;
}

.explanation-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0369a1;
  margin-bottom: 8px;
}

.explanation-content {
  font-size: 0.9rem;
  color: #0c4a6e;
  line-height: 1.6;
  white-space: pre-wrap;
}

.choice-label {
  font-size: 0.85rem;
  color: #64748b;
  margin-right: 6px;
}

.choice-value.correct {
  color: #16a34a;
  font-weight: 600;
}

.choice-value.incorrect {
  color: #dc2626;
  font-weight: 600;
}

.modal-footer,
.modal-footer-inline {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-footer-inline {
  border-top: none;
  padding-top: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn-outline {
  background: transparent;
  color: #1e90ff;
  border: 2px solid #1e90ff;
}

.btn-outline:hover {
  background: #f0f9ff;
}

.btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  background: #e2e8f0;
  color: #475569;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.btn-primary {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
}

.btn-primary:hover {
  opacity: 0.95;
}
</style>
