import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteItem, deletePlan, itemToDraft, libraryToDraft, moveItem, saveToLibrary, updateItem } from '../db/planService'
import { useApp } from '../app/AppContext'
import { performanceRatio, planLabel, weightSum, type ItemDraft } from '../lib/plans'
import { Button, Card, Modal, useConfirm } from '../components/ui'
import { ItemEditor } from '../components/ItemEditor'
import { LibraryDialog } from '../components/LibraryDialog'
import type { AssessmentItem } from '../db/types'
import { HelpButton } from '../components/Help'
import { Icon } from '../components/Icon'

export function PlanDetail() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const { semester, detailed } = useApp()
  const { ask, dialog } = useConfirm()
  const plan = useLiveQuery(() => db.plans.get(id), [id])
  const planSem = useLiveQuery(() => (plan ? db.semesters.get(plan.semesterId) : undefined), [plan?.semesterId])
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const items = useLiveQuery(async () => (await db.items.where('planId').equals(id).toArray()).sort((a, b) => a.order - b.order), [id])
  const scoreCounts = useLiveQuery(async () => {
    const m: Record<number, number> = {}
    for (const i of items ?? []) m[i.id!] = await db.scores.where('itemId').equals(i.id!).count()
    return m
  }, [items])
  const classCount = useLiveQuery(
    async () => (plan ? (await db.classes.where('semesterId').equals(plan.semesterId).toArray())
      .filter((c) => c.level === plan.level && c.grade === plan.grade && c.subject === plan.subject).length : 0),
    [plan],
  )
  const [editing, setEditing] = useState<{ item?: AssessmentItem; initial?: ItemDraft } | null>(null)
  const [lib, setLib] = useState(false)
  const [delTarget, setDelTarget] = useState<AssessmentItem | null>(null)
  const [err, setErr] = useState('')
  if (!plan || !items) return null

  const readOnly = (planSem ?? semester)?.status === 'closed'
  const sum = weightSum(items)
  const perf = performanceRatio(items)
  const minPerf = rules?.minPerformanceRatio ?? null
  const run = async (f: () => Promise<unknown>) => {
    try { setErr(''); await f() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/plans" className="text-brand-700 min-h-11 leading-[44px]">← 평가 계획</Link>
        <h1 className="text-xl font-bold flex-1">{planLabel(plan)}</h1>
        <HelpButton topic="plans" />
      </div>
      <p className="text-sm text-muted">
        {plan.level === '중' ? '중학교' : '고등학교'} {plan.grade}학년 {classCount}개 학급에 자동 적용됩니다.
        {readOnly && <b> 마감된 학기라 읽기 전용입니다.</b>}
      </p>
      {err && <p className="bg-[#FDECEC] text-red-700 rounded-2xl p-3 text-sm">{err}</p>}

      {sum !== 100 && (
        <p className="bg-peach rounded-2xl p-3 text-sm font-semibold">
          ⚠ 반영 비율 합이 {sum}%입니다 (100%가 아닙니다). 저장은 되지만 총점 계산 전에 확인하세요.
        </p>
      )}
      {minPerf !== null && perf < minPerf && (
        <p className="bg-peach rounded-2xl p-3 text-sm font-semibold">
          ⚠ 수행평가(정기시험 제외) 반영 비율이 {perf}%로, 규정 설정의 최소 반영 비율 {minPerf}%보다 낮습니다.
        </p>
      )}

      <Card className="p-0 overflow-hidden">
        {items.length === 0 && <p className="p-4 text-muted">아직 항목이 없습니다. 아래에서 추가하세요.</p>}
        <ul>
          {items.map((it, idx) => {
            const n = scoreCounts?.[it.id!] ?? 0
            return (
              <li key={it.id} className={`border-b last:border-b-0 p-3 flex gap-2 items-start ${it.enabled ? '' : 'bg-canvas text-muted'}`}>
                {!readOnly && (
                  <div className="flex flex-col">
                    <Button variant="ghost" className="min-h-9 px-2" disabled={idx === 0} aria-label="위로" onClick={() => run(() => moveItem(it.id!, -1))}>▲</Button>
                    <Button variant="ghost" className="min-h-9 px-2" disabled={idx === items.length - 1} aria-label="아래로" onClick={() => run(() => moveItem(it.id!, 1))}>▼</Button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {idx + 1}. {it.name} {!it.enabled && <span className="text-xs border rounded px-1">사용 안 함</span>}
                  </div>
                  <div className="text-sm">
                    {it.type} · {it.scoring === 'score' ? '점수형' : `수준형(${it.levels?.map((l) => l.label).join('/')})`} · 만점 {it.maxScore} · 최저 {it.minScore} · <b>반영 {it.weight}%</b>
                  </div>
                  {(it.startDate || it.endDate) && <div className="text-xs">예정 {it.startDate ?? ''} ~ {it.endDate ?? ''}</div>}
                  {n > 0 && <div className="text-xs text-brand-700">입력된 점수 {n}건</div>}
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                  <Button variant="secondary" onClick={() => setEditing({ item: it })}>{readOnly ? '보기' : '수정'}</Button>
                  {!readOnly && (
                    <>
                      {detailed && <Button variant="ghost" title="보관함에 저장" onClick={() => void saveToLibrary(it).then(() => setErr(''))}><Icon name="folder" /> 보관</Button>}
                      <Button variant="ghost" onClick={() => setDelTarget(it)}><Icon name="trash" /> </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="p-3 bg-canvas text-right font-semibold">반영 비율 합계 {sum}%</div>
      </Card>

      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setEditing({})}>＋ 새 항목</Button>
          {detailed && <Button variant="secondary" onClick={() => setLib(true)}><Icon name="folder" /> 보관함에서 추가</Button>}
          <Button variant="danger" className="ml-auto" onClick={async () => {
            const n = (await Promise.all(items.map((i) => db.scores.where('itemId').equals(i.id!).count()))).reduce((a, b) => a + b, 0)
            ask(`"${planLabel(plan)}" 계획과 항목 ${items.length}개를 삭제합니다.` + (n ? `\n⚠ 입력된 점수 ${n}건도 함께 삭제됩니다.` : '') + '\n되돌릴 수 없습니다.',
              () => void run(async () => { await deletePlan(id); nav('/plans') }), '계획 삭제')
          }}>이 계획 삭제</Button>
        </div>
      )}

      {editing && <ItemEditor planId={id} item={editing.item} initial={editing.initial} readOnly={readOnly} onClose={() => setEditing(null)} />}
      {lib && <LibraryDialog onClose={() => setLib(false)} onPick={(l) => setEditing({ initial: libraryToDraft(l) })} />}

      {delTarget && (
        <Modal title="항목 삭제" onClose={() => setDelTarget(null)}>
          <DeleteBody item={delTarget} onCancel={() => setDelTarget(null)}
            onHide={() => run(async () => { await updateItem(delTarget.id!, { ...itemToDraft(delTarget), enabled: false }); setDelTarget(null) })}
            onDelete={() => run(async () => { await deleteItem(delTarget.id!); setDelTarget(null) })} />
        </Modal>
      )}
      {dialog}
    </div>
  )
}

function DeleteBody({ item, onCancel, onHide, onDelete }: { item: AssessmentItem; onCancel: () => void; onHide: () => void; onDelete: () => void }) {
  const n = useLiveQuery(() => db.scores.where('itemId').equals(item.id!).count(), [item.id])
  if (n === undefined) return null
  return (
    <div className="space-y-3">
      {n > 0 ? (
        <>
          <p>&quot;{item.name}&quot;에는 <b>점수 {n}건</b>이 입력되어 있습니다. 삭제하면 점수도 함께 사라지고 되돌릴 수 없습니다.</p>
          <p className="text-sm text-muted">지우지 않고 숨기려면 &quot;사용 안 함&quot;을 선택하세요. 점수는 남고 합산·입력 화면에서만 빠집니다.</p>
          <Button className="w-full" onClick={onHide}>삭제하지 않고 &quot;사용 안 함&quot;으로 숨기기 (추천)</Button>
        </>
      ) : (
        <p>&quot;{item.name}&quot; 항목을 삭제합니다. 입력된 점수는 없습니다.</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>취소</Button>
        <Button variant="danger" onClick={onDelete}>{n > 0 ? '점수까지 모두 삭제' : '삭제'}</Button>
      </div>
    </div>
  )
}
