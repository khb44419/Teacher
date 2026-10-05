import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKv, setKv } from '../db/db'
import { createSemester } from '../db/services'
import { BulkClassForm } from '../components/BulkClassForm'
import { RosterImport } from '../components/RosterImport'
import { Button, Card, Field, inputCls } from '../components/ui'
import { useApp } from '../app/AppContext'
import { enterPractice } from '../db/practice'
import { HelpButton, SlideShow } from '../components/Help'

const STEPS = ['학년도·학기', '학급 만들기', '학생 명단', '규정 확인', '시작하기']

export function Wizard() {
  const nav = useNavigate()
  const { semester } = useApp()
  const now = new Date()
  const [step, setStep] = useState(0)
  const [year, setYear] = useState(now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear())
  const [term, setTerm] = useState<1 | 2>(now.getMonth() >= 2 && now.getMonth() <= 7 ? 1 : 2)
  const [semId, setSemId] = useState<number | undefined>(semester?.id)
  const [checked, setChecked] = useState(false)
  const [intro, setIntro] = useState(false)
  // 처음 한 번은 사용법 그림 설명을 자동으로 보여 줌
  useEffect(() => { void getKv('seenIntro', false).then((seen) => { if (!seen) setIntro(true) }) }, [])
  const rules = useLiveQuery(() => db.rules.get('main'), [semId, step])
  const classCount = useLiveQuery(
    async () => (semId ? db.classes.where('semesterId').equals(semId).count() : 0),
    [semId],
  )

  const next = async () => {
    if (step === 0) setSemId(await createSemester(year, term))
    if (step === 3) {
      await db.rules.update('main', { confirmedYear: year, updatedAt: Date.now() })
    }
    setStep(step + 1)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {intro && <SlideShow topic="start" onClose={() => { setIntro(false); void setKv('seenIntro', true) }} />}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold flex-1">🎵 처음 설정</h1>
        <HelpButton topic="start" />
      </div>
      {step === 0 && (
        <div className="bg-purple-50 border border-purple-300 rounded-xl p-4 space-y-2">
          <p className="font-bold">🎓 처음이라 어떻게 쓰는지 궁금하세요?</p>
          <p className="text-sm">가짜 학생과 점수가 들어 있는 <b>연습 모드</b>에서 먼저 눌러 볼 수 있습니다. 연습은 진짜 데이터와 완전히 따로입니다.</p>
          <Button variant="secondary" onClick={enterPractice}>먼저 연습해 보기</Button>
        </div>
      )}
      <ol className="flex gap-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex-1 text-center py-2 rounded ${i === step ? 'bg-brand-600 text-white font-bold' : i < step ? 'bg-brand-100' : 'bg-gray-200'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <Card className="space-y-4">
        {step === 0 && (
          <>
            <p>이번 학기를 선택하세요. 나중에 학기를 추가·변경할 수 있습니다.</p>
            <Field label="학년도"><input className={inputCls} type="number" value={year} onChange={(e) => setYear(+e.target.value)} /></Field>
            <Field label="학기">
              <select className={inputCls} value={term} onChange={(e) => setTerm(+e.target.value as 1 | 2)}>
                <option value={1}>1학기</option>
                <option value={2}>2학기</option>
              </select>
            </Field>
          </>
        )}
        {step === 1 && semId && (
          <>
            <p>학교급·학년별로 학급과 번호를 한 번에 만듭니다. 학년마다 반복하세요. (현재 {classCount ?? 0}개 학급)</p>
            <BulkClassForm semesterId={semId} />
          </>
        )}
        {step === 2 && semId && (
          <>
            <p className="font-semibold">선택 사항입니다. 건너뛰어도 번호만으로 모든 기능을 쓸 수 있고, 이름은 나중에 넣어도 됩니다.</p>
            <RosterImport semesterId={semId} />
          </>
        )}
        {step === 3 && rules && (
          <>
            <p className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
              ⚠ 아래 값은 <b>기본값</b>입니다. 반드시 <b>우리 학교 학업성적관리규정</b>과 일치하는지 확인하세요.
              자세한 수정은 [설정 → 규정 설정]에서 할 수 있습니다.
            </p>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li>세특 글자 수 제한: {rules.seteukMaxChars}자 = {rules.seteukMaxBytes}바이트 (한글 {rules.byteHangul}, 영문·숫자·공백 {rules.byteOther}, 줄바꿈 {rules.byteNewline})</li>
              <li>소수점 처리: {rules.roundDigits}자리 {{ round: '반올림', floor: '버림', ceil: '올림' }[rules.roundMode]}</li>
              <li>결시 처리:
                <ul className="list-disc pl-5">
                  {rules.absenceReasons.map((a) => (
                    <li key={a.id}>{a.label} → {methodText(a.method, a.creditRatio, a.fallback)}</li>
                  ))}
                </ul>
              </li>
            </ul>
            <label className="flex items-start gap-2 min-h-11">
              <input type="checkbox" className="w-5 h-5 mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              올해 학교생활기록부 기재요령과 우리 학교 학업성적관리규정을 확인했습니다. (규정 설정 화면에서 나중에 고칠 수 있습니다)
            </label>
          </>
        )}
        {step === 4 && (
          <>
            <p className="text-lg font-bold">준비가 끝났습니다 🎉</p>
            <p>다음은 이번 학기 <b>평가 계획(평가 항목)</b>을 만드는 단계입니다. 평가 항목은 직접 자유롭게 만들 수 있습니다.</p>
            <Button className="w-full" onClick={() => nav('/plans')}>평가 계획 만들기로 이동</Button>
            <Button variant="secondary" className="w-full" onClick={() => nav('/')}>대시보드로 가기</Button>
          </>
        )}
      </Card>

      {step < 4 && (
        <div className="flex justify-between">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>← 이전</Button>
          <Button onClick={next} disabled={(step === 1 && !classCount) || (step === 3 && !checked)}>
            {step === 2 ? '다음 (건너뛰기 가능) →' : '다음 →'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function methodText(m: string, ratio: number, fallback?: string) {
  const base = (k: string) =>
    ({ minScore: '기본 점수(최저점)', credit: `인정점 ${ratio}%`, zero: '0점', reassess: '재평가 후 입력' } as Record<string, string>)[k]
  return m === 'reassess' ? `재평가 우선 (불가 시 ${base(fallback ?? 'credit')})` : base(m)
}
