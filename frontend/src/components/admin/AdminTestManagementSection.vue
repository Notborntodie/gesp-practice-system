<template>
  <AdminPageTemplate
    title="测试管理"
    :loading="loading"
    :total="list.length"
    @refresh="load"
  >
    <!-- Header Actions -->
    <template #header-actions>
      <AppButton variant="primary" @click="openCreate">
        <Plus :size="16" />
        新建测试
      </AppButton>
    </template>

    <!-- Content: Table -->
    <div class="test-table-container">
      <table v-if="list.length > 0" class="test-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>限时</th>
            <th>满分</th>
            <th>公开</th>
            <th>查分</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in list" :key="t.id" class="table-row">
            <td class="col-name">{{ t.name }}</td>
            <td>{{ t.time_limit_minutes }} 分钟</td>
            <td>{{ t.total_score ?? '-' }}</td>
            <td>
              <AppTag :type="t.is_public ? 'success' : 'default'">
                {{ t.is_public ? '是' : '否' }}
              </AppTag>
            </td>
            <td>
              <AppTag :type="t.public_result_enabled ? 'success' : 'warning'">
                {{ t.public_result_enabled ? '已开启' : '关闭' }}
              </AppTag>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <AppButton v-if="teacherOnly || canManage(t)" variant="ghost" size="sm" @click="openRanking(t)">
                  <BarChart3 :size="16" />
                </AppButton>
                <template v-if="!t.public_result_enabled">
                  <AppButton v-if="canManage(t)" variant="secondary" size="sm" @click="enablePublic(t)">
                    开启查分
                  </AppButton>
                </template>
                <template v-else>
                  <AppButton variant="ghost" size="sm" @click="showQr(t)">
                    <Link :size="16" />
                  </AppButton>
                </template>
                <template v-if="canManage(t)">
                  <AppButton variant="ghost" size="sm" @click="openEdit(t)">
                    <Pencil :size="16" />
                  </AppButton>
                  <AppButton variant="destructive" size="sm" @click="confirmDelete(t)">
                    <Trash2 :size="16" />
                  </AppButton>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <AppEmptyState v-else type="empty" description="暂无测试，点击「新建测试」创建" />
    </div>

    <!-- QR Code Dialog -->
    <div v-if="qrTest" class="modal-overlay" @click="qrTest = null">
      <div class="modal-card" @click.stop>
        <div class="modal-header">
          <h4>{{ qrTest.name }}</h4>
          <span class="modal-subtitle">成绩查询链接</span>
          <button type="button" class="modal-close" @click="qrTest = null">×</button>
        </div>
        <div class="modal-body">
          <div class="qr-block">
            <p class="qr-hint">学员微信扫一扫即可打开查分页</p>
            <div class="qr-canvas-wrap">
              <img
                v-if="publicResultUrl"
                :src="qrCodeImageUrl"
                alt="查分二维码"
                class="qr-image"
              />
            </div>
          </div>
          <div class="url-block">
            <p class="url-label">或复制链接发给学员</p>
            <div class="url-box">
              <input :value="publicResultUrl" readonly class="url-input" />
              <button type="button" class="btn-copy" :class="{ copied: copySuccess }" @click="copyUrl">
                {{ copySuccess ? '已复制' : '复制' }}
              </button>
            </div>
            <p class="tip">打开链接后输入姓名或用户名可查个人成绩与排名</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-close" @click="qrTest = null">关闭</button>
        </div>
      </div>
    </div>

    <!-- Ranking Dialog -->
    <div v-if="rankingTest" class="modal-overlay modal-ranking-overlay" @click="closeRanking">
      <div class="modal-card modal-ranking-card" @click.stop>
        <div class="modal-ranking-header">
          <h4>测试排名 · {{ rankingTest.name }}</h4>
          <button type="button" class="modal-close" @click="closeRanking">×</button>
        </div>
        <div class="modal-ranking-controls">
          <div v-if="teacherOnly" class="teacher-filter-toggle">
            <label class="filter-toggle-label">
              <input type="checkbox" v-model="showOnlyMyStudents" @change="fetchRankings" class="filter-checkbox" />
              <span>只看我的学生</span>
            </label>
          </div>
          <div class="ranking-search-box">
            <input
              v-model="rankingSearchKeyword"
              type="text"
              placeholder="搜索姓名、用户名..."
              class="ranking-search-input"
            />
          </div>
        </div>
        <div class="modal-ranking-body">
          <div v-if="rankingLoading" class="ranking-loading">
            <div class="loading-spinner"></div>
            <p>加载排名中...</p>
          </div>
          <div v-else-if="rankingError" class="ranking-error">
            <p>{{ rankingError }}</p>
          </div>
          <div v-else-if="filteredRankingList.length === 0" class="ranking-empty">
            <p>暂无排名数据</p>
          </div>
          <div v-else class="ranking-table-wrap">
            <table class="ranking-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>姓名</th>
                  <th>总分</th>
                  <th>客观题</th>
                  <th>编程题</th>
                  <th>交卷时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in filteredRankingList" :key="row.user_id" :class="{ 'top-three': row.rank <= 3 }">
                  <td>{{ row.rank }}</td>
                  <td>{{ row.real_name || row.username || '—' }}</td>
                  <td>{{ formatScore(row.total_score) }}</td>
                  <td>{{ formatScore(row.exam_score) }}</td>
                  <td>{{ formatScore(row.oj_score) }}</td>
                  <td>{{ formatRankingTime(row.submitted_at) }}</td>
                  <td>
                    <AppButton variant="ghost" size="sm" @click="resetAttemptForStudent(row)">
                      重新开启
                    </AppButton>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="ranking-total">共 {{ rankingTotal }} 人已交卷</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Dialog -->
    <AppDialog
      v-model:show="showDeleteDialog"
      title="确认删除"
      width="400"
      positive-text="删除"
      negative-text="取消"
      :loading="deleting"
      @positive="doDelete"
    >
      <p style="color: var(--color-text-secondary);">
        确定要删除测试「{{ deleteTarget?.name }}」吗？将同时删除该测试下的参与记录，且不可恢复。
      </p>
    </AppDialog>
  </AdminPageTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute } from 'vue-router'
