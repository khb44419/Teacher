import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadDashboard, type CellState } from '../db/dashboardData'
import { useApp } from '../app/AppContext'
import { Button, Card } from '../components/ui'
import { HelpButton } from '../components/Help'
import { Icon, type IconName } from '../components/Icon'
import { updateRules } from '../db/services'

const tone: Record<CellState, string> = {
  완료: 'bg-green-100 text-green-800 border-green-300',
  진행중: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  미시작: 'bg-canvas text-muted border-line',
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
      <section className="rounded-[24px] bg-navy text-white p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-[#C9D3EE]">{semester.year}학년도 {semester.term}학기</p>
            <h1 className="text-2xl font-bold leading-snug">안녕하세요,<br />이정애 선생님 👋</h1>
          </div>
          <HelpButton topic="home" />
        </div>
        {d && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-2xl bg-white/10 px-3 py-2.5 text-left"
              onClick={() => document.getElementById('reassess')?.scrollIntoView({ behavior: 'smooth' })}>
              <span className="block text-xs text-[#C9D3EE]">재평가 대기</span>
              <span className="block text-lg font-bold">{d.reassessWaiting}건</span>
            </button>
            <Link to="/seteuk" className="rounded-2xl bg-white/10 px-3 py-2.5">
              <span className="block text-xs text-[#C9D3EE]">세특 작성</span>
              <span className="block text-lg font-bold">{d.seteuk.written}/{d.seteuk.total}명</span>
            </Link>
          </div>
        )}
      </section>

      {setup && !ready && (
        <Card className="space-y-2">
          <h2 className="font-bold text-lg flex items-center gap-2"><Icon name="flag" className="text-brand-600" /> 시작 준비 (차례대로 해 주세요)</h2>
          <Step done={setup.classes > 0} n={1} text="학급과 학생 번호 만들기" to="/settings/classes" />
          <Step done={setup.items > 0} n={2} text="이번 학기 평가 항목 만들기 (예: 가창, 리코더)" to="/plans" />
          <Step done={false} n={3} text="점수 매기기 시작!" to="/score" />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <BigButton to="/score" icon="pencil" tone="sky" title="점수 매기기" desc="실기평가 중 한 명씩" />
        <BigButton to="/memo" icon="note" tone="mint" title="메모 쓰기" desc="수업 중 관찰 한 줄" />
        <BigButton to="/report" icon="chart" tone="peach" title="성적·엑셀" desc="성적표, NEIS용 엑셀" />
        <BigButton to="/seteuk" icon="doc" tone="lilac" title="세특 쓰기" desc="초안 만들고 고치기" />
      </div>

      {needRuleCheck && (
        <Card className="space-y-2">
          <p className="font-semibold flex items-start gap-2"><Icon name="shield" className="text-brand-600 mt-0.5" /> <span>{semester.year}학년도가 시작되면 학교 규정을 한 번 확인해 주세요.</span></p>
          <p className="text-sm text-ink">세특 글자 수, 결석했을 때 점수 주는 방법이 우리 학교 학업성적관리규정과 같은지 확인하는 단계입니다.</p>
          <div className="flex gap-2 flex-wrap">
            <Link to="/settings/rules" className="min-h-11 px-4 inline-flex items-center rounded-2xl bg-brand-50 font-semibold">확인하러 가기</Link>
            <Button variant="ghost" onClick={() => void updateRules({ confirmedYear: semester.year }, [{ target: '규정 설정 · 확인', detail: `${semester.year}학년도 기재요령·학업성적관리규정 확인` }])}>이미 확인했어요</Button>
          </div>
        </Card>
      )}
      {needBackup && (
        <Link to="/settings/backup" className="flex items-center gap-3 bg-white rounded-[18px] p-3.5 shadow-[0_4px_16px_rgba(28,37,65,0.06)]">
          <span className="w-10 h-10 rounded-xl bg-peach text-[#9A6200] flex items-center justify-center"><Icon name="download" /></span>
          <span className="flex-1">
            <span className="block font-semibold">{lastBackup ? `백업한 지 ${Math.floor((Date.now() - lastBackup) / DAY)}일 지났어요` : '아직 백업한 적이 없어요'}</span>
            <span className="block text-sm text-muted">데이터는 이 기기에만 있어요. 지금 백업하세요</span>
          </span>
          <Icon name="next" className="text-muted" />
        </Link>
      )}
      {!d && <Card>불러오는 중…</Card>}
      {d && (
        <>
          <h2 className="font-bold text-lg pt-2">진행 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="학생 (전출 제외)" value={`${d.studentCount}명`} />
            <Stat label="재평가 대기" value={`${d.reassessWaiting}건`} warn={d.reassessWaiting > 0} />
            <Stat label="※ 결시 처리 대기" value={`${d.absenceWaiting}건`} warn={d.absenceWaiting > 0}
              hint="인정점 기준(다른 항목 점수)이 아직 없어 계산을 기다리는 결시" />
            <Stat label="세특 작성" value={`${d.seteuk.written}/${d.seteuk.total}명`}
              hint={d.seteuk.over ? `⚠ 바이트 초과 ${d.seteuk.over}명` : undefined} warn={d.seteuk.over > 0} to="/seteuk" />
          </div>

          {d.overdue.length > 0 && (
            <Card className="bg-[#FDECEC]">
              <h2 className="font-bold mb-1 flex items-center gap-2"><Icon name="clock" className="text-red-700" /> 예정 기간이 지났는데 끝나지 않은 항목</h2>
              <ul className="text-sm space-y-1">
                {d.overdue.map((o) => (
                  <li key={o.item.id}>• {o.plan} · <b>{o.item.name}</b> (~{o.item.endDate}) — 미완료 {o.classes.length}개 반: {o.classes.join(', ')}</li>
                ))}
              </ul>
            </Card>
          )}

          {d.reassessWaiting > 0 && (
            <Card>
              <h2 id="reassess" className="font-bold mb-2 flex items-center gap-2"><Icon name="repeat" className="text-[#9A6200]" /> 재평가 대기 학생이 있는 곳</h2>
              <div className="flex flex-wrap gap-2">
                {d.plans.flatMap((p) => p.classes.flatMap((c) => p.items.map((it) => {
                  const cell = p.cells.get(`${c.id}:${it.id}`)
                  if (!cell?.reassess) return null
                  return (
                    <Link key={`${c.id}-${it.id}`} to={`/score?class=${c.id}&item=${it.id}&mode=table&filter=reassess`}
                      className="min-h-11 px-3 inline-flex items-center rounded-full bg-peach text-sm font-semibold">
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
            <p className="text-sm text-muted">평가 계획이 없는 학급이 {d.classesWithoutPlan}개 있습니다. <Link to="/plans" className="text-brand-700 underline">평가 계획 →</Link></p>
          )}

          <div className="flex gap-3 text-sm flex-wrap" aria-label="범례">
            {(['완료', '진행중', '미시작'] as const).map((s) => <span key={s} className={`px-2 py-1 rounded border ${tone[s]}`}>{icon[s]} {s}</span>)}
            <span className="text-muted">칸을 누르면 그 반·항목 점수 입력으로 바로 갑니다.</span>
          </div>
          {d.plans.map((p) => (
            <Card key={p.plan.id} className="p-0 overflow-hidden">
              <h2 className="font-bold p-3 pb-2">{p.label}</h2>
              {p.items.length === 0 ? <p className="px-3 pb-3 text-sm text-muted">항목이 없습니다.</p> : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-canvas">
                        <th className="p-2 text-left sticky left-0 bg-canvas">학급</th>
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
                                  <span className="text-xs">{cell.done}/{cell.total}{cell.reassess > 0 && ` · ${cell.reassess}`}</span>
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

const tones = {
  sky: { bg: 'bg-sky', fg: 'text-brand-600' },
  mint: { bg: 'bg-mint', fg: 'text-[#1E7A4C]' },
  peach: { bg: 'bg-peach', fg: 'text-[#9A6200]' },
  lilac: { bg: 'bg-lilac', fg: 'text-[#5B3BA8]' },
}

function BigButton({ to, icon, tone, title, desc }: { to: string; icon: IconName; tone: keyof typeof tones; title: string; desc: string }) {
  const t = tones[tone]
  return (
    <Link to={to} className={`flex flex-col justify-between min-h-36 rounded-[22px] ${t.bg} p-4 hover:brightness-[0.97] active:scale-[0.98]`}>
      <span className={`w-12 h-12 rounded-2xl bg-white ${t.fg} flex items-center justify-center`}><Icon name={icon} size={26} /></span>
      <span>
        <span className="block text-xl font-bold">{title}</span>
        <span className="block text-sm text-[#3A4666]">{desc}</span>
      </span>
    </Link>
  )
}

function Step({ done, n, text, to }: { done: boolean; n: number; text: string; to: string }) {
  return (
    <Link to={to} className={`flex items-center gap-3 min-h-14 px-3 rounded-2xl ${done ? 'bg-mint' : 'bg-brand-50 hover:bg-brand-100'}`}>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${done ? 'bg-[#1E7A4C] text-white' : 'bg-white text-brand-700'}`}>{done ? <Icon name="check" size={18} /> : n}</span>
      <span className={`flex-1 ${done ? 'line-through text-muted' : 'font-semibold'}`}>{text}</span>
      {!done && <span aria-hidden>›</span>}
    </Link>
  )
}

function Stat({ label, value, hint, warn, to }: { label: string; value: string; hint?: string; warn?: boolean; to?: string }) {
  const body = (
    <Card className={`h-full ${warn ? 'bg-peach' : ''}`}>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </Card>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}
