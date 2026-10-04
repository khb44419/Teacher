import type { AssessmentItem, RuleSettings, Score, Student } from '../db/types'
import { computeStudent, roundTo, type StudentResult } from './grading'

export interface ReportRow {
  student: Student
  result: StudentResult
}

export interface ItemStats {
  itemId: number
  avg?: number // 평균(항목 척도)
  count: number
  bins: number[] // 득점률 0-20,20-40,40-60,60-80,80-100% 인원
}

export interface ClassReport {
  items: AssessmentItem[] // 사용 중인 항목 (순서대로)
  rows: ReportRow[]
  itemStats: ItemStats[]
  totalAvg?: number
}

/** 학급 성적표: 학생별 항목 점수·총점, 항목별 평균·분포, 총점 평균 (전출 학생은 통계 제외) */
export function buildClassReport(
  students: Student[],
  allItems: AssessmentItem[],
  scores: Score[],
  rules: Pick<RuleSettings, 'absenceReasons' | 'roundMode' | 'roundDigits'>,
): ClassReport {
  const items = allItems.filter((i) => i.enabled).sort((a, b) => a.order - b.order)
  const byStudent = new Map<number, Map<number, Score>>()
  for (const s of scores) {
    if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, new Map())
    byStudent.get(s.studentId)!.set(s.itemId, s)
  }
  const rows = [...students].sort((a, b) => a.no - b.no).map((student) => ({
    student,
    result: computeStudent(items, byStudent.get(student.id!) ?? new Map(), rules),
  }))
  const active = rows.filter((r) => r.student.status !== '전출')
  const itemStats = items.map((it) => {
    const pts = active.map((r) => r.result.items[it.id!]?.points).filter((p): p is number => p !== undefined)
    const bins = [0, 0, 0, 0, 0]
    pts.forEach((p) => bins[Math.min(4, Math.floor((it.maxScore > 0 ? p / it.maxScore : 0) * 5))]++)
    return {
      itemId: it.id!,
      count: pts.length,
      avg: pts.length ? roundTo(pts.reduce((a, b) => a + b, 0) / pts.length, 2, 'round') : undefined,
      bins,
    }
  })
  const totals = active.map((r) => r.result.total).filter((t): t is number => t !== undefined)
  return {
    items,
    rows,
    itemStats,
    totalAvg: totals.length ? roundTo(totals.reduce((a, b) => a + b, 0) / totals.length, 2, 'round') : undefined,
  }
}

export type ExportColumn = 'no' | 'name' | 'items' | 'total' | 'absence'
export const exportColumnNames: Record<ExportColumn, string> = {
  no: '번호', name: '이름', items: '항목별 점수', total: '총점', absence: '결시 처리 표시',
}
export const defaultExportColumns: ExportColumn[] = ['no', 'name', 'items', 'total', 'absence']

/**
 * 엑셀 한 시트(2차원 배열). 번호순.
 * 결시 처리로 계산된 점수는 숫자로 넣고, '결시 처리 표시' 열에 어떤 처리였는지 적음.
 * 미입력은 빈칸, 재평가 대기는 "재평가대기".
 */
export function reportToSheet(r: ClassReport, columns: ExportColumn[], includeNames: boolean): (string | number)[][] {
  const cols = columns.filter((c) => includeNames || c !== 'name')
  const header: string[] = []
  for (const c of cols) {
    if (c === 'items') r.items.forEach((i) => header.push(i.name))
    else if (c === 'total') header.push('총점')
    else header.push(exportColumnNames[c])
  }
  const body = r.rows.map(({ student, result }) => {
    const row: (string | number)[] = []
    for (const c of cols) {
      if (c === 'no') row.push(student.no)
      else if (c === 'name') row.push(student.name ?? '')
      else if (c === 'total') row.push(result.total ?? '')
      else if (c === 'items') {
        r.items.forEach((i) => {
          const x = result.items[i.id!]
          row.push(x?.points !== undefined ? roundTo(x.points, 2, 'round') : x?.kind === 'pending' ? '재평가대기' : '')
        })
      } else {
        const notes = r.items
          .map((i) => ({ i, x: result.items[i.id!] }))
          .filter(({ x }) => x && (x.kind === 'absence' || x.kind === 'pending' || x.kind === 'reassessed'))
          .map(({ i, x }) => `${i.name}: ${x!.note}`)
        if (student.status === '전출') notes.unshift('전출')
        row.push(notes.join(' / '))
      }
    }
    return row
  })
  return [header, ...body]
}

