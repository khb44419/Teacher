import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { defaultAbsenceReasons, defaultRules } from '../db/defaults'
import { updateRules } from '../db/services'
import { useApp } from '../app/AppContext'
import { limitStatus } from '../lib/bytes'
import { Button, Card, inputCls, useConfirm } from '../components/ui'
import type { AbsenceMethod, AbsenceReason, RuleSettings } from '../db/types'

const roundNames = { round: '반올림', floor: '버림', ceil: '올림' } as const
const methodNames: Record<AbsenceMethod, string> = {
  minScore: '기본 점수(최저점) 부여',
  credit: '인정점 부여',
  reassess: '재평가 후 점수 입력',
  zero: '0점 처리',
}
const categoryNames = { approved: '인정결시', unapproved: '미인정결시', nosubmit: '미응시·미제출' } as const

/** 입력하는 즉시 저장되는 숫자 칸 (칸을 벗어날 때 저장, 비우면 null) */
function NumField({ value, onSave, min, max, nullable }: {
  value: number | null
  onSave: (v: number | null) => void
  min: number
  max?: number
  nullable?: boolean
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? '' : String(value))
  const bad = shown !== '' && (isNaN(+shown) || +shown < min || (max !== undefined && +shown > max))
  return (
    <input
      className={`${inputCls} ${bad ? 'border-red-500' : ''}`}
      type="number"
      inputMode="decimal"
      value={shown}
      min={min}
      max={max}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text === null) return
        if (text === '' && nullable) onSave(null)
        else if (text !== '' && !bad) onSave(+text)
        setText(null)
      }}
    />
  )
}

function Setting({ title, desc, onReset, children }: { title: string; desc: ReactNode; onReset?: () => void; children: ReactNode }) {
  return (
    <div className="py-3 border-t first:border-t-0 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-600">{desc}</div>
        </div>
        {onReset && <Button variant="ghost" className="text-sm shrink-0" onClick={onReset}>기본값으로 되돌리기</Button>}
      </div>
      {children}
    </div>
  )
}

function ListEditor({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center bg-brand-50 border border-brand-100 rounded-full pl-3">
            {v}
            <button className="min-h-11 min-w-11" aria-label={`${v} 삭제`} onClick={() => onChange(values.filter((x) => x !== v))}>✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} value={draft} placeholder="새 항목 입력" onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button variant="secondary" onClick={add}>추가</Button>
      </div>
    </div>
  )
}

const yn = (v: unknown) => String(v)

