import { db } from './db'
import type { AbsenceReason, Score } from './types'

async function assertEditableItem(itemId: number) {
  const item = await db.items.get(itemId)
  const plan = item && (await db.plans.get(item.planId))
  const sem = plan && (await db.semesters.get(plan.semesterId))
  if (sem?.status === 'closed') throw new Error('마감된 학기는 점수를 수정할 수 없습니다 (읽기 전용)')
}

export const getScore = (studentId: number, itemId: number) =>
  db.scores.where('[studentId+itemId]').equals([studentId, itemId]).first()

/** 되돌리기(Undo)용: 바꾸기 전 상태 */
export interface UndoEntry {
  studentId: number
  itemId: number
  prev?: Score
}

async function put(studentId: number, itemId: number, patch: Partial<Score>): Promise<UndoEntry> {
  await assertEditableItem(itemId)
  const prev = await getScore(studentId, itemId)
  const now = Date.now()
  if (prev) {
    const next: Score = { ...prev, ...patch, updatedAt: now }
    // undefined로 지정한 필드는 지움
    for (const k of Object.keys(patch) as (keyof Score)[]) if (patch[k] === undefined) delete next[k]
    await db.scores.put(next)
  } else {
    await db.scores.add({ studentId, itemId, status: 'normal', createdAt: now, updatedAt: now, ...patch } as Score)
  }
  return { studentId, itemId, prev }
}

/** 점수(점수형) 또는 수준(수준형) 입력. 재평가 대기였다면 '재평가 점수'로 기록. */
export async function enterScore(studentId: number, itemId: number, v: { value?: number; levelLabel?: string }) {
  const prev = await getScore(studentId, itemId)
  const wasReassess = prev?.status === 'reassess' || (prev?.reassessed ?? false)
  return put(studentId, itemId, {
    status: 'normal',
    value: v.value,
    levelLabel: v.levelLabel,
    reassessed: wasReassess || undefined,
    useFallback: undefined,
    reasonId: wasReassess ? prev?.reasonId : undefined,
  })
}

/** 결시 사유 선택 → 규정에 따라 상태 결정 (재평가 우선 사유는 '재평가 예정') */
export function enterAbsence(studentId: number, itemId: number, reason: AbsenceReason, note?: string) {
  return put(studentId, itemId, {
    status: reason.method === 'reassess' ? 'reassess' : reason.category,
    reasonId: reason.id,
    reasonNote: note || undefined,
    value: undefined,
    levelLabel: undefined,
    reassessed: undefined,
    useFallback: undefined,
  })
}

/** 사유 없이 '재평가 예정'으로 표시 */
export function markReassess(studentId: number, itemId: number) {
  return put(studentId, itemId, {
    status: 'reassess', value: undefined, levelLabel: undefined, reassessed: undefined, useFallback: undefined,
  })
}

/** 재평가 불가 → 규정의 대체 처리(인정점 등) 적용. 사유가 있어야 함. */
export function reassessImpossible(studentId: number, itemId: number, reason: AbsenceReason) {
  return put(studentId, itemId, {
    status: reason.category, reasonId: reason.id, useFallback: true, value: undefined, levelLabel: undefined, reassessed: undefined,
  })
}

export async function clearScore(studentId: number, itemId: number): Promise<UndoEntry> {
  await assertEditableItem(itemId)
  const prev = await getScore(studentId, itemId)
  if (prev) await db.scores.delete(prev.id!)
  return { studentId, itemId, prev }
}

/** 되돌리기: 바꾸기 전 상태로 복원 */
export async function undo(u: UndoEntry) {
  await assertEditableItem(u.itemId)
  const cur = await getScore(u.studentId, u.itemId)
  if (cur) await db.scores.delete(cur.id!)
  if (u.prev) await db.scores.put(u.prev)
}
