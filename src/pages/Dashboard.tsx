import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadDashboard, type CellState } from '../db/dashboardData'
import { useApp } from '../app/AppContext'
import { Card } from '../components/ui'

const tone: Record<CellState, string> = {
  완료: 'bg-green-100 text-green-800 border-green-300',
  진행중: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  미시작: 'bg-gray-100 text-gray-600 border-gray-200',
}
const icon: Record<CellState, string> = { 완료: '✔', 진행중: '◐', 미시작: '○' }
const DAY = 86400000

export function Dashboard() {
  const { semester } = useApp()
  const d = useLiveQuery(() => (semester?.id ? loadDashboard(semester.id) : undefined), [semester?.id])
  const lastBackup = useLiveQuery(async () => (await db.kv.get('lastBackupAt'))?.value as number | undefined ?? null, [])
  if (!semester) return null
  const needBackup = lastBackup !== undefined && d && d.studentCount > 0 && (lastBackup === null || Date.now() - lastBackup > 7 * DAY)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">대시보드</h1>
      {needBackup && (
        <Link to="/settings/backup" className="block bg-orange-50 border border-orange-300 rounded-xl p-3 font-semibold">
          💾 {lastBackup ? `마지막 백업 후 ${Math.floor((Date.now() - lastBackup) / DAY)}일이 지났습니다.` : '아직 백업한 적이 없습니다.'} 데이터는 이 기기에만 있으니 지금 백업하세요 →
        </Link>
      )}
      {!d && <Card>불러오는 중…</Card>}
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="학생 (전출 제외)" value={`${d.studentCount}명`} />
            <Stat label="🔁 재평가 대기" value={`${d.reassessWaiting}건`} warn={d.reassessWaiting > 0} />
            <Stat label="※ 결시 처리 대기" value={`${d.absenceWaiting}건`} warn={d.absenceWaiting > 0}
              hint="인정점 기준(다른 항목 점수)이 아직 없어 계산을 기다리는 결시" />
            <Stat label="✍️ 세특 작성" value={`${d.seteuk.written}/${d.seteuk.total}명`}
              hint={d.seteuk.over ? `⚠ 바이트 초과 ${d.seteuk.over}명` : undefined} warn={d.seteuk.over > 0} to="/seteuk" />
          </div>

          {d.overdue.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <h2 className="font-bold mb-1">⏰ 예정 기간이 지났는데 끝나지 않은 항목</h2>
              <ul className="text-sm space-y-1">
                {d.overdue.map((o) => (
                  <li key={o.item.id}>• {o.plan} · <b>{o.item.name}</b> (~{o.item.endDate}) — 미완료 {o.classes.length}개 반: {o.classes.join(', ')}</li>
                ))}
              </ul>
            </Card>
          )}

          {d.reassessWaiting > 0 && (
            <Card>
              <h2 className="font-bold mb-2">🔁 재평가 대기 학생이 있는 곳</h2>
              <div className="flex flex-wrap gap-2">
                {d.plans.flatMap((p) => p.classes.flatMap((c) => p.items.map((it) => {
                  const cell = p.cells.get(`${c.id}:${it.id}`)
                  if (!cell?.reassess) return null
                  return (
                    <Link key={`${c.id}-${it.id}`} to={`/score?class=${c.id}&item=${it.id}&mode=table&filter=reassess`}
                      className="min-h-11 px-3 inline-flex items-center rounded-lg border border-yellow-400 bg-yellow-50 text-sm">
                      {c.level}{c.grade}-{c.classNo} {it.name} · {cell.reassess}명
                    </Link>
                  )
                })))}
              </div>
            </Card>
          )}

          {d.plans.length === 0 && (
            <Card>평가 계획이 없습니다. <Link to="/plans" className="text-brand-700 underline">평가 계획 만들기 →</Link></Card>
          )}
          {d.classesWithoutPlan > 0 && (
            <p className="text-sm text-gray-600">평가 계획이 없는 학급이 {d.classesWithoutPlan}개 있습니다. <Link to="/plans" className="text-brand-700 underline">평가 계획 →</Link></p>
          )}

          <div className="flex gap-3 text-sm flex-wrap" aria-label="범례">
            {(['완료', '진행중', '미시작'] as const).map((s) => <span key={s} className={`px-2 py-1 rounded border ${tone[s]}`}>{icon[s]} {s}</span>)}
            <span className="text-gray-600">칸을 누르면 그 반·항목 점수 입력으로 바로 갑니다.</span>
          </div>
          {d.plans.map((p) => (
            <Card key={p.plan.id} className="p-0 overflow-hidden">
              <h2 className="font-bold p-3 pb-2">{p.label}</h2>
              {p.items.length === 0 ? <p className="px-3 pb-3 text-sm text-gray-600">항목이 없습니다.</p> : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left sticky left-0 bg-gray-50">학급</th>
                        {p.items.map((it) => <th key={it.id} className="p-2 whitespace-nowrap">{it.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {p.classes.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="p-2 font-semibold sticky left-0 bg-white whitespace-nowrap">{c.classNo}반</td>
                          {p.items.map((it) => {
                            const cell = p.cells.get(`${c.id}:${it.id}`)!
                            return (
                              <td key={it.id} className="p-1">
                                <Link to={`/score?class=${c.id}&item=${it.id}`}
                                  className={`flex flex-col items-center justify-center min-h-11 min-w-20 rounded border ${tone[cell.state]}`}
                                  aria-label={`${c.classNo}반 ${it.name} ${cell.state} ${cell.done}/${cell.total}`}>
                                  <span className="font-semibold">{icon[cell.state]} {cell.state}</span>
                                  <span className="text-xs">{cell.done}/{cell.total}{cell.reassess > 0 && ` · 🔁${cell.reassess}`}</span>
                                </Link>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint, warn, to }: { label: string; value: string; hint?: string; warn?: boolean; to?: string }) {
  const body = (
    <Card className={`h-full ${warn ? 'border-orange-300 bg-orange-50' : ''}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-gray-600 mt-1">{hint}</div>}
    </Card>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}
