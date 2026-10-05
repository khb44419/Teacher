import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addMemo } from '../db/memoService'
import { useApp } from '../app/AppContext'
import { classLabel, classSort } from '../lib/classLabel'
import { studentLabel } from './StudentName'
import { Button, Modal, inputCls } from './ui'

/** 빠른 메모: 학년-반-번호 → 태그 → 한 줄 → 저장 */
export function QuickMemo({ studentId, onClose }: { studentId?: number; onClose: () => void }) {
  const { semester, hideNames } = useApp()
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const classes = useLiveQuery(
    async () => (semester?.id ? (await db.classes.where('semesterId').equals(semester.id).toArray()).sort(classSort) : []),
    [semester?.id],
  )
  const fixed = useLiveQuery(async () => {
    if (!studentId) return null
    const s = await db.students.get(studentId)
    const c = s && (await db.classes.get(s.classId))
    return s && c ? { s, c } : null
  }, [studentId])
  const [classId, setClassId] = useState<number | ''>('')
  const [sid, setSid] = useState<number | ''>(studentId ?? '')
  const students = useLiveQuery(async () => (classId ? db.students.where('classId').equals(classId).sortBy('no') : []), [classId])
  const [tags, setTags] = useState<string[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => { if (studentId) setSid(studentId) }, [studentId])

  const save = async () => {
    if (!sid) { setErr('학생을 선택하세요'); return }
    try {
      await addMemo(Number(sid), text, tags)
      if (studentId) { onClose(); return }
      setSaved('저장했습니다. 다음 학생 메모를 이어서 쓸 수 있습니다.')
      setText('')
      setTags([])
      setErr('')
    } catch (e) { setErr((e as Error).message) }
  }

  return (
    <Modal title="빠른 메모" onClose={onClose}>
      <div className="space-y-3">
        {fixed ? (
          <p className="text-lg font-bold">{classLabel(fixed.c)} · {studentLabel(fixed.s, hideNames)}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={classId} onChange={(e) => { setClassId(e.target.value ? +e.target.value : ''); setSid('') }} aria-label="학급">
              <option value="">학급 선택</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
            <select className={inputCls} value={sid} onChange={(e) => setSid(e.target.value ? +e.target.value : '')} aria-label="학생" disabled={!classId}>
              <option value="">번호 선택</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{studentLabel(s, hideNames)}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {rules?.memoTags.map((t) => {
            const on = tags.includes(t)
            return (
              <button key={t} className={`min-h-11 px-3 rounded-full border ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white'}`}
                onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} aria-pressed={on}>
                #{t}
              </button>
            )
          })}
        </div>
        <input className={inputCls} value={text} placeholder="한 줄 관찰 내용" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()} autoFocus={!!studentId} />
        <div className="flex flex-wrap gap-2">
          {rules?.quickPhrases.map((p) => (
            <button key={p} className="min-h-11 px-3 rounded-2xl bg-canvas text-sm" onClick={() => setText(text ? `${text} ${p}` : p)}>＋ {p}</button>
          ))}
        </div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        {saved && <p className="text-green-700 text-sm">✔ {saved}</p>}
        <Button className="w-full" onClick={() => void save()} disabled={!text.trim()}>저장</Button>
      </div>
    </Modal>
  )
}
