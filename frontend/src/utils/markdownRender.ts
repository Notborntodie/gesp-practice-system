import katex from 'katex'
import hljs from 'highlight.js'

/**
 * 渲染数学公式（KaTeX）
 */
export function renderMath(mathText: string, displayMode: boolean = false): string {
  try {
    const cleanMathText = mathText.trim()
    return katex.renderToString(cleanMathText, {
      displayMode: displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: false,
      macros: {
        "\\f": "#1f(#2)"
      }
    })
  } catch (error) {
    console.warn('KaTeX 渲染失败:', error, '公式:', mathText)
    return `<span class="math-error">${mathText}</span>`
  }
}

/**
 * 渲染 Markdown 内容（包含数学公式、代码块等）
 * 与 SmartOJView.vue 的渲染逻辑保持一致
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''

  try {
    // Step 1: 先提取并保护所有数学公式
    const mathStore: Array<{ placeholder: string; html: string; original: string; isBlock: boolean }> = []
    let mathIndex = 0
    let processed = text

    // 处理块级数学公式 $$...$$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, content, offset, string) => {
      if (match.indexOf('__MATH_') >= 0) return match
      const beforeChar = offset > 0 ? string[offset - 1] : ''
      const afterChar = offset + match.length < string.length ? string[offset + match.length] : ''
      if (beforeChar === '$' || afterChar === '$') return match

      const placeholder = `__MATH_BLOCK_${mathIndex}__`
      const trimmedContent = content.trim()
      if (!trimmedContent) return match
      const rendered = renderMath(trimmedContent, true)
      mathStore.push({
        placeholder,
        html: `<div class="math-block">${rendered}</div>`,
        original: match,
        isBlock: true
      })
      mathIndex++
      return placeholder
    })

    // 处理行内数学公式 $...$
    processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content, offset, string) => {
      if (match.indexOf('__MATH_') >= 0) return match
      const beforeChar = offset > 0 ? string[offset - 1] : ''
      const afterChar = offset + match.length < string.length ? string[offset + match.length] : ''
      if (beforeChar === '$' || afterChar === '$') return match

      const trimmedContent = content.trim()
      if (!trimmedContent) return match
      const placeholder = `__MATH_INLINE_${mathIndex}__`
      const rendered = renderMath(trimmedContent, false)
      mathStore.push({
        placeholder,
        html: `<span class="math-inline">${rendered}</span>`,
        original: match,
        isBlock: false
      })
      mathIndex++
      return placeholder
    })

    // Step 2: 处理代码块
    const codeBlockStore: Array<{ placeholder: string; html: string }> = []
    let codeBlockIndex = 0

    processed = processed.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      if (match.indexOf('__MATH_') >= 0) return match
      const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`
      let html = ''

      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value
          html = `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`
        } catch (err) {
          html = `<pre><code>${escapeHtml(code.trim())}</code></pre>`
        }
      } else {
        html = `<pre><code>${escapeHtml(code.trim())}</code></pre>`
      }

      codeBlockStore.push({ placeholder, html })
      codeBlockIndex++
      return placeholder
    })

    // Step 3: 处理长字符串换行
    processed = processed.replace(/([^\s__]{50,})/g, (match) => {
      if (match.indexOf('__MATH_') >= 0 || match.indexOf('__CODE_BLOCK_') >= 0) return match
      return match.replace(/(.{20})/g, '$1\u200B')
    })

    // Step 4: 基础 Markdown 处理
    let result = processed
      .replace(/\n/g, '<br>')
      .replace(/\*\*((?:(?!__MATH_)(?!__CODE_BLOCK_)[\s\S])*?)\*\*/g, '<strong>$1</strong>')
      .replace(/([^*]|^)\*((?:(?!__MATH_)(?!__CODE_BLOCK_)[^*])+?)\*(?!\*)/g, (match, before, content, offset, string) => {
        const charBefore = offset > 0 ? string[offset - 1] : ''
        if (charBefore === '*') return match
        return (before || '') + '<em>' + content + '</em>'
      })
      .replace(/`((?:(?!__MATH_)(?!__CODE_BLOCK_)[^`])+?)`/g, '<code>$1</code>')

    // Step 5: 还原代码块
    codeBlockStore.forEach(({ placeholder, html }) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      result = result.replace(regex, html)
    })

    // Step 6: 还原数学公式
    mathStore.forEach(({ placeholder, html }) => {
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedPlaceholder, 'g')
      result = result.replace(regex, html)
    })

    return result
  } catch (error) {
    console.error('Markdown 渲染失败:', error)
    return `<p class="render-error">渲染失败: ${error}</p>`
  }
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * 渲染数据范围列表
 */
export function renderConstraints(constraints: string[]): string[] {
  if (!constraints || constraints.length === 0) return []
  return constraints.map(c => renderMarkdown(c))
}

/**
 * 格式化日期显示
 */
export function formatDate(dateString: string): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * 获取分类显示文本
 */
export function getCategoryText(category: string): string {
  const map: Record<string, string> = {
    GESP: 'GESP',
    CSPJ: 'CSP-J',
    CSPS: 'CSP-S',
    NOIP: 'NOIP',
    NOI: 'NOI',
    PAT: 'PAT',
    OTHER: '其他'
  }
  return map[category] || category || 'GESP'
}

/**
 * 获取难度显示文本
 */
export function getDifficultyText(difficulty: string): string {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  }
  return map[difficulty] || difficulty || '中等'
}