import { db, setKv } from './db'
import { getRules } from './services'
import { defaultLevels } from '../lib/plans'
import type { AssessmentItem } from './types'

/**
 * 개발·시연용 가짜 데이터: 중·고 각 3개 학년, 반당 25명, 이름은 "학생01".
 * 2개 학기(앞 학기는 마감, 뒤 학기는 진행중). 학기마다 서로 다른 평가 계획 포함.
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
        const planId = await db.plans.add({ semesterId, level, grade, subject: '음악', createdAt: Date.now() })
        await db.items.bulkAdd(fakeItems(s.term, level, grade).map((it, i) => ({ ...it, planId, order: i + 1 })))
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

type FakeItem = Omit<AssessmentItem, 'id' | 'planId' | 'order'>
const fi = (name: string, type: string, maxScore: number, minScore: number, weight: number, extra: Partial<FakeItem> = {}): FakeItem => ({
  name, type, scoring: 'score', maxScore, minScore, weight, rubric: '', enabled: true, ...extra,
})

/** 학기·학교급·학년마다 조금씩 다른 가짜 평가 항목 (평가 항목은 코드에 고정되는 것이 아니라 시연용 예시입니다) */
function fakeItems(term: 1 | 2, level: '중' | '고', grade: number): FakeItem[] {
  if (term === 1) {
    return [
      fi('리코더 연주', '실기', 20, 10, 30, { rubric: '음정·박자·운지의 정확성', startDate: '2026-04-20', endDate: '2026-05-10' }),
      fi('가창', '실기', 20, 10, 30, { startDate: '2026-05-11', endDate: '2026-05-30' }),
      fi('음악 감상문', '제출물', 10, 5, 20, { startDate: '2026-04-01', endDate: '2026-04-30' }),
      fi('수업 참여도', '관찰', 10, 5, 20, {
        scoring: 'level', levels: defaultLevels(10),
      }),
    ]
  }
  const items = [
    fi('합창·합주', '실기', 30, 15, 40, { startDate: '2026-09-21', endDate: '2026-10-15' }),
    fi('창작 활동', '제출물', 20, 10, 30, { startDate: '2026-10-01', endDate: '2026-10-31' }),
    fi(level === '중' ? '정기시험' : '음악 이론 평가', '정기시험', 20, 10, 20),
    fi('수업 참여도', '관찰', 10, 5, 10, { scoring: 'level', levels: defaultLevels(10) }),
  ]
  // 시연용: 고3은 일부러 합이 90%가 되게 해서 노란 경고를 볼 수 있게 함
  if (level === '고' && grade === 3) items[3].weight = 0
  return items
}

export async function clearAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}
