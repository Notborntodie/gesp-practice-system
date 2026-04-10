import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import SelectLevelView from '../views/SelectLevelView.vue'
import CspLevelView from '../views/CspLevelView.vue'
import SmartOJLevelView from '../views/SmartOJLevelView.vue'
import SmartOJView from '../views/SmartOJView.vue'
import PlanSmartOJView from '../views/PlanSmartOJView.vue'
import GESPEaxmView from '../views/GESPEaxmView.vue'
import PlanExamView from '../views/PlanExamView.vue'
import AdminView from '../views/AdminView.vue'
import TeacherView from '../views/TeacherView.vue'
import LevelExamsView from '../views/LevelExamsView.vue'
import ExamSubmissionsView from '../views/ExamSubmissionsView.vue'
import StudentSubmissionsView from '../views/StudentSubmissionsView.vue'
import OJSubmissionsView from '../views/OJSubmissionsView.vue'
import TeacherOJSubmissionsView from '../views/TeacherOJSubmissionsView.vue'
import ProfileView from '../views/ProfileView.vue'
import PlanView from '../views/PlanView.vue'
import TestDetailView from '../views/TestDetailView.vue'
import TaskListView from '../views/TaskListView.vue'
import TaskView from '../views/TaskView.vue'
import homeView from '../views/homeView.vue'
import FeynmanSummaryView from '../views/FeynmanSummaryView.vue'
import StudentPlanProgressView from '../views/StudentPlanProgressView.vue'
import AnimationView from '../views/AnimationView.vue'
import TopWrongQuestionsView from '../views/TopWrongQuestionsView.vue'

const routes = [
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/', redirect: '/plan' },
  { path: '/home', component: homeView },
  { path: '/plan', component: PlanView },
  { path: '/plan/submissions', component: PlanView },
  { path: '/plan/ranking', component: PlanView },
  { path: '/plan/tests', component: PlanView },
  { path: '/tests/:testId', component: TestDetailView },
  { path: '/public-tests/:token', component: () => import('../views/PublicTestResultView.vue') },
  { path: '/public-plans/:token', component: () => import('../views/PublicPlanProgressView.vue') },
  { path: '/plan/:planId/tasks', component: TaskListView },
  { path: '/plan/:planId/tasks/:taskId', component: TaskView },
  { path: '/select', redirect: '/level-exams/0' },
  { path: '/csp', component: CspLevelView },
  { path: '/smartoj', component: SmartOJLevelView }, // 题目列表页
  { path: '/smartoj/:problemId', component: SmartOJView }, // 单个题目做题页
  { path: '/plan-smartoj/:problemId', component: PlanSmartOJView }, // 任务内编程题做题页
  { path: '/select-level', redirect: '/level-exams/0' },
  { path: '/level-exams/:level', component: LevelExamsView },
  { path: '/practice/:examId', component: GESPEaxmView },
  { path: '/exam/:examId', component: GESPEaxmView },
  { path: '/plan-exam/:examId', component: PlanExamView }, // 任务内考试页
  { path: '/exam-submissions/:examId', component: ExamSubmissionsView },
  { path: '/teacher/:teacherId/submissions', component: StudentSubmissionsView },
  { path: '/teacher/:teacherId/oj-submissions/:problemId', component: TeacherOJSubmissionsView },
  { path: '/oj-submissions', component: OJSubmissionsView },
  { path: '/oj-submissions/:problemId', component: OJSubmissionsView },
  { path: '/profile', component: ProfileView },
  { path: '/gesp5', redirect: '/practice/1' }, // 保持向后兼容
  { path: '/admin', component: AdminView },
  { path: '/teacher', component: TeacherView },
  { path: '/teacher/:teacherId/student/:studentId/plan-progress', component: StudentPlanProgressView },
  { path: '/feynman-summary', component: FeynmanSummaryView },
  { path: '/animation/:id', component: AnimationView },
  { path: '/top-wrong-questions', redirect: '/top-wrong-questions/1' },
  { path: '/top-wrong-questions/:level', component: TopWrongQuestionsView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  // 允许未登录访问的页面
  const publicPages = ['/login', '/register', '/home', '/top-wrong-questions']
  // 动画页面路径（支持动态ID）也允许公开访问
  // 易错题页面路径（支持动态级别）也允许公开访问；公开查分页无需登录
  const isPublic = publicPages.includes(to.path) || to.path.startsWith('/animation/') || to.path.startsWith('/top-wrong-questions/') || to.path.startsWith('/public-tests/') || to.path.startsWith('/public-plans/')

  if (!isLoggedIn && !isPublic) {
    // 未登录且访问受保护页面，跳转到登录
    next('/login')
  } else if (isLoggedIn && (to.path === '/login' || to.path === '/register')) {
    // 已登录访问登录/注册页，跳转到主页面
    next('/')
  } else {
    next()
  }
})

export default router
