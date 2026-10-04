import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setKv } from '../db/db'
import {
  backupSummary, checkPin, decryptBackup, encryptBackup, exportAll, hashPin, parseBackup, restoreAll,
  type BackupData, type EncryptedBackup,
} from '../lib/backup'
import { downloadBlob, todayStamp } from '../lib/download'
import { Button, Card, Field, Modal, inputCls, useConfirm } from '../components/ui'

const fmt = (t: number) => new Date(t).toLocaleString('ko-KR')

export async function makeBackupFile(password?: string) {
  const data = await exportAll(db)
  const out = password ? await encryptBackup(data, password) : data
  downloadBlob(JSON.stringify(out), `음악평가_백업_${todayStamp()}${password ? '_암호' : ''}.json`, 'application/json')
  await setKv('lastBackupAt', Date.now())
}

export function Backup() {
  const nav = useNavigate()
  const { ask, dialog } = useConfirm()
  const last = useLiveQuery(async () => ((await db.kv.get('lastBackupAt'))?.value as number | undefined) ?? null, [])
  const pin = useLiveQuery(async () => ((await db.kv.get('pinHash'))?.value as { salt: string; hash: string } | undefined) ?? null, [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usePw, setUsePw] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<EncryptedBackup | null>(null)
  const [openPw, setOpenPw] = useState('')
  const [ready, setReady] = useState<BackupData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)) }, [])

  const doBackup = async () => {
    if (usePw && (pw1.length < 4 || pw1 !== pw2)) { setMsg('비밀번호는 4자 이상, 두 칸이 같아야 합니다'); return }
    await makeBackupFile(usePw ? pw1 : undefined)
    setMsg('✅ 백업 파일을 내려받았습니다. 안전한 곳(개인 USB, 개인 클라우드 등)에 보관하세요.')
    setPw1(''); setPw2('')
  }

  const pick = async (f: File) => {
    setErr(''); setReady(null); setPending(null)
    try {
      const parsed = parseBackup(await f.text(), db)
      if ('encrypted' in parsed) setPending(parsed)
      else setReady(parsed)
    } catch (e) { setErr((e as Error).message) }
  }
  const unlock = async () => {
    if (!pending) return
    try { setReady(await decryptBackup(pending, openPw, db)); setPending(null); setOpenPw(''); setErr('') }
    catch (e) { setErr((e as Error).message) }
  }
  const doRestore = () => {
    if (!ready) return
    const s = backupSummary(ready)
    ask(`⚠ 지금 이 기기의 데이터가 모두 지워지고 백업 파일(${fmt(s.exportedAt)})의 내용으로 대체됩니다.\n되돌릴 수 없으니, 필요하면 먼저 "지금 데이터 백업"을 하세요.`, async () => {
      try {
        await restoreAll(db, ready)
        setReady(null)
        nav('/')
      } catch (e) { setErr(`복원 실패 (기존 데이터는 그대로입니다): ${(e as Error).message}`) }
    }, '복원하기')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-brand-700 min-h-11 leading-[44px]">← 설정</Link>
        <h1 className="text-xl font-bold flex-1">백업·복원·보안</h1>
      </div>

      <Card className="space-y-1 text-sm">
        <p>🔒 모든 데이터는 <b>이 기기의 이 브라우저 안에만</b> 저장됩니다. 브라우저 기록 삭제, 기기 고장·분실 시 사라질 수 있습니다.</p>
        <p>마지막 백업: <b>{last ? fmt(last) : '없음'}</b></p>
        <p>브라우저의 데이터 보존 허용: {persisted === null ? '확인 불가' : persisted ? '✔ 허용됨' : '✖ 허용 안 됨 (홈 화면에 설치하면 허용될 수 있습니다)'}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">💾 백업 파일 만들기</h2>
        <p className="text-sm text-gray-600">규정 설정, 평가 계획, 점수, 메모, 세특, 문구 템플릿까지 전부 파일 하나(.json)로 저장합니다.</p>
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" className="w-5 h-5" checked={usePw} onChange={(e) => setUsePw(e.target.checked)} />
          비밀번호로 암호화 (추천: 파일을 메신저·이메일로 옮길 때)
        </label>
        {usePw && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="비밀번호"><input type="password" className={inputCls} value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="비밀번호 확인"><input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            <p className="col-span-2 text-xs text-orange-700">⚠ 비밀번호를 잊으면 이 백업은 아무도 열 수 없습니다.</p>
          </div>
        )}
        <Button onClick={() => void doBackup()}>백업 파일 내려받기</Button>
        {msg && <p className="text-sm">{msg}</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">♻️ 백업에서 복원</h2>
        <p className="text-sm text-gray-600">다른 기기(학교 PC ↔ 태블릿)로 옮길 때: 원래 기기에서 백업 파일을 만들고, 새 기기에서 이 앱을 연 뒤 여기서 그 파일을 고르세요.</p>
        <input type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = '' }} />
        {pending && (
          <div className="flex gap-2 items-end">
            <Field label="이 백업의 비밀번호"><input type="password" className={inputCls} value={openPw} onChange={(e) => setOpenPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void unlock()} /></Field>
            <Button onClick={() => void unlock()}>열기</Button>
          </div>
        )}
        {ready && (() => {
          const s = backupSummary(ready)
          return (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
              <p>백업 시각 <b>{fmt(s.exportedAt)}</b> · 학기 {s.semesters} · 학급 {s.classes} · 학생 {s.students} · 점수 {s.scores} · 메모 {s.memos} · 세특 {s.seteuks}</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" onClick={() => void makeBackupFile()}>먼저 지금 데이터 백업</Button>
                <Button variant="danger" onClick={doRestore}>이 백업으로 복원</Button>
              </div>
            </div>
          )
        })()}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </Card>

      <PinCard pin={pin ?? null} />
      {dialog}
    </div>
  )
}

