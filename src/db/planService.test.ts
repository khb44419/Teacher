import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearAll } from './fakeData'
import { createSemester } from './services'
import { addItem, copyPlan, createPlan, deleteItem, deletePlan, moveItem, updateItem, affectedStudentCount } from './planService'
import type { ItemDraft } from '../lib/plans'

const draft = (name: string, p: Partial<ItemDraft> = {}): ItemDraft => ({
  name, type: '실기', scoring: 'score', maxScore: 20, minScore: 10, weight: 50, rubric: '', enabled: true, ...p,
})
let sem: number, planId: number
beforeEach(async () => {
  await clearAll()
  sem = await createSemester(2026, 1)
  planId = (await createPlan(sem, '중', 1, '음악')).id
})
const addScore = (studentId: number, itemId: number, value: number) =>
  db.scores.add({ studentId, itemId, value, computed: value, status: 'normal', createdAt: 1, updatedAt: 1 })

describe('평가 계획 서비스', () => {
  it('같은 학기·학년·과목 계획은 중복 생성되지 않음', async () => {
    expect((await createPlan(sem, '중', 1, '음악')).existed).toBe(true)
    expect(await db.plans.count()).toBe(1)
  })

  it('항목 추가는 순서대로, 순서 변경 가능', async () => {
    const a = await addItem(planId, draft('가창'))
    const b = await addItem(planId, draft('리코더'))
    await moveItem(b, -1)
    const names = (await db.items.toArray()).sort((x, y) => x.order - y.order).map((i) => i.name)
    expect(names).toEqual(['리코더', '가창'])
    await moveItem(a, 1) // 맨 끝에서 더 내려도 변화 없음
    expect((await db.items.toArray()).sort((x, y) => x.order - y.order).map((i) => i.name)).toEqual(['리코더', '가창'])
  })

  it('만점 변경: 환산 선택 시 점수가 비율대로 바뀜', async () => {
    const id = await addItem(planId, draft('가창'))
    await addScore(1, id, 15)
    await updateItem(id, draft('가창', { maxScore: 100 }), { rescale: true })
    const s = await db.scores.toArray()
    expect(s[0].value).toBe(75)
    expect(s[0].computed).toBe(75)
  })

  it('만점 변경: 유지 선택 시 점수는 그대로', async () => {
    const id = await addItem(planId, draft('가창'))
    await addScore(1, id, 15)
    await updateItem(id, draft('가창', { maxScore: 100 }), { rescale: false })
    expect((await db.scores.toArray())[0].value).toBe(15)
    const logs = await db.changeLogs.toArray()
    expect(logs.some((l) => l.after === '그대로 유지')).toBe(true)
  })

  it('변경 이력에 이전 값 → 새 값이 남음', async () => {
    const id = await addItem(planId, draft('가창'))
    await updateItem(id, draft('가창', { weight: 30 }))
    const l = (await db.changeLogs.toArray()).find((x) => x.detail.includes('반영 비율'))
    expect(l).toMatchObject({ before: '50%', after: '30%' })
  })

  it('영향받는 학생 수는 점수가 입력된 학생 기준', async () => {
    const id = await addItem(planId, draft('가창'))
    await addScore(1, id, 10)
    await addScore(2, id, 12)
    expect(await affectedStudentCount(id)).toBe(2)
  })

  it('항목 삭제 시 점수도 함께 삭제되고 이력에 건수 기록', async () => {
    const id = await addItem(planId, draft('가창'))
    await addScore(1, id, 10)
    await deleteItem(id)
    expect(await db.scores.count()).toBe(0)
    expect((await db.changeLogs.toArray()).some((l) => l.before?.includes('점수 1건'))).toBe(true)
  })

  it('계획 복사: 원본 불변, 점수·기간 미복사, 세특 템플릿 복사', async () => {
    const id = await addItem(planId, { ...draft('가창'), startDate: '2026-03-01', endDate: '2026-03-10' })
    await addScore(1, id, 10)
    await db.seteukTemplates.add({ itemId: id, levelLabel: '상', phrases: ['잘함'] })
    const sem2 = await createSemester(2026, 2)
    const r = await copyPlan(planId, { semesterId: sem2, level: '중', grade: 1, subject: '음악' })
    expect(r.existed).toBe(false)
    const copied = await db.items.where('planId').equals(r.id!).toArray()
    expect(copied).toHaveLength(1)
    expect(copied[0].startDate).toBeUndefined()
    expect(copied[0].id).not.toBe(id)
    expect(await db.scores.count()).toBe(1)
    expect((await db.seteukTemplates.toArray()).map((t) => t.itemId).sort()).toEqual([id, copied[0].id].sort())
    const orig = await db.items.get(id)
    expect(orig?.startDate).toBe('2026-03-01')
    // 같은 곳으로 다시 복사하면 건너뜀
    expect((await copyPlan(planId, { semesterId: sem2, level: '중', grade: 1, subject: '음악' })).existed).toBe(true)
  })

  it('다른 학년으로 복사', async () => {
    await addItem(planId, draft('가창'))
    const r = await copyPlan(planId, { semesterId: sem, level: '중', grade: 2, subject: '음악' })
    expect(r.existed).toBe(false)
    expect(await db.plans.count()).toBe(2)
  })

  it('마감된 학기는 수정 불가', async () => {
    const id = await addItem(planId, draft('가창'))
    await db.semesters.update(sem, { status: 'closed' })
    await expect(addItem(planId, draft('x'))).rejects.toThrow('읽기 전용')
    await expect(updateItem(id, draft('가창', { weight: 1 }))).rejects.toThrow('읽기 전용')
    await expect(deleteItem(id)).rejects.toThrow('읽기 전용')
    await expect(deletePlan(planId)).rejects.toThrow('읽기 전용')
  })
})
