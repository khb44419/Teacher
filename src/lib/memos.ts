import type { Memo } from '../db/types'

export interface MemoFilter {
  tags: string[] // 하나라도 포함하면 표시 (비우면 전체)
  from?: string // YYYY-MM-DD (포함)
  to?: string // YYYY-MM-DD (포함)
}

const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 태그·기간 필터, 최신순 */
export function filterMemos(memos: Memo[], f: MemoFilter): Memo[] {
  return memos
    .filter((m) => !f.tags.length || m.tags.some((t) => f.tags.includes(t)))
    .filter((m) => !f.from || dayKey(m.createdAt) >= f.from)
    .filter((m) => !f.to || dayKey(m.createdAt) <= f.to)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export const memoDate = (t: number) => dayKey(t)
