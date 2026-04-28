import { useMessage as naiveUseMessage } from 'naive-ui'
import type { MessageReactive } from 'naive-ui'

export function useMessage() {
  const message = naiveUseMessage()

  const showSuccess = (content: string, duration = 3000): MessageReactive => {
    return message.success(content, { duration })
  }

  const showError = (content: string, duration = 5000): MessageReactive => {
    return message.error(content, { duration })
  }

  const showInfo = (content: string, duration = 3000): MessageReactive => {
    return message.info(content, { duration })
  }

  const showWarning = (content: string, duration = 4000): MessageReactive => {
    return message.warning(content, { duration })
  }

  const showLoading = (content = '加载中...'): MessageReactive => {
    return message.loading(content, { duration: 0 })
  }

  return {
    ...message,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
  }
}
