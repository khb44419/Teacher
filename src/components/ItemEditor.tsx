import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addItem, affectedStudentCount, itemScoreCount, updateItem, usedLevelLabels } from '../db/planService'
import { defaultLevels, itemErrors, type ItemDraft } from '../lib/plans'
import type { AssessmentItem, LevelDef } from '../db/types'
import { Button, Field, Modal, inputCls } from './ui'
import { Icon } from './Icon'

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

interface Props {
  planId: number
  item?: AssessmentItem // 있으면 수정, 없으면 새 항목
  initial?: ItemDraft // 보관함에서 가져온 값 등
  readOnly?: boolean
  onClose: () => void
}

export function ItemEditor({ planId, item, initial, readOnly, onClose }: Props) {
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const src = item ?? initial
  const [name, setName] = useState(src?.name ?? '')
  const [type, setType] = useState(src?.type ?? '실기')
  const [scoring, setScoring] = useState<'score' | 'level'>(src?.scoring ?? 'score')
  const [max, setMax] = useState(String(src?.maxScore ?? 20))
  const [min, setMin] = useState(String(src?.minScore ?? 0))
  const [weight, setWeight] = useState(String(src?.weight ?? 0))
  const [levels, setLevels] = useState<{ label: string; score: string }[]>(
    (src?.levels ?? []).map((l) => ({ label: l.label, score: String(l.score) })),
  )
  const [rubric, setRubric] = useState(src?.rubric ?? '')
  const [start, setStart] = useState(src?.startDate ?? '')
  const [end, setEnd] = useState(src?.endDate ?? '')
  const [enabled, setEnabled] = useState(src?.enabled ?? true)
  const [errors, setErrors] = useState<string[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | { n: number; aff: number; maxChanged: boolean; weightChanged: boolean }>(null)
  const [rescale, setRescale] = useState<boolean | null>(null)

  const types = rules ? (rules.itemTypes.includes(type) ? rules.itemTypes : [...rules.itemTypes, type]) : [type]
  const draft = (): ItemDraft => ({
    name: name.trim(), type, scoring, maxScore: num(max), minScore: num(min), weight: num(weight),
    levels: scoring === 'level' ? levels.map((l): LevelDef => ({ label: l.label.trim(), score: num(l.score) })) : undefined,
    rubric, startDate: start || undefined, endDate: end || undefined, enabled,
  })

  const commit = async (rs: boolean) => {
    try {
      if (item) await updateItem(item.id!, draft(), { rescale: rs })
      else await addItem(planId, draft())
      onClose()
    } catch (e) {
      setErrors([(e as Error).message])
    }
  }

  const save = async () => {
    const d = draft()
    const errs = itemErrors(d)
    if (item?.id) {
      const n = await itemScoreCount(item.id)
      if (n > 0 && item.scoring !== d.scoring)
        errs.push('점수가 입력된 항목은 채점 방식(점수형/수준형)을 바꿀 수 없습니다. 새 항목을 만들어 주세요.')
      if (n > 0 && d.scoring === 'level') {
        const used = await usedLevelLabels(item.id)
        const now = new Set((d.levels ?? []).map((l) => l.label))
        const lost = [...used].filter((u) => !now.has(u))
        if (lost.length) errs.push(`이미 점수가 입력된 수준(${lost.join(', ')})은 삭제하거나 이름을 바꿀 수 없습니다.`)
      }
    }
    setErrors(errs)
    if (errs.some((e) => /최저점|기간/.test(e))) setMoreOpen(true)
    if (errs.length) return
    if (item?.id) {
      const n = await itemScoreCount(item.id)
      const maxChanged = d.scoring === 'score' && d.maxScore !== item.maxScore
      const weightChanged = d.weight !== item.weight
      if (n > 0 && (maxChanged || weightChanged)) {
        setConfirm({ n, aff: await affectedStudentCount(item.id), maxChanged, weightChanged })
        return
      }
    }
    await commit(false)
  }

  return (
    <Modal title={item ? '평가 항목 수정' : '새 평가 항목'} onClose={onClose}>
      <fieldset disabled={readOnly} className="space-y-3">
        <Field label="① 항목 이름"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 리코더 연주" /></Field>
        <div>
          <span className="block text-sm font-semibold mb-1">② 어떻게 매기나요?</span>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={scoring === 'score' ? 'primary' : 'secondary'} className="min-h-14" onClick={() => setScoring('score')}><Icon name="hash" /> 점수로</Button>
            <Button variant={scoring === 'level' ? 'primary' : 'secondary'} className="min-h-14" onClick={() => {
              setScoring('level')
              if (levels.length === 0) setLevels(defaultLevels(num(max) || 20).map((l) => ({ label: l.label, score: String(l.score) })))
            }}>🅰️ 상·중·하로</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="③ 만점"><input className={inputCls} type="number" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
          <Field label="④ 반영 비율(%)" hint="성적에서 차지하는 비중"><input className={inputCls} type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        </div>
        {scoring === 'level' && (
          <div className="border rounded-2xl p-3 space-y-2">
            <div className="font-semibold text-sm">수준과 환산 점수</div>
            {levels.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={inputCls} placeholder="수준 이름" value={l.label} onChange={(e) => setLevels(levels.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                <input className={inputCls} type="number" inputMode="decimal" placeholder="환산 점수" value={l.score} onChange={(e) => setLevels(levels.map((x, k) => (k === i ? { ...x, score: e.target.value } : x)))} />
                <Button variant="ghost" aria-label="수준 삭제" onClick={() => setLevels(levels.filter((_, k) => k !== i))}>✕</Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setLevels([...levels, { label: '', score: '' }])}>＋ 수준 추가</Button>
          </div>
        )}
        <details open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)} className="border rounded-2xl">
          <summary className="cursor-pointer min-h-12 py-3 px-3 font-semibold text-brand-700">더 보기 (평가 유형, 기본 점수, 평가 기준, 평가 기간, 사용 여부)</summary>
          <div className="space-y-3 p-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <Field label="평가 유형">
                <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="기본 점수(최저점)" hint="참여만 해도 주는 최저 점수"><input className={inputCls} type="number" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
            </div>
            <Field label="평가 기준 (루브릭)"><textarea className={`${inputCls} min-h-24 py-2`} value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="상: …&#10;중: …&#10;하: …" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="평가 예정 시작일"><input className={inputCls} type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="평가 예정 종료일"><input className={inputCls} type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 min-h-11">
              <input type="checkbox" className="w-5 h-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              사용 (끄면 점수 입력·합산에서 숨겨집니다. 입력된 점수는 남습니다)
            </label>
          </div>
        </details>
      </fieldset>

      {errors.length > 0 && (
        <ul className="mt-3 bg-[#FDECEC] text-red-700 rounded-2xl p-3 text-sm list-disc pl-6">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      {confirm && item && (
        <div className="mt-3 bg-peach rounded-2xl p-3 space-y-2 text-sm">
          <p className="font-bold">이미 점수가 입력된 항목입니다 ({confirm.n}건, 학생 {confirm.aff}명)</p>
          {confirm.weightChanged && (
            <p>• 반영 비율 {item.weight}% → {num(weight)}%: 총점이 <b>바로 바뀌는 학생 {confirm.aff}명</b> (점수가 입력된 학생 기준)</p>
          )}
          {confirm.maxChanged && (
            <div>
              <p>• 만점 {item.maxScore} → {num(max)}: 기존 점수를 어떻게 할까요?</p>
              <label className="flex items-center gap-2 min-h-11">
                <input type="radio" name="rs" className="w-5 h-5" checked={rescale === true} onChange={() => setRescale(true)} />
                비율대로 환산 (예: 15/{item.maxScore} → {Math.round((15 / item.maxScore) * num(max) * 100) / 100}/{num(max)})
              </label>
              <label className="flex items-center gap-2 min-h-11">
                <input type="radio" name="rs" className="w-5 h-5" checked={rescale === false} onChange={() => setRescale(false)} />
                그대로 유지 (점수 숫자는 바꾸지 않음)
              </label>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirm(null)}>돌아가기</Button>
            <Button disabled={confirm.maxChanged && rescale === null} onClick={() => void commit(rescale === true)}>변경 저장</Button>
          </div>
        </div>
      )}

      {!confirm && (
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="secondary" onClick={onClose}>{readOnly ? '닫기' : '취소'}</Button>
          {!readOnly && <Button onClick={() => void save()}>저장</Button>}
        </div>
      )}
    </Modal>
  )
}
