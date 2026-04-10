<template>
  <div class="test-management-root">
  <BaseTeacherSection title="测试管理">
    <template #header-right>
      <div class="header-right-content">
        <span class="count-info">共 {{ list.length }} 个测试</span>
        <button class="btn-primary btn-create" @click="openCreate">新建测试</button>
      </div>
    </template>
    <template #content>
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
      <div v-else-if="list.length === 0" class="empty-state">
        <p class="empty">暂无测试，点击「新建测试」创建。</p>
      </div>
      <div v-else class="data-table-container">
        <!-- 桌面：表格 -->
        <div class="table-wrap">
          <table class="data-table">
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
                <td class="col-name">
                  <span class="test-name-text">{{ t.name }}</span>
                </td>
                <td>{{ t.time_limit_minutes }} 分钟</td>
                <td>{{ t.total_score ?? '-' }}</td>
                <td>
                  <span :class="['badge', t.is_public ? 'on' : 'off']">{{ t.is_public ? '是' : '否' }}</span>
                </td>
                <td>
                  <span v-if="t.public_result_enabled" class="badge on">已开启</span>
                  <span v-else class="badge off">关闭</span>
                </td>
                <td class="col-actions">
                  <button v-if="teacherOnly || canManage(t)" class="btn-sm btn-ranking" @click="openRanking(t)">查看排名</button>
                  <template v-if="!t.public_result_enabled">
                    <button v-if="canManage(t)" class="btn-sm primary" @click="enablePublic(t)">开启查分</button>
                    <span v-else class="no-action-hint">—</span>
                  </template>
                  <template v-else>
                    <button class="btn-sm btn-qr" @click="showQr(t)">查分链接</button>
                  </template>
                  <template v-if="canManage(t)">
                    <button class="btn-sm" @click="openEdit(t)">编辑</button>
                    <button class="btn-sm danger" @click="confirmDelete(t)">删除</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- 移动：卡片列表 -->
        <div class="card-list">
          <div v-for="t in list" :key="t.id" class="test-card">
            <div class="test-card-main">
              <span class="test-card-title">{{ t.name }}</span>
              <div class="test-card-meta">
                <span>限时 {{ t.time_limit_minutes }} 分钟</span>
                <span>满分 {{ t.total_score ?? '-' }}</span>
                <span :class="['badge', t.is_public ? 'on' : 'off']">{{ t.is_public ? '是' : '否' }}</span>
                <span :class="['badge', t.public_result_enabled ? 'on' : 'off']">{{ t.public_result_enabled ? '已开启查分' : '关闭' }}</span>
              </div>
            </div>
            <div class="test-card-actions">
              <button v-if="teacherOnly || canManage(t)" class="btn-sm btn-ranking" @click="openRanking(t)">查看排名</button>
              <template v-if="!t.public_result_enabled">
                <button v-if="canManage(t)" class="btn-sm primary" @click="enablePublic(t)">开启查分</button>
              </template>
              <template v-else>
                <button class="btn-sm btn-qr" @click="showQr(t)">查分链接</button>
              </template>
              <template v-if="canManage(t)">
                <button class="btn-sm" @click="openEdit(t)">编辑</button>
                <button class="btn-sm danger" @click="confirmDelete(t)">删除</button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BaseTeacherSection>
  <!-- 测试排名弹窗 -->
  <div v-if="rankingTest" class="modal-overlay modal-ranking-overlay" @click="closeRanking">
    <div class="modal-card modal-ranking-card" @click.stop>
      <div class="modal-ranking-header">
        <h4>测试排名 · {{ rankingTest.name }}</h4>
        <button type="button" class="modal-qr-close" aria-label="关闭" @click="closeRanking">×</button>
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
              <tr v-for="(row, idx) in filteredRankingList" :key="row.user_id" :class="{ 'top-three': row.rank <= 3 }">
                <td>{{ row.rank }}</td>
                <td>{{ row.real_name || row.username || '—' }}</td>
                <td>{{ formatScore(row.total_score) }}</td>
                <td>{{ formatScore(row.exam_score) }}</td>
                <td>{{ formatScore(row.oj_score) }}</td>
                <td>{{ formatRankingTime(row.submitted_at) }}</td>
                <td>
                  <button type="button" class="btn-sm btn-reset-attempt" title="为该学生清空本次成绩并允许重新作答" @click.stop="resetAttemptForStudent(row)">
                    重新开启
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="ranking-total">共 {{ rankingTotal }} 人已交卷</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 弹窗统一放在根下 -->
  <template v-if="qrTest || showForm || deleteTarget">
    <!-- 查分链接弹窗：含二维码 -->
    <div v-if="qrTest" class="modal-overlay modal-qr-overlay" @click="qrTest = null">
      <div class="modal-card modal-qr-card" @click.stop>
        <div class="modal-qr-header">
          <h4>{{ qrTest.name }}</h4>
          <span class="modal-qr-subtitle">成绩查询链接</span>
          <button type="button" class="modal-qr-close" aria-label="关闭" @click="qrTest = null">×</button>
        </div>
        <div class="modal-qr-body">
          <div class="qr-block">
            <p class="qr-hint">学员微信扫一扫即可打开查分页</p>
            <div class="qr-canvas-wrap">
              <img
                v-if="publicResultUrl"
                :src="qrCodeImageUrl"
                alt="查分二维码"
                class="qr-image"
                width="200"
                height="200"
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
        <div class="modal-qr-footer">
          <button type="button" class="btn-close" @click="qrTest = null">关闭</button>
        </div>
      </div>
    </div>
    <!-- 新建/编辑弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click="closeForm">
      <div class="modal-form-card" @click.stop>
        <div class="modal-form-header">
          <h4>{{ editingId ? '编辑测试' : '新建测试' }}</h4>
          <button type="button" class="modal-close-x" aria-label="关闭" @click="closeForm">×</button>
        </div>
        <div class="form-body">
          <!-- 基本信息 -->
          <section class="form-block">
            <h5 class="form-block-title">基本信息</h5>
            <div class="form-row">
              <label>名称 <span class="required">*</span></label>
              <input v-model="form.name" type="text" placeholder="例如：GESP 1级模拟" maxlength="100" />
            </div>
            <div class="form-row">
              <label>说明</label>
              <textarea v-model="form.description" placeholder="选填，可写考试说明或注意事项" rows="3" />
            </div>
          </section>

          <!-- 时间与权限 -->
          <section class="form-block">
            <h5 class="form-block-title">时间与权限</h5>
            <div class="form-row">
              <label>考试限时 <span class="required">*</span></label>
              <div class="input-with-suffix">
                <input v-model.number="form.time_limit_minutes" type="number" min="1" placeholder="120" />
                <span class="suffix">分钟</span>
              </div>
            </div>
            <div class="form-row-group">
              <div class="form-row half">
                <label>开始时间</label>
                <input v-model="form.start_time" type="datetime-local" />
              </div>
              <div class="form-row half">
                <label>结束时间</label>
                <input v-model="form.end_time" type="datetime-local" />
              </div>
            </div>
            <div class="form-row checkbox-row">
              <label class="checkbox-label">
                <input v-model="form.is_public" type="checkbox" class="checkbox-input" />
                <span>公开</span>
              </label>
              <span class="checkbox-hint">所有人可见并可参与；关闭后仅创建者及其绑定学生可见</span>
            </div>
          </section>

          <!-- 客观题 -->
          <section class="form-block form-block-exams">
            <h5 class="form-block-title">客观题</h5>
            <p class="form-block-desc">先选等级，再选试卷，并设置满分。</p>
            <div v-for="(item, idx) in form.exams" :key="'e'+idx" class="chunk-row">
              <select v-model.number="item.level" class="chunk-level" @change="onExamLevelChange(item)">
                <option :value="null">等级</option>
                <option v-for="lv in levelOptions" :key="lv" :value="lv">{{ lv }}级</option>
              </select>
              <select v-model="item.exam_id" class="chunk-select" :disabled="item.level == null">
                <option :value="null">{{ item.level == null ? '请先选择等级' : '请选择试卷' }}</option>
                <option v-for="e in examsByLevel(item.level)" :key="e.id" :value="e.id">{{ e.name }}</option>
              </select>
              <div class="input-with-suffix small">
                <input v-model.number="item.score_weight" type="number" min="0" placeholder="满分" />
                <span class="suffix">分</span>
              </div>
              <button type="button" class="btn-remove" @click="form.exams.splice(idx, 1)">移除</button>
            </div>
            <button type="button" class="btn-add" @click="form.exams.push({ exam_id: null, exam_order: form.exams.length, score_weight: null, level: null })">
              + 添加客观题
            </button>
          </section>

          <!-- 编程题 -->
          <section class="form-block form-block-oj">
            <h5 class="form-block-title">编程题</h5>
            <p class="form-block-desc">先选等级，再选题目，并设置满分。</p>
            <div v-for="(item, idx) in form.oj_problems" :key="'p'+idx" class="chunk-row">
              <select v-model.number="item.level" class="chunk-level" @change="onOjLevelChange(item)">
                <option :value="null">等级</option>
                <option v-for="lv in levelOptions" :key="lv" :value="lv">{{ lv }}级</option>
              </select>
              <select v-model="item.problem_id" class="chunk-select" :disabled="item.level == null">
                <option :value="null">{{ item.level == null ? '请先选择等级' : '请选择题目' }}</option>
                <option v-for="p in ojByLevel(item.level)" :key="p.id" :value="p.id">{{ p.title }}</option>
              </select>
              <div class="input-with-suffix small">
                <input v-model.number="item.score_weight" type="number" min="0" placeholder="100" />
                <span class="suffix">分</span>
              </div>
              <button type="button" class="btn-remove" @click="form.oj_problems.splice(idx, 1)">移除</button>
            </div>
            <button type="button" class="btn-add" @click="form.oj_problems.push({ problem_id: null, problem_order: form.oj_problems.length, score_weight: 100, level: null })">
              + 添加编程题
            </button>
          </section>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="closeForm">取消</button>
          <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-overlay" @click="deleteTarget = null">
      <div class="modal-card" @click.stop>
        <h4>确认删除</h4>
        <p>确定要删除测试「{{ deleteTarget.name }}」吗？将同时删除该测试下的参与记录，且不可恢复。</p>
        <div class="form-actions">
          <button class="btn-secondary" @click="deleteTarget = null">取消</button>
          <button class="btn-danger" :disabled="deleting" @click="doDelete">{{ deleting ? '删除中...' : '删除' }}</button>
        </div>
      </div>
    </div>
  </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { BASE_URL } from '@/config/api'
