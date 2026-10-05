import type { SchoolLevel } from '../db/types'

export interface RosterRow {
  line: number // 원본 행 번호 (1부터)
  level: SchoolLevel
  grade: number
  classNo: number
  no: number
  name?: string
  error?: string
}

/** 엑셀에서 복사한 표(탭) 또는 CSV(쉼표)를 2차원 배열로 */
export function parseTable(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
  return lines.map((l) => {
    const sep = l.includes('\t') ? '\t' : ','
    return l.split(sep).map((c) => c.trim())
  })
}

const toInt = (s: string | undefined): number | null => {
  if (s === undefined) return null
  const m = String(s).trim().match(/^\D*?(\d+)\D*$/) // "1학년", "03", "5번" 허용
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n > 0 ? n : null
}

const toLevel = (s: string | undefined): SchoolLevel | null => {
  const t = (s ?? '').trim()
  if (t.startsWith('중')) return '중'
  if (t.startsWith('고')) return '고'
  return null
}

type Col = 'level' | 'grade' | 'classNo' | 'no' | 'name'
const headerMap: [Col, RegExp][] = [
  ['level', /^(학교급|학교)$/],
  ['grade', /^학년$/],
  ['classNo', /^(반|학급)$/],
  ['no', /^(번호|번|출석번호)$/],
  ['name', /^(이름|성명|학생명|학생이름)$/],
]
const colOf = (c: string) => headerMap.find(([, re]) => re.test(c.replace(/\s/g, '')))?.[0]

/**
 * 표를 학생 행으로 변환. 머리글 행이 있으면 열 이름으로, 없으면 열 개수로 판단:
 * 3열=학년,반,번호 / 4열=학년,반,번호,이름 / 5열=학교급,학년,반,번호,이름
 */
export function parseRoster(rows: string[][], defaultLevel: SchoolLevel): RosterRow[] {
  if (rows.length === 0) return []
  let start = 0
  let cols: Col[] | null = null
  // NEIS 명렬표처럼 위에 제목 줄이 있을 수 있으므로, 앞 15줄 안에서 '번호'가 있는 머리글 줄을 찾음
  const hIdx = rows.slice(0, 15).findIndex((row) => row.some((c) => colOf(c) === 'no'))
  if (hIdx >= 0) {
    cols = rows[hIdx].map((c) => colOf(c) ?? ('' as Col)) // 성별·생년월일 등 다른 열은 무시
    start = hIdx + 1
  }
  const out: RosterRow[] = []
  const seen = new Set<string>()
  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 1
    const c = cols ?? defaultCols(row.length)
    const get = (k: Col) => {
      const idx = c.indexOf(k)
      return idx >= 0 ? row[idx] : undefined
    }
    // 빈 줄·합계 줄 등 학년·반·번호가 모두 비어 있으면 조용히 건너뜀
    if (['grade', 'classNo', 'no'].every((k) => !String(get(k as Col) ?? '').trim()) && !get('name')?.trim()) continue
    const level = get('level') !== undefined ? toLevel(get('level')) : defaultLevel
    const grade = toInt(get('grade'))
    const classNo = toInt(get('classNo'))
    const no = toInt(get('no'))
    const name = get('name')?.trim() || undefined
    let error: string | undefined
    if (!level) error = '학교급을 알 수 없습니다 (중/고)'
    else if (grade === null) error = '학년이 숫자가 아닙니다'
    else if (classNo === null) error = '반이 숫자가 아닙니다'
    else if (no === null) error = '번호가 숫자가 아닙니다'
    else {
      const key = `${level}-${grade}-${classNo}-${no}`
      if (seen.has(key)) error = '같은 학년-반-번호가 중복됩니다'
      seen.add(key)
    }
    out.push({
      line,
      level: level ?? defaultLevel,
      grade: grade ?? 0,
      classNo: classNo ?? 0,
      no: no ?? 0,
      name,
      error,
    })
  }
  return out
}

function defaultCols(n: number): Col[] {
  if (n >= 5) return ['level', 'grade', 'classNo', 'no', 'name']
  if (n === 4) return ['grade', 'classNo', 'no', 'name']
  return ['grade', 'classNo', 'no']
}
