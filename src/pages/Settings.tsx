import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setKv } from '../db/db'
import { copyClasses, createSemester, setSemesterStatus } from '../db/services'
import { clearAll, SHOW_DEV_TOOLS } from '../db/fakeData'
import { enterPractice, exitPractice, resetPractice } from '../db/practice'
import { useApp } from '../app/AppContext'
import { HelpButton } from '../components/Help'
import { Button, Card, Field, inputCls, useConfirm } from '../components/ui'

function MenuLink({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 min-h-16 px-3 rounded-xl border border-gray-200 bg-white hover:bg-brand-50">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-gray-600">{desc}</span>
      </span>
      <span aria-hidden>›</span>
    </Link>
  )
}

function Toggle({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: ReactNode }) {
  return (
    <label className="flex items-center gap-3 min-h-16 cursor-pointer">
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-gray-600">{desc}</span>
      </span>
      <input type="checkbox" role="switch" className="w-7 h-7 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function Settings() {
  const { semester, practice, detailed, setDetailed, bigText, setBigText } = useApp()
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
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">설정</h1>
        <HelpButton topic="settings" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <MenuLink to="/help" icon="❓" title="사용법 모음" desc="상황별로 그림을 넘겨 가며 배우기" />
        <MenuLink to="/settings/classes" icon="👥" title="학급·학생 관리" desc="학급 만들기, 명단 넣기, 이름 고치기" />
        <MenuLink to="/plans" icon="📋" title="평가 계획" desc="이번 학기 평가 항목 만들기·고치기" />
        <MenuLink to="/settings/backup" icon="💾" title="백업·기기 옮기기" desc="노트북 ↔ 휴대폰, 백업 파일, 앱 잠금" />
        {detailed && <MenuLink to="/settings/rules" icon="📜" title="규정 설정" desc="세특 바이트, 결시 처리, 소수점" />}
        {detailed && <MenuLink to="/plans/history" icon="🕘" title="변경 이력" desc="평가 항목·규정을 언제 바꿨는지" />}
      </div>

      <Card className="divide-y">
        <Toggle checked={bigText} onChange={setBigText} title="글자 크게 보기" desc="화면의 글자와 버튼을 더 크게 보여 줍니다." />
        <Toggle checked={detailed} onChange={setDetailed} title="자세히 모드"
          desc={<>규정 설정, 변경 이력, 항목 보관함, 엑셀 열 순서 같은 세부 기능도 보여 줍니다. 평소에는 꺼 두셔도 됩니다.</>} />
      </Card>

      <Card className="space-y-2 border-purple-300 bg-purple-50">
        <h2 className="font-bold text-lg">🎓 연습 모드</h2>
        {practice ? (
          <>
            <p className="text-sm">지금은 연습 중입니다. 연습을 끝내면 연습한 내용은 사라지고 진짜 데이터 화면으로 돌아갑니다.</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" disabled={busy} onClick={() => ask('연습 데이터를 처음 상태로 되돌립니다.', async () => { setBusy(true); await resetPractice(); setBusy(false); nav('/') }, '처음 상태로')}>
                {busy ? '준비 중…' : '연습 데이터 처음 상태로'}
              </Button>
              <Button onClick={() => void exitPractice()}>연습 끝내기</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">가짜 학생(학생01…)과 점수가 들어 있는 연습 공간에서 마음껏 눌러 볼 수 있습니다. <b>진짜 데이터는 전혀 바뀌지 않습니다.</b></p>
            <Button onClick={enterPractice}>연습 모드로 둘러보기</Button>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">학기</h2>
        <ul className="space-y-1">
          {sorted.map((s) => (
            <li key={s.id} className="flex items-center gap-2 min-h-11 flex-wrap">
              <span className="flex-1">
                {s.year}학년도 {s.term}학기 {s.status === 'closed' && '(마감)'} {s.id === semester?.id && <b className="text-brand-700">· 사용 중</b>}
              </span>
              {s.id !== semester?.id && <Button variant="secondary" onClick={() => setKv('currentSemesterId', s.id)}>이 학기로 전환</Button>}
              {s.status === 'active' ? (
                <Button variant="ghost" onClick={() => ask(`${s.year}학년도 ${s.term}학기를 마감합니다.\n마감하면 점수·평가 계획·메모·세특이 읽기 전용이 되고, 조회와 엑셀 내보내기는 계속 할 수 있습니다.\n마감 전에 백업을 권합니다.`, () => void setSemesterStatus(s.id!, 'closed'), '학기 마감')}>학기 마감</Button>
              ) : (
                <Button variant="ghost" onClick={() => ask(`${s.year}학년도 ${s.term}학기 마감을 해제해 다시 수정할 수 있게 합니다.`, () => void setSemesterStatus(s.id!, 'active'), '마감 해제')}>마감 해제</Button>
              )}
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer min-h-11 leading-[44px] font-semibold text-brand-700">＋ 새 학기 추가하기</summary>
          <div className="space-y-3 pt-2">
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
          </div>
        </details>
      </Card>

      {SHOW_DEV_TOOLS && !practice && (
        <Card className="space-y-2 border-dashed border-orange-400">
          <h2 className="font-bold">🧪 개발 도구 (배포 시 숨김)</h2>
          <Button variant="danger" onClick={() => ask('이 기기의 진짜 데이터를 모두 삭제합니다. 되돌릴 수 없습니다.', async () => { await clearAll(); nav('/setup') }, '모두 삭제')}>
            전체 초기화
          </Button>
        </Card>
      )}
      {dialog}
    </div>
  )
}
