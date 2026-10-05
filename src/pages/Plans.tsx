import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { createPlan } from '../db/planService'
import { useApp } from '../app/AppContext'
import { planLabel, weightSum } from '../lib/plans'
import { Button, Card, Field, Modal, inputCls } from '../components/ui'
import { CopyPlansDialog } from '../components/CopyPlansDialog'
import { LibraryDialog } from '../components/LibraryDialog'
import { HelpButton } from '../components/Help'
import type { SchoolLevel } from '../db/types'

export function Plans() {
  const { semester, detailed } = useApp()
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | 'new' | 'copy' | 'library'>(null)
  const [level, setLevel] = useState<SchoolLevel>('중')
  const [grade, setGrade] = useState(1)
  const [subject, setSubject] = useState('음악')
  const [msg, setMsg] = useState('')
  const readOnly = semester?.status === 'closed'

  const plans = useLiveQuery(async () => {
    if (!semester?.id) return []
    const ps = await db.plans.where('semesterId').equals(semester.id).toArray()
    const classes = await db.classes.where('semesterId').equals(semester.id).toArray()
    return Promise.all(
      ps.map(async (p) => {
        const items = await db.items.where('planId').equals(p.id!).toArray()
        return {
          ...p,
          items,
          sum: weightSum(items),
          classCount: classes.filter((c) => c.level === p.level && c.grade === p.grade && c.subject === p.subject).length,
        }
      }),
    ).then((r) => r.sort((a, b) => (a.level === b.level ? 0 : a.level === '중' ? -1 : 1) || a.grade - b.grade))
  }, [semester?.id])

  const create = async () => {
    if (!semester?.id || !subject.trim()) return
    const r = await createPlan(semester.id, level, grade, subject.trim())
    if (r.existed) setMsg('이미 같은 평가 계획이 있어 그 계획을 열었습니다.')
    nav(`/plans/${r.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold flex-1">평가 계획</h1>
        {detailed && <Link to="/plans/history" className="text-brand-700 font-semibold min-h-11 leading-[44px]">🕘 변경 이력</Link>}
        <HelpButton topic="plans" />
      </div>
      <p className="text-sm text-gray-600">학기 + 학교급 + 학년 + 과목 단위로 계획을 만들면 해당 학년의 모든 반에 자동으로 적용됩니다.</p>
      {readOnly && <p className="bg-gray-100 rounded-lg p-3">마감된 학기의 평가 계획은 읽기 전용입니다.</p>}
      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setDlg('new')}>＋ 새 평가 계획</Button>
          <Button variant="secondary" onClick={() => setDlg('copy')}>📥 지난 학기·다른 학년 계획 불러오기</Button>
          {detailed && <Button variant="secondary" onClick={() => setDlg('library')}>🗂 항목 보관함</Button>}
        </div>
      )}
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      {plans?.length === 0 && <Card>아직 평가 계획이 없습니다. 위에서 새로 만들거나 지난 학기 계획을 불러오세요.</Card>}
      <div className="grid gap-3 sm:grid-cols-2">
        {plans?.map((p) => (
          <Link key={p.id} to={`/plans/${p.id}`} className="block">
            <Card className="hover:bg-brand-50 space-y-1">
              <div className="font-bold text-lg">{planLabel(p)}</div>
              <div className="text-sm text-gray-600">항목 {p.items.length}개 · 적용 학급 {p.classCount}개</div>
              <div className={`text-sm font-semibold ${p.sum === 100 ? 'text-green-700' : 'text-yellow-700'}`}>
                {p.sum === 100 ? '✔ 반영 비율 합 100%' : `⚠ 반영 비율 합 ${p.sum}% (100%가 아님)`}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {dlg === 'new' && (
        <Modal title="새 평가 계획" onClose={() => setDlg(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="학교급">
                <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)}>
                  <option value="중">중학교</option><option value="고">고등학교</option>
                </select>
              </Field>
              <Field label="학년">
                <select className={inputCls} value={grade} onChange={(e) => setGrade(+e.target.value)}>
                  {[1, 2, 3].map((g) => <option key={g} value={g}>{g}학년</option>)}
                </select>
              </Field>
            </div>
            <Field label="과목명"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Button className="w-full" onClick={() => void create()}>만들기</Button>
          </div>
        </Modal>
      )}
      {dlg === 'copy' && semester?.id && <CopyPlansDialog semesterId={semester.id} onClose={() => setDlg(null)} />}
      {dlg === 'library' && <LibraryDialog onClose={() => setDlg(null)} />}
    </div>
  )
}
