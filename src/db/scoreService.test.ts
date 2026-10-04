import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearAll } from './fakeData'
import { createSemester } from './services'
import { addItem, createPlan } from './planService'
import { clearScore, enterAbsence, enterScore, getScore, markReassess, reassessImpossible, undo } from './scoreService'
import { defaultAbsenceReasons } from './defaults'

const reasons = defaultAbsenceReasons()
const illness = reasons.find((r) => r.id === 'illness')!
const unapproved = reasons.find((r) => r.id === 'unapproved')!
let itemId: number, sem: number

beforeEach(async () => {
  await clearAll()
  sem = await createSemester(2026, 1)
  const planId = (await createPlan(sem, '중', 1, '음악')).id
  itemId = await addItem(planId, { name: '가창', type: '실기', scoring: 'score', maxScore: 20, minScore: 10, weight: 100, rubric: '', enabled: true })
})

describe('점수 입력', () => {
  it('입력·수정·지우기, 학생-항목당 한 건', async () => {
    await enterScore(1, itemId, { value: 15 })
    await enterScore(1, itemId, { value: 17 })
    expect(await db.scores.count()).toBe(1)
    expect((await getScore(1, itemId))?.value).toBe(17)
    await clearScore(1, itemId)
    expect(await db.scores.count()).toBe(0)
  })

  it('되돌리기: 새 입력은 삭제, 수정은 이전 값으로', async () => {
    const u1 = await enterScore(1, itemId, { value: 15 })
    const u2 = await enterScore(1, itemId, { value: 18 })
    await undo(u2)
    expect((await getScore(1, itemId))?.value).toBe(15)
    await undo(u1)
    expect(await getScore(1, itemId)).toBeUndefined()
  })

  it('미인정결시 → 상태 unapproved, 점수 지움', async () => {
    await enterScore(1, itemId, { value: 15 })
    await enterAbsence(1, itemId, unapproved)
    const s = await getScore(1, itemId)
    expect(s).toMatchObject({ status: 'unapproved', reasonId: 'unapproved' })
    expect(s?.value).toBeUndefined()
  })

  it('질병(재평가 우선) → 재평가 예정 → 재평가 점수 입력 시 재평가 표시', async () => {
    await enterAbsence(1, itemId, illness)
    expect((await getScore(1, itemId))?.status).toBe('reassess')
    await enterScore(1, itemId, { value: 16 })
    expect(await getScore(1, itemId)).toMatchObject({ status: 'normal', value: 16, reassessed: true, reasonId: 'illness' })
  })

  it('재평가 불가 → 대체 처리', async () => {
    await enterAbsence(1, itemId, illness)
    await reassessImpossible(1, itemId, illness)
    expect(await getScore(1, itemId)).toMatchObject({ status: 'approved', useFallback: true })
  })

  it('사유 없이 재평가 예정 표시', async () => {
    await markReassess(2, itemId)
    expect((await getScore(2, itemId))?.status).toBe('reassess')
  })

  it('마감된 학기는 입력 불가', async () => {
    await db.semesters.update(sem, { status: 'closed' })
    await expect(enterScore(1, itemId, { value: 1 })).rejects.toThrow('읽기 전용')
  })
})
