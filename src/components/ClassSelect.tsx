import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { classLabel, classSort } from '../lib/classLabel'
import { inputCls } from './ui'

export function ClassSelect({ semesterId, value, onChange }: { semesterId?: number; value?: number; onChange: (id: number) => void }) {
  const classes = useLiveQuery(async () => (semesterId ? (await db.classes.where('semesterId').equals(semesterId).toArray()).sort(classSort) : []), [semesterId])
  return (
    <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(+e.target.value)} aria-label="학급 선택">
      <option value="">학급을 선택하세요</option>
      {classes?.map((c) => <option key={c.id} value={c.id}>{classLabel(c)} ({c.subject})</option>)}
    </select>
  )
}
