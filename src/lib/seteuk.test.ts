import { describe, expect, it } from 'vitest'
import { buildDraft, levelForItem, pickPhrase, sentence } from './seteuk'
import { computeStudent } from './grading'
import { defaultRules, defaultSeteukBands } from '../db/defaults'
import type { AssessmentItem, Score } from '../db/types'

const rules = defaultRules()
const bands = defaultSeteukBands()
const items: AssessmentItem[] = [
  { id: 1, planId: 1, order: 1, name: '가창', type: '실기', scoring: 'score', maxScore: 20, minScore: 10, weight: 50, rubric: '', enabled: true },
  { id: 2, planId: 1, order: 2, name: '참여', type: '관찰', scoring: 'level', maxScore: 10, minScore: 5, weight: 50, rubric: '', enabled: true,
    levels: [{ label: 'A', score: 10 }, { label: 'B', score: 8 }] },
]
const sc = (itemId: number, p: Partial<Score>): Score => ({ studentId: 1, itemId, status: 'normal', createdAt: 0, updatedAt: 0, ...p })
const res = (...s: Score[]) => computeStudent(items, new Map(s.map((x) => [x.itemId, x])), rules)
const templates = [
  { itemId: 1, levelLabel: '상', phrases: ['{항목}에서 음정이 정확함', '{항목} 표현력이 뛰어남'] },
  { itemId: 1, levelLabel: '중', phrases: ['{항목}에 성실히 참여함'] },
  { itemId: 2, levelLabel: 'A', phrases: ['수업에 적극적으로 참여함.'] },
  { itemId: 0, levelLabel: '협력', phrases: ['모둠 활동에서 친구를 배려함'] },
]
const first = () => 0

describe('세특 문구 수준', () => {
  it('점수형은 득점률 구간 (80% 이상 상, 60% 이상 중)', () => {
    expect(levelForItem(items[0], res(sc(1, { value: 16 })), bands)).toBe('상')
    expect(levelForItem(items[0], res(sc(1, { value: 15 })), bands)).toBe('중')
    expect(levelForItem(items[0], res(sc(1, { value: 11 })), bands)).toBe('하')
  })
  it('수준형은 수준 이름, 결시·미입력은 없음', () => {
    expect(levelForItem(items[1], res(sc(2, { levelLabel: 'B' })), bands)).toBe('B')
    expect(levelForItem(items[0], res(sc(1, { status: 'unapproved', reasonId: 'unapproved' })), bands)).toBeUndefined()
    expect(levelForItem(items[0], res(), bands)).toBeUndefined()
  })
})

describe('문구 고르기', () => {
  it('마침표 정리', () => {
    expect(sentence('잘함')).toBe('잘함.')
    expect(sentence('잘함.')).toBe('잘함.')
    expect(sentence('  ')).toBe('')
  })
  it('가장 적게 쓴 표현부터 골라 겹침을 줄임', () => {
    const usage = new Map<string, number>()
    const picks = [0, 1, 2, 3].map(() => pickPhrase('k', ['가', '나', '다'], usage, first))
    expect(picks.slice(0, 3).sort()).toEqual(['가', '나', '다'])
    expect(picks[3]).toBe('가')
  })
  it('빈 표현은 무시', () => expect(pickPhrase('k', [' ', ''], new Map(), first)).toBeUndefined())
})

describe('초안 만들기', () => {
  it('항목 문구 + 관찰 메모 + 태그 문구, {항목} 치환', () => {
    const d = buildDraft({
      items, result: res(sc(1, { value: 18 }), sc(2, { levelLabel: 'A' })), bands, templates, usage: new Map(), rng: first,
      memos: [
        { studentId: 1, content: '리듬을 정확히 맞춤', tags: ['협력'], createdAt: 2 },
        { studentId: 1, content: '리듬을 정확히 맞춤', tags: [], createdAt: 3 }, // 같은 내용은 한 번만
      ],
    })
    expect(d).toBe('가창에서 음정이 정확함. 수업에 적극적으로 참여함. 리듬을 정확히 맞춤. 모둠 활동에서 친구를 배려함.')
  })
  it('같은 반에서 두 학생의 상 문구가 서로 다름', () => {
    const usage = new Map<string, number>()
    const a = buildDraft({ items, result: res(sc(1, { value: 20 })), memos: [], templates, bands, usage, rng: first })
    const b = buildDraft({ items, result: res(sc(1, { value: 20 })), memos: [], templates, bands, usage, rng: first })
    expect(a).not.toBe(b)
  })
  it('템플릿이 없으면 빈 문자열', () => {
    expect(buildDraft({ items, result: res(sc(1, { value: 20 })), memos: [], templates: [], bands, usage: new Map() })).toBe('')
  })
})
