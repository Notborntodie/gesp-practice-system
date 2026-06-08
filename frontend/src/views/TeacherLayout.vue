<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Users,
  CalendarDays,
  UserPlus,
  FileText,
  Code,
  ClipboardCheck,
  GraduationCap
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

interface MenuItem {
  key: string
  label: string
  icon: any
  path: string
}

// 完全扁平菜单
const menuItems: MenuItem[] = [
  { key: 'students', label: '学生管理', icon: Users, path: '/teacher/students' },
  { key: 'plan-progress', label: '计划完成', icon: CalendarDays, path: '/teacher/plan-progress' },
  { key: 'plan-assignment', label: '计划分配', icon: UserPlus, path: '/teacher/plan-assignment' },
  { key: 'objective-submissions', label: '客观题提交', icon: FileText, path: '/teacher/objective-submissions' },
  { key: 'oj-submissions', label: '编程题提交', icon: Code, path: '/teacher/oj-submissions' },
  { key: 'tests', label: '测试管理', icon: ClipboardCheck, path: '/teacher/tests' },
]

const activeKey = computed(() => {
  const path = route.path
  for (const item of menuItems) {
    if (path === item.path || path.startsWith(item.path + '/')) {
      return item.key
    }
  }
  return ''
})

function handleMenuClick(item: MenuItem) {
  router.push(item.path)
}

function menuItemClass(item: MenuItem) {
  return [
    'menu-item',
    { active: activeKey.value === item.key || route.path.startsWith(item.path + '/') }
  ]
}

// === Provide/Inject for child components ===

// 学生详情页 ID
const studentDetailId = computed(() => {
  if (!route.path.startsWith('/teacher/students/')) return undefined
  const id = route.params.studentId
  return id ? Number(id) : undefined
})
provide('studentDetailId', studentDetailId)

// 计划进度页参数
const planProgressParams = computed(() => {
  if (!route.path.startsWith('/teacher/plan-progress/')) return undefined
  return {
    planId: route.params.planId ? Number(route.params.planId) : undefined,
    taskId: route.params.taskId ? Number(route.params.taskId) : undefined
  }
})
provide('planProgressParams', planProgressParams)

// 打开学生详情页
function openStudentDetail(studentId: number) {
  router.push(`/teacher/students/${studentId}`)
}
provide('openStudentDetail', openStudentDetail)

// 打开任务进度页
function openTaskProgress(planId: number, taskId: number) {
  router.push(`/teacher/plan-progress/${planId}/tasks/${taskId}`)
}
provide('openTaskProgress', openTaskProgress)

// 返回学生列表
function closeStudentDetail() {
  router.push('/teacher/students')
}
provide('closeStudentDetail', closeStudentDetail)

// 返回计划进度
function closeTaskProgress() {
  router.push('/teacher/plan-progress')
}
provide('closeTaskProgress', closeTaskProgress)

// === 测试编辑器 ===
const testEditorTestId = computed(() => {
  if (route.path !== '/teacher/test-editor') return undefined
  const id = route.query.testId
  return id ? Number(id) : undefined
})
provide('testEditorTestId', testEditorTestId)

function openTestEditor(testId?: number) {
  if (testId) {
    router.push({ path: '/teacher/test-editor', query: { testId: String(testId) } })
  } else {
    router.push('/teacher/test-editor')
  }
}
provide('openTestEditor', openTestEditor)

function closeTestEditor() {
  router.push('/teacher/tests')
}
provide('closeTestEditor', closeTestEditor)
</script>

<template>
  <div class="teacher-layout">
    <!-- Sidebar -->
    <aside class="teacher-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <GraduationCap :size="24" />
          <span class="sidebar-title">教师端</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="menu-list">
          <li
            v-for="item in menuItems"
            :key="item.key"
            :class="menuItemClass(item)"
            @click="handleMenuClick(item)"
          >
            <component :is="item.icon" :size="20" class="menu-icon" />
            <span class="menu-label">{{ item.label }}</span>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="teacher-main">
      <router-view v-slot="{ Component, route: currentRoute }">
        <!-- 学生管理页面使用固定key，确保返回列表时不会重新加载 -->
        <!-- 详情页和编辑页使用完整路径作为key，确保每次都是新的 -->
        <KeepAlive :max="5">
          <component
            :is="Component"
            :key="
              currentRoute.path === '/teacher/students' ? 'teacher-students' :
              currentRoute.path === '/teacher/plan-progress' ? 'teacher-plan-progress' :
              currentRoute.path === '/teacher/plan-assignment' ? 'teacher-plan-assignment' :
              currentRoute.path === '/teacher/objective-submissions' ? 'teacher-objective-submissions' :
              currentRoute.path === '/teacher/oj-submissions' ? 'teacher-oj-submissions' :
              currentRoute.path === '/teacher/tests' ? 'teacher-tests' :
              currentRoute.fullPath
            "
          />
        </KeepAlive>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.teacher-layout {
  display: flex;
  min-height: calc(100vh - var(--navbar-height));
  background: var(--color-background);
}

/* Sidebar */
.teacher-sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: var(--navbar-height);
  left: 0;
  height: calc(100vh - var(--navbar-height));
  overflow-y: auto;
}

.sidebar-header {
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-foreground);
}

.sidebar-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

/* Menu */
.sidebar-nav {
  flex: 1;
  padding: var(--space-3) 0;
}

.menu-list {
  list-style: none;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.menu-item:hover {
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-primary);
}

.menu-item.active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
  font-weight: 500;
  position: relative;
}

.menu-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

.menu-icon {
  flex-shrink: 0;
}

.menu-label {
  font-size: var(--font-size-sm);
}

/* Main Content */
.teacher-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: var(--space-6);
  min-height: calc(100vh - var(--navbar-height));
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .teacher-sidebar {
    width: 200px;
  }

  .teacher-main {
    margin-left: 200px;
    padding: var(--space-4);
  }
}

@media (max-width: 640px) {
  .teacher-sidebar {
    transform: translateX(-100%);
  }

  .teacher-main {
    margin-left: 0;
  }
}
</style>