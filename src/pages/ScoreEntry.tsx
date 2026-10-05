import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../app/AppContext'
import { classLabel, classSort } from '../lib/classLabel'
import { planLabel } from '../lib/plans'
import { clearScore, enterAbsence, enterScore, markReassess, reassessImpossible, undo, type UndoEntry } from '../db/scoreService'
import { undoStore, useUndoEntries } from '../lib/undoStore'
import { ScoreCard, scoreText } from '../components/ScoreCard'
import { AbsenceDialog } from '../components/AbsenceDialog'
import { QuickMemo } from '../components/QuickMemo'
import { studentLabel } from '../components/StudentName'
import { Button, Card, Modal } from '../components/ui'
import type { AssessmentItem, SchoolClass, Score, Student } from '../db/types'
import { HelpButton } from '../components/Help'
import { Icon } from '../components/Icon'

/** 완료 = 점수·수준 입력 또는 결시 처리됨 (재평가 대기는 미완료) */
export const isDone = (s?: Score) => !!s && s.status !== 'reassess'
const activeStudents = (list: Student[]) => list.filter((s) => s.status !== '전출')

export function ScoreEntry() {
  const [sp, setSp] = useSearchParams()
  const classId = Number(sp.get('class')) || undefined
  const itemId = Number(sp.get('item')) || undefined
  const { semester } = useApp()
  const cls = useLiveQuery(() => (classId ? db.classes.get(classId) : undefined), [classId])
  const item = useLiveQuery(() => (itemId ? db.items.get(itemId) : undefined), [itemId])
  const go = (p: Record<string, string | number | undefined>) => {
    const n = new URLSearchParams(sp)
    Object.entries(p).forEach(([k, v]) => (v === undefined ? n.delete(k) : n.set(k, String(v))))
    setSp(n)
  }

  if (!classId || !cls) return <ClassPicker semesterId={semester?.id} onPick={(c) => go({ class: c, item: undefined })} />
  if (!itemId || !item) return <ItemPicker cls={cls} onPick={(i) => go({ item: i })} onBack={() => go({ class: undefined })} />
  const f = sp.get('filter')
  return <Entry key={`${cls.id}-${item.id}`} cls={cls} item={item} mode={sp.get('mode') === 'table' ? 'table' : 'seq'} initialFilter={f === 'reassess' || f === 'missing' ? f : 'all'}
    setMode={(m) => go({ mode: m })} onBack={() => go({ item: undefined, mode: undefined, filter: undefined })} />
}

