import { computed } from 'vue'
import { notionLightTheme } from '@/theme'

export function useTheme() {
  const themeOverrides = computed(() => notionLightTheme)

  return {
    themeOverrides,
    // Stub for future dark mode support
    isDark: false,
    toggleDark: () => {
      // TODO: implement dark mode toggle
    },
  }
}
