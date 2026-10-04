import { describe, expect, it } from 'vitest'
import { filterMemos } from './memos'

const at = (s: string) => new Date(`${s}T10:00:00`).getTime()
const memos = [
  { id: 1, studentId: 1, content: 'a', tags: ['참여'], createdAt: at('2026-09-01') },
  { id: 2, studentId: 1, content: 'b', tags: ['협력', '태도'], createdAt: at('2026-09-15') },
  { id: 3, studentId: 2, content: 'c', tags: [], createdAt: at('2026-10-01') },
]

describe('메모 필터', () => {
  it('필터 없으면 전체, 최신순', () => expect(filterMemos(memos, { tags: [] }).map((m) => m.id)).toEqual([3, 2, 1]))
  it('태그: 하나라도 포함', () => expect(filterMemos(memos, { tags: ['태도', '참여'] }).map((m) => m.id)).toEqual([2, 1]))
  it('기간: 시작·끝 날짜 포함', () => {
    expect(filterMemos(memos, { tags: [], from: '2026-09-15', to: '2026-10-01' }).map((m) => m.id)).toEqual([3, 2])
    expect(filterMemos(memos, { tags: [], to: '2026-09-01' }).map((m) => m.id)).toEqual([1])
  })
})
