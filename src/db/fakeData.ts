import { db, setKv } from './db'
import { getRules } from './services'

/**
 * 개발·시연용 가짜 데이터: 중·고 각 3개 학년, 반당 25명, 이름은 "학생01".
 * 2개 학기(앞 학기는 마감, 뒤 학기는 진행중). 평가 계획은 3단계에서 추가됩니다.
 * 주의: 기존 데이터를 모두 지우고 새로 만듭니다.
 */
export const SHOW_DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_TOOLS === '1'

export async function generateFakeData(classesPerGrade = 7) {
  await clearAll()
  await getRules()
  const now = new Date()
  const year = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()
  const sems = [
    { year, term: 1 as const, status: 'closed' as const },
    { year, term: 2 as const, status: 'active' as const },
  ]
  let activeId = 0
  for (const s of sems) {
    const semesterId = await db.semesters.add({ ...s, createdAt: Date.now() })
    if (s.status === 'active') activeId = semesterId
    for (const level of ['중', '고'] as const) {
      for (let grade = 1; grade <= 3; grade++) {
        for (let c = 1; c <= classesPerGrade; c++) {
          const classId = await db.classes.add({ semesterId, level, grade, classNo: c, subject: '음악' })
          await db.students.bulkAdd(
            Array.from({ length: 25 }, (_, i) => ({
              classId,
              no: i + 1,
              name: `학생${String(i + 1).padStart(2, '0')}`,
              status: '재학' as const,
            })),
          )
        }
      }
    }
  }
  await setKv('currentSemesterId', activeId)
  await setKv('privacyAck', true)
}

export async function clearAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}
