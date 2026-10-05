import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/db'
import { backupSummary, checkPin, decryptBackup, encryptBackup, exportAll, hashPin, parseBackup, restoreAll } from './backup'

const db = new AppDB('backup-test')
beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear() })
  await db.semesters.add({ year: 2026, term: 1, status: 'active', createdAt: 1 })
  await db.students.bulkAdd([{ classId: 1, no: 1, name: '가', status: '재학' }, { classId: 1, no: 2, status: '재학' }])
  await db.scores.add({ studentId: 1, itemId: 1, value: 10, status: 'normal', createdAt: 1, updatedAt: 1 })
  await db.kv.bulkPut([{ key: 'currentSemesterId', value: 1 }, { key: 'pinHash', value: 'secret' }, { key: 'privacyAck', value: true }])
})

describe('백업과 복원', () => {
  it('전체 백업 → 데이터 변경 → 복원하면 원래대로 (ID 유지)', async () => {
    const b = await exportAll(db)
    expect(backupSummary(b)).toMatchObject({ semesters: 1, students: 2, scores: 1 })
    expect((b.tables.kv as { key: string }[]).map((r) => r.key)).toEqual(['currentSemesterId']) // 기기 전용 설정 제외
    await db.students.clear()
    await db.scores.add({ studentId: 9, itemId: 9, value: 1, status: 'normal', createdAt: 1, updatedAt: 1 })
    await restoreAll(db, parseBackup(JSON.stringify(b), db) as typeof b)
    expect(await db.students.count()).toBe(2)
    expect(await db.scores.count()).toBe(1)
    expect((await db.students.get(1))?.name).toBe('가')
    expect((await db.kv.get('pinHash'))?.value).toBe('secret') // 이 기기의 잠금 설정은 유지
  })

  it('잘못된 파일은 거절', () => {
    expect(() => parseBackup('not json', db)).toThrow('JSON')
    expect(() => parseBackup('{"app":"other"}', db)).toThrow('이 앱의 백업 파일이 아닙니다')
    expect(() => parseBackup('{"app":"music-teacher-app","format":99,"tables":{}}', db)).toThrow('새로운 버전')
    expect(() => parseBackup('{"app":"music-teacher-app","format":1,"tables":{"hack":[]}}', db)).toThrow('알 수 없는')
    expect(() => parseBackup('{"app":"music-teacher-app","format":1,"tables":{"students":{}}}', db)).toThrow('손상')
  })

  it('비밀번호 암호화: 맞는 비밀번호로만 열림, 파일에 이름이 보이지 않음', async () => {
    const b = await exportAll(db)
    const e = await encryptBackup(b, '1234abcd')
    expect(JSON.stringify(e)).not.toContain('"가"')
    const back = await decryptBackup(parseBackup(JSON.stringify(e), db) as typeof e, '1234abcd', db)
    expect(backupSummary(back).students).toBe(2)
    await expect(decryptBackup(e, 'wrong', db)).rejects.toThrow('비밀번호')
  })

  it('PIN 확인', async () => {
    const h = await hashPin('2580')
    expect(await checkPin('2580', h)).toBe(true)
    expect(await checkPin('0000', h)).toBe(false)
  })
})

import { isOlderThanDevice } from './backup'
describe('어느 기기가 최신인지', () => {
  const b = { app: 'music-teacher-app' as const, format: 1, exportedAt: 5000, dataModifiedAt: 3000, tables: {} }
  it('기기 데이터가 백업보다 나중에 바뀌었으면 경고', () => {
    expect(isOlderThanDevice(b, 10000)).toBe(true)
    expect(isOlderThanDevice(b, 3500)).toBe(false) // 1초 이내 차이는 같은 것으로
    expect(isOlderThanDevice(b, null)).toBe(false)
  })
})
