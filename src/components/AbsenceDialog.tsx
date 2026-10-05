import { useState } from 'react'
import type { AbsenceCategory, AbsenceReason, RuleSettings } from '../db/types'
import { Button, Modal, inputCls } from './ui'

const groups: { cat: AbsenceCategory; icon: string; name: string; desc: string }[] = [
  { cat: 'approved', icon: '🏥', name: '인정 결석', desc: '질병, 경조사, 감염병, 공적 업무 등' },
  { cat: 'unapproved', icon: '🚫', name: '미인정 결석', desc: '인정되지 않는 결석' },
  { cat: 'nosubmit', icon: '📄', name: '미제출·미응시', desc: '왔지만 하지 않음, 과제 안 냄' },
]

/**
 * 결석·미제출 처리. 큰 버튼 3개 중 하나를 고르고, 그 안에 사유가 여러 개일 때만 세부 사유를 고름.
 * mode='fallback'이면 '재평가 불가'의 사유 선택(규정의 대체 처리 적용).
 */
export function AbsenceDialog({ rules, title, mode = 'absence', onPick, onReassessOnly, onClose }: {
  rules: RuleSettings
  title: string
  mode?: 'absence' | 'fallback'
  onPick: (r: AbsenceReason, note: string) => void
  onReassessOnly?: () => void
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [cat, setCat] = useState<AbsenceCategory | null>(null)
  const list = (c: AbsenceCategory) => rules.absenceReasons.filter((r) => r.category === c)
  const choose = (c: AbsenceCategory) => {
    const l = list(c)
    if (l.length === 1) onPick(l[0], note)
    else setCat(c)
  }
  const g = groups.find((x) => x.cat === cat)

  return (
    <Modal title={title} onClose={onClose}>
      {!cat ? (
        <div className="space-y-2">
          <p className="text-gray-700">
            {mode === 'fallback' ? '재평가를 할 수 없는 이유를 골라 주세요. 학교 규정대로 점수가 자동으로 정해집니다.' : '어떤 경우인가요? 고르면 학교 규정대로 자동 처리됩니다.'}
          </p>
          {groups.filter((x) => list(x.cat).length > 0).map((x) => (
            <button key={x.cat} onClick={() => choose(x.cat)}
              className="w-full flex items-center gap-3 min-h-16 px-4 rounded-xl border-2 border-gray-300 bg-white hover:bg-brand-50 text-left">
              <span className="text-3xl" aria-hidden>{x.icon}</span>
              <span className="flex-1"><span className="block text-lg font-bold">{x.name}</span><span className="block text-sm text-gray-600">{x.desc}</span></span>
              {list(x.cat).length > 1 && <span aria-hidden>›</span>}
            </button>
          ))}
          {mode === 'absence' && onReassessOnly && (
            <button onClick={onReassessOnly}
              className="w-full flex items-center gap-3 min-h-16 px-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 text-left">
              <span className="text-3xl" aria-hidden>🔁</span>
              <span className="flex-1"><span className="block text-lg font-bold">나중에 다시 평가 (재평가)</span><span className="block text-sm text-gray-600">사유는 나중에 정해도 됩니다</span></span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Button variant="ghost" onClick={() => setCat(null)}>← 뒤로</Button>
          <p className="font-bold text-lg">{g?.icon} {g?.name} · 사유를 골라 주세요</p>
          <div className="grid grid-cols-2 gap-2">
            {list(cat).map((r) => (
              <Button key={r.id} variant="secondary" className="min-h-16 text-lg" onClick={() => onPick(r, note)}>{r.label}</Button>
            ))}
          </div>
        </div>
      )}
      <input className={`${inputCls} mt-3`} placeholder="메모 (선택, 예: 병원 진료확인서 제출)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  )
}
