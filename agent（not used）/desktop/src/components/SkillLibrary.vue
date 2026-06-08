<script setup lang="ts">
/**
 * Skill 库组件
 */

import { ref, onMounted, computed } from 'vue'

interface Skill {
  skill_id: string
  name: string
  description: string
  author_id: number
  use_count: number
  version: number
  is_public: boolean
}

const props = defineProps<{
  teacherId: number
  apiKey: string
}>()

const emit = defineEmits<{
  subscribe: [skillId: string]
  unsubscribe: [skillId: string]
  execute: [skillId: string]
}>()

// Skills 列表
const skills = ref<Skill[]>([])
const subscribedIds = ref<string[]>([])
const searchQuery = ref('')
const sortBy = ref('popular')

// 加载 Skills
onMounted(async () => {
  await loadSkills()
  await loadSubscriptions()
})

async function loadSkills() {
  try {
    const response = await fetch('/api/skills/browse', {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      skills.value = data.skills || []
    }
  } catch (e) {
    // Mock data
    skills.value = [
      {
        skill_id: 'builtin_create_question',
        name: '创建题目',
        description: '快速创建 OJ 题目',
        author_id: 1,
        use_count: 50,
        version: 1,
        is_public: true
      },
      {
        skill_id: 'builtin_create_exam',
        name: '创建考试',
        description: '快速创建考试',
        author_id: 1,
        use_count: 30,
        version: 1,
        is_public: true
      },
      {
        skill_id: 'builtin_query_student',
        name: '查询学生',
        description: '查询学生信息和进度',
        author_id: 1,
        use_count: 40,
        version: 1,
        is_public: true
      }
    ]
  }
}

async function loadSubscriptions() {
  try {
    const response = await fetch(`/api/skills/subscriptions/${props.teacherId}`, {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      subscribedIds.value = data.skill_ids || []
    }
  } catch (e) {
    subscribedIds.value = []
  }
}

// 搜索 Skills
async function searchSkills() {
  if (!searchQuery.value.trim()) {
    await loadSkills()
    return
  }

  try {
    const response = await fetch(`/api/skills/search?q=${encodeURIComponent(searchQuery.value)}`, {
      headers: {
        'Authorization': `Bearer ${props.apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      skills.value = data.skills || []
    }
  } catch (e) {
    // 本地搜索
    skills.value = skills.value.filter(s =>
      s.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
}

// 排序后的 Skills
const sortedSkills = computed(() => {
  let sorted = [...skills.value]

  if (sortBy.value === 'popular') {
    sorted.sort((a, b) => b.use_count - a.use_count)
  } else if (sortBy.value === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  }

  return sorted
})

// 检查是否已订阅
function isSubscribed(skillId: string) {
  return subscribedIds.value.includes(skillId)
}

// 订阅
async function handleSubscribe(skill: Skill) {
  try {
    const response = await fetch(`/api/skills/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        teacher_id: props.teacherId,
        skill_id: skill.skill_id
      })
    })

    if (response.ok) {
      subscribedIds.value.push(skill.skill_id)
      emit('subscribe', skill.skill_id)
    }
  } catch (e) {
    subscribedIds.value.push(skill.skill_id)
  }
}

// 取消订阅
async function handleUnsubscribe(skill: Skill) {
  try {
    const response = await fetch(`/api/skills/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${props.apiKey}`
      },
      body: JSON.stringify({
        teacher_id: props.teacherId,
        skill_id: skill.skill_id
      })
    })

    if (response.ok) {
      subscribedIds.value = subscribedIds.value.filter(id => id !== skill.skill_id)
      emit('unsubscribe', skill.skill_id)
    }
  } catch (e) {
    subscribedIds.value = subscribedIds.value.filter(id => id !== skill.skill_id)
  }
}

// 执行 Skill
function handleExecute(skill: Skill) {
  emit('execute', skill.skill_id)
}
</script>

<template>
  <div class="skill-library">
    <div class="library-header">
      <h2>📚 Skill 库</h2>

      <div class="search-bar">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索 Skills..."
          @keyup.enter="searchSkills"
        />
        <button @click="searchSkills">搜索</button>
      </div>

      <div class="sort-bar">
        <select v-model="sortBy">
          <option value="popular">按热度</option>
          <option value="name">按名称</option>
        </select>
      </div>
    </div>

    <div class="skills-grid">
      <div v-for="skill in sortedSkills" :key="skill.skill_id" class="skill-card">
        <div class="skill-header">
          <span class="skill-name">{{ skill.name }}</span>
          <span class="skill-version">v{{ skill.version }}</span>
        </div>

        <div class="skill-description">
          {{ skill.description }}
        </div>

        <div class="skill-stats">
          <span class="stat-use">使用 {{ skill.use_count }} 次</span>
          <span class="stat-author">作者 #{{ skill.author_id }}</span>
        </div>

        <div class="skill-actions">
          <button
            v-if="!isSubscribed(skill.skill_id)"
            @click="handleSubscribe(skill)"
            class="btn-subscribe"
          >
            订阅
          </button>
          <button
            v-else
            @click="handleUnsubscribe(skill)"
            class="btn-unsubscribe"
          >
            已订阅
          </button>
          <button @click="handleExecute(skill)" class="btn-execute">
            执行
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skill-library {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.library-header h2 {
  margin: 0;
}

.search-bar {
  display: flex;
  gap: 8px;
}

.search-bar input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 200px;
}

.search-bar button {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.sort-bar select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.skill-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
}

.skill-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.skill-name {
  font-weight: bold;
}

.skill-version {
  color: #666;
  font-size: 12px;
}

.skill-description {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.skill-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.skill-actions {
  display: flex;
  gap: 8px;
}

.btn-subscribe {
  padding: 8px 16px;
  background: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-unsubscribe {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-execute {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>