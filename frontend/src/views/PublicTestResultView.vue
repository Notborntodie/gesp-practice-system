<template>
  <div class="public-result-page">
    <div class="public-result-card">
      <div v-if="configLoading" class="state">加载中...</div>
      <div v-else-if="!config?.allow_query" class="state">
        <p>{{ config?.reason === 'NOT_ENABLED_OR_NOT_FINISHED' ? '该考试暂未开放成绩查询' : '链接无效或已关闭' }}</p>
      </div>
      <div v-else class="content">
        <h1 class="test-title">{{ config.test_name }}</h1>
        <p v-if="config.description" class="test-desc">{{ config.description }}</p>

        <div v-if="!result && !queryLoading" class="form-section">
          <div class="form-group">
            <label>姓名</label>
            <input v-model="form.name" type="text" placeholder="请输入姓名或用户名" />
          </div>
          <button class="submit-btn" :disabled="queryLoading || !form.name.trim()" @click="query">
            {{ queryLoading ? '查询中...' : '查询成绩' }}
          </button>
        </div>

        <div v-else-if="queryLoading" class="state">查询中...</div>
        <div v-else-if="result?.found" class="result-section">
          <p class="result-name">{{ result.name }}</p>
          <p class="result-score">总分：<strong>{{ result.total_score }}</strong></p>
          <p class="result-detail">客观题 {{ result.exam_score }} &nbsp; 编程题 {{ result.oj_score }}</p>
          <p class="result-rank">排名：第 {{ result.rank }} 名 / 共 {{ result.total_participants }} 人</p>
          <button class="again-btn" @click="result = null">再查一次</button>
        </div>
        <div v-else class="state">
          <p>{{ queryError || '未查到该姓名/用户名的成绩，请确认输入与报名信息一致' }}</p>
          <button class="again-btn" @click="result = null; queryError = null">重新输入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { BASE_URL } from '@/config/api'

const route = useRoute()
const token = ref(route.params.token as string)

const config = ref<{ allow_query: boolean; test_name?: string; description?: string; reason?: string } | null>(null)
const configLoading = ref(true)
const form = ref({ name: '' })
const result = ref<{
  found: boolean
  name?: string
  total_score?: number
  exam_score?: number
  oj_score?: number
  rank?: number
  total_participants?: number
} | null>(null)
const queryLoading = ref(false)
const queryError = ref<string | null>(null)

async function loadConfig () {
  configLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/public-tests/${token.value}/config`)
    config.value = await res.json()
  } catch {
    config.value = null
  } finally {
    configLoading.value = false
  }
}

async function query () {
  if (!form.value.name.trim()) return
  queryLoading.value = true
  queryError.value = null
  result.value = null
  try {
    const res = await fetch(`${BASE_URL}/public-tests/${token.value}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.value.name.trim() })
    })
    const data = await res.json()
    result.value = data
  } catch {
    queryError.value = '网络错误，请稍后重试'
  } finally {
    queryLoading.value = false
  }
}

onMounted(() => loadConfig())
watch(() => route.params.token, (t) => {
  token.value = t as string
  loadConfig()
  result.value = null
  form.value = { name: '' }
})
</script>

<style scoped>
/* PC 与移动端共用：安全区、触控友好；缩小浏览器时避免横向溢出 */
.public-result-page {
  min-height: 100vh;
  min-height: calc(100vh - env(safe-area-inset-bottom, 0px));
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
  padding: 24px;
  padding-left: max(24px, env(safe-area-inset-left));
  padding-right: max(24px, env(safe-area-inset-right));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  background: linear-gradient(135deg, #e0f2fe 0%, #f8fafc 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  box-sizing: border-box;
}
.public-result-card {
  width: 100%;
  min-width: 0;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 24px;
  box-sizing: border-box;
}
.state {
  text-align: center;
  padding: 32px 0;
  font-weight: 600;
  color: #0f172a;
}
.test-title {
  font-size: 1.4rem;
  margin: 0 0 8px 0;
  text-align: center;
  word-break: break-word;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.01em;
}
.test-desc {
  text-align: center;
  color: #475569;
  font-size: 0.9rem;
  margin: 0 0 24px 0;
  word-break: break-word;
}
.form-section {
  margin-top: 16px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
}
.form-group input {
  width: 100%;
  padding: 12px 14px;
  min-height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
}
.submit-btn {
  width: 100%;
  padding: 14px 16px;
  min-height: 48px;
  margin-top: 8px;
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.result-section {
  text-align: center;
  padding: 24px 0;
}
.result-name { font-size: 1.15rem; font-weight: 600; color: #0f172a; margin: 0 0 12px 0; word-break: break-word; letter-spacing: 0.01em; }
.result-score { font-size: 1.5rem; font-weight: 600; color: #0f172a; margin: 0 0 8px 0; }
.result-detail { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 8px 0; }
.result-rank { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 20px 0; }
.again-btn {
  padding: 12px 24px;
  min-height: 44px;
  background: #e2e8f0;
  color: #0f172a;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  -webkit-tap-highlight-color: transparent;
}

/* 中等窄屏（缩小浏览器）：留白缩小，避免挤压 */
@media (max-width: 900px) {
  .public-result-page {
    padding: 20px;
    padding-left: max(20px, env(safe-area-inset-left));
    padding-right: max(20px, env(safe-area-inset-right));
  }
  .public-result-card {
    padding: 22px 20px;
  }
}

/* 移动端：更紧凑留白、更大触控区 */
@media (max-width: 600px) {
  .public-result-page {
    padding: 16px;
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    align-items: flex-start;
    padding-top: max(16px, env(safe-area-inset-top));
  }
  .public-result-card {
    padding: 20px 18px;
    border-radius: 12px;
  }
  .test-title {
    font-size: 1.25rem;
  }
  .form-group input {
    min-height: 48px;
    font-size: 16px;
  }
  .submit-btn {
    min-height: 48px;
    font-size: 1rem;
  }
  .again-btn {
    min-height: 48px;
    padding: 14px 28px;
  }
}
</style>