import { BASE_URL } from '@/config/api'

// UI Components
import AdminPageTemplate from '@/components/admin/AdminPageTemplate.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'

// Lucide Icons
import { Plus, Pencil, Trash2, Link, BarChart3 } from 'lucide-vue-next'

// Inject
const openTestEditor = inject<(testId?: number) => void>('openTestEditor')

const route = useRoute()
const teacherOnly = computed(() => route.path.startsWith('/teacher'))

const list = ref<any[]>([])
const loading = ref(true)
const qrTest = ref<any>(null)
const showDeleteDialog = ref(false)
const deleteTarget = ref<any>(null)
const deleting = ref(false)

// Ranking State
const rankingTest = ref<any>(null)
const rankingLoading = ref(false)
const rankingList = ref<any[]>([])
const rankingTotal = ref(0)
const rankingError = ref<string | null>(null)
const showOnlyMyStudents = ref(false)
const rankingSearchKeyword = ref('')

function getUserId(): number | null {
  try {
    const s = localStorage.getItem('userInfo')
    if (!s) return null
    const u = JSON.parse(s)
    return u?.id ?? null
  } catch {
    return null
  }
}

function canManage(t: any): boolean {
  if (!teacherOnly.value) return true
  const uid = getUserId()
  if (uid == null) return false
  return Number(t.created_by) === Number(uid)
}