import BaseTeacherSection from '@/components/teacher/BaseTeacherSection.vue'

const route = useRoute()
const teacherOnly = computed(() => route.path.startsWith('/teacher'))

const list = ref<any[]>([])
const loading = ref(true)
const qrTest = ref<any>(null)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const deleteTarget = ref<any>(null)
const deleting = ref(false)
const examOptions = ref<any[]>([])
const ojOptions = ref<any[]>([])

// 测试排名弹窗
const rankingTest = ref<any>(null)
const rankingLoading = ref(false)
const rankingList = ref<any[]>([])
const rankingTotal = ref(0)
const rankingError = ref<string | null>(null)
const showOnlyMyStudents = ref(false)
const rankingSearchKeyword = ref('')

const form = ref({
  name: '',
  description: '',
  time_limit_minutes: 120,
  start_time: '',
  end_time: '',
  is_public: true,
  exams: [] as { exam_id: number | null; exam_order: number; score_weight: number | null; level: number | null }[],
  oj_problems: [] as { problem_id: number | null; problem_order: number; score_weight: number; level: number | null }[]
})

const levelOptions = [1, 2, 3, 4, 5, 6, 7, 8]

function examsByLevel (level: number | null) {
  if (level == null) return []
  return examOptions.value.filter((e: any) => Number(e.level) === Number(level))
}

