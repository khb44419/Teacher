import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setKv } from '../db/db'
import { copyClasses, createSemester } from '../db/services'
import { clearAll, generateFakeData, SHOW_DEV_TOOLS } from '../db/fakeData'
import { useApp } from '../app/AppContext'
import { Button, Card, Field, inputCls, useConfirm } from '../components/ui'

export function Settings() {
  const { semester } = useApp()
  const nav = useNavigate()
  const semesters = useLiveQuery(() => db.semesters.orderBy('year').toArray(), [])
  const { ask, dialog } = useConfirm()
  const [year, setYear] = useState(new Date().getFullYear())
  const [term, setTerm] = useState<1 | 2>(1)
  const [copyPrev, setCopyPrev] = useState(true)
  const [busy, setBusy] = useState(false)
  const sorted = [...(semesters ?? [])].sort((a, b) => b.year - a.year || b.term - a.term)

  const addSemester = async () => {
    const prev = semester?.id
    const id = await createSemester(year, term)
    if (copyPrev && prev && prev !== id) await copyClasses(prev, id)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">설정</h1>
      <Card className="space-y-2">
        <Link to="/settings/classes" className="block min-h-11 py-2 font-semibold text-brand-700">👥 학급·학생 관리 →</Link>
        <Link to="/settings/rules" className="block min-h-11 py-2 font-semibold text-brand-700">📜 규정 설정 →</Link>
        <p className="text-sm text-gray-500">평가 계획(3단계), 백업(9단계)은 단계별로 추가됩니다.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">학기</h2>
        <ul className="space-y-1">
          {sorted.map((s) => (
            <li key={s.id} className="flex items-center gap-2 min-h-11">
              <span className="flex-1">
                {s.year}학년도 {s.term}학기 {s.status === 'closed' && '(마감)'} {s.id === semester?.id && <b className="text-brand-700">· 사용 중</b>}
              </span>
              {s.id !== semester?.id && <Button variant="secondary" onClick={() => setKv('currentSemesterId', s.id)}>이 학기로 전환</Button>}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <Field label="학년도"><input className={inputCls} type="number" value={year} onChange={(e) => setYear(+e.target.value)} /></Field>
          <Field label="학기">
            <select className={inputCls} value={term} onChange={(e) => setTerm(+e.target.value as 1 | 2)}>
              <option value={1}>1학기</option><option value={2}>2학기</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" className="w-5 h-5" checked={copyPrev} onChange={(e) => setCopyPrev(e.target.checked)} />
          지금 학기의 학급·학생 명단을 새 학기로 복사 (점수·메모는 복사 안 함)
        </label>
        <Button onClick={addSemester}>학기 추가</Button>
      </Card>

      {SHOW_DEV_TOOLS && (
        <Card className="space-y-2 border-dashed border-orange-400">
          <h2 className="font-bold">🧪 개발·시연 도구 (배포 시 숨김)</h2>
          <p className="text-sm text-gray-600">가짜 데이터: 중·고 3개 학년 × 7개 반 × 25명(학생01…), 2개 학기. 기존 데이터는 모두 지워집니다.</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={busy}
              onClick={() =>
                ask('현재 데이터를 모두 지우고 가짜 데이터를 만듭니다. 계속할까요?', async () => {
                  setBusy(true)
                  await generateFakeData()
                  setBusy(false)
                  nav('/')
                }, '가짜 데이터 만들기')
              }
            >
              {busy ? '만드는 중…' : '가짜 데이터 생성'}
            </Button>
            <Button variant="danger" onClick={() => ask('모든 데이터를 삭제합니다. 되돌릴 수 없습니다.', async () => { await clearAll(); nav('/setup') }, '모두 삭제')}>
              전체 초기화
            </Button>
          </div>
        </Card>
      )}
      {dialog}
    </div>
  )
}
