import { describe, expect, it } from 'vitest'
import { buildClassReport, parseScoreSheet, reportToSheet, defaultExportColumns, type ImportClass } from './report'
import { defaultRules } from '../db/defaults'
import type { AssessmentItem, Score, Student } from '../db/types'

const items: AssessmentItem[] = [
  { id: 1, planId: 1, order: 2, name: '가창', type: '실기', scoring: 'score', maxScore: 20, minScore: 10, weight: 60, rubric: '', enabled: true },
  { id: 2, planId: 1, order: 1, name: '참여', type: '관찰', scoring: 'level', maxScore: 10, minScore: 5, weight: 40, rubric: '', enabled: true,
    levels: [{ label: '상', score: 10 }, { label: '중', score: 8 }, { label: '하', score: 6 }] },
  { id: 3, planId: 1, order: 3, name: '숨김', type: '실기', scoring: 'score', maxScore: 10, minScore: 0, weight: 0, rubric: '', enabled: false },
]
const students: Student[] = [
  { id: 11, classId: 1, no: 2, name: '나', status: '재학' },
  { id: 10, classId: 1, no: 1, name: '가', status: '재학' },
  { id: 12, classId: 1, no: 3, status: '전출' },
]
const sc = (studentId: number, itemId: number, p: Partial<Score>): Score => ({ studentId, itemId, status: 'normal', createdAt: 0, updatedAt: 0, ...p })
const scores = [
  sc(10, 1, { value: 20 }), sc(10, 2, { levelLabel: '상' }),
  sc(11, 1, { status: 'unapproved', reasonId: 'unapproved' }), sc(11, 2, { levelLabel: '하' }),
  sc(12, 1, { value: 0 }),
]

describe('학급 성적표', () => {
  const r = buildClassReport(students, items, scores, defaultRules())
  it('번호순, 사용 중 항목만, 항목 순서대로', () => {
    expect(r.rows.map((x) => x.student.no)).toEqual([1, 2, 3])
    expect(r.items.map((i) => i.name)).toEqual(['참여', '가창'])
  })
  it('총점과 평균 (전출 학생은 통계 제외)', () => {
    expect(r.rows[0].result.total).toBe(100)
    expect(r.rows[1].result.total).toBe(54) // 10/20*60 + 6/10*40
    expect(r.totalAvg).toBe(77)
    const g = r.itemStats.find((s) => s.itemId === 1)!
    expect(g.avg).toBe(15)
    expect(g.bins).toEqual([0, 0, 1, 0, 1]) // 50% → 40-60 구간, 100% → 80-100
  })
  it('엑셀 시트: 이름 제외 옵션, 결시 처리 표시', () => {
    const sheet = reportToSheet(r, defaultExportColumns, false)
    expect(sheet[0]).toEqual(['번호', '참여', '가창', '총점', '결시 처리 표시'])
    expect(sheet[2]).toEqual([2, 6, 10, 54, '가창: 미인정결시 → 기본 점수'])
    expect(sheet[3][4]).toBe('전출')
  })
  it('열 순서 바꾸기', () => {
    const sheet = reportToSheet(r, ['total', 'no', 'name'], true)
    expect(sheet[1]).toEqual([100, 1, '가'])
  })
})

describe('점수 가져오기', () => {
  const cls: ImportClass[] = [
    { id: 1, level: '중', grade: 1, classNo: 1, items, students },
    { id: 2, level: '고', grade: 1, classNo: 1, items, students: [{ id: 20, classId: 2, no: 1, status: '재학' }] },
  ]
  it('시트 이름 "중1-1" + 항목 이름 열', () => {
    const { entries, errors } = parseScoreSheet('중1-1', [['번호', '이름', '가창', '참여', '총점'], [1, '가', 18, '중', 99], [2, '', '', 10, '']], cls)
    expect(errors).toEqual([])
    expect(entries).toEqual([
      expect.objectContaining({ studentId: 10, itemId: 1, value: 18 }),
      expect.objectContaining({ studentId: 10, itemId: 2, levelLabel: '중' }),
      expect.objectContaining({ studentId: 11, itemId: 2, levelLabel: '상' }), // 환산 점수 10 → 상
    ])
  })
  it('학년·반 열 방식, 중/고 모호하면 오류', () => {
    const r1 = parseScoreSheet('Sheet1', [['학교급', '학년', '반', '번호', '가창'], ['고', 1, 1, 1, 15]], cls)
    expect(r1.entries[0]).toMatchObject({ studentId: 20, value: 15 })
    const r2 = parseScoreSheet('Sheet1', [['학년', '반', '번호', '가창'], [1, 1, 1, 15]], cls)
    expect(r2.errors[0].message).toMatch(/중\/고/)
  })
  it('범위 밖 점수·없는 수준·없는 학생은 오류', () => {
    const { entries, errors } = parseScoreSheet('중1-1', [['번호', '가창', '참여'], [1, 25, '최상'], [9, 10, '']], cls)
    expect(entries).toEqual([])
    expect(errors).toHaveLength(3)
  })
  it('번호 머리글이 없으면 시트 건너뜀', () => {
    expect(parseScoreSheet('메모', [['아무거나']], cls).errors).toHaveLength(1)
  })
})
