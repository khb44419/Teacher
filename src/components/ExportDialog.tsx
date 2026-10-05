import { useEffect, useState } from 'react'
import { db, getKv, setKv } from '../db/db'
import { loadClassData } from '../db/reportData'
import { buildClassReport, defaultExportColumns, exportColumnNames, reportToSheet, type ExportColumn } from '../lib/report'
import { classLabel, classSort } from '../lib/classLabel'
import { useApp } from '../app/AppContext'
import { downloadWorkbook, todayStamp } from '../lib/download'
import type { SchoolClass } from '../db/types'
import { Button, Modal } from './ui'

type Scope = 'class' | 'grade' | 'level' | 'all'

export function ExportDialog({ cls, onClose }: { cls: SchoolClass; onClose: () => void }) {
  const { hideNames, semester, detailed } = useApp()
  const [scope, setScope] = useState<Scope>('class')
  const [cols, setCols] = useState<{ key: ExportColumn; on: boolean }[]>(defaultExportColumns.map((key) => ({ key, on: true })))
  const [includeNames, setIncludeNames] = useState(!hideNames)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void getKv<{ key: ExportColumn; on: boolean }[] | null>('exportColumns', null).then((v) => v && setCols(v))
  }, [])
  const saveCols = (v: typeof cols) => { setCols(v); void setKv('exportColumns', v) }
  const move = (i: number, d: -1 | 1) => {
    const n = [...cols]; const j = i + d
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    saveCols(n)
  }

  const run = async () => {
    setBusy(true)
    try {
      const rules = (await db.rules.get('main'))!
      const all = (await db.classes.where('semesterId').equals(cls.semesterId).toArray()).sort(classSort)
      const targets = all.filter((c) =>
        scope === 'class' ? c.id === cls.id : scope === 'grade' ? c.level === cls.level && c.grade === cls.grade : scope === 'level' ? c.level === cls.level : true)
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const columns = cols.filter((c) => c.on).map((c) => c.key)
      for (const c of targets) {
        const d = await loadClassData(c.id!)
        if (!d) continue
        const report = buildClassReport(d.students, d.items, d.scores, rules)
        const ws = XLSX.utils.aoa_to_sheet(reportToSheet(report, columns, includeNames))
        XLSX.utils.book_append_sheet(wb, ws, classLabel(c).slice(0, 31))
      }
      const scopeName = scope === 'class' ? classLabel(cls) : scope === 'grade' ? `${cls.level}${cls.grade}학년` : scope === 'level' ? `${cls.level}학교` : '전체'
      await downloadWorkbook(wb, `수행평가_${semester?.year}-${semester?.term}학기_${scopeName}_${todayStamp()}.xlsx`)
      setMsg(`${targets.length}개 학급을 내보냈습니다 (학급마다 시트 하나).`)
    } catch (e) {
      setMsg(`내보내기 실패: ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="엑셀 내보내기" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="font-semibold mb-1">범위</div>
          <div className="grid grid-cols-2 gap-2">
            {([['class', `이 학급 (${classLabel(cls)})`], ['grade', `${cls.level}${cls.grade}학년 전체`], ['level', `${cls.level === '중' ? '중학교' : '고등학교'} 전체`], ['all', '전 학년']] as const).map(([k, v]) => (
              <Button key={k} variant={scope === k ? 'primary' : 'secondary'} onClick={() => setScope(k)}>{v}</Button>
            ))}
          </div>
        </div>
        {detailed && <div>
          <div className="font-semibold mb-1">열 순서 (NEIS 입력 순서에 맞춰 조정)</div>
          <ul className="space-y-1">
            {cols.map((c, i) => (
              <li key={c.key} className="flex items-center gap-2 border rounded-2xl px-2">
                <input type="checkbox" className="w-5 h-5" checked={c.on} aria-label={`${exportColumnNames[c.key]} 포함`}
                  onChange={(e) => saveCols(cols.map((x) => (x.key === c.key ? { ...x, on: e.target.checked } : x)))} />
                <span className="flex-1">{exportColumnNames[c.key]}</span>
                <Button variant="ghost" className="px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로">▲</Button>
                <Button variant="ghost" className="px-2" disabled={i === cols.length - 1} onClick={() => move(i, 1)} aria-label="아래로">▼</Button>
              </li>
            ))}
          </ul>
        </div>}
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" className="w-5 h-5" checked={includeNames} onChange={(e) => setIncludeNames(e.target.checked)} />
          이름 포함 (끄면 번호만 내보냄)
        </label>
        <p className="text-xs text-muted">학생은 번호순입니다. 결시 처리로 계산된 점수는 숫자로 들어가고 &quot;결시 처리 표시&quot; 열에 처리 내용이 적힙니다. 미입력은 빈칸입니다.</p>
        <p className="text-xs text-orange-700">⚠ 내려받은 파일에는 학생 정보가 들어 있습니다. 보관·전송에 주의하세요.</p>
        {msg && <p className="text-green-700">{msg}</p>}
        <Button className="w-full" onClick={() => void run()} disabled={busy}>{busy ? '만드는 중…' : '엑셀 파일 만들기'}</Button>
      </div>
    </Modal>
  )
}
