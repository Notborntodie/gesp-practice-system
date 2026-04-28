<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { BASE_URL } from '@/config/api'

// UI Components
import AppFormDialog from '@/components/ui/AppFormDialog.vue'
import AppFormField from '@/components/ui/AppFormField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [knowledgePoint: any]
}>()

// Form data
const formData = ref({
  name: '',
  description: '',
  category: 'data_structure',
  level: '1',
})

const loading = ref(false)
const formError = ref('')

// Options
const categoryOptions = [
  { label: '算法', value: 'algorithm' },
  { label: '数据结构', value: 'data_structure' },
  { label: '编程', value: 'programming' },
  { label: '数学', value: 'math' },
]

const levelOptions = [
  { label: 'GESP 1级', value: '1' },
  { label: 'GESP 2级', value: '2' },
  { label: 'GESP 3级', value: '3' },
  { label: 'GESP 4级', value: '4' },
  { label: 'GESP 5级', value: '5' },
  { label: 'GESP 6级', value: '6' },
  { label: 'GESP 7级', value: '7' },
  { label: 'GESP 8级', value: '8' },
]

// Validation
const isValid = computed(() => formData.value.name.trim() !== '')

// Reset form when dialog closes
watch(() => props.visible, (visible) => {
  if (!visible) {
    formData.value = {
      name: '',
      description: '',
      category: 'data_structure',
      level: '1',
    }
    formError.value = ''
  }
})

async function handleSubmit() {
  if (!isValid.value) {
    formError.value = '请填写知识点名称'
    return
  }

  loading.value = true
  formError.value = ''

  try {
    const response = await axios.post(`${BASE_URL}/knowledge-points`, {
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
      category: formData.value.category,
      level: parseInt(formData.value.level),
    })

    const newKnowledgePoint = {
      id: response.data.id,
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
      category: formData.value.category,
      level: parseInt(formData.value.level),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    emit('created', newKnowledgePoint)
    emit('close')
  } catch (error: any) {
    formError.value = error.response?.data?.message || error.message || '创建失败'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <AppFormDialog
    :show="visible"
    title="创建知识点"
    width="520"
    :loading="loading"
    positive-text="创建"
    @update:show="(val) => !val && handleClose()"
    @positive="handleSubmit"
    @negative="handleClose"
  >
    <div class="form-grid">
      <AppFormField label="知识点名称" required>
        <AppInput
          v-model="formData.name"
          placeholder="如：链表基础"
          :error="formError && !isValid ? '请填写知识点名称' : ''"
        />
      </AppFormField>

      <AppFormField label="分类">
        <AppSelect
          v-model="formData.category"
          :options="categoryOptions"
          placeholder="选择分类"
        />
      </AppFormField>

      <AppFormField label="等级">
        <AppSelect
          v-model="formData.level"
          :options="levelOptions"
          placeholder="选择等级"
        />
      </AppFormField>
    </div>

    <AppFormField label="描述">
      <AppTextarea
        v-model="formData.description"
        placeholder="知识点详细描述..."
        :rows="4"
      />
    </AppFormField>

    <p v-if="formError && isValid" class="form-error-msg">{{ formError }}</p>
  </AppFormDialog>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-error-msg {
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2);
}
</style>