<script setup lang="ts">
import { computed, provide, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  FileQuestion,
  GraduationCap,
  Code,
  CalendarDays,
  ClipboardCheck,
  Users,
  FileUp,
  Brain,
  ChevronDown,
  FolderOpen
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

interface MenuItem {
  key: string
  label: string
  icon: any
  path?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  { key: 'upload', label: '题目来源管理', icon: FileUp, path: '/admin/upload' },
  {
    key: 'objective-questions',
    label: '客观题管理',
    icon: FolderOpen,
    children: [
      { key: 'knowledge-points', label: '知识点管理', icon: Brain, path: '/admin/knowledge-points' },
      { key: 'questions', label: '题目管理', icon: FileQuestion, path: '/admin/questions' },
      { key: 'exams', label: '练习管理', icon: GraduationCap, path: '/admin/exams' },
    ]
  },
  { key: 'oj', label: '编程题管理', icon: Code, path: '/admin/oj' },
  { key: 'plans', label: '学习计划管理', icon: CalendarDays, path: '/admin/plans' },
  { key: 'tests', label: '测试管理', icon: ClipboardCheck, path: '/admin/tests' },
  { key: 'users', label: '用户管理', icon: Users, path: '/admin/users' },
]

// 展开/折叠状态
const expandedKeys = ref<string[]>(['objective-questions'])

const activeKey = computed(() => {
  const path = route.path
  for (const item of menuItems) {
    if (item.path && (path === item.path || path.startsWith(item.path + '/'))) {
      return item.key
    }
    if (item.children) {
      for (const child of item.children) {
        if (child.path && (path === child.path || path.startsWith(child.path + '/'))) {
          return child.key
        }
      }
    }
  }
  return ''
})

function handleMenuClick(item: MenuItem) {
  if (item.children) {
    // 有子菜单时，切换展开/折叠
    const idx = expandedKeys.value.indexOf(item.key)
    if (idx > -1) {
      expandedKeys.value.splice(idx, 1)
    } else {
      expandedKeys.value.push(item.key)
    }
  } else if (item.path) {
    router.push(item.path)
  }
}

function handleSubMenuClick(child: MenuItem) {
  if (child.path) {
    router.push(child.path)
  }
}

function isExpanded(key: string) {
  return expandedKeys.value.includes(key)
}

function isItemActive(item: MenuItem) {
  if (activeKey.value === item.key) return true
  if (item.children) {
    return item.children.some(c => activeKey.value === c.key)
  }
  return false
}

function menuItemClass(item: MenuItem) {
  return [
    'menu-item',
    {
      active: isItemActive(item),
      expanded: isExpanded(item.key),
      'has-children': Boolean(item.children)
    }
  ]
}

function chevronClass(item: MenuItem) {
  return {
    rotated: isExpanded(item.key)
  }
}

function subMenuClass(child: MenuItem) {
  return [
    'sub-menu-item',
    { active: activeKey.value === child.key }
  ]
}

// === Backward compatibility: provide/inject for child components ===

const planEditorPlanId = computed(() => {
  if (route.path !== '/admin/plan-editor') return undefined
  const id = route.query.planId
  return id ? Number(id) : undefined
})
provide('planEditorPlanId', planEditorPlanId)

function openPlanEditor(planId?: number) {
  if (planId) {
    router.push({ path: '/admin/plan-editor', query: { planId: String(planId) } })
  } else {
    router.push('/admin/plan-editor')
  }
}
provide('openPlanEditor', openPlanEditor)

function closeCurrentSection() {
  router.push('/admin/plans')
}
provide('closeCurrentSection', closeCurrentSection)

function triggerSectionRefresh(_sectionKey: string) {
  // In router-based navigation, components refresh on mount
}
provide('triggerSectionRefresh', triggerSectionRefresh)

// === 练习编辑器 ===
const examEditorExamId = computed(() => {
  if (route.path !== '/admin/exam-editor') return undefined
  const id = route.query.examId
  return id ? Number(id) : undefined
})
provide('examEditorExamId', examEditorExamId)

const examEditorQuestionIds = computed(() => {
  if (route.path !== '/admin/exam-editor') return undefined
  const ids = route.query.questionIds
  return ids ? String(ids).split(',').map(Number) : undefined
})
provide('examEditorQuestionIds', examEditorQuestionIds)

function openExamEditor(examId?: number, questionIds?: number[]) {
  if (examId) {
    router.push({ path: '/admin/exam-editor', query: { examId: String(examId) } })
  } else if (questionIds && questionIds.length > 0) {
    router.push({ path: '/admin/exam-editor', query: { questionIds: questionIds.join(',') } })
  } else {
    router.push('/admin/exam-editor')
  }
}
provide('openExamEditor', openExamEditor)

// === OJ 创建/编辑 ===
function openOJCreate() {
  router.push('/admin/oj-create')
}
provide('openOJCreate', openOJCreate)

function openOJEditor(problemId: number) {
  router.push(`/admin/oj-editor/${problemId}`)
}
provide('openOJEditor', openOJEditor)

const ojEditorProblemId = computed(() => {
  if (!route.path.startsWith('/admin/oj-editor/')) return undefined
  const id = route.params.id
  return id ? Number(id) : undefined
})
provide('ojEditorProblemId', ojEditorProblemId)

// === 测试编辑器 ===
const testEditorTestId = computed(() => {
  if (route.path !== '/admin/test-editor') return undefined
  const id = route.query.testId
  return id ? Number(id) : undefined
})
provide('testEditorTestId', testEditorTestId)

function openTestEditor(testId?: number) {
  if (testId) {
    router.push({ path: '/admin/test-editor', query: { testId: String(testId) } })
  } else {
    router.push('/admin/test-editor')
  }
}
provide('openTestEditor', openTestEditor)

// === 批量上传 ===
function openBatchUpload() {
  router.push('/admin/batch-upload')
}
provide('openBatchUpload', openBatchUpload)

// === 上传练习 ===
function openExamBatchUpload() {
  router.push('/admin/exam-batch-upload')
}
provide('openExamBatchUpload', openExamBatchUpload)

// === 题目编辑 ===
function openQuestionEditor(questionId: number) {
  router.push(`/admin/question-editor/${questionId}`)
}
provide('openQuestionEditor', openQuestionEditor)

const questionEditorQuestionId = computed(() => {
  if (!route.path.startsWith('/admin/question-editor/')) return undefined
  const id = route.params.id
  return id ? Number(id) : undefined
})
provide('questionEditorQuestionId', questionEditorQuestionId)
</script>

<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <LayoutDashboard :size="24" />
          <span class="sidebar-title">管理后台</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="menu-list">
          <li
            v-for="item in menuItems"
            :key="item.key"
            class="menu-group"
          >
            <div
              :class="menuItemClass(item)"
              @click="handleMenuClick(item)"
            >
              <component :is="item.icon" :size="20" class="menu-icon" />
              <span class="menu-label">{{ item.label }}</span>
              <ChevronDown
                v-if="item.children"
                :size="16"
                class="chevron-icon"
                :class="chevronClass(item)"
              />
            </div>

            <!-- Sub-menu -->
            <ul
              v-if="item.children && isExpanded(item.key)"
              class="sub-menu-list"
            >
              <li
                v-for="child in item.children"
                :key="child.key"
                :class="subMenuClass(child)"
                @click.stop="handleSubMenuClick(child)"
              >
                <component :is="child.icon" :size="18" class="sub-menu-icon" />
                <span class="sub-menu-label">{{ child.label }}</span>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="admin-main">
      <router-view v-slot="{ Component, route: currentRoute }">
        <!-- 列表页使用固定key，确保缓存；编辑页和详情页使用完整路径 -->
        <KeepAlive :max="5">
          <component
            :is="Component"
            :key="
              currentRoute.path === '/admin/upload' ? 'admin-upload' :
              currentRoute.path === '/admin/knowledge-points' ? 'admin-knowledge-points' :
              currentRoute.path === '/admin/questions' ? 'admin-questions' :
              currentRoute.path === '/admin/exams' ? 'admin-exams' :
              currentRoute.path === '/admin/exam-batch-upload' ? 'admin-exam-batch-upload' :
              currentRoute.path === '/admin/oj' ? 'admin-oj' :
              currentRoute.path === '/admin/plans' ? 'admin-plans' :
              currentRoute.path === '/admin/tests' ? 'admin-tests' :
              currentRoute.path === '/admin/users' ? 'admin-users' :
              currentRoute.fullPath
            "
          />
        </KeepAlive>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: calc(100vh - var(--navbar-height));
  background: var(--color-background);
}

/* Sidebar */
.admin-sidebar {
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

.menu-group {
  margin: var(--space-1) 0;
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

.menu-item.has-children {
  position: relative;
}

.chevron-icon {
  margin-left: auto;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.menu-icon {
  flex-shrink: 0;
}

.menu-label {
  font-size: var(--font-size-sm);
}

/* Sub-menu */
.sub-menu-list {
  list-style: none;
  margin-left: var(--space-4);
  padding-left: var(--space-2);
  border-left: 1px solid var(--color-border);
}

.sub-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-1) 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.sub-menu-item:hover {
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-primary);
}

.sub-menu-item.active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary);
  font-weight: 500;
}

.sub-menu-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.sub-menu-label {
  flex: 1;
}

/* Main Content */
.admin-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: var(--space-6);
  min-height: calc(100vh - var(--navbar-height));
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-sidebar {
    width: 200px;
  }

  .admin-main {
    margin-left: 200px;
    padding: var(--space-4);
  }
}

@media (max-width: 640px) {
  .admin-sidebar {
    transform: translateX(-100%);
  }

  .admin-main {
    margin-left: 0;
  }
}
</style>