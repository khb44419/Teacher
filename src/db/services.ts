import { db, getKv, setKv } from './db'
import { defaultRules } from './defaults'
import type { RosterRow } from '../lib/roster'
import type { RuleSettings, SchoolLevel, Semester } from './types'

export async function getRules(): Promise<RuleSettings> {
  const row = await db.rules.get('main')
  if (row) return row
  const d = defaultRules()
  await db.rules.put({ ...d, key: 'main' })
  return d
}

export async function createSemester(year: number, term: 1 | 2): Promise<number> {
  const existing = await db.semesters.where('year').equals(year).filter((s) => s.term === term).first()
  const id =
    existing?.id ??
    (await db.semesters.add({ year, term, status: 'active', createdAt: Date.now() } as Semester))
  await setKv('currentSemesterId', id)
  await getRules()
  return id
}

export interface BulkClassSpec {
  semesterId: number
  level: SchoolLevel
  grade: number
  classCount: number
  studentsPerClass: number
  subject: string
}

/** "중 / 1학년 / 1~N반 / 반당 M명" → 학급과 번호 자동 생성. 이미 있는 학급은 건너뜀. */
export async function createClassesBulk(spec: BulkClassSpec): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0
  await db.transaction('rw', db.classes, db.students, async () => {
    for (let c = 1; c <= spec.classCount; c++) {
      const exists = await db.classes
        .where('[semesterId+level+grade+classNo]')
        .equals([spec.semesterId, spec.level, spec.grade, c])
        .first()
      if (exists) {
        skipped++
        continue
      }
      const classId = await db.classes.add({
        semesterId: spec.semesterId,
        level: spec.level,
        grade: spec.grade,
        classNo: c,
        subject: spec.subject,
      })
      await db.students.bulkAdd(
        Array.from({ length: spec.studentsPerClass }, (_, i) => ({
          classId,
          no: i + 1,
          status: '재학' as const,
        })),
      )
      created++
    }
  })
  return { created, skipped }
}

export interface ImportResult {
  updated: number
  added: number
  classesCreated: number
}

/** 명단 반영. (학급, 번호)가 같으면 이름을 갱신, 없으면 추가. 오류 행은 제외. */
export async function importRoster(
  semesterId: number,
  rows: RosterRow[],
  subject: string,
  createMissingClasses: boolean,
): Promise<ImportResult> {
  const res: ImportResult = { updated: 0, added: 0, classesCreated: 0 }
  await db.transaction('rw', db.classes, db.students, async () => {
    for (const r of rows.filter((x) => !x.error)) {
      let cls = await db.classes
        .where('[semesterId+level+grade+classNo]')
        .equals([semesterId, r.level, r.grade, r.classNo])
        .first()
      if (!cls) {
        if (!createMissingClasses) continue
        const id = await db.classes.add({
          semesterId, level: r.level, grade: r.grade, classNo: r.classNo, subject,
        })
        cls = await db.classes.get(id)
        res.classesCreated++
      }
      const st = await db.students.where('[classId+no]').equals([cls!.id!, r.no]).first()
      if (st) {
        if (r.name) await db.students.update(st.id!, { name: r.name })
        res.updated++
      } else {
        await db.students.add({ classId: cls!.id!, no: r.no, name: r.name, status: '재학' })
        res.added++
      }
    }
  })
  return res
}

export async function deleteClass(classId: number) {
  await db.transaction('rw', [db.classes, db.students, db.scores, db.memos, db.seteuks], async () => {
    const ids = await db.students.where('classId').equals(classId).primaryKeys()
    await db.scores.where('studentId').anyOf(ids).delete()
    await db.memos.where('studentId').anyOf(ids).delete()
    await db.seteuks.where('studentId').anyOf(ids).delete()
    await db.students.bulkDelete(ids)
    await db.classes.delete(classId)
  })
}

export async function deleteStudent(studentId: number) {
  await db.transaction('rw', [db.students, db.scores, db.memos, db.seteuks], async () => {
    await db.scores.where('studentId').equals(studentId).delete()
    await db.memos.where('studentId').equals(studentId).delete()
    await db.seteuks.where('studentId').equals(studentId).delete()
    await db.students.delete(studentId)
  })
}

export { getKv, setKv }

/** 지난 학기의 학급·학생(번호/이름)을 새 학기로 복사. 점수·메모는 복사하지 않음. */
export async function copyClasses(fromSemesterId: number, toSemesterId: number): Promise<number> {
  let n = 0
  await db.transaction('rw', db.classes, db.students, async () => {
    const classes = await db.classes.where('semesterId').equals(fromSemesterId).toArray()
    for (const c of classes) {
      const exists = await db.classes
        .where('[semesterId+level+grade+classNo]')
        .equals([toSemesterId, c.level, c.grade, c.classNo])
        .first()
      if (exists) continue
      const classId = await db.classes.add({ ...c, id: undefined, semesterId: toSemesterId })
      const studs = await db.students.where('classId').equals(c.id!).toArray()
      await db.students.bulkAdd(studs.map((s) => ({ ...s, id: undefined, classId })))
      n++
    }
  })
  return n
}

export interface ChangeEntry {
  target: string
  detail: string
  before?: string
  after?: string
}

export async function logChanges(entries: ChangeEntry[]) {
  const at = Date.now()
  await db.changeLogs.bulkAdd(entries.map((e) => ({ ...e, at })))
}

/** 규정 설정 저장 + 변경 이력 기록 (이전 값 → 새 값) */
export async function updateRules(patch: Partial<RuleSettings>, entries: ChangeEntry[]) {
  await getRules()
  await db.transaction('rw', db.rules, db.changeLogs, async () => {
    await db.rules.update('main', { ...patch, updatedAt: Date.now() })
    if (entries.length) await logChanges(entries)
  })
}
