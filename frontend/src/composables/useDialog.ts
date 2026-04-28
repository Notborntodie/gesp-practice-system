import { useDialog as naiveUseDialog } from 'naive-ui'

export function useDialog() {
  const dialog = naiveUseDialog()

  const confirm = (
    options: {
      title?: string
      content: string
      positiveText?: string
      negativeText?: string
      onPositiveClick?: () => void | Promise<void>
      onNegativeClick?: () => void
      type?: 'warning' | 'error' | 'info'
    }
  ) => {
    return dialog.warning({
      title: options.title || '确认操作',
      content: options.content,
      positiveText: options.positiveText || '确认',
      negativeText: options.negativeText || '取消',
      onPositiveClick: options.onPositiveClick,
      onNegativeClick: options.onNegativeClick,
      ...(options.type === 'error' ? { type: 'error' as const } : {}),
    })
  }

  const alert = (
    options: {
      title?: string
      content: string
      positiveText?: string
      type?: 'warning' | 'error' | 'info' | 'success'
    }
  ) => {
    const typeMap = {
      warning: dialog.warning,
      error: dialog.error,
      info: dialog.info,
      success: dialog.success,
    }
    const fn = typeMap[options.type || 'info']
    return fn({
      title: options.title || '提示',
      content: options.content,
      positiveText: options.positiveText || '知道了',
    })
  }

  return {
    ...dialog,
    confirm,
    alert,
  }
}
