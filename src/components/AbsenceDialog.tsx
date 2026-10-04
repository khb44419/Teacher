import type { AbsenceReason, RuleSettings } from '../db/types'
import { useState } from 'react'
import { Button, Modal, inputCls } from './ui'

const groups = [
  ['approved', '인정결시'],
  ['unapproved', '미인정결시'],
  ['nosubmit', '미응시·미제출'],
] as const

/**
 * 결시 사유 선택. mode='fallback'이면 '재평가 불가'의 사유 선택(대체 처리 적용).
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
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-3">
        {mode === 'fallback'
          ? '재평가가 불가능한 사유를 고르면 규정 설정의 대체 처리(인정점 등)가 적용됩니다.'
          : '사유를 고르면 규정 설정에 따라 자동 처리됩니다.'}
      </p>
      {groups.map(([cat, name]) => {
        const list = rules.absenceReasons.filter((r) => r.category === cat)
        if (!list.length) return null
        return (
          <div key={cat} className="mb-3">
            <div className="font-semibold text-sm mb-1">{name}</div>
            <div className="grid grid-cols-2 gap-2">
              {list.map((r) => (
                <Button key={r.id} variant="secondary" className="min-h-14" onClick={() => onPick(r, note)}>{r.label}</Button>
              ))}
            </div>
          </div>
        )
      })}
      {mode === 'absence' && onReassessOnly && (
        <Button variant="secondary" className="w-full min-h-14 mb-3" onClick={onReassessOnly}>🔁 재평가 예정으로만 표시 (사유는 나중에)</Button>
      )}
      <input className={inputCls} placeholder="사유 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  )
}
