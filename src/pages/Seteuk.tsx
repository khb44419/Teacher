import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadClassData } from '../db/reportData'
import { generateDrafts, saveSeteuk } from '../db/seteukService'
import { useApp } from '../app/AppContext'
import { computeStudent } from '../lib/grading'
import { limitStatus } from '../lib/bytes'
import { classLabel } from '../lib/classLabel'
import { downloadWorkbook, todayStamp } from '../lib/download'
import { memoDate } from '../lib/memos'
import { ReportTabs } from '../components/ReportTabs'
import { ClassSelect } from '../components/ClassSelect'
import { ByteCounter } from '../components/ByteCounter'
import { studentLabel } from '../components/StudentName'
import { Button, Card, Modal, useConfirm } from '../components/ui'
import type { RuleSettings, Score, Student } from '../db/types'
import { HelpButton } from '../components/Help'
import { Icon } from '../components/Icon'

export const SETEUK_TITLE = '교과학습발달상황 - 세부능력 및 특기사항'

export function Seteuk() {
  const { semester, hideNames } = useApp()
  const [sp, setSp] = useSearchParams()
  const classId = Number(sp.get('class')) || undefined
  const studentId = Number(sp.get('student')) || undefined
  const { ask, dialog } = useConfirm()
  const [msg, setMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const data = useLiveQuery(async () => {
    if (!classId) return undefined
    const d = await loadClassData(classId)
    if (!d) return undefined
    const students = d.students.filter((s) => s.status !== '전출').sort((a, b) => a.no - b.no)
    const seteuks = await db.seteuks.where('studentId').anyOf(students.map((s) => s.id!)).toArray()
    return { ...d, students, text: new Map(seteuks.map((s) => [s.studentId, s.text])) }
  }, [classId])
  const readOnly = semester?.status === 'closed'
  if (!rules) return null

  const select = (id: number) => setSp({ class: String(classId), student: String(id) })
  const over = data ? data.students.filter((s) => limitStatus(data.text.get(s.id!) ?? '', rules).over) : []
  const written = data ? data.students.filter((s) => (data.text.get(s.id!) ?? '').trim()).length : 0

  const genAll = (overwrite: boolean) => {
    if (!classId) return
    const run = async () => {
      try {
        const r = await generateDrafts(classId, { overwrite })
        setMsg(`초안 ${r.written}명 생성${r.skipped ? ` · 이미 쓴 ${r.skipped}명은 건너뜀` : ''}. 반드시 한 명씩 읽고 고치세요.`)
      } catch (e) { setMsg((e as Error).message) }
    }
    if (overwrite) ask('이미 쓴 세특까지 모두 새 초안으로 바뀝니다. 직접 고친 내용도 사라집니다. 계속할까요?', () => void run(), '모두 덮어쓰기')
    else void run()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="flex-1"><ReportTabs /></div>
        <HelpButton topic="seteuk" />
      </div>
      <div className="sticky top-0 z-20 bg-peach rounded-2xl p-2 text-sm font-semibold">
        ⚠ 이 문구는 초안이며 교사가 반드시 검토·수정해야 합니다. ({SETEUK_TITLE}, 최대 {rules.seteukMaxBytes.toLocaleString()}바이트)
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-48"><ClassSelect semesterId={semester?.id} value={classId} onChange={(id) => setSp({ class: String(id) })} /></div>
        <Link to="/seteuk/templates" className="min-h-11 px-4 inline-flex items-center rounded-2xl border border-line bg-white font-semibold"><Icon name="layers" /> 문구 템플릿</Link>
      </div>
      {msg && <p className="bg-brand-50 rounded-2xl p-2 text-sm">{msg}</p>}
      {!classId && <Card>학급을 선택하세요. 문구 템플릿을 먼저 만들어 두면 초안이 더 풍부해집니다.</Card>}

      {data && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm font-semibold flex-1">작성 {written}/{data.students.length}명{over.length > 0 && <span className="text-red-600"> · ⚠ 바이트 초과 {over.length}명</span>}</span>
            {!readOnly && <Button variant="secondary" onClick={() => genAll(false)}><Icon name="sparkle" /> 빈 학생 초안 생성</Button>}
            {!readOnly && <Button variant="ghost" onClick={() => genAll(true)}>전체 다시 생성</Button>}
            <Button variant="secondary" onClick={() => setExporting(true)}><Icon name="upload" /> 엑셀 내보내기</Button>
          </div>
          <div className="grid md:grid-cols-[260px_1fr] gap-3">
            <Card className="p-0 max-h-[60vh] overflow-auto">
              <ul className="divide-y">
                {data.students.map((s) => {
                  const t = data.text.get(s.id!) ?? ''
                  const st = limitStatus(t, rules)
                  return (
                    <li key={s.id}>
                      <button onClick={() => select(s.id!)} className={`w-full text-left px-3 min-h-12 flex items-center gap-2 ${studentId === s.id ? 'bg-brand-50 font-bold' : ''}`}>
                        <span className="flex-1">{studentLabel(s, hideNames)}</span>
                        <span className={`text-xs ${st.over ? 'text-red-600 font-bold' : t.trim() ? 'text-green-700' : 'text-gray-400'}`}>
                          {st.over ? `⚠ ${st.bytes}B` : t.trim() ? `✔ ${st.bytes}B` : '미작성'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
            {studentId && data.students.find((s) => s.id === studentId) ? (
              <Editor key={studentId} classId={classId!} student={data.students.find((s) => s.id === studentId)!} rules={rules} readOnly={readOnly}
                scores={data.scores.filter((x) => x.studentId === studentId)} items={data.items}
                onNext={() => {
                  const i = data.students.findIndex((s) => s.id === studentId)
                  if (i < data.students.length - 1) select(data.students[i + 1].id!)
                }} />
            ) : <Card className="text-muted">왼쪽에서 학생을 고르세요.</Card>}
          </div>
        </>
      )}
      {exporting && data && <ExportSeteuk cls={data.cls} students={data.students} text={data.text} rules={rules} onClose={() => setExporting(false)} />}
      {dialog}
    </div>
  )
}

function Editor({ classId, student, rules, readOnly, scores, items, onNext }: {
  classId: number; student: Student; rules: RuleSettings; readOnly: boolean; scores: Score[]; items: import('../db/types').AssessmentItem[]; onNext: () => void
}) {
  const { hideNames } = useApp()
  const { ask, dialog } = useConfirm()
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState<'saved' | 'saving' | ''>('')
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<string | null>(null) // 아직 저장 안 된 내용 (학생을 바꾸거나 화면을 떠날 때 바로 저장)
  const memos = useLiveQuery(() => db.memos.where('studentId').equals(student.id!).sortBy('createdAt'), [student.id])
  useEffect(() => {
    void db.seteuks.where('studentId').equals(student.id!).first().then((s) => setText(s?.text ?? ''))
  }, [student.id])
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (pending.current !== null) void saveSeteuk(student.id!, pending.current)
  }, [student.id])
  if (text === null) return null

  const change = (v: string) => {
    setText(v)
    setSaved('saving')
    pending.current = v
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      pending.current = null
      void saveSeteuk(student.id!, v).then(() => setSaved('saved'))
    }, 500)
  }
  const gen = () => {
    const run = async () => {
      window.clearTimeout(timer.current)
      pending.current = null
      await generateDrafts(classId, { studentIds: [student.id!], overwrite: true })
      const s = await db.seteuks.where('studentId').equals(student.id!).first()
      setText(s?.text ?? '')
      setSaved('saved')
    }
    if (text.trim()) ask('지금 쓴 내용이 새 초안으로 바뀝니다. 계속할까요?', () => void run(), '초안으로 바꾸기')
    else void run()
  }
  const result = computeStudent(items, new Map(scores.map((s) => [s.itemId, s])), rules)

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold flex-1">{studentLabel(student, hideNames)}</h2>
        <span className="text-xs text-muted">{saved === 'saving' ? '저장 중…' : saved === 'saved' ? '✔ 저장됨' : ''}</span>
        {!readOnly && <Button variant="secondary" onClick={gen}><Icon name="sparkle" /> 초안 생성</Button>}
      </div>
      <textarea className="w-full min-h-60 p-3 rounded-2xl border border-line leading-relaxed" value={text} readOnly={readOnly}
        onChange={(e) => change(e.target.value)} aria-label="세부능력 및 특기사항" placeholder="초안 생성을 누르거나 직접 쓰세요." />
      <ByteCounter text={text} rules={rules} />
      <div className="flex justify-end"><Button variant="secondary" onClick={onNext}>다음 학생 ▶</Button></div>
      <details open className="text-sm">
        <summary className="font-semibold cursor-pointer min-h-8">참고: 평가 결과와 관찰 메모</summary>
        <ul className="mt-1 space-y-0.5">
          {items.filter((i) => i.enabled).map((i) => {
            const r = result.items[i.id!]
            return <li key={i.id}>• {i.name}: {r?.points !== undefined ? `${Math.round(r.points * 100) / 100}/${i.maxScore}` : r?.kind === 'pending' ? '재평가 대기' : '미입력'}{r?.note ? ` (${r.note})` : ''}</li>
          })}
        </ul>
        <ul className="mt-2 space-y-0.5">
          {memos?.length ? memos.map((m) => <li key={m.id}><Icon name="note" /> {memoDate(m.createdAt)} {m.content} <span className="text-brand-700">{m.tags.map((t) => `#${t}`).join(' ')}</span></li>) : <li className="text-muted">관찰 메모가 없습니다.</li>}
        </ul>
      </details>
      {dialog}
    </Card>
  )
}