export function Rules() {
  const { semester } = useApp()
  const rules = useLiveQuery(() => db.rules.get('main'), [])
  const logs = useLiveQuery(() => db.changeLogs.orderBy('at').reverse().filter((l) => l.target.startsWith('규정')).toArray(), [])
  const { ask, dialog } = useConfirm()
  const [sample, setSample] = useState('')
  if (!rules) return null
  const def = defaultRules()

  /** 값 하나를 바꾸고 이력에 기록 */
  const set = <K extends keyof RuleSettings>(key: K, label: string, v: RuleSettings[K], show: (x: RuleSettings[K]) => string = yn) => {
    if (JSON.stringify(rules[key]) === JSON.stringify(v)) return
    void updateRules({ [key]: v } as Partial<RuleSettings>, [
      { target: `규정 설정 · ${label}`, detail: label, before: show(rules[key]), after: show(v) },
    ])
  }
  const reset = <K extends keyof RuleSettings>(keys: K[], label: string) =>
    ask(`"${label}"을(를) 기본값으로 되돌립니다.`, () => {
      const patch: Partial<RuleSettings> = {}
      keys.forEach((k) => ((patch as Record<string, unknown>)[k] = def[k]))
      void updateRules(patch, [{ target: `규정 설정 · ${label}`, detail: `${label} 기본값으로 되돌림` }])
    }, '되돌리기')

  const reasons = rules.absenceReasons
  const setReason = (id: string, p: Partial<AbsenceReason>) => {
    const next = reasons.map((r) => (r.id === id ? { ...r, ...p } : r))
    const before = reasons.find((r) => r.id === id)!
    void updateRules({ absenceReasons: next }, [
      { target: `규정 설정 · 결시 처리`, detail: `${before.label}`, before: reasonText(before), after: reasonText({ ...before, ...p }) },
    ])
  }
  const status = limitStatus(sample, rules)
  const needConfirm = semester && rules.confirmedYear !== semester.year

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-brand-700 min-h-11 leading-[44px]">← 설정</Link>
        <h1 className="text-xl font-bold flex-1">규정 설정</h1>
      </div>

      <div className="sticky top-0 z-10 bg-yellow-50 border border-yellow-400 rounded-lg p-3 text-sm font-semibold">
        ⚠ 이 값은 반드시 우리 학교 학업성적관리규정과 일치하는지 확인하세요. (아래 값은 기본값일 뿐입니다)
      </div>

      {needConfirm && (
        <Card className="bg-blue-50 border-blue-300 space-y-2">
          <p className="font-semibold">올해({semester.year}학년도) 학교생활기록부 기재요령과 학교 학업성적관리규정을 확인하셨나요?</p>
          <Button onClick={() => void updateRules({ confirmedYear: semester.year }, [{ target: '규정 설정 · 확인', detail: `${semester.year}학년도 기재요령·학업성적관리규정 확인` }])}>
            네, 확인했습니다
          </Button>
        </Card>
      )}
      {semester && rules.confirmedYear === semester.year && (
        <p className="text-sm text-green-700">✅ {semester.year}학년도 규정 확인 완료</p>
      )}

      <Card>
        <h2 className="font-bold text-lg mb-1">교과학습발달상황 – 세부능력 및 특기사항 (세특)</h2>
        <Setting
          title="최대 바이트 수"
          desc="과목별 세부능력 및 특기사항 최대 500자 = 1,500바이트 (기재요령이 바뀌면 여기서 수정)"
          onReset={() => reset(['seteukMaxBytes', 'seteukMaxChars'], '세특 글자·바이트 제한')}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">최대 바이트<NumField value={rules.seteukMaxBytes} min={1} onSave={(v) => set('seteukMaxBytes', '세특 최대 바이트', v ?? 1500)} /></label>
            <label className="text-sm">최대 글자(참고용)<NumField value={rules.seteukMaxChars} min={1} onSave={(v) => set('seteukMaxChars', '세특 최대 글자', v ?? 500)} /></label>
          </div>
        </Setting>
        <Setting
          title="바이트 계산 규칙"
          desc="NEIS 기준: 한글 1자 = 3바이트, 영문·숫자·공백·일반 기호 = 1바이트, 줄바꿈(엔터) = 2바이트"
          onReset={() => reset(['byteHangul', 'byteOther', 'byteNewline'], '바이트 계산 규칙')}
        >
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm">한글<NumField value={rules.byteHangul} min={1} max={4} onSave={(v) => set('byteHangul', '한글 바이트', v ?? 3)} /></label>
            <label className="text-sm">영문·숫자·공백<NumField value={rules.byteOther} min={1} max={4} onSave={(v) => set('byteOther', '영문·숫자 바이트', v ?? 1)} /></label>
            <label className="text-sm">줄바꿈<NumField value={rules.byteNewline} min={1} max={4} onSave={(v) => set('byteNewline', '줄바꿈 바이트', v ?? 2)} /></label>
          </div>
          <p className="text-xs text-gray-500">한글이 아닌 특수문자(“ ” · … 등)는 한글과 같은 바이트로 계산합니다. NEIS에서 실제 값을 확인해 보세요.</p>
          <textarea className={`${inputCls} min-h-20 py-2`} placeholder="여기에 글을 써 보면 바이트가 계산됩니다 (연습용, 저장되지 않음)" value={sample} onChange={(e) => setSample(e.target.value)} />
          <p className={`font-semibold ${status.over ? 'text-red-600' : ''}`}>
            글자 {status.chars}자 / {status.bytes}바이트 / 남은 {status.remaining}바이트 {status.over && '⚠ 초과'}
          </p>
        </Setting>
      </Card>

      <Card>
        <h2 className="font-bold text-lg mb-1">결시(결석) 처리</h2>
        <p className="text-sm text-gray-600 mb-2">
          시·도교육청 시행지침과 학교 학업성적관리규정에 따라 정합니다. 인정점 비율(질병 80% 등)은 <b>예시값</b>이니 학교 규정에 맞게 고치세요.
          인정점의 기준은 &quot;같은 학기 다른 수행평가 항목들의 환산 평균&quot; 또는 &quot;항목 만점&quot; 중에서 고릅니다.
        </p>
        <div className="space-y-3">
          {reasons.map((r) => {
            const usesCredit = r.method === 'credit' || (r.method === 'reassess' && r.fallback === 'credit')
            return (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="text-sm">사유 이름
                    <input key={r.label} className={inputCls} defaultValue={r.label} onBlur={(e) => e.target.value.trim() && e.target.value !== r.label && setReason(r.id, { label: e.target.value.trim() })} />
                  </label>
                  <label className="text-sm">구분
                    <select className={inputCls} value={r.category} onChange={(e) => setReason(r.id, { category: e.target.value as AbsenceReason['category'] })}>
                      {Object.entries(categoryNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">처리 방법
                    <select className={inputCls} value={r.method} onChange={(e) => {
                      const m = e.target.value as AbsenceMethod
                      setReason(r.id, { method: m, fallback: m === 'reassess' ? r.fallback ?? 'credit' : undefined })
                    }}>
                      {Object.entries(methodNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                </div>
                {r.method === 'reassess' && (
                  <label className="text-sm block">재평가가 불가능할 때
                    <select className={inputCls} value={r.fallback ?? 'credit'} onChange={(e) => setReason(r.id, { fallback: e.target.value as AbsenceReason['fallback'] })}>
                      {(['credit', 'minScore', 'zero'] as const).map((k) => <option key={k} value={k}>{methodNames[k]}</option>)}
                    </select>
                  </label>
                )}
                {usesCredit && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">인정점 비율(%)
                      <NumField value={r.creditRatio} min={0} max={100} onSave={(v) => setReason(r.id, { creditRatio: v ?? 0 })} />
                    </label>
                    <label className="text-sm">기준 점수
                      <select className={inputCls} value={r.creditBase} onChange={(e) => setReason(r.id, { creditBase: e.target.value as AbsenceReason['creditBase'] })}>
                        <option value="othersAverage">다른 수행평가 항목 환산 평균</option>
                        <option value="maxScore">해당 항목 만점</option>
                      </select>
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">→ {reasonText(r)}</span>
                  <Button variant="ghost" onClick={() => ask(`"${r.label}" 사유를 삭제합니다. (이미 이 사유로 입력된 점수가 있으면 점수 입력 단계에서 문제가 될 수 있습니다)`, () =>
                    void updateRules({ absenceReasons: reasons.filter((x) => x.id !== r.id) }, [{ target: '규정 설정 · 결시 처리', detail: `사유 삭제: ${r.label}`, before: reasonText(r) }]), '삭제')}>🗑 삭제</Button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button variant="secondary" onClick={() => void updateRules({ absenceReasons: [...reasons, { id: `r${Date.now()}`, label: '새 사유', category: 'approved', method: 'reassess', fallback: 'credit', creditRatio: 100, creditBase: 'othersAverage' }] },
            [{ target: '규정 설정 · 결시 처리', detail: '사유 추가' }])}>＋ 사유 추가</Button>
          <Button variant="ghost" onClick={() => ask('결시 사유와 처리 방법을 모두 기본값으로 되돌립니다. 직접 추가·수정한 내용은 사라집니다.', () =>
            void updateRules({ absenceReasons: defaultAbsenceReasons() }, [{ target: '규정 설정 · 결시 처리', detail: '결시 처리 기본값으로 되돌림' }]), '되돌리기')}>
            기본값으로 되돌리기
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-lg mb-1">성적 계산</h2>
        <Setting
          title="소수점 처리"
          desc="환산 총점의 소수점 처리 방식과 자릿수"
          onReset={() => reset(['roundMode', 'roundDigits'], '소수점 처리')}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">방식
              <select className={inputCls} value={rules.roundMode} onChange={(e) => set('roundMode', '소수점 처리 방식', e.target.value as RuleSettings['roundMode'], (x) => roundNames[x])}>
                {Object.entries(roundNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">소수점 아래 자릿수
              <select className={inputCls} value={rules.roundDigits} onChange={(e) => set('roundDigits', '소수점 자릿수', +e.target.value)}>
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}자리</option>)}
              </select>
            </label>
          </div>
        </Setting>
        <Setting
          title="수행평가 최소 반영 비율(%)"
          desc="시·도교육청마다 다릅니다. 비워 두면 경고하지 않고, 입력하면 평가 계획의 수행평가 비율이 이보다 낮을 때 경고합니다."
          onReset={() => reset(['minPerformanceRatio'], '수행평가 최소 반영 비율')}
        >
          <NumField value={rules.minPerformanceRatio} min={0} max={100} nullable
            onSave={(v) => set('minPerformanceRatio', '수행평가 최소 반영 비율', v, (x) => (x === null ? '(비움)' : `${x}%`))} />
        </Setting>
      </Card>

      <Card>
        <h2 className="font-bold text-lg mb-1">목록 편집</h2>
        <Setting title="평가 유형" desc="평가 항목을 만들 때 고르는 유형입니다. (중간·기말고사는 '정기시험'으로 표기)" onReset={() => reset(['itemTypes'], '평가 유형')}>
          <ListEditor values={rules.itemTypes} onChange={(v) => set('itemTypes', '평가 유형', v, (x) => x.join(', '))} />
        </Setting>
        <Setting title="관찰 메모 태그" desc="빠른 메모에서 고르는 태그입니다." onReset={() => reset(['memoTags'], '메모 태그')}>
          <ListEditor values={rules.memoTags} onChange={(v) => set('memoTags', '메모 태그', v, (x) => x.join(', '))} />
        </Setting>
        <Setting title="자주 쓰는 메모 문구" desc="메모 입력 때 한 번에 누를 수 있는 문구 버튼입니다." onReset={() => reset(['quickPhrases'], '자주 쓰는 문구')}>
          <ListEditor values={rules.quickPhrases} onChange={(v) => set('quickPhrases', '자주 쓰는 문구', v, (x) => x.join(', '))} />
        </Setting>
      </Card>

      <Card>
        <h2 className="font-bold text-lg mb-2">규정 설정 변경 이력</h2>
        {!logs?.length && <p className="text-sm text-gray-500">아직 변경 기록이 없습니다.</p>}
        <ul className="text-sm space-y-1 max-h-72 overflow-auto">
          {logs?.slice(0, 50).map((l) => (
            <li key={l.id} className="border-b py-1">
              <span className="text-gray-500">{new Date(l.at).toLocaleString('ko-KR')}</span> · {l.target.replace('규정 설정 · ', '')} {l.detail !== l.target.replace('규정 설정 · ', '') && `(${l.detail})`}
              {(l.before !== undefined || l.after !== undefined) && <> : {l.before ?? ''} → <b>{l.after ?? ''}</b></>}
            </li>
          ))}
        </ul>
      </Card>
      {dialog}
    </div>
  )
}

function reasonText(r: AbsenceReason) {
  const base = (k: string) =>
    k === 'credit' ? `인정점 ${r.creditRatio}%(${r.creditBase === 'maxScore' ? '만점 기준' : '다른 항목 평균 기준'})` : methodNames[k as AbsenceMethod]
  return r.method === 'reassess' ? `재평가 우선, 불가 시 ${base(r.fallback ?? 'credit')}` : base(r.method)
}
