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
import AdminLayout from '../views/AdminLayout.vue'
import TeacherView from '../views/TeacherView.vue'
import TeacherLayout from '../views/TeacherLayout.vue'
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

// Admin components
import QuestionUpload from '../components/admin/QuestionUpload.vue'
import KnowledgePointManagement from '../components/admin/KnowledgePointManagement.vue'
import QuestionList from '../components/admin/QuestionList.vue'
import ExamManagement from '../components/admin/ExamManagement.vue'
import OJManagement from '../components/admin/OJManagement.vue'
import LeaningPlanManagement from '../components/admin/LeaningPlanManagement.vue'
import AdminTestManagementSection from '../components/admin/AdminTestManagementSection.vue'
import UserManagement from '../components/admin/UserManagement.vue'
import PlanEditorView from '../components/admin/PlanEditorView.vue'
import ObjectiveSubmissionsSection from '../components/teacher/ObjectiveSubmissionsSection.vue'
import OJSubmissionsSection from '../components/teacher/OJSubmissionsSection.vue'

const routes = [
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/', redirect: '/plan' },
  { path: '/home', component: homeView },
  { path: '/plan', component: PlanView },
  { path: '/plan/submissions', component: PlanView },
  { path: '/plan/ranking', component: PlanView },
  { path: '/plan/tests', component: PlanView },
  { path: '/plan/growth-pets', component: PlanView },
  { path: '/tests/:testId', component: TestDetailView },
  { path: '/public-tests/:token', component: () => import('../views/PublicTestResultView.vue') },
  { path: '/public-plans/:token', component: () => import('../views/PublicPlanProgressView.vue') },
  { path: '/plan/:planId/tasks', component: TaskListView },
  { path: '/plan/:planId/tasks/:taskId', component: TaskView },
  { path: '/select', redirect: '/level-exams/0' },
  { path: '/csp', component: CspLevelView },
  { path: '/smartoj', component: SmartOJLevelView },
  { path: '/smartoj/:problemId', component: SmartOJView },
  { path: '/plan-smartoj/:problemId', component: PlanSmartOJView },
  { path: '/select-level', redirect: '/level-exams/0' },
  { path: '/level-exams/:level', component: LevelExamsView },
  { path: '/practice/:examId', component: GESPEaxmView },
  { path: '/exam/:examId', component: GESPEaxmView },
  { path: '/plan-exam/:examId', component: PlanExamView },
  { path: '/exam-submissions/:examId', component: ExamSubmissionsView },
  { path: '/teacher/:teacherId/submissions', component: StudentSubmissionsView },
  { path: '/teacher/:teacherId/oj-submissions/:problemId', component: TeacherOJSubmissionsView },
  { path: '/oj-submissions', component: OJSubmissionsView },
  { path: '/oj-submissions/:problemId', component: OJSubmissionsView },
  { path: '/profile', component: ProfileView },
  { path: '/gesp5', redirect: '/practice/1' },

  // Legacy admin route (for backward compatibility, redirects to new layout)
  { path: '/admin-old', component: AdminView },

  // New Admin nested routes with layout
  {
    path: '/admin',
    component: AdminLayout,
    redirect: '/admin/questions',
    children: [
      { path: 'upload', name: 'AdminUpload', component: QuestionUpload },
      { path: 'batch-upload', name: 'AdminBatchUpload', component: () => import('../components/admin/BatchUploadView.vue') },
      { path: 'exam-batch-upload', name: 'AdminExamBatchUpload', component: () => import('../components/admin/ExamBatchUploadView.vue') },
      { path: 'knowledge-points', name: 'AdminKnowledgePoints', component: KnowledgePointManagement },
      { path: 'questions', name: 'AdminQuestions', component: QuestionList },
      { path: 'question-editor/:id', name: 'AdminQuestionEditor', component: () => import('../components/admin/QuestionEditorView.vue') },
      { path: 'exams', name: 'AdminExams', component: ExamManagement },
      { path: 'exam-editor', name: 'AdminExamEditor', component: () => import('../components/admin/ExamEditorView.vue') },
      { path: 'oj', name: 'AdminOJ', component: OJManagement },
      { path: 'oj-create', name: 'AdminOJCreate', component: () => import('../components/admin/OJCreateView.vue') },
      {
        path: 'oj-editor/:id',
        name: 'AdminOJEditor',
        component: () => import('../components/admin/OJEditorView.vue'),
        children: [
          { path: 'samples', name: 'AdminOJSamples', component: () => import('../components/admin/OJSamplesView.vue') }
        ]
      },
      { path: 'plans', name: 'AdminPlans', component: LeaningPlanManagement },
      { path: 'tests', name: 'AdminTests', component: AdminTestManagementSection },
      { path: 'test-editor', name: 'AdminTestEditor', component: () => import('../components/admin/TestEditorView.vue') },
      { path: 'users', name: 'AdminUsers', component: UserManagement },
      { path: 'plan-editor', name: 'AdminPlanEditor', component: PlanEditorView },
    ]
  },

  { path: '/teacher-old', component: TeacherView },
  {
    path: '/teacher',
    component: TeacherLayout,
    redirect: '/teacher/students',
    children: [
      { path: 'students', name: 'TeacherStudents', component: () => import('../views/teacher/StudentManagementView.vue') },
      { path: 'students/:studentId', name: 'TeacherStudentDetail', component: () => import('../views/teacher/StudentProgressDetailView.vue') },
      { path: 'plan-progress', name: 'TeacherPlanProgress', component: () => import('../views/teacher/TeacherPlanProgressView.vue') },
      { path: 'plan-progress/:planId/tasks/:taskId', name: 'TeacherTaskProgress', component: () => import('../views/teacher/TeacherTaskProgressView.vue') },
      { path: 'plan-assignment', name: 'TeacherPlanAssignment', component: () => import('../views/teacher/PlanAssignmentView.vue') },
      { path: 'objective-submissions', name: 'TeacherObjectiveSubmissions', component: ObjectiveSubmissionsSection },
      { path: 'oj-submissions', name: 'TeacherOJSubmissions', component: OJSubmissionsSection },
      { path: 'tests', name: 'TeacherTests', component: AdminTestManagementSection },
      { path: 'test-editor', name: 'TeacherTestEditor', component: () => import('../components/admin/TestEditorView.vue') },
    ]
  },
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
  // 动画页面路径、易错题页面、公开查分页也允许公开访问
  const isPublic = publicPages.includes(to.path) ||
    to.path.startsWith('/animation/') ||
    to.path.startsWith('/top-wrong-questions/') ||
    to.path.startsWith('/public-tests/') ||
    to.path.startsWith('/public-plans/')

  if (!isLoggedIn && !isPublic) {
    next('/login')
  } else if (isLoggedIn && (to.path === '/login' || to.path === '/register')) {
    next('/')
  } else {
    next()
  }
})

export default router
