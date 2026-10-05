import { useState } from 'react'
import { db } from '../db/db'
import { loadImportClasses } from '../db/reportData'
import { importScores } from '../db/scoreService'
import { parseScoreSheet, type ImportEntry, type ImportError } from '../lib/report'
import { Button, Modal, useConfirm } from './ui'
import { FilePick } from './FilePick'

export function ImportScoresDialog({ semesterId, onClose }: { semesterId: number; onClose: () => void }) {
  const [entries, setEntries] = useState<ImportEntry[]>([])
  const [errors, setErrors] = useState<ImportError[]>([])
  const [overwrite, setOverwrite] = useState(0)
  const [skipped, setSkipped] = useState({ same: 0, special: 0 })
  const [special, setSpecial] = useState<ImportEntry[]>([])
  const [includeSpecial, setIncludeSpecial] = useState(false)
  const [msg, setMsg] = useState('')
  const [loaded, setLoaded] = useState(false)
  const { ask, dialog } = useConfirm()

  const read = async (f: File) => {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await f.arrayBuffer())
    const classes = await loadImportClasses(semesterId)
    const all: ImportEntry[] = [], errs: ImportError[] = []
    for (const name of wb.SheetNames) {
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, blankrows: false })
      const r = parseScoreSheet(name, aoa, classes)
      all.push(...r.entries); errs.push(...r.errors)
    }
    // 바뀐 것만 가져옴. 결시·재평가로 처리된 칸은 기본적으로 건너뜀 (내보낸 파일을 다시 넣어도 결시 처리가 사라지지 않게)
    let ow = 0, same = 0
    const changed: ImportEntry[] = [], spc: ImportEntry[] = []
    for (const e of all) {
      const prev = await db.scores.where('[studentId+itemId]').equals([e.studentId, e.itemId]).first()
      if (prev && prev.status === 'normal' && prev.value === e.value && prev.levelLabel === e.levelLabel) { same++; continue }
      if (prev && prev.status !== 'normal') { spc.push(e); continue }
      if (prev) ow++
      changed.push(e)
    }
    setEntries(changed); setSpecial(spc); setErrors(errs); setOverwrite(ow); setSkipped({ same, special: spc.length }); setLoaded(true); setMsg('')
  }

  const apply = () => {
    const go = async () => {
      try {
        const list = includeSpecial ? [...entries, ...special] : entries
        await importScores(list)
        setMsg(`✔ ${list.length}건을 가져왔습니다.`)
        setEntries([]); setLoaded(false)
      } catch (e) { setMsg((e as Error).message) }
    }
    const ow = overwrite + (includeSpecial ? special.length : 0)
    if (ow > 0) ask(`이미 입력된 점수 ${ow}건이 엑셀 값으로 덮어써집니다. (결시·재평가 표시도 정상 점수로 바뀝니다) 계속할까요?`, () => void go(), '덮어쓰기')
    else void go()
  }

  return (
    <Modal title="점수 가져오기 (엑셀)" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>기존 엑셀 점수를 옮겨 올 때 씁니다. 이 앱에서 내보낸 파일 형식을 그대로 쓰면 가장 쉽습니다.</p>
        <ul className="list-disc pl-5 text-muted">
          <li>시트 이름을 &quot;중1-3&quot;처럼 쓰거나, 학교급·학년·반 열을 넣으세요.</li>
          <li>&quot;번호&quot; 열이 꼭 필요하고, 점수 열 제목은 평가 항목 이름과 같아야 합니다.</li>
          <li>수준형은 수준 이름(상/중/하) 또는 환산 점수. 빈칸은 건너뜁니다.</li>
        </ul>
        <FilePick label="엑셀 파일 고르기" accept=".xlsx,.xls,.csv" onFile={(f) => void read(f)} />
        {loaded && (
          <div className="space-y-2">
            <p className="font-semibold">가져올 점수 {entries.length + (includeSpecial ? special.length : 0)}건 · 덮어쓰기 {overwrite + (includeSpecial ? special.length : 0)}건 · <span className={errors.length ? 'text-red-600' : ''}>오류 {errors.length}건</span></p>
            {skipped.same > 0 && <p className="text-muted">이미 같은 점수 {skipped.same}건은 건너뜁니다.</p>}
            {special.length > 0 && (
              <label className="flex items-start gap-2 min-h-11 bg-orange-50 rounded p-2">
                <input type="checkbox" className="w-5 h-5 mt-0.5" checked={includeSpecial} onChange={(e) => setIncludeSpecial(e.target.checked)} />
                <span>결시·재평가로 처리된 칸 {special.length}건도 엑셀 점수로 덮어쓰기 (보통은 끄세요: 결시 처리 점수가 일반 점수로 바뀝니다)</span>
              </label>
            )}
            {errors.length > 0 && (
              <ul className="max-h-40 overflow-auto bg-[#FDECEC] rounded p-2">
                {errors.slice(0, 100).map((e, i) => <li key={i}>⚠ {e.where}: {e.message}</li>)}
              </ul>
            )}
            <Button className="w-full" disabled={!(entries.length + (includeSpecial ? special.length : 0))} onClick={apply}>{entries.length + (includeSpecial ? special.length : 0)}건 가져오기</Button>
          </div>
        )}
        {msg && <p className="font-semibold">{msg}</p>}
      </div>
      {dialog}
    </Modal>
  )
}