function ClassPicker({ semesterId, onPick }: { semesterId?: number; onPick: (id: number) => void }) {
  const classes = useLiveQuery(async () => (semesterId ? (await db.classes.where('semesterId').equals(semesterId).toArray()).sort(classSort) : []), [semesterId])
  const groups = new Map<string, SchoolClass[]>()
  classes?.forEach((c) => {
    const k = `${c.level === '중' ? '중학교' : '고등학교'} ${c.grade}학년`
    groups.set(k, [...(groups.get(k) ?? []), c])
  })
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">점수 입력 · 학급 선택</h1>
        <HelpButton topic="score" />
      </div>
      {classes?.length === 0 && <Card>학급이 없습니다. 설정 → 학급·학생 관리에서 먼저 만드세요.</Card>}
      {[...groups].map(([name, list]) => (
        <Card key={name}>
          <h2 className="font-bold mb-2">{name}</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {list.map((c) => (
              <Button key={c.id} variant="secondary" className="min-h-14 text-lg rounded-[18px]" onClick={() => onPick(c.id!)}>{c.classNo}반</Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function ItemPicker({ cls, onPick, onBack }: { cls: SchoolClass; onPick: (id: number) => void; onBack: () => void }) {
  const data = useLiveQuery(async () => {
    const plan = await db.plans.where('semesterId').equals(cls.semesterId)
      .filter((p) => p.level === cls.level && p.grade === cls.grade && p.subject === cls.subject).first()
    if (!plan) return { plan: undefined, items: [] }
    const items = (await db.items.where('planId').equals(plan.id!).toArray()).filter((i) => i.enabled).sort((a, b) => a.order - b.order)
    const students = activeStudents(await db.students.where('classId').equals(cls.id!).toArray())
    const ids = new Set(students.map((s) => s.id!))
    const stats = await Promise.all(items.map(async (i) => {
      const sc = (await db.scores.where('itemId').equals(i.id!).toArray()).filter((s) => ids.has(s.studentId))
      return { done: sc.filter(isDone).length, reassess: sc.filter((s) => s.status === 'reassess').length }
    }))
    return { plan, items: items.map((i, k) => ({ ...i, ...stats[k] })), total: students.length }
  }, [cls.id])
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="학급 고르기로 돌아가기" className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"><Icon name="back" /></button>
        <h1 className="text-xl font-bold flex-1">{classLabel(cls)} · 평가 항목 선택</h1>
        <HelpButton topic="score" />
      </div>
      {data && !data.plan && (
        <Card>
          이 학년({cls.level}{cls.grade}학년 {cls.subject})의 평가 계획이 없습니다.{' '}
          <Link to="/plans" className="text-brand-700 underline">평가 계획 만들기 →</Link>
        </Card>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {data?.items.map((i) => {
          const status = i.done === data.total && data.total > 0 ? '완료' : i.done > 0 || i.reassess > 0 ? '진행중' : '미시작'
          const tone = status === '완료' ? 'bg-mint' : status === '진행중' ? 'bg-peach' : 'bg-white shadow-sm'
          return (
            <button key={i.id} onClick={() => onPick(i.id!)} className={`text-left rounded-[22px] p-4 min-h-20 ${tone}`}>
              <div className="font-bold text-lg">{i.name}</div>
              <div className="text-sm">{status} · {i.done}/{data.total}명{i.reassess > 0 && ` · 재평가 대기 ${i.reassess}명`}</div>
              <div className="text-xs text-muted">{i.type} · {i.scoring === 'score' ? `만점 ${i.maxScore}` : '수준형'} · 반영 {i.weight}%</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Dialog = { kind: 'absence' | 'fallback' | 'memo' | 'edit'; student: Student } | null

function Entry({ cls, item, mode, initialFilter, setMode, onBack }: { cls: SchoolClass; item: AssessmentItem; mode: 'seq' | 'table'; initialFilter: 'all' | 'missing' | 'reassess'; setMode: (m: 'seq' | 'table') => void; onBack: () => void }) {
  const { hideNames } = useApp()
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const plan = useLiveQuery(() => db.plans.get(item.planId), [item.planId])
  const sem = useLiveQuery(() => db.semesters.get(cls.semesterId), [cls.semesterId])
  const students = useLiveQuery(() => db.students.where('classId').equals(cls.id!).sortBy('no'), [cls.id])
  const scores = useLiveQuery(async () => {
    const ids = new Set((await db.students.where('classId').equals(cls.id!).primaryKeys()) as number[])
    const m = new Map<number, Score>()
    ;(await db.scores.where('itemId').equals(item.id!).toArray()).forEach((s) => ids.has(s.studentId) && m.set(s.studentId, s))
    return m
  }, [cls.id, item.id])
  const [idx, setIdx] = useState(0)
  useUndoEntries() // 되돌리기 기록이 바뀌면 다시 그림
  const [dialog, setDialog] = useState<Dialog>(null)
  const [filter, setFilter] = useState<'all' | 'missing' | 'reassess'>(initialFilter)
  const [msg, setMsg] = useState('')
  const active = useMemo(() => activeStudents(students ?? []), [students])
  if (!students || !scores || !rules || !plan) return null

  const readOnly = sem?.status === 'closed'
  const classIds = new Set(students.map((s) => s.id!))
  const done = active.filter((s) => isDone(scores.get(s.id!))).length
  const reassessCount = active.filter((s) => scores.get(s.id!)?.status === 'reassess').length
  const cur = active[Math.min(idx, active.length - 1)]

  const act = async (fn: () => Promise<UndoEntry>, advance: boolean) => {
    try {
      const u = await fn()
      undoStore.push(u) // 다른 화면에 다녀와도 되돌리기 가능
      setMsg('')
      if (advance && mode === 'seq') {
        if (idx < active.length - 1) setIdx(idx + 1)
        else setMsg('마지막 학생입니다. 미입력 학생이 있는지 확인하세요.')
      }
      if (mode === 'table') setDialog(null)
    } catch (e) { setMsg((e as Error).message) }
  }
  const doUndo = async () => {
    const u = undoStore.last(item.id!, classIds)
    if (!u) return
    try {
      await undo(u)
      undoStore.remove(u)
      const i = active.findIndex((s) => s.id === u.studentId)
      if (i >= 0 && mode === 'seq') setIdx(i)
      setMsg('')
    } catch (e) { setMsg((e as Error).message) }
  }
  const lastUndo = undoStore.last(item.id!, classIds)
  const lastUndoStudent = lastUndo ? students.find((s) => s.id === lastUndo.studentId) : undefined
  const nextMissing = () => {
    const after = active.findIndex((s, i) => i > idx && !isDone(scores.get(s.id!)))
    const any = after >= 0 ? after : active.findIndex((s) => !isDone(scores.get(s.id!)))
    if (any >= 0) setIdx(any)
    else setMsg('모든 학생 입력이 끝났습니다 ')
  }

  const card = (s: Student, big: boolean) => (
    <ScoreCard
      student={s} item={item} score={scores.get(s.id!)} rules={rules} readOnly={readOnly} big={big}
      onScore={(v) => void act(() => enterScore(s.id!, item.id!, v), true)}
      onAbsence={() => setDialog({ kind: 'absence', student: s })}
      onFallback={() => {
        const sc = scores.get(s.id!)
        const reason = sc?.reasonId ? rules.absenceReasons.find((r) => r.id === sc.reasonId) : undefined
        if (reason) void act(() => reassessImpossible(s.id!, item.id!, reason), true)
        else setDialog({ kind: 'fallback', student: s })
      }}
      onClear={() => void act(() => clearScore(s.id!, item.id!), false)}
      onMemo={() => setDialog({ kind: 'memo', student: s })}
    />
  )

  const shown = active.concat(students.filter((s) => s.status === '전출')).filter((s) => {
    const sc = scores.get(s.id!)
    return filter === 'all' || (filter === 'missing' ? !sc : sc?.status === 'reassess')
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="항목 고르기로 돌아가기" className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"><Icon name="back" /></button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-lg font-bold truncate">{item.name}</h1>
          <p className="text-sm text-muted truncate">{classLabel(cls)} · {planLabel(plan)}</p>
        </div>
        <HelpButton topic="score" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex p-1 rounded-2xl bg-white shadow-sm">
          <button className={`min-h-10 px-4 rounded-xl ${mode === 'seq' ? 'bg-navy text-white font-bold' : 'text-muted'}`} onClick={() => setMode('seq')}>순서 모드</button>
          <button className={`min-h-10 px-4 rounded-xl ${mode === 'table' ? 'bg-navy text-white font-bold' : 'text-muted'}`} onClick={() => setMode('table')}>표 모드</button>
        </div>
        <div className="flex-1" />
        {!readOnly && (
          <Button variant="secondary" className="bg-white shadow-sm" disabled={!lastUndo} onClick={() => void doUndo()}>
            <Icon name="undo" /> 되돌리기{lastUndoStudent ? ` (${lastUndoStudent.no}번)` : ''}
          </Button>
        )}
      </div>
      <div>
        <div className="flex justify-between text-sm font-semibold mb-1">
          <span>{done}/{active.length}명 완료</span>
          {reassessCount > 0 && <span className="text-[#6B4500]">재평가 대기 {reassessCount}명</span>}
        </div>
        <div className="h-2 bg-line rounded-full overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemax={active.length}>
          <div className="h-full bg-brand-600 rounded-full" style={{ width: `${active.length ? (done / active.length) * 100 : 0}%` }} />
        </div>
      </div>
      {msg && <p className="bg-brand-50 rounded-2xl p-3 text-sm">{msg}</p>}
      {item.rubric && (
        <details className="bg-white rounded-2xl px-4 py-2 text-sm shadow-sm">
          <summary className="cursor-pointer min-h-8">평가 기준 보기</summary>
          <p className="whitespace-pre-line mt-1">{item.rubric}</p>
        </details>
      )}

      {mode === 'seq' && cur && (
        <>
          <Card className="p-5 rounded-[28px]">{card(cur, true)}</Card>
          <div className="flex gap-2 items-center justify-between">
            <Button variant="secondary" className="bg-white shadow-sm rounded-full" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setMsg('') }}><Icon name="back" /> 이전 학생</Button>
            <span className="text-sm text-muted">{idx + 1} / {active.length}</span>
            <Button variant="secondary" className="bg-white shadow-sm rounded-full" disabled={idx >= active.length - 1} onClick={() => { setIdx(idx + 1); setMsg('') }}>다음 학생 <Icon name="next" /></Button>
          </div>
          <div className="text-center"><Button variant="ghost" onClick={nextMissing}>아직 안 한 학생으로 가기</Button></div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {active.map((s, i) => {
              const sc = scores.get(s.id!)
              const tone = !sc ? 'bg-white' : sc.status === 'reassess' ? 'bg-peach' : sc.status === 'normal' ? 'bg-mint' : 'bg-[#FCE3D6]'
              return (
                <button key={s.id} onClick={() => setIdx(i)} aria-label={`${s.no}번으로 이동`}
                  className={`min-w-11 min-h-11 rounded-xl text-sm ${tone} ${i === idx ? 'ring-2 ring-brand-600 font-bold' : ''}`}>{s.no}</button>
              )
            })}
          </div>
        </>
      )}
      {mode === 'seq' && !cur && <Card>이 학급에 학생이 없습니다.</Card>}

      {mode === 'table' && (
        <>
          <div className="flex gap-2">
            {([['all', '전체'], ['missing', '미입력'], ['reassess', '재평가 대기']] as const).map(([k, v]) => (
              <Button key={k} variant={filter === k ? 'primary' : 'secondary'} className={`rounded-full ${filter === k ? '' : 'bg-white shadow-sm'}`} onClick={() => setFilter(k)}>{v}</Button>
            ))}
          </div>
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y">
              {shown.map((s) => {
                const st = scoreText(scores.get(s.id!), rules)
                return (
                  <li key={s.id}>
                    <button className={`w-full text-left flex items-center gap-2 px-3 min-h-14 hover:bg-brand-50 ${s.status === '전출' ? 'opacity-50' : ''}`}
                      onClick={() => setDialog({ kind: 'edit', student: s })}>
                      <span className="flex-1 font-semibold">{studentLabel(s, hideNames)}{s.status !== '재학' && <span className="ml-1 text-xs border rounded px-1">{s.status}</span>}</span>
                      <span className={`px-2 py-1 rounded text-sm ${st.tone}`}>{st.icon} {st.text}</span>
                    </button>
                  </li>
                )
              })}
              {shown.length === 0 && <li className="p-4 text-muted">해당하는 학생이 없습니다.</li>}
            </ul>
          </Card>
        </>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title={`${item.name} 점수`} onClose={() => setDialog(null)}>{card(dialog.student, false)}</Modal>
      )}
      {(dialog?.kind === 'absence' || dialog?.kind === 'fallback') && (
        <AbsenceDialog
          rules={rules}
          mode={dialog.kind}
          title={`${studentLabel(dialog.student, hideNames)} · ${dialog.kind === 'absence' ? '결시·미제출 사유' : '재평가 불가 사유'}`}
          onClose={() => setDialog(null)}
          onPick={(r, note) => {
            const s = dialog.student
            setDialog(null)
            void act(() => (dialog.kind === 'absence' ? enterAbsence(s.id!, item.id!, r, note) : reassessImpossible(s.id!, item.id!, r)), true)
          }}
          onReassessOnly={() => {
            const s = dialog.student
            setDialog(null)
            void act(() => markReassess(s.id!, item.id!), true)
          }}
        />
      )}
      {dialog?.kind === 'memo' && <QuickMemo studentId={dialog.student.id} onClose={() => setDialog(null)} />}
    </div>
  )
}
