import { useMemo, useState } from 'react'
import { importRoster } from '../db/services'
import type { SchoolLevel } from '../db/types'
import { parseRoster, parseTable, type RosterRow } from '../lib/roster'
import { Button, Field, inputCls } from './ui'
import { FilePick } from './FilePick'

async function fileToRows(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx') // 필요할 때만 불러옴 (앱 시작 속도)
  const wb = XLSX.read(await file.arrayBuffer())
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false })
  return data.map((r) => r.map((c) => String(c ?? '').trim()))
}

export function RosterImport({ semesterId, onDone }: { semesterId: number; onDone?: () => void }) {
  const [rows, setRows] = useState<string[][]>([])
  const [text, setText] = useState('')
  const [level, setLevel] = useState<SchoolLevel>('중')
  const [subject, setSubject] = useState('음악')
  const [createMissing, setCreateMissing] = useState(true)
  const [result, setResult] = useState('')
  const parsed: RosterRow[] = useMemo(() => parseRoster(rows, level), [rows, level])
  const errors = parsed.filter((r) => r.error)
  const ok = parsed.length - errors.length

  const apply = async () => {
    const r = await importRoster(semesterId, parsed, subject.trim() || '음악', createMissing)
    setResult(`완료: 이름 갱신 ${r.updated}명, 새로 추가 ${r.added}명` + (r.classesCreated ? `, 새 학급 ${r.classesCreated}개` : ''))
    setRows([])
    setText('')
    onDone?.()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        열 순서: <b>학년, 반, 번호, 이름</b> (이름은 없어도 됩니다). 엑셀에서 복사해 붙여넣거나 파일(.xlsx/.csv)을 올리세요.
        학교급 열(맨 앞, "중"/"고")이 있으면 함께 읽습니다.
      </p>
      <Field label="학교급 (표에 학교급 열이 없을 때 적용)">
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)}>
          <option value="중">중학교</option>
          <option value="고">고등학교</option>
        </select>
      </Field>
      <textarea
        className={`${inputCls} min-h-28 py-2 font-mono text-sm`}
        placeholder={'1\t1\t1\t김민수\n1\t1\t2\t이서연'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setRows(parseTable(e.target.value))
        }}
      />
      <FilePick label="📂 엑셀·CSV 파일 고르기" accept=".xlsx,.xls,.csv" onFile={async (f) => { setRows(await fileToRows(f)); setText('') }} />
      {parsed.length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold">
            미리보기: 정상 {ok}행 / <span className={errors.length ? 'text-red-600' : ''}>오류 {errors.length}행</span> (오류 행은 가져오지 않습니다)
          </p>
          <div className="max-h-60 overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr><th className="p-1">행</th><th>학교급</th><th>학년</th><th>반</th><th>번호</th><th>이름</th><th>상태</th></tr>
              </thead>
              <tbody>
                {parsed.slice(0, 200).map((r) => (
                  <tr key={r.line} className={r.error ? 'bg-red-50 text-red-700' : ''}>
                    <td className="p-1 text-center">{r.line}</td>
                    <td className="text-center">{r.level}</td>
                    <td className="text-center">{r.grade || '-'}</td>
                    <td className="text-center">{r.classNo || '-'}</td>
                    <td className="text-center">{r.no || '-'}</td>
                    <td className="text-center">{r.name ?? '(없음)'}</td>
                    <td className="text-center">{r.error ? `⚠ ${r.error}` : '✔ 정상'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.length > 200 && <p className="text-xs text-gray-500">앞 200행만 표시했습니다 (전체가 가져와집니다).</p>}
          <label className="flex items-center gap-2 min-h-11">
            <input type="checkbox" className="w-5 h-5" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
            없는 학급은 자동으로 만들기
          </label>
          {createMissing && (
            <Field label="새 학급의 과목명">
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <p className="text-xs text-gray-500">이미 있는 번호는 이름만 바뀌고, 점수 등 다른 기록은 그대로 유지됩니다.</p>
          <Button onClick={apply} disabled={ok === 0}>{ok}명 가져오기</Button>
        </div>
      )}
      {result && <p className="text-green-700">✅ {result}</p>}
    </div>
  )
}
