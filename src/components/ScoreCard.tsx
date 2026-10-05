import { useState } from 'react'
import type { AssessmentItem, RuleSettings, Score, Student } from '../db/types'
import { quickScores } from '../lib/grading'
import { useApp } from '../app/AppContext'
import { Button } from './ui'
import { Icon } from './Icon'

export function scoreText(score: Score | undefined, rules: RuleSettings) {
  if (!score) return { text: '미입력', tone: 'bg-canvas text-muted', icon: '○' }
  const reason = score.reasonId ? rules.absenceReasons.find((r) => r.id === score.reasonId) : undefined
  if (score.status === 'normal') {
    const v = score.levelLabel ?? String(score.value ?? '')
    return { text: score.reassessed ? `${v} (재평가)` : v, tone: 'bg-mint text-[#155C38]', icon: '✔' }
  }
  if (score.status === 'reassess') return { text: `재평가 대기${reason ? ` · ${reason.label}` : ''}`, tone: 'bg-peach text-[#6B4500]', icon: '↻' }
  return {
    text: `결시 · ${reason?.label ?? '사유 없음'}${score.useFallback ? ' (재평가 불가)' : ''}`,
    tone: 'bg-[#FCE3D6] text-[#8A3A12]',
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

  const name = hideNames || !student.name ? `${student.no}번` : student.name
  const scoreBtn = (active: boolean) =>
    `rounded-full font-bold ${big ? 'min-h-16 text-2xl' : 'min-h-14 text-xl'} ${active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-ink hover:bg-brand-100'}`

  return (
    <div className="space-y-4">
      {big ? (
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="w-[76px] h-[76px] rounded-full bg-sky text-navy flex items-center justify-center text-3xl font-bold">{student.no}</span>
          <span className="text-2xl font-bold">
            {name}
            {student.status !== '재학' && <span className="ml-2 text-sm font-semibold bg-canvas rounded-full px-2 py-0.5 align-middle">{student.status}</span>}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${st.tone}`}>{st.icon} {st.text}</span>
          {!readOnly && !pending && <span className="text-sm text-muted">점수를 누르면 다음 학생으로 넘어가요</span>}
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-12 h-12 rounded-full bg-sky text-navy flex items-center justify-center text-xl font-bold">{student.no}</span>
          <span className="text-xl font-bold flex-1">{name}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${st.tone}`}>{st.icon} {st.text}</span>
        </div>
      )}
      {student.note && <p className="text-sm text-muted text-center">비고: {student.note}</p>}
      {pending && <p className="bg-peach rounded-2xl p-3 text-sm">재평가 대상입니다. 재평가 점수를 누르거나, 재평가가 불가능하면 아래 &quot;재평가 불가&quot;를 누르세요.</p>}

      {!readOnly && (
        <>
          {item.scoring === 'level' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {item.levels?.map((l) => (
                <button key={l.label} className={scoreBtn(score?.levelLabel === l.label)} onClick={() => onScore({ levelLabel: l.label })}>
                  {l.label} <span className="text-sm font-normal">({l.score}점)</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {quickScores(item.minScore, item.maxScore).map((v) => (
                  <button key={v} className={scoreBtn(score?.status === 'normal' && score.value === v)} onClick={() => onScore({ value: v })}>{v}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 min-w-0 min-h-12 rounded-full bg-canvas px-5 text-center text-lg focus:outline-none focus:ring-2 focus:ring-brand-600"
                  type="number" inputMode="decimal" step="any" placeholder={`직접 입력 (${item.minScore}~${item.maxScore})`}
                  value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitTyped()} aria-label="점수 직접 입력" />
                <Button className="rounded-full px-5" onClick={submitTyped} disabled={!typed.trim()}>입력</Button>
              </div>
              {err && <p className="text-red-700 text-sm">{err}</p>}
            </>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button className="min-h-14 rounded-[18px] bg-peach text-[#6B4500] font-semibold inline-flex items-center justify-center gap-2" onClick={onAbsence}>
              <Icon name="ban" /> 결시·미제출
            </button>
            <button className="min-h-14 rounded-[18px] bg-mint text-[#155C38] font-semibold inline-flex items-center justify-center gap-2" onClick={onMemo}>
              <Icon name="note" /> 메모
            </button>
          </div>
          {(pending || score) && (
            <div className="flex gap-2 flex-wrap justify-center">
              {pending && <Button variant="secondary" onClick={onFallback}><Icon name="repeat" /> 재평가 불가 → 규정 처리</Button>}
              {score && <Button variant="ghost" onClick={onClear}>점수 지우기</Button>}
            </div>
          )}
        </>
      )}
      {readOnly && <p className="text-muted text-sm text-center">마감된 학기라 읽기 전용입니다.</p>}
    </div>
  )
}