// ── 점수 가져오기 ──

export interface ImportClass {
  id: number
  level: '중' | '고'
  grade: number
  classNo: number
  items: AssessmentItem[]
  students: Student[]
}

export interface ImportEntry {
  studentId: number
  itemId: number
  value?: number
  levelLabel?: string
  where: string
}
export interface ImportError {
  where: string
  message: string
}

const sheetClassRe = /^\s*(중|고)\s*(\d)\s*-\s*(\d+)\s*$/

/**
 * 엑셀 시트를 점수 목록으로. 시트 이름이 "중1-3" 형식이면 그 학급, 아니면 학교급·학년·반 열을 읽음.
 * 머리글 행에 '번호'가 있어야 하며, 항목 열은 평가 항목 이름과 정확히 같아야 함.
 * 점수형은 0~만점 숫자, 수준형은 수준 이름 또는 환산 점수. 빈칸·총점·이름 등 다른 열은 무시.
 */
export function parseScoreSheet(sheetName: string, aoa: unknown[][], classes: ImportClass[]) {
  const entries: ImportEntry[] = []
  const errors: ImportError[] = []
  const hIdx = aoa.findIndex((row) => row.some((c) => String(c ?? '').trim() === '번호'))
  if (hIdx < 0) {
    errors.push({ where: sheetName, message: "'번호' 머리글을 찾을 수 없어 건너뜁니다" })
    return { entries, errors }
  }
  const header = aoa[hIdx].map((c) => String(c ?? '').trim())
  const col = (name: string) => header.indexOf(name)
  const m = sheetName.match(sheetClassRe)
  for (let r = hIdx + 1; r < aoa.length; r++) {
    const row = aoa[r]
    const where = `${sheetName} ${r + 1}행`
    const cell = (i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    if (row.every((c) => String(c ?? '').trim() === '')) continue
    const no = parseInt(cell(col('번호')), 10)
    let cls: ImportClass | undefined
    if (m) cls = classes.find((c) => c.level === m[1] && c.grade === +m[2] && c.classNo === +m[3])
    else {
      const lv = cell(col('학교급')).startsWith('고') ? '고' : cell(col('학교급')).startsWith('중') ? '중' : undefined
      const g = parseInt(cell(col('학년')), 10), cn = parseInt(cell(col('반')), 10)
      const cands = classes.filter((c) => c.grade === g && c.classNo === cn && (!lv || c.level === lv))
      if (cands.length > 1) { errors.push({ where, message: '중/고 구분이 필요합니다 (학교급 열 또는 "중1-3" 같은 시트 이름)' }); continue }
      cls = cands[0]
    }
    if (!cls) { errors.push({ where, message: '해당 학급이 없습니다' }); continue }
    if (!no) { errors.push({ where, message: '번호가 없습니다' }); continue }
    const st = cls.students.find((s) => s.no === no)
    if (!st) { errors.push({ where, message: `${no}번 학생이 없습니다` }); continue }
    for (const it of cls.items) {
      const ci = col(it.name)
      if (ci < 0) continue
      const raw = cell(ci)
      if (raw === '' || raw === '재평가대기') continue
      if (it.scoring === 'level') {
        const lv = it.levels?.find((l) => l.label === raw) ?? it.levels?.find((l) => String(l.score) === raw)
        if (lv) entries.push({ studentId: st.id!, itemId: it.id!, levelLabel: lv.label, where })
        else errors.push({ where, message: `${it.name}: "${raw}"는 수준 목록에 없습니다` })
      } else {
        const v = Number(raw)
        if (isNaN(v) || v < 0 || v > it.maxScore) errors.push({ where, message: `${it.name}: "${raw}"는 0~${it.maxScore} 사이 숫자가 아닙니다 (결시는 점수 입력 화면에서 처리)` })
        else entries.push({ studentId: st.id!, itemId: it.id!, value: v, where })
      }
    }
  }
  return { entries, errors }
}
