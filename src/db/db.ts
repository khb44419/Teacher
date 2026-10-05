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
    // 데이터가 바뀐 시각 기록 (기기 옮길 때 어느 쪽이 최신인지 알려 주기 위함). 화면 설정(kv)은 제외.
    for (const t of this.tables) {
      if (t.name === 'kv') continue
      const mark = () => markModified(this.name)
      t.hook('creating', mark)
      t.hook('updating', mark)
      t.hook('deleting', mark)
    }
  }
}

const modKey = (dbName: string) => `dataModifiedAt:${dbName}`
let suppressMark = false
function markModified(dbName: string) {
  if (suppressMark) return
  try { localStorage.setItem(modKey(dbName), String(Date.now())) } catch { /* 저장 불가 환경: 무시 */ }
}
/** 이 기기 데이터가 마지막으로 바뀐 시각 (모르면 null) */
export function getDataModifiedAt(dbName: string): number | null {
  try { const v = localStorage.getItem(modKey(dbName)); return v ? Number(v) : null } catch { return null }
}
export function setDataModifiedAt(dbName: string, t: number | null) {
  try { if (t) localStorage.setItem(modKey(dbName), String(t)); else localStorage.removeItem(modKey(dbName)) } catch { /* 무시 */ }
}
/** 복원처럼 '변경'으로 치지 않을 작업을 할 때 */
export async function withoutModifiedMark<T>(f: () => Promise<T>): Promise<T> {
  suppressMark = true
  try { return await f() } finally { suppressMark = false }
}

export const MAIN_DB = 'music-teacher-app'
export const PRACTICE_DB = 'music-teacher-app-practice'

/** 연습 모드: 실제 데이터와 완전히 분리된 저장 공간을 씀 (이 기기에서만 기억) */
export function isPracticeMode() {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('practiceMode') === '1' } catch { return false }
}

export const db = new AppDB(isPracticeMode() ? PRACTICE_DB : MAIN_DB)

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row ? (row.value as T) : fallback
}
export const setKv = (key: string, value: unknown) => db.kv.put({ key, value })
