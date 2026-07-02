import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  formatCost,
  formatTokens,
  formatUptime,
  formatRelativeTime,
  getPriorityColor,
  safeJsonParse,
} from '../utils'

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'flex')).toBe('base flex')
  })

  it('returns empty string for no input', () => {
    expect(cn()).toBe('')
  })
})

describe('formatCost()', () => {
  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats whole dollars', () => {
    expect(formatCost(5)).toBe('$5.00')
  })

  it('formats cents', () => {
    expect(formatCost(1.5)).toBe('$1.50')
  })

  it('rounds to two decimal places', () => {
    expect(formatCost(3.456)).toBe('$3.46')
  })
})

describe('formatTokens()', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokens(500)).toBe('500')
  })

  it('formats thousands as K', () => {
    expect(formatTokens(1500)).toBe('1.5K')
  })

  it('formats millions as M', () => {
    expect(formatTokens(2_500_000)).toBe('2.5M')
  })

  it('formats exactly 1000 as K', () => {
    expect(formatTokens(1000)).toBe('1.0K')
  })

  it('formats exactly 1_000_000 as M', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M')
  })
})

describe('formatUptime()', () => {
  it('formats minutes only', () => {
    expect(formatUptime(300)).toBe('5m')
  })

  it('formats hours and minutes', () => {
    expect(formatUptime(3660)).toBe('1h 1m')
  })

  it('formats days, hours, and minutes', () => {
    expect(formatUptime(90060)).toBe('1d 1h 1m')
  })

  it('formats zero seconds as 0m', () => {
    expect(formatUptime(0)).toBe('0m')
  })
})

describe('formatRelativeTime()', () => {
  it('returns "just now" for very recent timestamps', () => {
    vi.useFakeTimers()
    const now = new Date('2026-01-15T12:00:00Z')
    vi.setSystemTime(now)
    const recent = new Date(now.getTime() - 10_000) // 10 seconds ago
    expect(formatRelativeTime(recent.toISOString())).toBe('just now')
    vi.useRealTimers()
  })

  it('returns minutes ago for older timestamps', () => {
    vi.useFakeTimers()
    const now = new Date('2026-01-15T12:00:00Z')
    vi.setSystemTime(now)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000)
    expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe('5m ago')
    vi.useRealTimers()
  })

  it('returns "unknown" for invalid dates', () => {
    expect(formatRelativeTime('not-a-date')).toBe('unknown')
  })

  it('returns "just now" for future dates', () => {
    vi.useFakeTimers()
    const now = new Date('2026-01-15T12:00:00Z')
    vi.setSystemTime(now)
    const future = new Date(now.getTime() + 60_000)
    expect(formatRelativeTime(future.toISOString())).toBe('just now')
    vi.useRealTimers()
  })
})

describe('getPriorityColor()', () => {
  it('returns red classes for critical', () => {
    expect(getPriorityColor('critical')).toContain('red')
  })

  it('returns orange classes for high', () => {
    expect(getPriorityColor('high')).toContain('orange')
  })

  it('returns yellow classes for medium', () => {
    expect(getPriorityColor('medium')).toContain('yellow')
  })

  it('returns blue classes for low', () => {
    expect(getPriorityColor('low')).toContain('blue')
  })

  it('returns gray classes for unknown priority', () => {
    expect(getPriorityColor('anything')).toContain('gray')
  })
})

describe('safeJsonParse()', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('parses valid JSON arrays', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
  })

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', { fallback: true })).toEqual({ fallback: true })
  })

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', null)).toBeNull()
  })
})
