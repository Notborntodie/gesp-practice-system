<script setup lang="ts">
import { computed } from 'vue'
import { NLayout, NLayoutSider, NMenu } from 'naive-ui'
import type { MenuOption } from 'naive-ui'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  collapsedWidth?: number
  width?: number
  menuOptions: MenuOption[]
  activeKey?: string
}>(), {
  collapsed: false,
  collapsedWidth: 64,
  width: 220,
})

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
  'select': [key: string]
  'toggle': []
}>()

const menuValue = computed(() => props.activeKey || '')
</script>

<template>
  <NLayout has-sider class="app-sidebar-layout">
    <NLayoutSider
      :collapsed="collapsed"
      :collapsed-width="collapsedWidth"
      :width="width"
      :native-scrollbar="false"
      bordered
      show-trigger="bar"
      collapse-mode="width"
      @update:collapsed="emit('update:collapsed', $event)"
    >
      <div class="sidebar-header">
        <slot name="header" />
      </div>
      <NMenu
        :value="menuValue"
        :options="menuOptions"
        :collapsed="collapsed"
        :collapsed-width="collapsedWidth"
        :collapsed-icon-size="20"
        @update:value="(key: string) => emit('select', key)"
      />
    </NLayoutSider>
    <NLayout class="sidebar-content">
      <slot />
    </NLayout>
  </NLayout>
</template>

<style scoped>
.app-sidebar-layout {
  height: calc(100vh - 48px);
}

.sidebar-content {
  overflow: auto;
}

.sidebar-header {
  padding: 16px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0,0,0,0.95);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-header:empty {
  padding: 8px 16px;
}
</style>
