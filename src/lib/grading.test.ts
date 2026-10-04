import { describe, expect, it } from 'vitest'
import { computeStudent, roundTo } from './grading'
import { defaultRules } from '../db/defaults'
import type { AssessmentItem, Score } from '../db/types'

const item = (id: number, p: Partial<AssessmentItem> = {}): AssessmentItem => ({
  id, planId: 1, order: id, name: `항목${id}`, type: '실기', scoring: 'score', maxScore: 20, minScore: 10,
  weight: 25, rubric: '', enabled: true, ...p,
})
const sc = (itemId: number, p: Partial<Score>): Score => ({ studentId: 1, itemId, status: 'normal', createdAt: 0, updatedAt: 0, ...p })
const map = (...s: Score[]) => new Map(s.map((x) => [x.itemId, x]))
const rules = defaultRules() // 소수 1자리 반올림

describe('소수점 처리', () => {
  it('반올림/버림/올림, 부동소수점 오차 보정', () => {
    expect(roundTo(84.25, 1, 'round')).toBe(84.3)
    expect(roundTo(84.25, 1, 'floor')).toBe(84.2)
    expect(roundTo(84.21, 1, 'ceil')).toBe(84.3)
    expect(roundTo(1.005, 2, 'round')).toBe(1.01)
    expect(roundTo(0.1 + 0.2, 1, 'ceil')).toBe(0.3) // 0.30000000000000004 를 0.4로 올리지 않음
    expect(roundTo(87.5, 0, 'round')).toBe(88)
  })
})

describe('환산 총점', () => {
  it('Σ(점수/만점×반영 비율)', () => {
    const items = [item(1, { weight: 40 }), item(2, { maxScore: 10, weight: 60 })]
    const r = computeStudent(items, map(sc(1, { value: 15 }), sc(2, { value: 7 })), rules)
    expect(r.total).toBe(72) // 15/20*40=30 + 7/10*60=42
    expect(r.complete).toBe(true)
  })
  it('수준형은 환산 점수로 계산', () => {
    const items = [item(1, { scoring: 'level', maxScore: 10, weight: 100, levels: [{ label: '상', score: 10 }, { label: '중', score: 8 }] })]
    expect(computeStudent(items, map(sc(1, { levelLabel: '중' })), rules).total).toBe(80)
  })
  it('사용 안 함 항목은 제외, 미입력은 개수로', () => {
    const items = [item(1, { weight: 50 }), item(2, { weight: 50 }), item(3, { enabled: false })]
    const r = computeStudent(items, map(sc(1, { value: 20 }), sc(3, { value: 20 })), rules)
    expect(r.total).toBe(50)
    expect(r.missing).toBe(1)
    expect(r.complete).toBe(false)
    expect(r.items[3]).toBeUndefined()
  })
  it('아무 점수도 없으면 총점 없음', () => {
    expect(computeStudent([item(1)], map(), rules).total).toBeUndefined()
  })
  it('소수점 설정 반영', () => {
    const items = [item(1, { maxScore: 3, weight: 100 })]
    const r = computeStudent(items, map(sc(1, { value: 2 })), { ...rules, roundDigits: 2, roundMode: 'floor' })
    expect(r.total).toBe(66.66)
  })
})

describe('결시 처리', () => {
  const items = [item(1, { weight: 50 }), item(2, { weight: 25 }), item(3, { weight: 25, type: '정기시험' })]
  it('미인정결시 → 기본 점수(최저점)', () => {
    const r = computeStudent(items, map(sc(1, { status: 'unapproved', reasonId: 'unapproved' })), rules)
    expect(r.items[1]).toMatchObject({ kind: 'absence', points: 10 })
  })
  it('미제출 → 기본 점수', () => {
    const r = computeStudent(items, map(sc(2, { status: 'nosubmit', reasonId: 'nosubmit' })), rules)
    expect(r.items[2].points).toBe(10)
  })
  it('인정결시(질병, 재평가 우선) → 재평가 대기', () => {
    const r = computeStudent(items, map(sc(1, { status: 'reassess', reasonId: 'illness' })), rules)
    expect(r.items[1].kind).toBe('pending')
    expect(r.pending).toBe(1)
    expect(r.complete).toBe(false)
  })
  it('재평가 점수 입력 → 정상 점수(재평가 표시)', () => {
    const r = computeStudent(items, map(sc(1, { status: 'normal', value: 18, reassessed: true, reasonId: 'illness' })), rules)
    expect(r.items[1]).toMatchObject({ kind: 'reassessed', points: 18 })
  })
  it('재평가 불가 → 인정점 80%, 기준은 다른 수행평가 항목 평균(정기시험 제외)', () => {
    const r = computeStudent(items, map(
      sc(1, { status: 'approved', reasonId: 'illness', useFallback: true }),
      sc(2, { value: 15 }), // 75%
      sc(3, { value: 20 }), // 정기시험: 기준에서 제외
    ), rules)
    // 0.75 * 20 * 0.8 = 12
    expect(r.items[1]).toMatchObject({ kind: 'absence', points: 12 })
    expect(r.total).toBe(73.8) // 30 + 18.75 + 25 = 73.75 → 소수 1자리 반올림
  })
  it('인정점 기준이 없으면 대기', () => {
    const r = computeStudent(items, map(sc(1, { status: 'approved', reasonId: 'illness', useFallback: true })), rules)
    expect(r.items[1].kind).toBe('pending')
  })
  it('인정점 만점 기준, 0점 처리, 사유 정보 없음', () => {
    const custom = {
      ...rules,
      absenceReasons: [
        { id: 'a', label: '경조사', category: 'approved' as const, method: 'credit' as const, creditRatio: 100, creditBase: 'maxScore' as const },
        { id: 'z', label: '무단', category: 'unapproved' as const, method: 'zero' as const, creditRatio: 0, creditBase: 'maxScore' as const },
      ],
    }
    const r = computeStudent(items, map(
      sc(1, { status: 'approved', reasonId: 'a' }),
      sc(2, { status: 'unapproved', reasonId: 'z' }),
      sc(3, { status: 'unapproved', reasonId: 'deleted' }),
    ), custom)
    expect(r.items[1].points).toBe(20)
    expect(r.items[2].points).toBe(0)
    expect(r.items[3].points).toBe(10)
  })
})

import { quickScores } from './grading'
describe('자주 쓰는 점수 버튼', () => {
  it('좁은 범위는 정수 전부', () => expect(quickScores(10, 20)).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]))
  it('넓은 범위는 6단계', () => expect(quickScores(40, 100)).toEqual([100, 88, 76, 64, 52, 40]))
  it('최저=만점', () => expect(quickScores(5, 5)).toEqual([5]))
})
