import type { AbsenceReason, RuleSettings } from './types'

// 기본값일 뿐입니다. 반드시 학교 학업성적관리규정과 일치하는지 확인하세요.
// (인정점 비율 80/100 은 요구사항의 '예시'이며 법정 기준이 아닙니다.)
const r = (
  id: string,
  label: string,
  category: AbsenceReason['category'],
  method: AbsenceReason['method'],
  creditRatio = 100,
): AbsenceReason => ({
  id,
  label,
  category,
  method,
  fallback: method === 'reassess' ? 'credit' : undefined,
  creditRatio,
  creditBase: 'othersAverage',
})

export const defaultAbsenceReasons = (): AbsenceReason[] => [
  r('illness', '질병', 'approved', 'reassess', 80),
  r('family', '경조사', 'approved', 'reassess', 100),
  r('infection', '법정 감염병', 'approved', 'reassess', 100),
  r('disaster', '천재지변', 'approved', 'reassess', 100),
  r('official', '공적 업무', 'approved', 'reassess', 100),
  r('unapproved', '미인정결시', 'unapproved', 'minScore', 0),
  r('nosubmit', '미응시·미제출', 'nosubmit', 'minScore', 0),
]

export const defaultRules = (): RuleSettings => ({
  seteukMaxBytes: 1500,
  seteukMaxChars: 500,
  byteHangul: 3,
  byteOther: 1,
  byteNewline: 2,
  absenceReasons: defaultAbsenceReasons(),
  roundMode: 'round',
  roundDigits: 1,
  minPerformanceRatio: null,
  itemTypes: ['실기', '정기시험', '제출물', '관찰'],
  memoTags: ['참여', '성장', '특기', '협력', '태도'],
  quickPhrases: ['적극적으로 참여함', '꾸준히 노력함', '친구를 잘 도와줌'],
  confirmedYear: null,
  updatedAt: Date.now(),
})
