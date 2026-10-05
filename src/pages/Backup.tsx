import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getDataModifiedAt, setKv } from '../db/db'
import { useApp } from '../app/AppContext'
import { HelpButton } from '../components/Help'
import {
  backupSummary, checkPin, decryptBackup, encryptBackup, exportAll, hashPin, isOlderThanDevice, parseBackup, restoreAll,
  type BackupData, type EncryptedBackup,
} from '../lib/backup'
import { downloadBlob, todayStamp } from '../lib/download'
import { Button, Card, Field, Modal, inputCls, useConfirm } from '../components/ui'
import { Icon } from '../components/Icon'

const fmt = (t: number) => new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })

async function buildBackup(password?: string) {
  const data = await exportAll(db)
  const out = password ? await encryptBackup(data, password) : data
  const name = `음악평가_백업_${todayStamp()}${password ? '_암호' : ''}.json`
  return { name, text: JSON.stringify(out) }
}

export async function makeBackupFile(password?: string) {
  const { name, text } = await buildBackup(password)
  downloadBlob(text, name, 'application/json')
  await setKv('lastBackupAt', Date.now())
}

/** 휴대폰에서는 공유 창(카카오톡 '나와의 채팅', 구글 드라이브 등)으로, 안 되면 파일 내려받기 */
async function sendToOtherDevice(password?: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { name, text } = await buildBackup(password)
  const file = new File([text], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '음악평가 백업' })
      await setKv('lastBackupAt', Date.now())
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(text, name, 'application/json')
  await setKv('lastBackupAt', Date.now())
  return 'downloaded'
}

