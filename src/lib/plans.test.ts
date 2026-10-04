import { describe, expect, it } from 'vitest'
import { defaultLevels, diffItem, itemErrors, performanceRatio, rescaleScore, weightSum, type ItemDraft } from './plans'

const base: ItemDraft = {
  name: '리코더', type: '실기', scoring: 'score', maxScore: 20, minScore: 10, weight: 25,
  rubric: '', enabled: true,
}

describe('평가 계획 계산', () => {
  it('반영 비율 합은 사용 중인 항목만', () => {
    expect(weightSum([{ weight: 30, enabled: true }, { weight: 70, enabled: true }, { weight: 50, enabled: false }])).toBe(100)
  })
  it('부동소수점 오차 없이 합산', () => {
    expect(weightSum([0.1, 0.2, 0.3].map((w) => ({ weight: w * 100, enabled: true })))).toBe(60)
  })
  it('수행평가 비율은 정기시험 제외', () => {
    expect(performanceRatio([
      { weight: 30, enabled: true, type: '실기' },
      { weight: 40, enabled: true, type: '정기시험' },
      { weight: 30, enabled: true, type: '제출물' },
    ])).toBe(60)
  })
  it('만점 변경 시 비율대로 환산', () => {
    expect(rescaleScore(15, 20, 100)).toBe(75)
    expect(rescaleScore(7, 10, 15)).toBe(10.5)
    expect(rescaleScore(1, 3, 10)).toBe(3.33)
  })
  it('기본 수준 구성', () => {
    expect(defaultLevels(10)).toEqual([{ label: '상', score: 10 }, { label: '중', score: 8 }, { label: '하', score: 6 }])
  })
});

describe('항목 입력 검사', () => {
  it('정상 항목은 오류 없음', () => expect(itemErrors(base)).toEqual([]))
  it('이름·만점·최저점·비율 검사', () => {
    expect(itemErrors({ ...base, name: ' ' })).toHaveLength(1)
    expect(itemErrors({ ...base, maxScore: 0, minScore: 0 })).toHaveLength(1)
    expect(itemErrors({ ...base, minScore: 21 })).toHaveLength(1)
    expect(itemErrors({ ...base, weight: 101 })).toHaveLength(1)
  })
  it('수준형은 수준 2개 이상, 이름 중복 불가, 환산 점수 범위', () => {
    const lv = { ...base, scoring: 'level' as const }
    expect(itemErrors({ ...lv, levels: [{ label: '상', score: 20 }] })).toHaveLength(1)
    expect(itemErrors({ ...lv, levels: [{ label: '상', score: 20 }, { label: '상', score: 10 }] })).toHaveLength(1)
    expect(itemErrors({ ...lv, levels: [{ label: '상', score: 30 }, { label: '하', score: 10 }] })).toHaveLength(1)
    expect(itemErrors({ ...lv, levels: defaultLevels(20) })).toEqual([])
  })
  it('기간 순서', () => {
    expect(itemErrors({ ...base, startDate: '2026-10-10', endDate: '2026-10-01' })).toHaveLength(1)
  })
})

describe('변경 내용 비교', () => {
  it('바뀐 칸만 이전 → 새 값으로', () => {
    expect(diffItem(base, { ...base, weight: 30, maxScore: 100 })).toEqual([
      { label: '만점', before: '20', after: '100' },
      { label: '반영 비율', before: '25%', after: '30%' },
    ])
  })
  it('같으면 빈 목록', () => expect(diffItem(base, { ...base })).toEqual([]))
})
