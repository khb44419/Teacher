import Dexie from 'dexie'
import { db, isPracticeMode, PRACTICE_DB } from './db'
import { generateFakeData } from './fakeData'

/** 연습 모드로 들어가기: 가짜 학생·점수가 들어 있는 연습 공간을 엶. 실제 데이터는 그대로. */
export function enterPractice() {
  try { localStorage.setItem('practiceMode', '1') } catch { /* 무시 */ }
  location.hash = '#/'
  location.reload()
}

/** 연습 끝내기: 연습 공간을 지우고 실제 데이터로 돌아감 */
export async function exitPractice() {
  try { localStorage.removeItem('practiceMode') } catch { /* 무시 */ }
  db.close()
  await Dexie.delete(PRACTICE_DB).catch(() => undefined)
  location.hash = '#/'
  location.reload()
}

/** 연습 공간이 비어 있으면 연습용 데이터 채우기 */
export async function ensurePracticeData() {
  if (!isPracticeMode()) return
  if ((await db.semesters.count()) === 0) await generateFakeData()
}

/** 연습 데이터를 처음 상태로 */
export const resetPractice = () => generateFakeData()