export function Backup() {
  const nav = useNavigate()
  const { practice } = useApp()
  const { ask, dialog } = useConfirm()
  const last = useLiveQuery(async () => ((await db.kv.get('lastBackupAt'))?.value as number | undefined) ?? null, [])
  const pin = useLiveQuery(async () => ((await db.kv.get('pinHash'))?.value as { salt: string; hash: string } | undefined) ?? null, [])
  const deviceModified = getDataModifiedAt(db.name)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usePw, setUsePw] = useState(true)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<EncryptedBackup | null>(null)
  const [openPw, setOpenPw] = useState('')
  const [ready, setReady] = useState<BackupData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)) }, [])

  const pwOk = () => {
    if (!usePw) return true
    if (pw1.length < 4 || pw1 !== pw2) { setMsg('비밀번호는 4자 이상, 두 칸이 같아야 합니다'); return false }
    return true
  }
  const doSend = async () => {
    if (!pwOk()) return
    const r = await sendToOtherDevice(usePw ? pw1 : undefined)
    if (r === 'cancelled') return setMsg('보내기를 취소했습니다.')
    setMsg(r === 'shared'
      ? '✔ 보냈습니다. 받는 기기에서 그 파일을 저장한 뒤 아래 "② 받기"에서 고르세요.'
      : '✔ 백업 파일을 내려받았습니다(다운로드 폴더). 이 파일을 카카오톡 "나와의 채팅"이나 구글 드라이브로 다른 기기에 보내세요.')
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
    const older = isOlderThanDevice(ready, deviceModified)
    ask(`${older ? '이 기기의 데이터가 받은 파일보다 더 최근에 바뀌었습니다!\n받으면 이 기기에서 최근에 입력한 내용이 사라집니다.\n\n' : ''}이 기기의 데이터가 모두 지워지고, 받은 파일(${fmt(s.dataModifiedAt)} 기준)의 내용으로 바뀝니다.`, async () => {
      try {
        await restoreAll(db, ready)
        setReady(null)
        nav('/')
      } catch (e) { setErr(`받기 실패 (기존 데이터는 그대로입니다): ${(e as Error).message}`) }
    }, older ? '그래도 받기' : '받기')
  }

  if (practice) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">백업·기기 옮기기</h1>
        <Card><Icon name="cap" /> 연습 모드에서는 백업과 기기 옮기기를 쓸 수 없습니다. 연습을 끝낸 뒤 이용하세요.</Card>
        <PinCard pin={pin ?? null} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-brand-700 min-h-11 leading-[44px]">← 설정</Link>
        <h1 className="text-xl font-bold flex-1">백업·기기 옮기기</h1>
        <HelpButton topic="backup" />
      </div>

      <Card className="space-y-1">
        <p><Icon name="lock" /> 데이터는 <b>이 기기 안에만</b> 있습니다. 노트북과 휴대폰은 서로 자동으로 맞춰지지 않아요.</p>
        <p>이 기기 데이터 마지막 변경: <b>{deviceModified ? fmt(deviceModified) : '기록 없음'}</b></p>
        <p>마지막으로 보낸(백업한) 때: <b>{last ? fmt(last) : '없음'}</b></p>
        {persisted === false && <p className="text-sm text-muted">홈 화면에 앱을 설치해 두면 브라우저가 데이터를 더 안전하게 보관합니다.</p>}
      </Card>

      <Card className="bg-brand-50 space-y-1 text-sm">
        <p className="font-bold text-base"><Icon name="phone" /> 노트북 ↔ 휴대폰 옮기는 순서</p>
        <p>1. 방금까지 쓴 기기에서 <b>① 보내기</b></p>
        <p>2. 카카오톡 <b>&quot;나와의 채팅&quot;</b> 또는 <b>구글 드라이브</b>로 파일 보내기</p>
        <p>3. 다른 기기에서 그 파일을 저장(다운로드)</p>
        <p>4. 다른 기기의 이 화면에서 <b>② 받기</b> → 파일 고르기</p>
        <p className="text-ink">⚠ 한 번에 한 기기에서만 입력하세요. 기기를 바꿀 때마다 보내기→받기를 하면 됩니다.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">① 보내기 (백업)</h2>
        <label className="flex items-center gap-2 min-h-11">
          <input type="checkbox" className="w-5 h-5" checked={usePw} onChange={(e) => setUsePw(e.target.checked)} />
          비밀번호 걸기 (추천: 카카오톡·메일로 보낼 때)
        </label>
        {usePw && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="비밀번호"><input type="password" className={inputCls} value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="비밀번호 확인"><input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            <p className="col-span-2 text-xs text-orange-700">⚠ 받을 때 이 비밀번호가 필요합니다. 잊으면 아무도 열 수 없어요.</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button className="min-h-14 text-lg" onClick={() => void doSend()}><Icon name="upload" /> 다른 기기로 보내기</Button>
          <Button variant="secondary" onClick={() => { if (pwOk()) void makeBackupFile(usePw ? pw1 : undefined).then(() => setMsg('✔ 백업 파일을 내려받았습니다. 개인 USB·개인 클라우드 등 안전한 곳에 보관하세요.')) }}><Icon name="save" /> 이 기기에 백업 파일 저장</Button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">② 받기 (복원)</h2>
        <p className="text-sm text-muted">다른 기기에서 보낸 파일(음악평가_백업_….json)을 고르세요.</p>
        <label className="inline-flex items-center justify-center min-h-14 px-5 rounded-2xl bg-white border-2 border-brand-600 text-brand-700 font-bold cursor-pointer">
          받은 파일 고르기
          <input type="file" className="sr-only" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = '' }} />
        </label>
        {pending && (
          <div className="flex gap-2 items-end">
            <Field label="보낼 때 정한 비밀번호"><input type="password" className={inputCls} value={openPw} onChange={(e) => setOpenPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void unlock()} /></Field>
            <Button onClick={() => void unlock()}>열기</Button>
          </div>
        )}
        {ready && (() => {
          const s = backupSummary(ready)
          const older = isOlderThanDevice(ready, deviceModified)
          return (
            <div className={`rounded-2xl p-3 text-sm space-y-2 ${older ? 'bg-[#FDECEC]' : 'bg-canvas'}`}>
              <p>받은 파일: <b>{fmt(s.dataModifiedAt)}</b> 기준 데이터 · 학생 {s.students}명 · 점수 {s.scores}건 · 메모 {s.memos}건 · 세특 {s.seteuks}건</p>
              {older && <p className="font-bold text-red-700"><Icon name="alert" /> 이 기기 데이터({deviceModified ? fmt(deviceModified) : ''})가 받은 파일보다 더 최근입니다. 받으면 최근 입력이 사라져요. 파일이 맞는지 확인하세요.</p>}
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" onClick={() => void makeBackupFile()}>먼저 이 기기 데이터 백업</Button>
                <Button variant="danger" onClick={doRestore}>이 파일로 바꾸기</Button>
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
      <h2 className="font-bold text-lg"><Icon name="lock" /> 앱 잠금 (PIN)</h2>
      <p className="text-sm text-muted">앱을 열 때 숫자 PIN을 묻습니다. 기기를 잠깐 빌려주거나 자리를 비울 때 화면을 가려 줍니다. (데이터 자체를 암호화하지는 않으니 기기 화면 잠금도 꼭 쓰세요)</p>
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
