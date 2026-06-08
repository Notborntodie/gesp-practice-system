import { describe, expect, it } from 'vitest'
import { buildMonthOptions, normalizeMonthValue } from './monthOptions'

describe('monthOptions', () => {
  it('normalizes valid month-like values to YYYY-MM', () => {
    expect(normalizeMonthValue('2026-03')).toBe('2026-03')
    expect(normalizeMonthValue('2026-03-15')).toBe('2026-03')
    expect(normalizeMonthValue('2026/03')).toBe('2026-03')
    expect(normalizeMonthValue('2026年3月')).toBe('2026-03')
    expect(normalizeMonthValue('bad-date')).toBe('')
  })

  it('builds unique month options sorted by recent month first', () => {
    expect(buildMonthOptions(['2026-03-10', '2025-09', '2026年3月', '', 'bad'])).toEqual([
      { label: '2026 年 3 月', value: '2026-03' },
      { label: '2025 年 9 月', value: '2025-09' },
    ])
  })
})