function ojByLevel (level: number | null) {
  if (level == null) return []
  return ojOptions.value.filter((p: any) => Number(p.level) === Number(level))
}

function onExamLevelChange (item: { level: number | null; exam_id: number | null }) {
  item.exam_id = null
}

function onOjLevelChange (item: { level: number | null; problem_id: number | null }) {
  item.problem_id = null
}

function getUserId (): number | null {
  try {
    const s = localStorage.getItem('userInfo')
    if (!s) return null
    const u = JSON.parse(s)
    return u?.id ?? null
  } catch {
    return null
  }
}

function canManage (t: any): boolean {
  if (!teacherOnly.value) return true
  const uid = getUserId()
  if (uid == null) return false
  return Number(t.created_by) === Number(uid)
}

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

async function load () {
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

async function loadOptions () {
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

function openCreate () {
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    time_limit_minutes: 120,
    start_time: '',
    end_time: '',
    is_public: true,
    exams: [],
    oj_problems: []
  }
  loadOptions()
  showForm.value = true
}

async function openEdit (t: any) {
  editingId.value = t.id
  const uid = getUserId()
  if (!uid) return
  try {
    const res = await fetch(`${BASE_URL}/tests/${t.id}?user_id=${uid}`)
    if (!res.ok) {
      alert('无法加载测试详情')
      return
    }
    const data = await res.json()
    const toDatetimeLocal = (v: string | null) => {
      if (!v) return ''
      const d = new Date(v)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const h = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${day}T${h}:${min}`
    }
    form.value = {
      name: data.name ?? '',
      description: data.description ?? '',
      time_limit_minutes: data.time_limit_minutes ?? 120,
      start_time: toDatetimeLocal(data.start_time),
      end_time: toDatetimeLocal(data.end_time),
      is_public: !!data.is_public,
      exams: (data.exams ?? []).map((e: any, i: number) => ({
        exam_id: e.exam_id,
        exam_order: i,
        score_weight: e.score_weight ?? null,
        level: e.level != null ? Number(e.level) : null
      })),
      oj_problems: (data.oj_problems ?? []).map((p: any, i: number) => ({
        problem_id: p.problem_id,
        problem_order: i,
        score_weight: p.score_weight ?? 100,
        level: p.level != null ? Number(p.level) : null
      }))
    }
    await loadOptions()
    showForm.value = true
  } catch (e) {
    console.error(e)
    alert('加载失败')
  }
}

function closeForm () {
  showForm.value = false
  editingId.value = null
}

function buildPayload () {
  const uid = getUserId()
  const start = form.value.start_time ? form.value.start_time.slice(0, 16).replace('T', ' ') + ':00' : null
  const end = form.value.end_time ? form.value.end_time.slice(0, 16).replace('T', ' ') + ':00' : null
  const exams = form.value.exams
    .filter(e => e.exam_id != null)
    .map((e, i) => ({ exam_id: e.exam_id, exam_order: i, score_weight: e.score_weight }))
  const oj_problems = form.value.oj_problems
    .filter(p => p.problem_id != null)
    .map((p, i) => ({ problem_id: p.problem_id, problem_order: i, score_weight: p.score_weight ?? 100 }))
  return {
    user_id: uid,
    name: form.value.name.trim(),
    description: form.value.description?.trim() || null,
    time_limit_minutes: form.value.time_limit_minutes,
    start_time: start,
    end_time: end,
    is_public: form.value.is_public,
    exams,
    oj_problems
  }
}

async function submitForm () {
  if (!form.value.name.trim()) {
    alert('请填写名称')
    return
  }
  if (form.value.time_limit_minutes < 1) {
    alert('限时至少 1 分钟')
    return
  }
  const uid = getUserId()
  if (!uid) {
    alert('请先登录')
    return
  }
  saving.value = true
  try {
    const body = buildPayload()
    const id = editingId.value
    const url = id ? `${BASE_URL}/tests/${id}` : `${BASE_URL}/tests`
    const method = id ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || '保存失败')
    }
    closeForm()
    await load()
  } catch (e) {
    alert(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete (t: any) {
  deleteTarget.value = t
}

async function doDelete () {
  if (!deleteTarget.value) return
  const uid = getUserId()
  if (!uid) return
  deleting.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests/${deleteTarget.value.id}?user_id=${uid}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    deleteTarget.value = null
    await load()
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

async function enablePublic (t: any) {
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

function showQr (t: any) {
  qrTest.value = t
}

function formatScore (v: any): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : '—'
}

function formatRankingTime (v: any): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}

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

async function openRanking (t: any) {
  rankingTest.value = t
  rankingList.value = []
  rankingTotal.value = 0
  rankingError.value = null
  rankingSearchKeyword.value = ''
  await fetchRankings()
}

function closeRanking () {
  rankingTest.value = null
  rankingList.value = []
  rankingTotal.value = 0
  rankingError.value = null
}

async function resetAttemptForStudent (row: any) {
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

async function fetchRankings () {
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


async function copyUrl () {
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
.header-right-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-info {
  color: #0369a1;
  font-size: 14px;
  font-weight: 700;
  padding: 6px 12px;
  background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
  border-radius: 8px;
  border: 2px solid #87ceeb;
  box-shadow: 0 2px 6px rgba(30, 144, 255, 0.15);
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4); }
.btn-create { flex-shrink: 0; }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #0369a1;
  gap: 12px;
}
.loading-state p { margin: 0; font-size: 14px; font-weight: 600; }
.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #bae6fd;
  border-top-color: #1e90ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { padding: 24px; text-align: center; }
.empty { color: #64748b; margin: 0; font-size: 0.95rem; }

.data-table-container { width: 100%; }
.table-wrap { overflow-x: auto; border-radius: 12px; border: 2px solid #87ceeb; background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%); box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15); }
.data-table { width: 100%; border-collapse: collapse; min-width: 640px; }
.data-table th, .data-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #bae6fd; }
.data-table th { background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); font-weight: 700; font-size: 0.9rem; color: #0c4a6e; letter-spacing: 0.01em; }
.data-table tbody td { font-weight: 600; font-size: 0.95rem; color: #0f172a; }
.data-table tbody tr:hover { background: rgba(224, 242, 254, 0.5); }
.data-table tbody tr:last-child td { border-bottom: none; }
.table-row { transition: background 0.2s; }
.col-name { min-width: 140px; }
.test-name-text { font-weight: 600; color: #0369a1; font-size: 15px; }
.col-actions { white-space: nowrap; }
.no-action-hint { color: #94a3b8; font-size: 0.9rem; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; }
.badge.on { background: #dcfce7; color: #16a34a; }
.badge.off { background: #f1f5f9; color: #64748b; }
.btn-sm { margin-right: 6px; margin-bottom: 4px; padding: 6px 12px; font-size: 0.85rem; border-radius: 8px; cursor: pointer; border: 2px solid #87ceeb; background: linear-gradient(135deg, #fff 0%, #f0f9ff 100%); color: #0369a1; text-decoration: none; display: inline-block; transition: background 0.2s, border-color 0.2s; }
.btn-sm:hover { background: #e0f2fe; border-color: #1e90ff; }
.btn-sm.primary { background: linear-gradient(135deg, #1e90ff, #38bdf8); color: #fff; border-color: #1e90ff; }
.btn-sm.primary:hover { background: #0284c7; }
.btn-sm.btn-qr { border-color: #38bdf8; color: #1e90ff; }
.btn-sm.btn-qr:hover { background: #f0f9ff; }
.btn-sm.danger { color: #dc2626; border-color: #fecaca; background: #fff; }
.btn-sm.danger:hover { background: #fef2f2; }
.card-list { display: none; }
.test-card { background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%); border: 2px solid #87ceeb; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15); }
.test-card-main { margin-bottom: 12px; }
.test-card-title { display: block; font-weight: 700; color: #0369a1; margin-bottom: 8px; font-size: 1.1rem; }
.test-card-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.9rem; font-weight: 600; color: #0f172a; }
.test-card-meta .badge { margin-right: 0; }
.test-card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.test-card-actions .btn-sm { margin-right: 0; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; overflow-y: auto; }
.modal-card { background: #fff; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; }
.modal-card h4 { margin: 0 0 12px 0; }
.modal-qr-card { max-width: 420px; padding: 0; overflow: hidden; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
.modal-qr-header { position: relative; padding: 20px 24px 16px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-bottom: 1px solid #bae6fd; }
.modal-qr-header h4 { margin: 0 0 4px 0; font-size: 1.2rem; font-weight: 600; color: #0f172a; }
.modal-qr-subtitle { font-size: 0.9rem; color: #64748b; }
.modal-qr-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border: none; background: rgba(255,255,255,0.8); color: #64748b; font-size: 1.5rem; line-height: 1; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.modal-qr-close:hover { background: #fff; color: #0f172a; }
.modal-qr-body { padding: 24px; }
.qr-block { text-align: center; margin-bottom: 24px; }
.qr-hint { margin: 0 0 16px 0; font-size: 0.9rem; color: #475569; }
.qr-canvas-wrap { display: inline-flex; padding: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.qr-image { display: block; width: 200px; height: 200px; }
.url-block .url-label { margin: 0 0 8px 0; font-size: 0.9rem; color: #475569; }
.url-box { display: flex; gap: 10px; margin-bottom: 10px; }
.url-input { flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; background: #f8fafc; }
.btn-copy { padding: 10px 18px; background: #1e90ff; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 500; flex-shrink: 0; transition: background 0.2s; }
.btn-copy:hover { background: #0c7cd5; }
.btn-copy.copied { background: #16a34a; }
.url-block .tip { margin: 0; font-size: 0.82rem; color: #64748b; }
.modal-qr-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; }
.modal-qr-footer .btn-close { padding: 10px 24px; background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-size: 0.95rem; }
.modal-qr-footer .btn-close:hover { background: #e2e8f0; }
.modal-form-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  max-width: 640px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.modal-form-header h4 { margin: 0; font-size: 1.25rem; font-weight: 600; color: #0f172a; }
.modal-close-x {
  width: 32px;
  height: 32px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  font-size: 1.5rem;
  line-height: 1;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.modal-close-x:hover { background: #e2e8f0; color: #0f172a; }
.form-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.form-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
}
.form-block-title {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #334155;
}
.form-block-desc {
  margin: 0 0 12px 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.4;
}
.form-block-desc + .chunk-row { margin-top: 0; }
.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-row:last-child { margin-bottom: 0; }
.form-row label { font-weight: 500; font-size: 0.9rem; color: #374151; }
.form-row .required { color: #dc2626; }
.form-row input[type="text"],
.form-row input[type="number"],
.form-row input[type="datetime-local"],
.form-row textarea {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}
.form-row input:focus,
.form-row textarea:focus {
  outline: none;
  border-color: #1e90ff;
  box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.15);
}
.form-row textarea { resize: vertical; min-height: 64px; }
.input-with-suffix {
  display: flex;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.input-with-suffix:focus-within { border-color: #1e90ff; box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.15); }
.input-with-suffix input {
  flex: 1;
  min-width: 0;
  border: none;
  padding: 10px 14px;
  font-size: 0.95rem;
}
.input-with-suffix input:focus { outline: none; }
.input-with-suffix.small input { padding: 8px 12px; max-width: 90px; }
.input-with-suffix .suffix {
  padding: 0 14px;
  font-size: 0.9rem;
  color: #64748b;
  background: #f1f5f9;
  white-space: nowrap;
}
.input-with-suffix.small .suffix { padding: 0 10px; font-size: 0.85rem; }
.form-row-group { display: flex; gap: 16px; margin-bottom: 14px; }
.form-row-group .form-row { flex: 1; margin-bottom: 0; }
.form-row.checkbox-row {
  flex-direction: column;
  gap: 6px;
  margin-bottom: 0;
}
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  cursor: pointer;
}
.checkbox-input { width: 18px; height: 18px; cursor: pointer; accent-color: #1e90ff; }
.checkbox-hint { font-size: 0.82rem; color: #64748b; margin-left: 28px; line-height: 1.4; }
.form-block-exams .chunk-row,
.form-block-oj .chunk-row { margin-bottom: 10px; }
.form-block-exams .btn-add,
.form-block-oj .btn-add { margin-top: 6px; }
.chunk-row { display: flex; gap: 10px; align-items: center; }
.chunk-level {
  width: 72px;
  flex-shrink: 0;
  padding: 10px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  background: #fff;
}
.chunk-level:focus { outline: none; border-color: #1e90ff; }
.chunk-select { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; }
.chunk-select:focus { outline: none; border-color: #1e90ff; }
.chunk-select:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
.btn-remove {
  padding: 8px 14px;
  font-size: 0.85rem;
  color: #dc2626;
  background: #fff;
  border: 1px solid #fecaca;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-remove:hover { background: #fef2f2; }
.btn-add {
  padding: 10px 16px;
  font-size: 0.9rem;
  color: #1e90ff;
  background: #fff;
  border: 1px dashed #7dd3fc;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.btn-add:hover { background: #f0f9ff; border-color: #1e90ff; }
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}
.form-actions .btn-primary { padding: 10px 20px; font-size: 1rem; }
.form-actions .btn-secondary { padding: 10px 20px; font-size: 1rem; }
.url-label { margin: 0 0 8px 0; font-size: 0.9rem; color: #475569; }
.url-box { display: flex; gap: 8px; margin-bottom: 12px; }
.url-input { flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; }
.btn-copy { padding: 8px 16px; background: #1e90ff; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.tip { margin: 0 0 16px 0; font-size: 0.85rem; color: #64748b; }
.btn-close { padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 8px; cursor: pointer; }

@media (max-width: 768px) {
  .header-right-content { flex-wrap: wrap; }
  .btn-create { width: 100%; }
  .table-wrap { display: none; }
  .card-list { display: block; }
  .test-card { padding: 14px; }
  .test-card-actions { margin-top: 4px; }
  .modal-qr-overlay { padding: 12px; align-items: flex-start; }
  .modal-qr-card { width: 100%; max-width: none; margin: auto 0; max-height: calc(100vh - 24px); overflow-y: auto; }
  .modal-qr-header { padding: 16px 44px 14px 16px; }
  .modal-qr-body { padding: 20px 16px; }
  .qr-canvas-wrap { padding: 12px; }
  .qr-image { width: 180px; height: 180px; }
  .url-box { flex-direction: column; }
  .modal-qr-footer { padding: 14px 16px; }
}

/* 测试排名弹窗 */
.modal-ranking-overlay { align-items: flex-start; padding-top: 40px; padding-bottom: 24px; }
.modal-ranking-card {
  max-width: 720px;
  width: 96%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-ranking-header {
  position: relative;
  padding: 16px 24px;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border-bottom: 1px solid #bae6fd;
  flex-shrink: 0;
}
.modal-ranking-header h4 { margin: 0; font-size: 1.15rem; font-weight: 600; color: #0c4a6e; }
.modal-ranking-header .modal-qr-close { top: 12px; right: 16px; }
.modal-ranking-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.teacher-filter-toggle .filter-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #475569;
  cursor: pointer;
}
.teacher-filter-toggle .filter-checkbox { width: 16px; height: 16px; accent-color: #1e90ff; cursor: pointer; }
.ranking-search-box { flex: 1; min-width: 0; }
.ranking-search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
}
.ranking-search-input:focus { outline: none; border-color: #1e90ff; }
.modal-ranking-body {
  padding: 16px 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 200px;
}
.ranking-loading, .ranking-error, .ranking-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #64748b;
  gap: 10px;
}
.ranking-loading .loading-spinner { width: 28px; height: 28px; border: 3px solid #bae6fd; border-top-color: #1e90ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.ranking-table-wrap { overflow-x: auto; }
.ranking-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.ranking-table th, .ranking-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.ranking-table th { background: #f1f5f9; font-weight: 600; color: #334155; }
.ranking-table tbody tr:hover { background: #f8fafc; }
.ranking-table tbody tr.top-three { background: #fefce8; }
.ranking-total { margin: 12px 0 0 0; font-size: 0.85rem; color: #64748b; }
.btn-ranking { color: #0c4a6e; border-color: #7dd3fc; }
.btn-ranking:hover { background: #e0f2fe; }
.btn-reset-attempt { font-size: 0.8rem; padding: 4px 10px; color: #b45309; border-color: #fcd34d; }
.btn-reset-attempt:hover { background: #fef3c7; }

@media (max-width: 480px) {
  .qr-image { width: 160px; height: 160px; }
  .modal-ranking-card { width: 100%; max-height: 90vh; }
  .modal-ranking-controls { flex-wrap: wrap; }
}
</style>
