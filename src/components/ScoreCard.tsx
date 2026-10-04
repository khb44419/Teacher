import { useState } from 'react'
import type { AssessmentItem, RuleSettings, Score, Student } from '../db/types'
import { quickScores } from '../lib/grading'
import { useApp } from '../app/AppContext'
import { studentLabel } from './StudentName'
import { Button, inputCls } from './ui'

export function scoreText(score: Score | undefined, rules: RuleSettings) {
  if (!score) return { text: '미입력', tone: 'bg-gray-100 text-gray-600', icon: '○' }
  const reason = score.reasonId ? rules.absenceReasons.find((r) => r.id === score.reasonId) : undefined
  if (score.status === 'normal') {
    const v = score.levelLabel ?? String(score.value ?? '')
    return { text: score.reassessed ? `${v} (재평가)` : v, tone: 'bg-green-100 text-green-800', icon: '✔' }
  }
  if (score.status === 'reassess') return { text: `재평가 대기${reason ? ` · ${reason.label}` : ''}`, tone: 'bg-yellow-100 text-yellow-800', icon: '🔁' }
  return {
    text: `결시 · ${reason?.label ?? '사유 없음'}${score.useFallback ? ' (재평가 불가)' : ''}`,
    tone: 'bg-orange-100 text-orange-800',
    icon: '※',
  }
}

interface Props {
  student: Student
  item: AssessmentItem
  score?: Score
  rules: RuleSettings
  readOnly: boolean
  big?: boolean
  onScore: (v: { value?: number; levelLabel?: string }) => void
  onAbsence: () => void
  onFallback: () => void
  onClear: () => void
  onMemo: () => void
}

/** 학생 한 명의 점수 입력 카드 (순서 모드의 큰 카드, 표 모드의 팝업 공용) */
export function ScoreCard({ student, item, score, rules, readOnly, big, onScore, onAbsence, onFallback, onClear, onMemo }: Props) {
  const { hideNames } = useApp()
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState('')
  const st = scoreText(score, rules)
  const pending = score?.status === 'reassess'

  const submitTyped = () => {
    const v = Number(typed)
    if (typed.trim() === '' || isNaN(v)) return
    if (v < item.minScore || v > item.maxScore) {
      setErr(`기본 점수(${item.minScore}) ~ 만점(${item.maxScore}) 사이로 입력하세요. 결시·미제출은 "결시" 버튼을 쓰세요.`)
      return
    }
    setErr('')
    setTyped('')
    onScore({ value: v })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`${big ? 'text-4xl' : 'text-2xl'} font-bold flex-1`}>
          {studentLabel(student, hideNames)}
          {student.status !== '재학' && <span className="ml-2 text-sm border rounded px-1 align-middle">{student.status}</span>}
        </div>
        <span className={`px-3 py-2 rounded-lg font-semibold ${st.tone}`}>{st.icon} {st.text}</span>
      </div>
      {student.note && <p className="text-sm text-gray-600">비고: {student.note}</p>}
      {pending && <p className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-sm">🔁 재평가 대상입니다. 재평가 점수를 입력하거나, 재평가가 불가능하면 아래 &quot;재평가 불가&quot;를 누르세요.</p>}

      {!readOnly && (
        <>
          {item.scoring === 'level' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {item.levels?.map((l) => (
                <Button key={l.label} variant={score?.levelLabel === l.label ? 'primary' : 'secondary'}
                  className={`${big ? 'min-h-20 text-2xl' : 'min-h-14 text-xl'}`} onClick={() => onScore({ levelLabel: l.label })}>
                  {l.label} <span className="text-sm font-normal">({l.score}점)</span>
                </Button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {quickScores(item.minScore, item.maxScore).map((v) => (
                  <Button key={v} variant={score?.status === 'normal' && score.value === v ? 'primary' : 'secondary'}
                    className={`${big ? 'min-h-16 text-2xl' : 'min-h-12 text-lg'}`} onClick={() => onScore({ value: v })}>
                    {v}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={inputCls} type="number" inputMode="decimal" step="any" placeholder={`직접 입력 (${item.minScore}~${item.maxScore})`}
                  value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitTyped()} aria-label="점수 직접 입력" />
                <Button onClick={submitTyped} disabled={!typed.trim()}>입력</Button>
              </div>
              {err && <p className="text-red-600 text-sm">{err}</p>}
            </>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={onAbsence}>🚫 결시·미제출</Button>
            {pending && <Button variant="secondary" onClick={onFallback}>재평가 불가 → 규정 처리</Button>}
            <Button variant="secondary" onClick={onMemo}>📝 메모</Button>
            {score && <Button variant="ghost" onClick={onClear}>점수 지우기</Button>}
          </div>
        </>
      )}
      {readOnly && <p className="text-gray-500 text-sm">마감된 학기라 읽기 전용입니다.</p>}
    </div>
  )
}
