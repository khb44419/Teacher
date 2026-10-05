import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadDashboard, type CellState } from '../db/dashboardData'
import { useApp } from '../app/AppContext'
import { Button, Card } from '../components/ui'
import { HelpButton } from '../components/Help'
import { updateRules } from '../db/services'

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
  const confirmedYear = useLiveQuery(async () => (await db.rules.get('main'))?.confirmedYear ?? null, [])
  const setup = useLiveQuery(async () => {
    if (!semester?.id) return undefined
    const classes = await db.classes.where('semesterId').equals(semester.id).count()
    const plans = await db.plans.where('semesterId').equals(semester.id).primaryKeys()
    const items = plans.length ? await db.items.where('planId').anyOf(plans).count() : 0
    return { classes, plans: plans.length, items }
  }, [semester?.id])
  if (!semester) return null
  const needRuleCheck = confirmedYear !== undefined && confirmedYear !== semester.year && semester.status === 'active'
  const ready = setup && setup.classes > 0 && setup.items > 0
  const needBackup = lastBackup !== undefined && d && d.studentCount > 0 && (lastBackup === null || Date.now() - lastBackup > 7 * DAY)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">안녕하세요, 이정애 선생님 👋</h1>
        <HelpButton topic="home" />
      </div>

      {setup && !ready && (
        <Card className="border-brand-600 border-2 space-y-2">
          <h2 className="font-bold text-lg">🚀 시작 준비 (차례대로 해 주세요)</h2>
          <Step done={setup.classes > 0} n={1} text="학급과 학생 번호 만들기" to="/settings/classes" />
          <Step done={setup.items > 0} n={2} text="이번 학기 평가 항목 만들기 (예: 가창, 리코더)" to="/plans" />
          <Step done={false} n={3} text="점수 매기기 시작!" to="/score" />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <BigButton to="/score" icon="✏️" title="점수 매기기" desc="실기평가 중 한 명씩" />
        <BigButton to="/memo" icon="📝" title="메모 쓰기" desc="수업 중 관찰 한 줄" />
        <BigButton to="/report" icon="📊" title="성적·엑셀" desc="성적표 보기, NEIS용 엑셀" />
        <BigButton to="/seteuk" icon="✍️" title="세특 쓰기" desc="초안 만들고 고치기" />
      </div>

      {needRuleCheck && (
        <Card className="bg-blue-50 border-blue-200 space-y-2">
          <p className="font-semibold">📜 {semester.year}학년도가 시작되면 학교 규정을 한 번 확인해 주세요.</p>
          <p className="text-sm text-gray-700">세특 글자 수, 결석했을 때 점수 주는 방법이 우리 학교 학업성적관리규정과 같은지 확인하는 단계입니다.</p>
          <div className="flex gap-2 flex-wrap">
            <Link to="/settings/rules" className="min-h-11 px-4 inline-flex items-center rounded-lg bg-white border border-gray-300 font-semibold">확인하러 가기</Link>
            <Button variant="ghost" onClick={() => void updateRules({ confirmedYear: semester.year }, [{ target: '규정 설정 · 확인', detail: `${semester.year}학년도 기재요령·학업성적관리규정 확인` }])}>이미 확인했어요</Button>
          </div>
        </Card>
      )}
      {needBackup && (
        <Link to="/settings/backup" className="block bg-orange-50 border border-orange-300 rounded-xl p-3 font-semibold">
          💾 {lastBackup ? `마지막 백업 후 ${Math.floor((Date.now() - lastBackup) / DAY)}일이 지났습니다.` : '아직 백업한 적이 없습니다.'} 데이터는 이 기기에만 있으니 지금 백업하세요 →
        </Link>
      )}
      {!d && <Card>불러오는 중…</Card>}
      {d && (
        <>
          <h2 className="font-bold text-lg pt-2">📈 진행 현황</h2>
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

function BigButton({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center text-center min-h-32 rounded-2xl bg-brand-600 text-white p-3 shadow hover:bg-brand-700 active:scale-[0.98]">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <span className="text-xl font-bold mt-1">{title}</span>
      <span className="text-sm opacity-90">{desc}</span>
    </Link>
  )
}

function Step({ done, n, text, to }: { done: boolean; n: number; text: string; to: string }) {
  return (
    <Link to={to} className={`flex items-center gap-3 min-h-14 px-3 rounded-xl border ${done ? 'bg-green-50 border-green-300' : 'bg-white border-gray-300 hover:bg-brand-50'}`}>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${done ? 'bg-green-600 text-white' : 'bg-brand-100 text-brand-700'}`}>{done ? '✔' : n}</span>
      <span className={`flex-1 ${done ? 'line-through text-gray-500' : 'font-semibold'}`}>{text}</span>
      {!done && <span aria-hidden>›</span>}
    </Link>
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
