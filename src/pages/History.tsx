import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Card, inputCls } from '../components/ui'
import { HelpButton } from '../components/Help'

export function History() {
  const [filter, setFilter] = useState('')
  const logs = useLiveQuery(
    () => db.changeLogs.orderBy('at').reverse().filter((l) => !filter || l.target.startsWith(filter)).limit(300).toArray(),
    [filter],
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/plans" className="text-brand-700 min-h-11 leading-[44px]">← 평가 계획</Link>
        <h1 className="text-xl font-bold flex-1">변경 이력</h1>
        <HelpButton topic="plans" />
      </div>
      <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">전체</option>
        <option value="평가 계획">평가 계획</option>
        <option value="규정 설정">규정 설정</option>
      </select>
      <Card>
        {!logs?.length && <p className="text-gray-600">변경 기록이 없습니다.</p>}
        <ul className="divide-y">
          {logs?.map((l) => (
            <li key={l.id} className="py-2 text-sm">
              <div className="text-xs text-gray-500">{new Date(l.at).toLocaleString('ko-KR')} · {l.target}</div>
              <div>
                {l.detail}
                {(l.before || l.after) && <> : <span className="text-gray-600">{l.before || '(없음)'}</span> → <b>{l.after || '(없음)'}</b></>}
              </div>
            </li>
          ))}
        </ul>
        {logs?.length === 300 && <p className="text-xs text-gray-500 mt-2">최근 300건만 표시했습니다.</p>}
      </Card>
    </div>
  )
}
