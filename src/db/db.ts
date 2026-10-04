import Dexie, { type Table } from 'dexie'
import type {
  AssessmentItem, AssessmentPlan, ChangeLog, KV, LibraryItem, Memo, RuleSettings,
  SchoolClass, Score, Semester, Seteuk, SeteukTemplate, Student,
} from './types'

export class AppDB extends Dexie {
  semesters!: Table<Semester, number>
  classes!: Table<SchoolClass, number>
  students!: Table<Student, number>
  plans!: Table<AssessmentPlan, number>
  items!: Table<AssessmentItem, number>
  scores!: Table<Score, number>
  memos!: Table<Memo, number>
  rules!: Table<RuleSettings & { key: string }, string>
  changeLogs!: Table<ChangeLog, number>
  itemLibrary!: Table<LibraryItem, number>
  seteukTemplates!: Table<SeteukTemplate, number>
  seteuks!: Table<Seteuk, number>
  kv!: Table<KV, string>

  constructor(name = 'music-teacher-app') {
    super(name)
    this.version(1).stores({
      semesters: '++id, year, status',
      classes: '++id, semesterId, [semesterId+level+grade+classNo]',
      students: '++id, classId, [classId+no]',
      plans: '++id, semesterId',
      items: '++id, planId',
      scores: '++id, studentId, itemId, &[studentId+itemId]',
      memos: '++id, studentId, createdAt',
      rules: 'key',
      changeLogs: '++id, at',
      itemLibrary: '++id',
      seteukTemplates: '++id, itemId',
      seteuks: '++id, &studentId',
      kv: 'key',
    })
  }
}

export const db = new AppDB()

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row ? (row.value as T) : fallback
}
export const setKv = (key: string, value: unknown) => db.kv.put({ key, value })
