import type { AbsenceMethod, AssessmentItem, RuleSettings, Score } from '../db/types'
import { EXAM_TYPE } from './plans'

export type ResultKind = 'normal' | 'reassessed' | 'absence' | 'pending' | 'missing'

export interface ItemResult {
  points?: number // 항목 척도(0~만점)의 점수
  kind: ResultKind
  note?: string // 결시 처리 설명 등
}

export interface StudentResult {
  items: Record<number, ItemResult>
  total?: number // 소수점 처리된 환산 총점 (점수 있는 항목만 합산)
  complete: boolean // 사용 중인 모든 항목의 점수가 확정됨
  missing: number // 미입력 항목 수
  pending: number // 재평가 대기·결시 처리 대기 항목 수
}

type Rules = Pick<RuleSettings, 'absenceReasons' | 'roundMode' | 'roundDigits'>

/** 소수점 처리 (부동소수점 오차 보정 후 반올림/버림/올림) */
export function roundTo(x: number, digits: number, mode: RuleSettings['roundMode']) {
  const f = 10 ** digits
  const v = Number((x * f).toFixed(8))
  const r = mode === 'floor' ? Math.floor(v) : mode === 'ceil' ? Math.ceil(v) : Math.round(v)
  return r / f
}

/** 정상 입력된 원점수 (점수형=값, 수준형=수준의 환산 점수) */
export function rawPoints(item: AssessmentItem, s?: Score): number | undefined {
  if (!s) return undefined
  if (item.scoring === 'level') return item.levels?.find((l) => l.label === s.levelLabel)?.score
  return s.value
}

const methodLabel: Record<AbsenceMethod, string> = {
  minScore: '기본 점수', credit: '인정점', reassess: '재평가', zero: '0점',
}

/**
 * 학생 한 명의 항목별 점수와 환산 총점.
 * 환산 총점 = Σ(항목 점수 / 만점 × 반영 비율). 사용 안 함 항목은 제외.
 * 결시 항목은 규정 설정(사유별 처리 방법)에 따라 계산:
 *  - 기본 점수: 항목의 기본 점수(최저점)
 *  - 0점
 *  - 인정점: 기준 점수 × 비율. 기준은 '다른 수행평가 항목(정기시험 제외)의 환산 평균' 또는 '만점'
 *  - 재평가: 재평가 점수가 들어오기 전까지 '대기'. 재평가 불가로 표시하면 대체 처리 방법 적용
 */
export function computeStudent(allItems: AssessmentItem[], scores: Map<number, Score>, rules: Rules): StudentResult {
  const items = allItems.filter((i) => i.enabled)
  const out: Record<number, ItemResult> = {}

  // 인정점 기준용: 정상 점수가 있는 다른 수행평가 항목들의 득점 비율
  const normalRatio = new Map<number, number>()
  for (const it of items) {
    const s = scores.get(it.id!)
    const raw = rawPoints(it, s)
    if (s && s.status === 'normal' && raw !== undefined && it.maxScore > 0) normalRatio.set(it.id!, raw / it.maxScore)
  }

  for (const it of items) {
    const s = scores.get(it.id!)
    if (!s) { out[it.id!] = { kind: 'missing' }; continue }
    if (s.status === 'normal') {
      const raw = rawPoints(it, s)
      out[it.id!] = raw === undefined ? { kind: 'missing' } : { kind: s.reassessed ? 'reassessed' : 'normal', points: raw, note: s.reassessed ? '재평가' : undefined }
      continue
    }
    const reason = s.reasonId ? rules.absenceReasons.find((r) => r.id === s.reasonId) : undefined
    if (s.status === 'reassess') {
      out[it.id!] = { kind: 'pending', note: `재평가 대기${reason ? `(${reason.label})` : ''}` }
      continue
    }
    // approved / unapproved / nosubmit
    if (!reason) {
      out[it.id!] = { kind: 'absence', points: it.minScore, note: '결시(사유 정보 없음) → 기본 점수' }
      continue
    }
    const method: AbsenceMethod = reason.method === 'reassess' ? reason.fallback ?? 'credit' : reason.method
    const label = `${reason.label} → ${methodLabel[method]}${method === 'credit' ? ` ${reason.creditRatio}%` : ''}`
    if (method === 'minScore') out[it.id!] = { kind: 'absence', points: it.minScore, note: label }
    else if (method === 'zero') out[it.id!] = { kind: 'absence', points: 0, note: label }
    else {
      let baseRatio: number | undefined
      if (reason.creditBase === 'maxScore') baseRatio = 1
      else {
        const others = items.filter((o) => o.id !== it.id && o.type !== EXAM_TYPE && normalRatio.has(o.id!))
        if (others.length) baseRatio = others.reduce((a, o) => a + normalRatio.get(o.id!)!, 0) / others.length
      }
      out[it.id!] = baseRatio === undefined
        ? { kind: 'pending', note: `${label} (기준이 될 다른 항목 점수가 아직 없음)` }
        : { kind: 'absence', points: Math.min(it.maxScore, Math.max(0, baseRatio * it.maxScore * reason.creditRatio / 100)), note: label }
    }
  }

  let sum = 0, any = false, missing = 0, pending = 0
  for (const it of items) {
    const r = out[it.id!]
    if (r.kind === 'missing') missing++
    if (r.kind === 'pending') pending++
    if (r.points !== undefined && it.maxScore > 0) {
      sum += (r.points / it.maxScore) * it.weight
      any = true
    }
  }
  return {
    items: out,
    total: any ? roundTo(sum, rules.roundDigits, rules.roundMode) : undefined,
    complete: missing === 0 && pending === 0,
    missing,
    pending,
  }
}

/** 표시용 짧은 문자열 */
export function formatPoints(n: number | undefined, digits = 2) {
  if (n === undefined) return ''
  return String(roundTo(n, digits, 'round'))
}

/** 자주 쓰는 점수 버튼: 범위가 좁으면 정수 전부, 넓으면 6단계 (만점부터 내림차순) */
export function quickScores(min: number, max: number): number[] {
  if (Number.isInteger(min) && Number.isInteger(max) && max - min <= 10) {
    const out: number[] = []
    for (let v = max; v >= min; v--) out.push(v)
    return out
  }
  const n = 6
  const vals = Array.from({ length: n }, (_, i) => Math.round(max - ((max - min) * i) / (n - 1)))
  return [...new Set(vals)]
}
