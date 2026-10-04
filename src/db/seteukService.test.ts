import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearAll } from './fakeData'
import { createClassesBulk, createSemester } from './services'
import { addItem, copyPlan, createPlan } from './planService'
import { enterScore } from './scoreService'
import { generateDrafts, saveSeteuk } from './seteukService'

let classId: number, itemId: number, planId: number, sem: number
beforeEach(async () => {
  await clearAll()
  sem = await createSemester(2026, 2)
  await createClassesBulk({ semesterId: sem, level: '중', grade: 1, classCount: 1, studentsPerClass: 3, subject: '음악' })
  classId = (await db.classes.toArray())[0].id!
  planId = (await createPlan(sem, '중', 1, '음악')).id
  itemId = await addItem(planId, { name: '가창', type: '실기', scoring: 'score', maxScore: 10, minScore: 5, weight: 100, rubric: '', enabled: true })
  await db.seteukTemplates.add({ itemId, levelLabel: '상', phrases: ['{항목} 실력이 뛰어남', '{항목}에서 음색이 고움'] })
})

describe('세특 초안 생성', () => {
  it('점수에 맞는 문구, 이미 쓴 학생은 건너뜀, 덮어쓰기 선택 가능', async () => {
    const st = await db.students.where('classId').equals(classId).sortBy('no')
    for (const s of st) await enterScore(s.id!, itemId, { value: 10 })
    await saveSeteuk(st[2].id!, '직접 쓴 내용')
    expect(await generateDrafts(classId, { overwrite: false })).toEqual({ written: 2, skipped: 1 })
    const texts = (await db.seteuks.toArray()).map((s) => s.text)
    expect(texts).toContain('직접 쓴 내용')
    expect(new Set(texts.filter((t) => t.startsWith('가창'))).size).toBe(2) // 두 학생 문구가 서로 다름
    await generateDrafts(classId, { overwrite: true, studentIds: [st[2].id!] })
    expect((await db.seteuks.where('studentId').equals(st[2].id!).first())?.text).toMatch(/^가창/)
  })

  it('학생당 세특 한 건', async () => {
    const [s] = await db.students.toArray()
    await saveSeteuk(s.id!, 'a')
    await saveSeteuk(s.id!, 'b')
    expect(await db.seteuks.count()).toBe(1)
  })

  it('계획을 복사하면 항목에 연결된 템플릿도 따라감', async () => {
    const sem2 = await createSemester(2027, 1)
    const r = await copyPlan(planId, { semesterId: sem2, level: '중', grade: 1, subject: '음악' })
    const newItem = (await db.items.where('planId').equals(r.id!).toArray())[0]
    expect(await db.seteukTemplates.where('itemId').equals(newItem.id!).count()).toBe(1)
  })
})
