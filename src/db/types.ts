// 데이터 모델 (요구사항 5장). 모든 데이터는 이 기기의 IndexedDB에만 저장됩니다.

export type SchoolLevel = '중' | '고'
export type SemesterStatus = 'active' | 'closed'

export interface Semester {
  id?: number
  year: number // 학년도
  term: 1 | 2
  status: SemesterStatus
  createdAt: number
}

export interface SchoolClass {
  id?: number
  semesterId: number
  level: SchoolLevel
  grade: number
  classNo: number
  subject: string // 과목명 (자유 입력)
}

export type StudentStatus = '재학' | '전출' | '전입'

export interface Student {
  id?: number
  classId: number
  no: number
  name?: string // 선택 입력. 없어도 모든 기능이 동작해야 함
  status: StudentStatus
  note?: string
}

export interface AssessmentPlan {
  id?: number
  semesterId: number
  level: SchoolLevel
  grade: number
  subject: string
  createdAt: number
}

export type ScoringMode = 'score' | 'level'
export interface LevelDef {
  label: string
  score: number // 환산 점수
}

export interface AssessmentItem {
  id?: number
  planId: number
  order: number
  name: string
  type: string // 실기/정기시험/제출물/관찰 등 (목록은 규정 설정에서 편집)
  scoring: ScoringMode
  maxScore: number
  minScore: number // 기본 점수(최저점)
  weight: number // 반영 비율(%)
  levels?: LevelDef[]
  rubric: string
  startDate?: string
  endDate?: string
  enabled: boolean
}

export type ScoreStatus = 'normal' | 'approved' | 'unapproved' | 'nosubmit' | 'reassess'

export interface Score {
  id?: number
  studentId: number
  itemId: number
  value?: number
  levelLabel?: string
  status: ScoreStatus
  reasonId?: string // 결시 사유(규정 설정의 사유 id)
  reasonNote?: string
  computed?: number // (사용 안 함: 결시 처리 점수는 grading.ts에서 그때그때 계산)
  reassessed?: boolean // 재평가로 입력된 점수
  useFallback?: boolean // 재평가 불가 → 규정의 대체 처리 적용
  createdAt: number
  updatedAt: number
}

export interface Memo {
  id?: number
  studentId: number
  content: string
  tags: string[]
  createdAt: number
}

export type AbsenceMethod = 'minScore' | 'credit' | 'reassess' | 'zero'
export type AbsenceCategory = 'approved' | 'unapproved' | 'nosubmit'

export interface AbsenceReason {
  id: string
  label: string
  category: AbsenceCategory
  method: AbsenceMethod
  /** method가 reassess일 때, 재평가가 불가하면 적용할 방식 */
  fallback?: Exclude<AbsenceMethod, 'reassess'>
  creditRatio: number // 인정점 비율(%)
  creditBase: 'othersAverage' | 'maxScore' // 인정점 기준
}

export interface RuleSettings {
  seteukMaxBytes: number
  seteukMaxChars: number
  byteHangul: number
  byteOther: number
  byteNewline: number
  absenceReasons: AbsenceReason[]
  roundMode: 'round' | 'floor' | 'ceil'
  roundDigits: number
  minPerformanceRatio: number | null // 수행평가 최소 반영 비율(%), 비워 두면 경고 없음
  itemTypes: string[]
  memoTags: string[]
  quickPhrases: string[]
  confirmedYear: number | null // 올해 기재요령/학업성적관리규정 확인 학년도
  updatedAt: number
}

export interface ChangeLog {
  id?: number
  at: number
  target: string
  detail: string
  before?: string
  after?: string
}

export interface LibraryItem {
  id?: number
  name: string
  type: string
  scoring: ScoringMode
  maxScore: number
  minScore: number
  weight: number
  levels?: LevelDef[]
  rubric: string
}

export interface SeteukTemplate {
  id?: number
  itemId: number
  levelLabel: string // 수준 또는 구간 이름
  phrases: string[] // 여러 표현 중 무작위 선택
}

export interface Seteuk {
  id?: number
  studentId: number
  text: string
  updatedAt: number
}

export interface KV {
  key: string
  value: unknown
}