function ExportSeteuk({ cls, students, text, rules, onClose }: { cls: import('../db/types').SchoolClass; students: Student[]; text: Map<number, string>; rules: RuleSettings; onClose: () => void }) {
  const { hideNames, semester } = useApp()
  const [names, setNames] = useState(!hideNames)
  const [done, setDone] = useState('')
  const over = students.filter((s) => limitStatus(text.get(s.id!) ?? '', rules).over)
  const run = async () => {
    const XLSX = await import('xlsx')
    const header = ['번호', ...(names ? ['이름'] : []), SETEUK_TITLE, '글자 수', '바이트', '바이트 초과']
    const rows = students.map((s) => {
      const t = text.get(s.id!) ?? ''
      const st = limitStatus(t, rules)
      return [s.no, ...(names ? [s.name ?? ''] : []), t, st.chars, st.bytes, st.over ? `초과(${-st.remaining})` : '']
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [{ wch: 6 }, ...(names ? [{ wch: 10 }] : []), { wch: 80 }, { wch: 8 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, classLabel(cls))
    await downloadWorkbook(wb, `세특_${semester?.year}-${semester?.term}학기_${classLabel(cls)}_${todayStamp()}.xlsx`)
    setDone('내보냈습니다.')
  }
  return (
    <Modal title="세특 엑셀 내보내기" onClose={onClose}>
      <div className="space-y-3">
        {over.length > 0 ? (
          <div className="bg-[#FDECEC] rounded-2xl p-3">
            <p className="font-bold text-red-700">⚠ 바이트를 넘은 학생이 {over.length}명 있습니다 (NEIS에 들어가지 않습니다)</p>
            <ul className="text-sm mt-1">{over.map((s) => <li key={s.id}>• {studentLabel(s, hideNames)}: {limitStatus(text.get(s.id!) ?? '', rules).bytes}바이트</li>)}</ul>
          </div>
        ) : <p className="text-green-700">✔ 바이트를 넘은 학생이 없습니다.</p>}
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" className="w-5 h-5" checked={names} onChange={(e) => setNames(e.target.checked)} /> 이름 포함
        </label>
        <p className="text-xs text-muted">번호순, &quot;바이트 초과&quot; 열 포함. 파일에 학생 정보가 들어 있으니 보관에 주의하세요.</p>
        {done && <p className="text-green-700">{done}</p>}
        <Button className="w-full" variant={over.length ? 'danger' : 'primary'} onClick={() => void run()}>{over.length ? '초과 학생이 있지만 그래도 내보내기' : '내보내기'}</Button>
      </div>
    </Modal>
  )
}
