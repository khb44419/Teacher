import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteMemo, updateMemo } from '../db/memoService'
import { useApp } from '../app/AppContext'
import { filterMemos, memoDate } from '../lib/memos'
import { studentLabel } from '../components/StudentName'
import { ClassSelect } from '../components/ClassSelect'
import { QuickMemo } from '../components/QuickMemo'
import { Button, Card, Field, Modal, inputCls, useConfirm } from '../components/ui'
import type { Memo } from '../db/types'
import { HelpButton } from '../components/Help'

export function Memos() {
  const { semester, hideNames } = useApp()
  const [sp, setSp] = useSearchParams()
  const classId = Number(sp.get('class')) || undefined
  const studentId = Number(sp.get('student')) || undefined
  const [tags, setTags] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [adding, setAdding] = useState<number | 'any' | null>(null)
  const [editing, setEditing] = useState<Memo | null>(null)
  const { ask, dialog } = useConfirm()
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const data = useLiveQuery(async () => {
    if (!classId) return undefined
    const students = await db.students.where('classId').equals(classId).sortBy('no')
    const memos = await db.memos.where('studentId').anyOf(students.map((s) => s.id!)).toArray()
    return { students, memos }
  }, [classId])

  const filtered = data ? filterMemos(data.memos.filter((m) => !studentId || m.studentId === studentId), { tags, from: from || undefined, to: to || undefined }) : []
  const count = (sid: number) => data?.memos.filter((m) => m.studentId === sid).length ?? 0
  const stuOf = (sid: number) => data?.students.find((s) => s.id === sid)
  const setParam = (k: string, v?: number) => {
    const n = new URLSearchParams(sp)
    if (v === undefined) n.delete(k); else n.set(k, String(v))
    if (k === 'class') n.delete('student')
    setSp(n)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold flex-1">관찰 메모</h1>
        <HelpButton topic="memo" />
        <Button onClick={() => setAdding('any')}>＋ 빠른 메모</Button>
      </div>
      <p className="text-sm text-gray-600">
        수업 중 학생별 한 줄 관찰을 쌓아 두면 학기말 세특 초안에 쓰입니다. 어느 화면에서든 오른쪽 아래 📝 버튼으로 바로 쓸 수 있습니다.
        태그·자주 쓰는 문구는 <Link to="/settings/rules" className="text-brand-700 underline">규정 설정</Link>에서 바꿉니다.
      </p>
      <ClassSelect semesterId={semester?.id} value={classId} onChange={(id) => setParam('class', id)} />

      {data && (
        <>
          <Card>
            <h2 className="font-bold mb-2">학생별 메모 (눌러서 모아보기)</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              <Button variant={!studentId ? 'primary' : 'secondary'} onClick={() => setParam('student')}>전체</Button>
              {data.students.map((s) => (
                <Button key={s.id} variant={studentId === s.id ? 'primary' : 'secondary'} className="text-sm px-1"
                  onClick={() => setParam('student', s.id)}>
                  {hideNames || !s.name ? `${s.no}번` : `${s.no} ${s.name}`}
                  <span className={`ml-1 text-xs ${count(s.id!) ? '' : 'opacity-50'}`}>({count(s.id!)})</span>
                </Button>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-semibold">태그</span>
              {rules?.memoTags.map((t) => {
                const on = tags.includes(t)
                return <button key={t} aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  className={`min-h-11 px-3 rounded-full border text-sm ${on ? 'bg-brand-600 text-white' : 'bg-white'}`}>#{t}</button>
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="시작일"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="종료일"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="font-bold">{studentId && stuOf(studentId) ? studentLabel(stuOf(studentId)!, hideNames) : '학급 전체'} · {filtered.length}건</h2>
            {studentId && <Button variant="secondary" onClick={() => setAdding(studentId)}>＋ 이 학생 메모</Button>}
          </div>
          <Card className="p-0">
            {!filtered.length && <p className="p-4 text-gray-600">메모가 없습니다.</p>}
            <ul className="divide-y">
              {filtered.map((m) => {
                const s = stuOf(m.studentId)
                return (
                  <li key={m.id} className="p-3 flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">{memoDate(m.createdAt)}{!studentId && s && ` · ${studentLabel(s, hideNames)}`}</div>
                      <div>{m.content}</div>
                      {m.tags.length > 0 && <div className="text-xs text-brand-700">{m.tags.map((t) => `#${t}`).join(' ')}</div>}
                    </div>
                    {semester?.status !== 'closed' && (
                      <>
                        <Button variant="ghost" onClick={() => setEditing(m)}>수정</Button>
                        <Button variant="ghost" aria-label="메모 삭제" onClick={() => ask('이 메모를 삭제합니다.', () => void deleteMemo(m.id!), '삭제')}>🗑</Button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
      {adding !== null && <QuickMemo studentId={adding === 'any' ? undefined : adding} onClose={() => setAdding(null)} />}
      {editing && rules && <EditMemo memo={editing} tags={rules.memoTags} onClose={() => setEditing(null)} />}
      {dialog}
    </div>
  )
}

function EditMemo({ memo, tags, onClose }: { memo: Memo; tags: string[]; onClose: () => void }) {
  const [text, setText] = useState(memo.content)
  const [sel, setSel] = useState(memo.tags)
  const all = [...new Set([...tags, ...memo.tags])]
  return (
    <Modal title="메모 수정" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {all.map((t) => {
            const on = sel.includes(t)
            return <button key={t} aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== t) : [...sel, t])}
              className={`min-h-11 px-3 rounded-full border ${on ? 'bg-brand-600 text-white' : 'bg-white'}`}>#{t}</button>
          })}
        </div>
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} />
        <Button className="w-full" disabled={!text.trim()} onClick={() => void updateMemo(memo.id!, text, sel).then(onClose)}>저장</Button>
      </div>
    </Modal>
  )
}
