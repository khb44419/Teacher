import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { defaultSeteukBands } from '../db/defaults'
import { saveTemplate } from '../db/seteukService'
import { updateRules } from '../db/services'
import { useApp } from '../app/AppContext'
import { planLabel } from '../lib/plans'
import { Button, Card, inputCls } from '../components/ui'
import type { SeteukBand, SeteukTemplate } from '../db/types'
import { HelpButton } from '../components/Help'

/** 표현 여러 개 = 한 줄에 하나. 칸을 벗어나면 저장. */
function PhraseBox({ itemId, level, tpl, readOnly, placeholder }: { itemId: number; level: string; tpl?: SeteukTemplate; readOnly: boolean; placeholder: string }) {
  const initial = (tpl?.phrases ?? []).join('\n')
  const [v, setV] = useState<string | null>(null)
  const n = (v ?? initial).split('\n').filter((x) => x.trim()).length
  return (
    <label className="block">
      <span className="text-sm font-semibold">{level} <span className="font-normal text-gray-500">· 표현 {n}개</span></span>
      <textarea className={`${inputCls} min-h-24 py-2 text-sm`} value={v ?? initial} readOnly={readOnly} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== null && v !== initial) void saveTemplate(itemId, level, v.split('\n')).then(() => setV(null)) }} />
    </label>
  )
}

export function SeteukTemplates() {
  const { semester, detailed } = useApp()
  const [sp, setSp] = useSearchParams()
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const plans = useLiveQuery(async () => (semester?.id ? db.plans.where('semesterId').equals(semester.id).toArray() : []), [semester?.id])
  const planId = Number(sp.get('plan')) || plans?.[0]?.id
  const items = useLiveQuery(async () => (planId ? (await db.items.where('planId').equals(planId).toArray()).filter((i) => i.enabled).sort((a, b) => a.order - b.order) : []), [planId])
  const templates = useLiveQuery(async () => db.seteukTemplates.where('itemId').anyOf([0, ...(items ?? []).map((i) => i.id!)]).toArray(), [items])
  const [bandsDraft, setBandsDraft] = useState<SeteukBand[] | null>(null)
  if (!rules || !plans || !items || !templates) return null
  const readOnly = semester?.status === 'closed'
  const bands = bandsDraft ?? rules.seteukBands ?? defaultSeteukBands()
  const tplOf = (itemId: number, level: string) => templates.find((t) => t.itemId === itemId && t.levelLabel === level)
  const saveBands = (b: SeteukBand[]) => {
    setBandsDraft(null)
    void updateRules({ seteukBands: b }, [{ target: '규정 설정 · 세특 문구 구간', detail: '세특 문구 구간', before: bands.map((x) => `${x.label}≥${x.minRatio}%`).join(', '), after: b.map((x) => `${x.label}≥${x.minRatio}%`).join(', ') }])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/seteuk" className="text-brand-700 min-h-11 leading-[44px]">← 세특</Link>
        <h1 className="text-xl font-bold flex-1">🧩 세특 문구 템플릿</h1>
        <HelpButton topic="templates" />
      </div>
      <Card className="text-sm space-y-1">
        <p>평가 항목·수준별로 문장을 적어 두면, 학생의 점수 수준에 맞는 문장이 골라져 초안이 됩니다. <b>한 줄에 표현 하나</b>씩, 여러 개 적을수록 같은 반 학생들의 문장이 덜 겹칩니다.</p>
        <p><code className="bg-gray-100 px-1">{'{항목}'}</code>이라고 쓰면 항목 이름으로 바뀝니다. 템플릿은 평가 항목에 붙어 있어서 계획을 다음 학기로 불러오면 함께 복사됩니다.</p>
        <p className="text-gray-600">학생부에는 교사가 관찰한 내용을 적어야 하므로, 학생이 쓴 글을 그대로 옮기는 기능은 없습니다.</p>
      </Card>

      <select className={inputCls} value={planId ?? ''} onChange={(e) => setSp({ plan: e.target.value })} aria-label="평가 계획 선택">
        {plans.map((p) => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}
      </select>
      {!plans.length && <Card>평가 계획이 없습니다. <Link to="/plans" className="text-brand-700 underline">평가 계획 만들기 →</Link></Card>}

      {detailed && <Card className="space-y-2">
        <h2 className="font-bold">점수형 항목의 수준 구간</h2>
        <p className="text-sm text-gray-600">득점률(점수/만점)이 기준 이상이면 그 수준의 문장을 씁니다. 수준형 항목은 항목의 수준 이름을 그대로 씁니다.</p>
        {bands.map((b, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className={inputCls} value={b.label} disabled={readOnly} aria-label="구간 이름"
              onChange={(e) => setBandsDraft(bands.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
            <input className={inputCls} type="number" value={b.minRatio} disabled={readOnly} aria-label="최소 득점률"
              onChange={(e) => setBandsDraft(bands.map((x, k) => (k === i ? { ...x, minRatio: +e.target.value } : x)))} />
            <span className="whitespace-nowrap">% 이상</span>
            {!readOnly && <Button variant="ghost" onClick={() => setBandsDraft(bands.filter((_, k) => k !== i))} aria-label="구간 삭제">✕</Button>}
          </div>
        ))}
        {!readOnly && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setBandsDraft([...bands, { label: '', minRatio: 0 }])}>＋ 구간</Button>
            {bandsDraft && <Button onClick={() => saveBands(bandsDraft.filter((b) => b.label.trim()))}>구간 저장</Button>}
            <Button variant="ghost" onClick={() => saveBands(defaultSeteukBands())}>기본값(상 80 / 중 60 / 하 0)</Button>
          </div>
        )}
      </Card>}

      {items.map((it) => {
        const levels = it.scoring === 'level' ? (it.levels ?? []).map((l) => l.label) : (rules.seteukBands ?? defaultSeteukBands()).map((b) => b.label)
        return (
          <Card key={it.id} className="space-y-2">
            <h2 className="font-bold">{it.name} <span className="text-sm font-normal text-gray-600">({it.scoring === 'level' ? '수준형' : '점수형'})</span></h2>
            {it.rubric && <p className="text-xs text-gray-600 whitespace-pre-line">평가 기준: {it.rubric}</p>}
            <div className="grid md:grid-cols-3 gap-3">
              {levels.map((lv) => (
                <PhraseBox key={`${it.id}-${lv}`} itemId={it.id!} level={lv} tpl={tplOf(it.id!, lv)} readOnly={readOnly}
                  placeholder={`예: {항목}에서 ${lv === levels[0] ? '음정과 박자가 정확하고 표현이 풍부함' : '꾸준히 연습하여 향상된 모습을 보임'}`} />
              ))}
            </div>
          </Card>
        )
      })}

      <Card className="space-y-2">
        <h2 className="font-bold">관찰 메모 태그 문구</h2>
        <p className="text-sm text-gray-600">학생의 관찰 메모에 이 태그가 있으면 문장 하나가 덧붙습니다.</p>
        <div className="grid md:grid-cols-3 gap-3">
          {rules.memoTags.map((t) => (
            <PhraseBox key={t} itemId={0} level={t} tpl={tplOf(0, t)} readOnly={readOnly} placeholder={`예: 모둠 활동에서 ${t}하는 모습을 보임`} />
          ))}
        </div>
      </Card>
    </div>
  )
}
