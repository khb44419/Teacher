import { describe, expect, it } from 'vitest'
import { undoStore } from './undoStore'

describe('되돌리기 기록', () => {
  it('항목·학생별로 가장 최근 기록, 꺼내면 그다음', () => {
    undoStore.clear()
    const a = { studentId: 1, itemId: 10 }, b = { studentId: 2, itemId: 10 }, c = { studentId: 3, itemId: 20 }
    undoStore.push(a); undoStore.push(b); undoStore.push(c)
    const cls = new Set([1, 2])
    expect(undoStore.last(10, cls)).toBe(b)
    undoStore.remove(b)
    expect(undoStore.last(10, cls)).toBe(a)
    expect(undoStore.last(20, cls)).toBeUndefined() // 다른 반 학생
  })
  it('항목당 50개까지만', () => {
    undoStore.clear()
    for (let i = 0; i < 60; i++) undoStore.push({ studentId: i, itemId: 1 })
    expect(undoStore.snapshot()).toHaveLength(50)
    expect(undoStore.snapshot()[0].studentId).toBe(10)
  })
})