function PinCard({ pin }: { pin: { salt: string; hash: string } | null }) {
  const [mode, setMode] = useState<'set' | 'remove' | null>(null)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')
  const close = () => { setMode(null); setA(''); setB(''); setErr('') }
  const save = async () => {
    if (mode === 'set') {
      if (!/^\d{4,8}$/.test(a)) return setErr('숫자 4~8자리로 정하세요')
      if (a !== b) return setErr('두 번 입력한 PIN이 다릅니다')
      try { sessionStorage.setItem('unlocked', '1') } catch { /* 무시 */ }
      await setKv('pinHash', await hashPin(a))
    } else if (pin) {
      if (!(await checkPin(a, pin))) return setErr('PIN이 맞지 않습니다')
      await db.kv.delete('pinHash')
    }
    close()
  }
  return (
    <Card className="space-y-2">
      <h2 className="font-bold text-lg">🔐 앱 잠금 (PIN)</h2>
      <p className="text-sm text-gray-600">앱을 열 때 숫자 PIN을 묻습니다. 기기를 잠깐 빌려주거나 자리를 비울 때 화면을 가려 줍니다. (데이터 자체를 암호화하지는 않으니 기기 화면 잠금도 꼭 쓰세요)</p>
      <p>상태: <b>{pin ? '사용 중' : '사용 안 함'}</b></p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setMode('set')}>{pin ? 'PIN 바꾸기' : 'PIN 설정'}</Button>
        {pin && <Button variant="ghost" onClick={() => setMode('remove')}>잠금 끄기</Button>}
      </div>
      {mode && (
        <Modal title={mode === 'set' ? 'PIN 설정' : '잠금 끄기'} onClose={close}>
          <div className="space-y-3">
            <Field label={mode === 'set' ? '새 PIN (숫자 4~8자리)' : '현재 PIN'}>
              <input className={inputCls} type="password" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} autoFocus />
            </Field>
            {mode === 'set' && <Field label="한 번 더"><input className={inputCls} type="password" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} /></Field>}
            {err && <p className="text-red-600 text-sm">{err}</p>}
            {mode === 'set' && <p className="text-xs text-orange-700">PIN을 잊으면 데이터를 지우고 백업에서 복원해야 합니다. 백업을 꼭 해 두세요.</p>}
            <Button className="w-full" onClick={() => void save()}>확인</Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}
