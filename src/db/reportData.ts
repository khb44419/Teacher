import { db } from './db'
import type { ImportClass } from '../lib/report'
import type { AssessmentItem, AssessmentPlan, SchoolClass } from './types'

export async function planForClass(cls: SchoolClass): Promise<AssessmentPlan | undefined> {
  return db.plans.where('semesterId').equals(cls.semesterId)
    .filter((p) => p.level === cls.level && p.grade === cls.grade && p.subject === cls.subject).first()
}

export async function itemsForPlan(planId: number): Promise<AssessmentItem[]> {
  return (await db.items.where('planId').equals(planId).toArray()).sort((a, b) => a.order - b.order)
}

/** 학급 한 개의 성적 계산 재료 */
export async function loadClassData(classId: number) {
  const cls = await db.classes.get(classId)
  if (!cls) return undefined
  const plan = await planForClass(cls)
  const items = plan ? await itemsForPlan(plan.id!) : []
  const students = await db.students.where('classId').equals(classId).toArray()
  const ids = new Set(students.map((s) => s.id!))
  const scores = items.length
    ? (await db.scores.where('itemId').anyOf(items.map((i) => i.id!)).toArray()).filter((s) => ids.has(s.studentId))
    : []
  return { cls, plan, items, students, scores }
}

export async function loadImportClasses(semesterId: number): Promise<ImportClass[]> {
  const classes = await db.classes.where('semesterId').equals(semesterId).toArray()
  return Promise.all(classes.map(async (c) => {
    const plan = await planForClass(c)
    return {
      id: c.id!, level: c.level, grade: c.grade, classNo: c.classNo,
      items: plan ? await itemsForPlan(plan.id!) : [],
      students: await db.students.where('classId').equals(c.id!).toArray(),
    }
  }))
}
