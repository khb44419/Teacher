import { useSyncExternalStore } from 'react'
import type { UndoEntry } from '../db/scoreService'

/**
 * 되돌리기 기록: 다른 화면에 갔다 와도 남아 있도록 앱 전체에서 공유 (앱을 닫으면 사라짐).
 * 항목별로 최근 50개까지.
 */
let entries: UndoEntry[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const undoStore = {
  push(u: UndoEntry) {
    entries = [...entries, u]
    const sameItem = entries.filter((e) => e.itemId === u.itemId)
    if (sameItem.length > 50) entries = entries.filter((e) => e !== sameItem[0])
    emit()
  },
  /** 이 항목·이 학생들에 대한 가장 최근 기록 */
  last(itemId: number, studentIds: Set<number>) {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].itemId === itemId && studentIds.has(entries[i].studentId)) return entries[i]
    return undefined
  },
  remove(u: UndoEntry) {
    entries = entries.filter((e) => e !== u)
    emit()
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  snapshot: () => entries,
  clear() { entries = []; emit() },
}

export const useUndoEntries = () => useSyncExternalStore(undoStore.subscribe, undoStore.snapshot)
