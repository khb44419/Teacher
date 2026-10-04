import type { AssessmentItem, AssessmentPlan, LevelDef } from '../db/types'

/** 이 유형의 항목은 '수행평가 반영 비율' 계산에서 제외합니다 (정기시험은 수행평가가 아님). */
export const EXAM_TYPE = '정기시험'

const r2 = (n: number) => Math.round(n * 100) / 100

export const planLabel = (p: Pick<AssessmentPlan, 'level' | 'grade' | 'subject'>) =>
  `${p.level}${p.grade}학년 ${p.subject}`

/** 사용 중인 항목의 반영 비율 합 */
export const weightSum = (items: Pick<AssessmentItem, 'weight' | 'enabled'>[]) =>
  r2(items.filter((i) => i.enabled).reduce((s, i) => s + i.weight, 0))

/** 수행평가(정기시험이 아닌 항목)의 반영 비율 합 */
export const performanceRatio = (items: Pick<AssessmentItem, 'weight' | 'enabled' | 'type'>[]) =>
  weightSum(items.filter((i) => i.type !== EXAM_TYPE))

/** 만점이 바뀔 때 기존 점수를 비율대로 환산 (소수 둘째 자리까지) */
export const rescaleScore = (value: number, oldMax: number, newMax: number) =>
  oldMax > 0 ? r2((value / oldMax) * newMax) : value

/** 수준형 기본 수준 (교사가 자유롭게 고침) */
export const defaultLevels = (max: number): LevelDef[] => [
  { label: '상', score: max },
  { label: '중', score: r2(max * 0.8) },
  { label: '하', score: r2(max * 0.6) },
]

export type ItemDraft = Pick<
  AssessmentItem,
  'name' | 'type' | 'scoring' | 'maxScore' | 'minScore' | 'weight' | 'levels' | 'rubric' | 'startDate' | 'endDate' | 'enabled'
>

export function itemErrors(f: ItemDraft): string[] {
  const e: string[] = []
  if (!f.name.trim()) e.push('항목 이름을 입력하세요')
  if (!(f.maxScore > 0)) e.push('만점은 0보다 커야 합니다')
  if (!(f.minScore >= 0) || f.minScore > f.maxScore) e.push('기본 점수(최저점)는 0 이상, 만점 이하여야 합니다')
  if (!(f.weight >= 0 && f.weight <= 100)) e.push('반영 비율은 0~100 사이여야 합니다')
  if (f.scoring === 'level') {
    const ls = f.levels ?? []
    if (ls.length < 2) e.push('수준은 2개 이상 필요합니다')
    if (ls.some((l) => !l.label.trim())) e.push('수준 이름을 모두 입력하세요')
    if (new Set(ls.map((l) => l.label.trim())).size !== ls.length) e.push('수준 이름이 중복됩니다')
    if (ls.some((l) => !(l.score >= 0) || l.score > f.maxScore)) e.push('수준별 환산 점수는 0 이상, 만점 이하여야 합니다')
  }
  if (f.startDate && f.endDate && f.startDate > f.endDate) e.push('평가 예정 기간의 시작이 끝보다 늦습니다')
  return e
}

const levelText = (l?: LevelDef[]) => (l ?? []).map((x) => `${x.label}=${x.score}`).join(', ')
const fields: [keyof ItemDraft, string, (v: ItemDraft) => string][] = [
  ['name', '항목명', (v) => v.name],
  ['type', '평가 유형', (v) => v.type],
  ['scoring', '채점 방식', (v) => (v.scoring === 'score' ? '점수형' : '수준형')],
  ['maxScore', '만점', (v) => String(v.maxScore)],
  ['minScore', '기본 점수(최저점)', (v) => String(v.minScore)],
  ['weight', '반영 비율', (v) => `${v.weight}%`],
  ['levels', '수준·환산 점수', (v) => levelText(v.levels)],
  ['rubric', '평가 기준', (v) => v.rubric],
  ['startDate', '예정 시작일', (v) => v.startDate ?? ''],
  ['endDate', '예정 종료일', (v) => v.endDate ?? ''],
  ['enabled', '사용 여부', (v) => (v.enabled ? '사용' : '사용 안 함')],
]

/** 바뀐 항목만 "무엇을: 이전 → 새 값" 목록으로 */
export function diffItem(a: ItemDraft, b: ItemDraft) {
  const out: { label: string; before: string; after: string }[] = []
  for (const [key, label, show] of fields) {
    if (key === 'levels' && a.scoring === 'score' && b.scoring === 'score') continue
    const x = show(a)
    const y = show(b)
    if (x !== y) out.push({ label, before: x, after: y })
  }
  return out
}
