import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearAll } from './fakeData'
import { createClassesBulk, createSemester } from './services'
import { addItem, createPlan } from './planService'
import { enterAbsence, enterScore } from './scoreService'
import { cellState, loadDashboard } from './dashboardData'
import { defaultAbsenceReasons } from './defaults'

describe('진행 상태', () => {
  it('완료/진행중/미시작', () => {
    expect(cellState(25, 25, 25)).toBe('완료')
    expect(cellState(3, 4, 25)).toBe('진행중')
    expect(cellState(0, 1, 25)).toBe('진행중') // 재평가 대기만 있어도 진행중
    expect(cellState(0, 0, 25)).toBe('미시작')
    expect(cellState(0, 0, 0)).toBe('미시작')
  })
})

describe('대시보드 집계', () => {
  let sem: number, item1: number, item2: number
  beforeEach(async () => {
    await clearAll()
    sem = await createSemester(2026, 2)
    await createClassesBulk({ semesterId: sem, level: '중', grade: 1, classCount: 2, studentsPerClass: 2, subject: '음악' })
    await createClassesBulk({ semesterId: sem, level: '고', grade: 2, classCount: 1, studentsPerClass: 2, subject: '음악' })
    const plan = (await createPlan(sem, '중', 1, '음악')).id
    const d = { type: '실기', scoring: 'score' as const, maxScore: 10, minScore: 5, weight: 50, rubric: '', enabled: true }
    item1 = await addItem(plan, { ...d, name: 'A', endDate: '2026-09-01' })
    item2 = await addItem(plan, { ...d, name: 'B', endDate: '2026-12-31' })
  })

  it('학급×항목 상태, 재평가·결시 대기, 기한 지난 항목, 계획 없는 학급', async () => {
    const [c1] = await db.classes.where('semesterId').equals(sem).filter((c) => c.level === '중').sortBy('classNo')
    const [s1, s2] = await db.students.where('classId').equals(c1.id!).sortBy('no')
    const reasons = defaultAbsenceReasons()
    await enterScore(s1.id!, item1, { value: 9 })
    await enterScore(s2.id!, item1, { value: 8 })
    await enterAbsence(s1.id!, item2, reasons[0]) // 질병 → 재평가 대기
    await db.scores.add({ studentId: s2.id!, itemId: item2, status: 'approved', reasonId: 'illness', useFallback: true, createdAt: 0, updatedAt: 0 })
    const d = await loadDashboard(sem, '2026-10-04')
    const p = d.plans[0]
    expect(p.classes).toHaveLength(2)
    expect(p.cells.get(`${c1.id}:${item1}`)?.state).toBe('완료')
    expect(p.cells.get(`${c1.id}:${item2}`)?.state).toBe('진행중')
    expect(d.reassessWaiting).toBe(1)
    expect(d.absenceWaiting).toBe(0) // s2의 인정점 기준(A 항목 점수)이 있음
    expect(d.overdue).toHaveLength(1)
    expect(d.overdue[0].classes).toEqual(['중1-2'])
    expect(d.classesWithoutPlan).toBe(1)
    expect(d.studentCount).toBe(6)
  })

  it('세특 작성·바이트 초과', async () => {
    const st = await db.students.toArray()
    await db.seteuks.add({ studentId: st[0].id!, text: '가'.repeat(501), updatedAt: 0 })
    await db.seteuks.add({ studentId: st[1].id!, text: '좋음', updatedAt: 0 })
    const d = await loadDashboard(sem)
    expect(d.seteuk).toEqual({ total: 6, written: 2, over: 1 })
  })
})
