import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { copyPlan } from '../db/planService'
import { planLabel } from '../lib/plans'
import type { SchoolLevel } from '../db/types'
import { Button, Modal, inputCls } from './ui'

/**
 * 다른 학기(또는 같은 학기 다른 학년)의 평가 계획을 현재 학기로 복사.
 * 원본은 바뀌지 않음. 각 줄에서 복사할 곳(학교급·학년)을 바꿀 수 있어 '다른 학년 계획 복사'도 겸함.
 */
export function CopyPlansDialog({ semesterId, onClose }: { semesterId: number; onClose: () => void }) {
  const semesters = useLiveQuery(() => db.semesters.toArray(), [])
  const [srcId, setSrcId] = useState<number | null>(null)
  const sorted = [...(semesters ?? [])].sort((a, b) => b.year - a.year || b.term - a.term)
  // 기본 원본: 현재 학기가 아닌 가장 최근 학기, 없으면 현재 학기
  const defaultSrc = (sorted.find((s) => s.id !== semesterId) ?? sorted[0])?.id
  const src = srcId ?? defaultSrc
  const plans = useLiveQuery(async () => {
    if (!src) return []
    const ps = await db.plans.where('semesterId').equals(src).toArray()
    const counts = await Promise.all(ps.map((p) => db.items.where('planId').equals(p.id!).count()))
    return ps.map((p, i) => ({ ...p, count: counts[i] }))
  }, [src])
  const [pick, setPick] = useState<Record<number, { on: boolean; level: SchoolLevel; grade: number }>>({})
  const [result, setResult] = useState('')

  const row = (p: NonNullable<typeof plans>[number]) => pick[p.id!] ?? { on: true, level: p.level, grade: p.grade }

  const run = async () => {
    let done = 0, skipped = 0
    for (const p of plans ?? []) {
      const r = row(p)
      if (!r.on) continue
      const res = await copyPlan(p.id!, { semesterId, level: r.level, grade: r.grade, subject: p.subject })
      res.existed ? skipped++ : done++
    }
    setResult(`${done}개 계획을 불러왔습니다.` + (skipped ? ` (이미 있는 ${skipped}개는 건너뜀)` : ''))
  }

  return (
    <Modal title="📥 다른 평가 계획 불러오기" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-3">
        불러온 뒤 바뀐 부분만 고치세요. <b>원본은 바뀌지 않으며</b>, 점수는 가져오지 않고 평가 예정 기간은 비워집니다. 항목에 연결된 세특 문구 템플릿은 함께 복사됩니다.
      </p>
      <label className="block text-sm font-semibold mb-1">어느 학기에서 불러올까요?</label>
      <select className={`${inputCls} mb-3`} value={src ?? ''} onChange={(e) => { setSrcId(+e.target.value); setPick({}) }}>
        {sorted.map((s) => (
          <option key={s.id} value={s.id}>{s.year}학년도 {s.term}학기{s.id === semesterId ? ' (지금 학기)' : ''}</option>
        ))}
      </select>
      {!plans?.length && <p className="text-gray-600">이 학기에는 평가 계획이 없습니다.</p>}
      <ul className="space-y-2">
        {plans?.map((p) => {
          const r = row(p)
          const set = (x: Partial<typeof r>) => setPick({ ...pick, [p.id!]: { ...r, ...x } })
          return (
            <li key={p.id} className="border rounded-lg p-2 flex items-center gap-2 flex-wrap">
              <input type="checkbox" className="w-5 h-5" checked={r.on} onChange={(e) => set({ on: e.target.checked })} aria-label={`${planLabel(p)} 선택`} />
              <span className="flex-1 min-w-32">
                {planLabel(p)} <span className="text-xs text-gray-500">(항목 {p.count}개)</span>
              </span>
              <span className="text-sm">→</span>
              <select className="min-h-11 border rounded-lg px-2" value={r.level} onChange={(e) => set({ level: e.target.value as SchoolLevel })}>
                <option value="중">중</option><option value="고">고</option>
              </select>
              <select className="min-h-11 border rounded-lg px-2" value={r.grade} onChange={(e) => set({ grade: +e.target.value })}>
                {[1, 2, 3].map((g) => <option key={g} value={g}>{g}학년</option>)}
              </select>
            </li>
          )
        })}
      </ul>
      {result && <p className="text-green-700 mt-3">✅ {result}</p>}
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>닫기</Button>
        <Button onClick={() => void run()} disabled={!plans?.some((p) => row(p).on)}>선택한 계획 불러오기</Button>
      </div>
    </Modal>
  )
}
