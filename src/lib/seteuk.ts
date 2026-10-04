import type { AssessmentItem, Memo, SeteukBand, SeteukTemplate } from '../db/types'
import type { StudentResult } from './grading'

/** 항목 결과 → 문구 수준 이름. 수준형은 수준 이름, 점수형은 득점률 구간. 결시·미입력은 없음. */
export function levelForItem(item: AssessmentItem, result: StudentResult, bands: SeteukBand[]): string | undefined {
  const r = result.items[item.id!]
  if (!r || (r.kind !== 'normal' && r.kind !== 'reassessed') || r.points === undefined) return undefined
  if (item.scoring === 'level') return item.levels?.find((l) => l.score === r.points)?.label
  const ratio = item.maxScore > 0 ? (r.points / item.maxScore) * 100 : 0
  return [...bands].sort((a, b) => b.minRatio - a.minRatio).find((b) => ratio >= b.minRatio)?.label
}

/** 문장 끝 정리: 마침표 등이 없으면 붙임 */
export function sentence(s: string) {
  const t = s.trim()
  if (!t) return ''
  return /[.!?。]$/.test(t) ? t : `${t}.`
}

/**
 * 같은 반 학생들의 문장이 겹치지 않도록, 지금까지 가장 적게 쓴 표현을 고르고 동점이면 무작위.
 * usage 는 반 전체 생성 동안 공유.
 */
export function pickPhrase(tplKey: string, phrases: string[], usage: Map<string, number>, rng: () => number): string | undefined {
  const list = phrases.map((p) => p.trim()).filter(Boolean)
  if (!list.length) return undefined
  const counts = list.map((_, i) => usage.get(`${tplKey}#${i}`) ?? 0)
  const min = Math.min(...counts)
  const cands = list.map((_, i) => i).filter((i) => counts[i] === min)
  const pick = cands[Math.floor(rng() * cands.length) % cands.length]
  usage.set(`${tplKey}#${pick}`, min + 1)
  return list[pick]
}

export interface DraftInput {
  items: AssessmentItem[] // 사용 중인 항목 (순서대로)
  result: StudentResult
  memos: Memo[]
  templates: SeteukTemplate[] // 이 계획 항목들의 템플릿 + 태그 템플릿(itemId=0)
  bands: SeteukBand[]
  usage: Map<string, number>
  rng?: () => number
}

/**
 * 세특 초안 = ① 항목별 수준 문구(템플릿) + ② 교사의 관찰 메모 + ③ 메모 태그 문구(템플릿).
 * 문구 안의 {항목} 은 항목 이름으로 바뀜. 결시·미입력 항목은 문장을 만들지 않음.
 */
export function buildDraft(input: DraftInput): string {
  const rng = input.rng ?? Math.random
  const out: string[] = []
  for (const it of input.items) {
    const lv = levelForItem(it, input.result, input.bands)
    if (!lv) continue
    const tpl = input.templates.find((t) => t.itemId === it.id && t.levelLabel === lv)
    const p = tpl && pickPhrase(`i${it.id}:${lv}`, tpl.phrases, input.usage, rng)
    if (p) out.push(sentence(p.replaceAll('{항목}', it.name)))
  }
  const memos = [...input.memos].sort((a, b) => a.createdAt - b.createdAt)
  const seen = new Set<string>()
  for (const m of memos) {
    const s = sentence(m.content)
    if (s && !seen.has(s)) { seen.add(s); out.push(s) }
  }
  const tags = [...new Set(memos.flatMap((m) => m.tags))]
  for (const tag of tags) {
    const tpl = input.templates.find((t) => t.itemId === 0 && t.levelLabel === tag)
    const p = tpl && pickPhrase(`t:${tag}`, tpl.phrases, input.usage, rng)
    if (p) out.push(sentence(p))
  }
  return out.join(' ')
}
