<template>
  <div class="ai-management">
    <div class="section-header">
      <h2>AI 管理</h2>
    </div>

    <div class="input-area">
      <div class="input-row">
        <label class="label">问题描述</label>
        <textarea
          v-model="question"
          class="question-input"
          placeholder="例如：GESP1级第一个任务全部学员的完成情况"
          rows="3"
        />
      </div>
      <div class="input-row">
        <label class="label">结果展示</label>
        <div class="result-type-options">
          <label class="radio-label">
            <input v-model="resultType" type="radio" value="table" />
            <span>表格</span>
          </label>
          <label class="radio-label">
            <input v-model="resultType" type="radio" value="page" />
            <span>页面</span>
          </label>
        </div>
      </div>
      <div class="input-row actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !question.trim()"
          @click="submit"
        >
          {{ loading ? '查询中...' : '执行查询' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>正在生成并执行查询...</span>
    </div>

    <div v-else-if="result" class="result-area">
      <template v-if="resultType === 'table'">
        <div class="table-actions">
          <span v-if="result.truncated" class="truncated-hint">仅显示前 {{ result.rows.length }} 条</span>
          <button type="button" class="btn btn-export" @click="exportCsv">导出 CSV</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="col in result.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in result.rows" :key="i">
                <td v-for="col in result.columns" :key="col">{{ formatCell(row[col]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template v-else>
        <div class="page-template">
          <div class="page-summary">
            <span class="summary-text">共 {{ result.rows.length }} 条结果</span>
            <span v-if="result.truncated" class="truncated-hint">（已截断）</span>
            <button type="button" class="btn btn-export" @click="exportCsv">导出 CSV</button>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th v-for="col in result.columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in result.rows" :key="i">
                  <td v-for="col in result.columns" :key="col">{{ formatCell(row[col]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

const question = ref('')
const resultType = ref<'table' | 'page'>('table')
const loading = ref(false)
const error = ref('')
const result = ref<{ columns: string[]; rows: Record<string, unknown>[]; truncated?: boolean } | null>(null)

const userInfo = ref<{ id: number } | null>(null)

onMounted(() => {
  const raw = localStorage.getItem('userInfo')
  if (raw) {
    try {
      userInfo.value = JSON.parse(raw)
    } catch {
      userInfo.value = null
    }
  }
})

function formatCell(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function submit() {
  const q = question.value.trim()
  if (!q) return
  if (!userInfo.value?.id) {
    error.value = '请先登录'
    return
  }
  error.value = ''
  result.value = null
  loading.value = true
  try {
    const res = await axios.post(
      `${BASE_URL}/admin/ai-query`,
      {
        question: q,
        resultType: resultType.value,
        admin_user_id: userInfo.value.id
      },
      { timeout: 60000 }
    )
    if (res.data && res.data.success && res.data.data) {
      result.value = {
        columns: res.data.data.columns || [],
        rows: res.data.data.rows || [],
        truncated: res.data.data.truncated
      }
    } else {
      error.value = res.data?.message || '请求失败'
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || '网络或服务错误'
  } finally {
    loading.value = false
  }
}

function exportCsv() {
  if (!result.value || result.value.rows.length === 0) return
  const cols = result.value.columns
  const lines: string[] = ['\uFEFF' + cols.join(',')]
  for (const row of result.value.rows) {
    lines.push(cols.map((c) => String(row[c] ?? '').replace(/,/g, '，')).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-query-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.ai-management {
  padding: 24px;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 1.8rem;
  font-weight: 700;
}

.input-area {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.input-row {
  margin-bottom: 16px;
}

.input-row:last-child {
  margin-bottom: 0;
}

.label {
  display: block;
  margin-bottom: 8px;
  color: #64748b;
  font-weight: 600;
  font-size: 14px;
}

.question-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

.question-input:focus {
  outline: none;
  border-color: #1e90ff;
}

.result-type-options {
  display: flex;
  gap: 24px;
  align-items: center;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #334155;
}

.actions .btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #1e90ff;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #1a7fe6;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-export {
  padding: 8px 16px;
  font-size: 13px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.btn-export:hover {
  background: #f1f5f9;
}

.error-message {
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 6px;
  font-size: 14px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
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
  to { transform: rotate(360deg); }
}

.result-area {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.table-actions,
.page-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.truncated-hint {
  font-size: 13px;
  color: #64748b;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}

.data-table tr:hover {
  background: #f8fafc;
}

.page-template .page-summary .summary-text {
  font-weight: 600;
  color: #334155;
}
</style>