// QR Code
const publicTestBase = computed(() =>
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')

const publicResultUrl = computed(() => {
  if (!qrTest.value?.public_result_token) return ''
  return `${publicTestBase.value}/public-tests/${qrTest.value.public_result_token}`
})

const qrCodeImageUrl = computed(() => {
  const url = publicResultUrl.value
  if (!url) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`
})

const copySuccess = ref(false)
let copySuccessTimer: ReturnType<typeof setTimeout> | null = null

// Ranking
const filteredRankingList = computed(() => {
  const list = rankingList.value
  const kw = (rankingSearchKeyword.value || '').trim().toLowerCase()
  if (!kw) return list
  return list.filter((r: any) => {
    const name = (r.real_name || '').toLowerCase()
    const username = (r.username || '').toLowerCase()
    return name.includes(kw) || username.includes(kw)
  })
})

// Load Data
async function load() {
  const uid = getUserId()
  if (!uid) return
  loading.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests?user_id=${uid}`)
    const data = await res.json()
    list.value = data.list ?? []
  } catch (e) {
    console.error(e)
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [examRes, ojRes] = await Promise.all([
      fetch(`${BASE_URL}/exams?include_all=1`),
      fetch(`${BASE_URL}/oj/problems?pageSize=200&include_all=1`)
    ])
    const exams = await examRes.json()
    examOptions.value = Array.isArray(exams) ? exams : []
    const ojData = await ojRes.json()
    ojOptions.value = ojData?.data ?? []
  } catch (e) {
    console.error(e)
    examOptions.value = []
    ojOptions.value = []
  }
}

function openCreate() {
  openTestEditor?.()
}

function openEdit(t: any) {
  openTestEditor?.(t.id)
}

function confirmDelete(t: any) {
  deleteTarget.value = t
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  const uid = getUserId()
  if (!uid) return
  deleting.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/${deleteTarget.value.id}?user_id=${uid}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    showDeleteDialog.value = false
    deleteTarget.value = null
    await load()
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

async function enablePublic(t: any) {
  const uid = getUserId()
  if (!uid) return
  try {
    const res = await fetch(`${BASE_URL}/tests/${t.id}/enable-public-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid })
    })
    const data = await res.json()
    if (res.ok && data.public_result_token) {
      t.public_result_enabled = true
      t.public_result_token = data.public_result_token
      showQr(t)
    }
  } catch (e) {
    console.error(e)
  }
}

function showQr(t: any) {
  qrTest.value = t
}

function formatScore(v: any): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : '—'
}

function formatRankingTime(v: any): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}

async function openRanking(t: any) {
  rankingTest.value = t
  rankingList.value = []
  rankingTotal.value = 0
  rankingError.value = null
  rankingSearchKeyword.value = ''
  await fetchRankings()
}

function closeRanking() {
  rankingTest.value = null
  rankingList.value = []
  rankingTotal.value = 0
  rankingError.value = null
}

async function fetchRankings() {
  if (!rankingTest.value) return
  const uid = getUserId()
  if (!uid) return
  rankingLoading.value = true
  rankingError.value = null
  try {
    const params = new URLSearchParams({ user_id: String(uid) })
    if (teacherOnly.value && showOnlyMyStudents.value) params.set('my_students_only', '1')
    const res = await fetch(`${BASE_URL}/tests/${rankingTest.value.id}/rankings?${params}`)
    const data = await res.json()
    if (!res.ok) {
      rankingError.value = data.error || '加载排名失败'
      rankingList.value = []
      rankingTotal.value = 0
      return
    }
    rankingList.value = data.list || []
    rankingTotal.value = data.total ?? rankingList.value.length
  } catch (e) {
    rankingError.value = '加载排名失败'
    rankingList.value = []
    rankingTotal.value = 0
  } finally {
    rankingLoading.value = false
  }
}

async function resetAttemptForStudent(row: any) {
  if (!rankingTest.value) return
  const name = row.real_name || row.username || '该生'
  if (!confirm(`确定要为「${name}」重新开启一次测试吗？其当前成绩将被清空，可重新作答。`)) return
  const uid = getUserId()
  if (!uid) return
  try {
    const res = await fetch(
      `${BASE_URL}/tests/${rankingTest.value.id}/reset-attempt?user_id=${uid}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: row.user_id })
      }
    )
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || '操作失败')
      return
    }
    alert('已为该生重新开启，其可重新进入测试作答。')
    await fetchRankings()
  } catch (e) {
    console.error(e)
    alert('操作失败')
  }
}

