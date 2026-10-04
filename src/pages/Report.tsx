import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadClassData } from '../db/reportData'
import { useApp } from '../app/AppContext'
import { buildClassReport, type ClassReport } from '../lib/report'
import { formatPoints, type ItemResult } from '../lib/grading'
import { weightSum } from '../lib/plans'
import { studentLabel } from '../components/StudentName'
import { ReportTabs } from '../components/ReportTabs'
import { ClassSelect } from '../components/ClassSelect'
import { ExportDialog } from '../components/ExportDialog'
import { ImportScoresDialog } from '../components/ImportScoresDialog'
import { Button, Card } from '../components/ui'
import type { AssessmentItem } from '../db/types'

function Cell({ r, item }: { r?: ItemResult; item: AssessmentItem }) {
  if (!r || r.kind === 'missing') return <td className="p-2 text-center bg-red-50 text-red-700 text-xs">미입력</td>
  if (r.kind === 'pending') return <td className="p-2 text-center bg-yellow-100 text-yellow-800 text-xs" title={r.note}>🔁 대기</td>
  const lv = item.scoring === 'level' ? item.levels?.find((l) => l.score === r.points)?.label : undefined
  const v = formatPoints(r.points)
  if (r.kind === 'absence') return <td className="p-2 text-center bg-orange-100 text-orange-900" title={r.note}>※{v}</td>
  return (
    <td className="p-2 text-center" title={r.note}>
      {lv ? <>{lv} <span className="text-xs text-gray-500">{v}</span></> : v}
      {r.kind === 'reassessed' && <sup className="text-brand-700 font-bold">재</sup>}
    </td>
  )
}

/** 득점률 구간별 인원 막대 (항목별 점수 분포) */
function Histogram({ bins, title }: { bins: number[]; title: string }) {
  const max = Math.max(1, ...bins)
  const labels = ['0~20%', '20~40%', '40~60%', '60~80%', '80~100%']
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold mb-1 truncate">{title}</figcaption>
      <div className="flex items-end gap-0.5 h-28 border-b border-gray-300" role="img"
        aria-label={`${title} 분포: ${labels.map((l, i) => `${l} ${bins[i]}명`).join(', ')}`}>
        {bins.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${labels[i]}: ${b}명`}>
            <span className="text-xs text-gray-700">{b > 0 ? b : ''}</span>
            <div className="w-full max-w-8 bg-brand-600 rounded-t group-hover:bg-brand-700" style={{ height: `${(b / max) * 85}%`, minHeight: b ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 text-[10px] text-gray-500">{labels.map((l) => <span key={l} className="flex-1 text-center">{l.replace('%', '')}</span>)}</div>
    </figure>
  )
}

export function Report() {
  const { semester, hideNames } = useApp()
  const [sp, setSp] = useSearchParams()
  const classId = Number(sp.get('class')) || undefined
  const [sort, setSort] = useState<'no' | 'total'>('no')
  const [dlg, setDlg] = useState<'export' | 'import' | null>(null)
  const data = useLiveQuery(async () => {
    if (!classId) return undefined
    const d = await loadClassData(classId)
    const rules = await db.rules.get('main')
    if (!d || !rules) return undefined
    return { ...d, report: buildClassReport(d.students, d.items, d.scores, rules) as ClassReport }
  }, [classId])

  const rows = data ? [...data.report.rows].sort((a, b) =>
    sort === 'no' ? a.student.no - b.student.no : (b.result.total ?? -1) - (a.result.total ?? -1)) : []

  return (
    <div className="space-y-4">
      <ReportTabs />
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-48"><ClassSelect semesterId={semester?.id} value={classId} onChange={(id) => setSp({ class: String(id) })} /></div>
        {data && <Button variant="secondary" onClick={() => setDlg('export')}>📤 엑셀 내보내기</Button>}
        {semester?.status !== 'closed' && <Button variant="secondary" onClick={() => setDlg('import')}>📥 점수 가져오기</Button>}
      </div>

      {!classId && <Card>학급을 선택하면 성적표가 나옵니다.</Card>}
      {data && !data.plan && <Card>이 학년의 평가 계획이 없습니다. <Link className="text-brand-700 underline" to="/plans">평가 계획 만들기 →</Link></Card>}

      {data?.plan && (
        <>
          {weightSum(data.items) !== 100 && (
            <p className="bg-yellow-50 border border-yellow-400 rounded-lg p-2 text-sm">⚠ 반영 비율 합이 {weightSum(data.items)}%입니다. 총점이 100점 만점이 아닐 수 있습니다.</p>
          )}
          <div className="flex gap-2 items-center flex-wrap text-sm">
            <span>정렬:</span>
            <Button variant={sort === 'no' ? 'primary' : 'secondary'} onClick={() => setSort('no')}>번호순</Button>
            <Button variant={sort === 'total' ? 'primary' : 'secondary'} onClick={() => setSort('total')}>총점순</Button>
          </div>
          <div className="overflow-auto bg-white border rounded-xl max-h-[65vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-gray-100">학생</th>
                  {data.report.items.map((i) => (
                    <th key={i.id} className="p-2 whitespace-nowrap">{i.name}<div className="text-xs font-normal text-gray-500">{i.maxScore}점·{i.weight}%</div></th>
                  ))}
                  <th className="p-2 whitespace-nowrap">총점</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, result }) => (
                  <tr key={student.id} className={`border-t ${student.status === '전출' ? 'opacity-50' : ''}`}>
                    <td className="p-2 sticky left-0 bg-white whitespace-nowrap font-semibold">
                      {studentLabel(student, hideNames)}{student.status !== '재학' && <span className="ml-1 text-xs border rounded px-1">{student.status}</span>}
                    </td>
                    {data.report.items.map((i) => <Cell key={i.id} r={result.items[i.id!]} item={i} />)}
                    <td className="p-2 text-center font-bold">{result.total ?? '-'}{!result.complete && result.total !== undefined && <span className="text-xs text-gray-500 font-normal"> (미완)</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 sticky bottom-0">
                <tr className="border-t-2 font-semibold">
                  <td className="p-2 sticky left-0 bg-gray-50">학급 평균</td>
                  {data.report.itemStats.map((s) => <td key={s.itemId} className="p-2 text-center">{s.avg ?? '-'}</td>)}
                  <td className="p-2 text-center">{data.report.totalAvg ?? '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-600">
            표시: <span className="bg-orange-100 px-1">※ 결시 처리 점수</span> <span className="bg-yellow-100 px-1">🔁 재평가 대기</span> <span className="bg-red-50 px-1">미입력</span> <sup className="text-brand-700 font-bold">재</sup> 재평가 점수 · (미완) 아직 입력이 끝나지 않은 총점 · 칸에 마우스를 올리면 처리 내용이 보입니다. 전출 학생은 평균에서 제외됩니다.
          </p>
          <Card>
            <h2 className="font-bold mb-2">항목별 점수 분포 (득점률 구간별 인원)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.report.items.map((i) => {
                const s = data.report.itemStats.find((x) => x.itemId === i.id)!
                return <Histogram key={i.id} bins={s.bins} title={`${i.name} (평균 ${s.avg ?? '-'})`} />
              })}
            </div>
          </Card>
        </>
      )}
      {dlg === 'export' && data?.cls && <ExportDialog cls={data.cls} onClose={() => setDlg(null)} />}
      {dlg === 'import' && semester?.id && <ImportScoresDialog semesterId={semester.id} onClose={() => setDlg(null)} />}
    </div>
  )
}
