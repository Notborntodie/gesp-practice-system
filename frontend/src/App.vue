<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import GlobalGrowthPetFloating from './components/plan/GlobalGrowthPetFloating.vue'

const route = useRoute()

// 动画页面、公开查分/计划进度页在 #app 上添加标记，用于禁用双栏布局并保证窄屏正常
watch(
  () => route.path,
  (path) => {
    const appEl = document.getElementById('app')
    if (appEl) {
      appEl.classList.toggle('animation-page', path.startsWith('/animation/'))
      appEl.classList.toggle('public-query-page', path.startsWith('/public-tests/') || path.startsWith('/public-plans/'))
    }
  },
  { immediate: true }
)
</script>

<template>
  <NavBar />
  <main class="main-content">
    <RouterView />
  </main>
  <GlobalGrowthPetFloating />
</template>

<style scoped>
.app-wrapper {
  width: 50vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* 主内容区域，为导航栏留出空间 */
.main-content {
  padding-top: 48px; /* 与导航栏高度一致 */
  min-height: calc(100vh - 48px);
  width: 100%;
  flex: 1;
  /* 移除 max-width 限制，让内容占满整个屏幕 */
}
</style>
