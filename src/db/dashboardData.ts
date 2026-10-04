import { db } from './db'
import { computeStudent } from '../lib/grading'
import { limitStatus } from '../lib/bytes'
import { planLabel } from '../lib/plans'
import { classLabel, classSort } from '../lib/classLabel'
import type { AssessmentItem, AssessmentPlan, SchoolClass, Score } from './types'

export type CellState = '완료' | '진행중' | '미시작'
export const cellState = (done: number, started: number, total: number): CellState =>
  total > 0 && done >= total ? '완료' : started > 0 ? '진행중' : '미시작'

export interface DashCell { classId: number; itemId: number; done: number; total: number; reassess: number; state: CellState }
export interface DashPlan { plan: AssessmentPlan; label: string; items: AssessmentItem[]; classes: SchoolClass[]; cells: Map<string, DashCell> }

export interface Dashboard {
  plans: DashPlan[]
  reassessWaiting: number // 재평가 대기 (학생-항목 건수)
  absenceWaiting: number // 결시 처리 대기 (인정점 기준이 아직 없는 등)
  overdue: { item: AssessmentItem; plan: string; classes: string[] }[]
  seteuk: { total: number; written: number; over: number }
  studentCount: number
  classesWithoutPlan: number
}

/** 대시보드 집계 (학기 전체를 한 번에 읽어서 계산) */
export async function loadDashboard(semesterId: number, today = new Date().toISOString().slice(0, 10)): Promise<Dashboard> {
  const rules = await db.rules.get('main')
  const classes = (await db.classes.where('semesterId').equals(semesterId).toArray()).sort(classSort)
  const plans = await db.plans.where('semesterId').equals(semesterId).toArray()
  const allItems = plans.length ? await db.items.where('planId').anyOf(plans.map((p) => p.id!)).toArray() : []
  const students = (await db.students.where('classId').anyOf(classes.map((c) => c.id!)).toArray()).filter((s) => s.status !== '전출')
  const scores = allItems.length ? await db.scores.where('itemId').anyOf(allItems.map((i) => i.id!)).toArray() : []
  const seteuks = students.length ? await db.seteuks.where('studentId').anyOf(students.map((s) => s.id!)).toArray() : []

  const studentsByClass = new Map<number, number[]>()
  students.forEach((s) => studentsByClass.set(s.classId, [...(studentsByClass.get(s.classId) ?? []), s.id!]))
  const scoreByKey = new Map<string, Score>()
  const scoresByStudent = new Map<number, Map<number, Score>>()
  for (const s of scores) {
    scoreByKey.set(`${s.studentId}:${s.itemId}`, s)
    if (!scoresByStudent.has(s.studentId)) scoresByStudent.set(s.studentId, new Map())
    scoresByStudent.get(s.studentId)!.set(s.itemId, s)
  }

  let reassessWaiting = 0, absenceWaiting = 0
  const overdue: Dashboard['overdue'] = []
  const usedClassIds = new Set<number>()
  const dashPlans: DashPlan[] = plans
    .sort((a, b) => (a.level === b.level ? 0 : a.level === '중' ? -1 : 1) || a.grade - b.grade)
    .map((plan) => {
      const items = allItems.filter((i) => i.planId === plan.id && i.enabled).sort((a, b) => a.order - b.order)
      const pcs = classes.filter((c) => c.level === plan.level && c.grade === plan.grade && c.subject === plan.subject)
      pcs.forEach((c) => usedClassIds.add(c.id!))
      const cells = new Map<string, DashCell>()
      for (const c of pcs) {
        const ids = studentsByClass.get(c.id!) ?? []
        for (const it of items) {
          let done = 0, started = 0, reassess = 0
          for (const sid of ids) {
            const s = scoreByKey.get(`${sid}:${it.id}`)
            if (!s) continue
            started++
            if (s.status === 'reassess') reassess++
            else done++
          }
          reassessWaiting += reassess
          cells.set(`${c.id}:${it.id}`, { classId: c.id!, itemId: it.id!, done, total: ids.length, reassess, state: cellState(done, started, ids.length) })
        }
        if (rules) {
          for (const sid of ids) {
            const r = computeStudent(items, scoresByStudent.get(sid) ?? new Map(), rules)
            for (const it of items) {
              const x = r.items[it.id!]
              if (x?.kind === 'pending' && scoreByKey.get(`${sid}:${it.id}`)?.status !== 'reassess') absenceWaiting++
            }
          }
        }
      }
      for (const it of items) {
        if (it.endDate && it.endDate < today) {
          const late = pcs.filter((c) => cells.get(`${c.id}:${it.id}`)?.state !== '완료').map(classLabel)
          if (late.length) overdue.push({ item: it, plan: planLabel(plan), classes: late })
        }
      }
      return { plan, label: planLabel(plan), items, classes: pcs, cells }
    })

  const over = rules ? seteuks.filter((s) => limitStatus(s.text, rules).over).length : 0
  return {
    plans: dashPlans,
    reassessWaiting,
    absenceWaiting,
    overdue,
    seteuk: { total: students.length, written: seteuks.filter((s) => s.text.trim()).length, over },
    studentCount: students.length,
    classesWithoutPlan: classes.filter((c) => !usedClassIds.has(c.id!)).length,
  }
}
