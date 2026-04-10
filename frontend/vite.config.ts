import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // 支持环境变量
  envPrefix: 'VITE_',
  // 构建优化配置
  build: {
    // 启用资源预加载
    rollupOptions: {
      output: {
        // 手动分包策略，优化资源加载
        manualChunks: {
          // 将 Vue 核心库单独打包
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // 将大型第三方库单独打包
          'editor-vendor': ['codemirror', '@codemirror/view', '@codemirror/state'],
          // 将工具库单独打包
          'utils-vendor': ['axios', 'marked', 'katex'],
        },
        // 优化 chunk 文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用资源内联阈值（小于 4kb 的资源内联）
    assetsInlineLimit: 4096,
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 保留 console，方便调试
        drop_debugger: true,
      },
    },
    // 启用 sourcemap（生产环境可关闭）
    sourcemap: false,
    // 启用 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },
  // 开发服务器：监听所有网卡，便于局域网/外网访问
  server: {
    host: true, // 监听 0.0.0.0，外网可访问
    port: 5137,
    strictPort: false, // 若 5137 被占用则自动尝试下一端口
    // 允许的 host（开发时外网访问可配置 VITE_ALLOWED_HOSTS 环境变量，逗号分隔，如：your-domain.com,192.168.1.100）
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean).concat(['localhost', '127.0.0.1'])
      : ['localhost', '127.0.0.1'],
    // 代理配置：将 /api 请求代理到后端服务器
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      // AI API 代理（如果需要）
      '/ai-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ai-api/, '/api'),
      },
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'axios',
      'codemirror',
      '@codemirror/view',
      '@codemirror/state',
    ],
  },
})
