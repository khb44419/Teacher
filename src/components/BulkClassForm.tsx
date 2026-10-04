import { useState } from 'react'
import { createClassesBulk } from '../db/services'
import type { SchoolLevel } from '../db/types'
import { Button, Field, inputCls } from './ui'

export function BulkClassForm({ semesterId, onDone }: { semesterId: number; onDone?: (msg: string) => void }) {
  const [level, setLevel] = useState<SchoolLevel>('중')
  const [grade, setGrade] = useState(1)
  const [classCount, setClassCount] = useState(12)
  const [per, setPer] = useState(25)
  const [subject, setSubject] = useState('음악')
  const [msg, setMsg] = useState('')
  const valid = grade >= 1 && grade <= 3 && classCount >= 1 && classCount <= 40 && per >= 1 && per <= 60 && subject.trim()

  const run = async () => {
    const r = await createClassesBulk({ semesterId, level, grade, classCount, studentsPerClass: per, subject: subject.trim() })
    const m = `${level}학교 ${grade}학년: ${r.created}개 학급을 만들었습니다.` + (r.skipped ? ` (이미 있는 ${r.skipped}개 반은 건너뜀)` : '')
    setMsg(m)
    onDone?.(m)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Field label="학교급">
          <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)}>
            <option value="중">중학교</option>
            <option value="고">고등학교</option>
          </select>
        </Field>
        <Field label="학년">
          <select className={inputCls} value={grade} onChange={(e) => setGrade(+e.target.value)}>
            {[1, 2, 3].map((g) => <option key={g} value={g}>{g}학년</option>)}
          </select>
        </Field>
        <Field label="반 수" hint="1반부터 이 수까지">
          <input className={inputCls} type="number" inputMode="numeric" min={1} max={40} value={classCount} onChange={(e) => setClassCount(+e.target.value)} />
        </Field>
        <Field label="반당 학생 수">
          <input className={inputCls} type="number" inputMode="numeric" min={1} max={60} value={per} onChange={(e) => setPer(+e.target.value)} />
        </Field>
        <Field label="과목명">
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
      </div>
      <Button onClick={run} disabled={!valid}>학급 만들기</Button>
      {msg && <p className="text-sm text-green-700">✅ {msg}</p>}
    </div>
  )
}