async function copyUrl() {
  if (copySuccessTimer) clearTimeout(copySuccessTimer)
  try {
    await navigator.clipboard.writeText(publicResultUrl.value)
    copySuccess.value = true
    copySuccessTimer = setTimeout(() => {
      copySuccess.value = false
      copySuccessTimer = null
    }, 2000)
  } catch {
    alert('复制失败，请手动复制链接')
  }
}

onMounted(() => load())
</script>

<style scoped>
/* Table */
.test-table-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.test-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.test-table thead {
  background: var(--color-muted);
}

.test-table th {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.test-table td {
  padding: var(--space-3) var(--space-4);
  color: var(--color-foreground);
  border-bottom: 1px solid var(--color-border);
}

.table-row:hover {
  background: rgba(37, 99, 235, 0.04);
}

.col-name {
  font-weight: 500;
  color: var(--color-primary);
}

.row-actions {
  display: flex;
  gap: var(--space-2);
}

/* Form Sections */
.form-section {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-top: var(--space-3);
}

.form-section-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-foreground);
}

.form-section-desc {
  margin: var(--space-1) 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.form-row-group {
  display: flex;
  gap: var(--space-3);
}

.datetime-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.checkbox-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.checkbox-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Chunk Row */
.chunk-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
}

.chunk-level {
  width: 80px;
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-surface);
}

.chunk-select {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-surface);
}

.chunk-select:disabled {
  background: var(--color-muted);
  cursor: not-allowed;
}

.input-with-suffix {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.input-with-suffix input {
  flex: 1;
  border: none;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.input-with-suffix input:focus {
  outline: none;
}

.input-with-suffix.small input {
  max-width: 90px;
}

.input-with-suffix .suffix {
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-muted);
}

/* QR Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 420px;
  width: 90%;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.modal-header {
  position: relative;
  padding: var(--space-4);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h4 {
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

.modal-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.modal-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.modal-body {
  padding: var(--space-5);
}

.qr-block {
  text-align: center;
  margin-bottom: var(--space-5);
}

.qr-hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.qr-canvas-wrap {
  display: inline-flex;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.qr-image {
  display: block;
  width: 200px;
  height: 200px;
}

.url-block .url-label {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.url-box {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.url-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-muted);
}

.btn-copy {
  padding: var(--space-2) var(--space-3);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
}

.btn-copy:hover {
  background: var(--color-secondary);
}

.btn-copy.copied {
  background: var(--color-accent);
}

.tip {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.modal-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.btn-close {
  padding: var(--space-2) var(--space-4);
  background: var(--color-muted);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

/* Ranking Modal */
.modal-ranking-overlay {
  align-items: flex-start;
  padding-top: 40px;
  padding-bottom: var(--space-4);
}

.modal-ranking-card {
  max-width: 720px;
  width: 96%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-ranking-header {
  position: relative;
  padding: var(--space-3) var(--space-4);
  background: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}

.modal-ranking-header h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-foreground);
}

.modal-ranking-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.filter-toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.filter-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.ranking-search-box {
  flex: 1;
}

.ranking-search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.modal-ranking-body {
  padding: var(--space-4);
  overflow-y: auto;
  flex: 1;
  min-height: 200px;
}

.ranking-loading,
.ranking-error,
.ranking-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  color: var(--color-text-muted);
  gap: var(--space-2);
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ranking-table-wrap {
  overflow-x: auto;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.ranking-table th,
.ranking-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.ranking-table th {
  background: var(--color-muted);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.ranking-table tbody tr:hover {
  background: var(--color-muted);
}

.ranking-table tbody tr.top-three {
  background: rgba(250, 204, 21, 0.1);
}

.ranking-total {
  margin: var(--space-3) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .form-row-group {
    flex-direction: column;
  }

  .chunk-row {
    flex-wrap: wrap;
  }

  .chunk-level {
    width: 100%;
  }

  .chunk-select {
    width: 100%;
  }
}
</style>