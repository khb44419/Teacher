import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearAll } from './fakeData'
import { copyClasses, createClassesBulk, createSemester, deleteClass, importRoster } from './services'
import { parseRoster, parseTable } from '../lib/roster'

beforeEach(async () => {
  await clearAll()
})

describe('학급·학생 서비스', () => {
  it('일괄 생성: 반 수 × 반당 학생 수, 재실행 시 중복 생성 안 함', async () => {
    const semesterId = await createSemester(2026, 1)
    const spec = { semesterId, level: '중' as const, grade: 1, classCount: 3, studentsPerClass: 25, subject: '음악' }
    expect(await createClassesBulk(spec)).toEqual({ created: 3, skipped: 0 })
    expect(await db.students.count()).toBe(75)
    expect(await createClassesBulk(spec)).toEqual({ created: 0, skipped: 3 })
    expect(await db.students.count()).toBe(75)
  })

  it('명단 가져오기: 이름 갱신, 없는 학급 자동 생성, 오류 행 제외', async () => {
    const semesterId = await createSemester(2026, 1)
    await createClassesBulk({ semesterId, level: '중', grade: 1, classCount: 1, studentsPerClass: 2, subject: '음악' })
    const rows = parseRoster(parseTable('1,1,1,가\n1,1,3,나\n1,2,1,다\n1,1,x,라'), '중')
    const r = await importRoster(semesterId, rows, '음악', true)
    expect(r).toEqual({ updated: 1, added: 2, classesCreated: 1 })
    expect(await db.classes.count()).toBe(2)
    const noCreate = await importRoster(semesterId, parseRoster(parseTable('3,9,1,마'), '중'), '음악', false)
    expect(noCreate.added).toBe(0)
  })

  it('학급 삭제 시 학생도 함께 삭제, 학기 복사는 점수 제외', async () => {
    const s1 = await createSemester(2026, 1)
    await createClassesBulk({ semesterId: s1, level: '고', grade: 2, classCount: 1, studentsPerClass: 3, subject: '음악' })
    const s2 = await createSemester(2026, 2)
    expect(await copyClasses(s1, s2)).toBe(1)
    expect(await db.students.count()).toBe(6)
    const c = await db.classes.where('semesterId').equals(s1).first()
    await deleteClass(c!.id!)
    expect(await db.students.count()).toBe(3)
  })
})
