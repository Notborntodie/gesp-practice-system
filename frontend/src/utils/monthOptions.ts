export interface MonthOption {
  label: string
  value: string
}

const MONTH_PATTERN = /(\d{4})\D?(\d{1,2})/

export function normalizeMonthValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = String(value).trim()
  if (!raw) return ''

  const match = raw.match(MONTH_PATTERN)
  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month)) return ''
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return ''

  return `${year}-${String(month).padStart(2, '0')}`
}

export function formatMonthLabel(value: string): string {
  const normalized = normalizeMonthValue(value)
  if (!normalized) return ''
  const [year, month] = normalized.split('-')
  return `${year} 年 ${Number(month)} 月`
}

export function buildMonthOptions(values: unknown[] = []): MonthOption[] {
  const unique = new Set<string>()
  values.forEach(value => {
    const month = normalizeMonthValue(value)
    if (month) unique.add(month)
  })

  return Array.from(unique)
    .sort((a, b) => b.localeCompare(a))
    .map(value => ({ label: formatMonthLabel(value), value }))
}

export function buildMonthRangeOptions(minYear: number, maxYear: number, selectedValue?: unknown): MonthOption[] {
  const values: string[] = []
  for (let year = maxYear; year >= minYear; year -= 1) {
    for (let month = 12; month >= 1; month -= 1) {
      values.push(`${year}-${String(month).padStart(2, '0')}`)
    }
  }

  const selectedMonth = normalizeMonthValue(selectedValue)
  if (selectedMonth && !values.includes(selectedMonth)) values.unshift(selectedMonth)

  return buildMonthOptions(values)
}
