import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { checkPin } from '../lib/backup'
import { clearAll } from '../db/fakeData'
import { Button, inputCls, useConfirm } from './ui'

const isUnlocked = () => { try { return sessionStorage.getItem('unlocked') === '1' } catch { return false } }
export const lockNow = () => { try { sessionStorage.removeItem('unlocked') } catch { /* 무시 */ } window.dispatchEvent(new Event('app-lock')) }

/** PIN이 설정돼 있으면 앱을 열 때(탭을 새로 열 때마다) PIN을 물음 */
export function LockGate({ children }: { children: ReactNode }) {
  const pin = useLiveQuery(async () => ((await db.kv.get('pinHash'))?.value as { salt: string; hash: string } | undefined) ?? null, [])
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [, setTick] = useState(0)
  useEffect(() => {
    // 상태가 이미 false여도 다시 그려서 잠금 화면을 띄움
    const h = () => { setUnlocked(false); setTick((t) => t + 1) }
    window.addEventListener('app-lock', h)
    return () => window.removeEventListener('app-lock', h)
  }, [])
  if (pin === undefined) return null
  // PIN을 방금 설정한 경우 등: 이 탭에서 이미 열려 있었다면 잠그지 않음
  if (!pin || unlocked || isUnlocked()) return <>{children}</>
  return <LockScreen pin={pin} onOpen={() => { try { sessionStorage.setItem('unlocked', '1') } catch { /* 무시 */ } setUnlocked(true) }} />
}

function LockScreen({ pin, onOpen }: { pin: { salt: string; hash: string }; onOpen: () => void }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [fails, setFails] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const { ask, dialog } = useConfirm()
  const tryOpen = async () => {
    if (Date.now() < waitUntil) return setErr('잠시 후 다시 시도하세요')
    if (await checkPin(v, pin)) return onOpen()
    const n = fails + 1
    setFails(n); setV('')
    if (n % 5 === 0) { setWaitUntil(Date.now() + 30000); setErr('5번 틀려서 30초 동안 잠깁니다') }
    else setErr('PIN이 맞지 않습니다')
  }
  return (
    <div className="h-full flex items-center justify-center p-4 bg-brand-600">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold">음악 수행평가</h1>
        <input className={`${inputCls} text-center text-2xl tracking-widest`} type="password" inputMode="numeric" autoFocus aria-label="PIN"
          value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void tryOpen()} />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <Button className="w-full" onClick={() => void tryOpen()}>열기</Button>
        <button className="text-sm text-gray-500 underline min-h-11" onClick={() => ask(
          'PIN을 모르면 이 기기의 데이터를 모두 지우고 처음부터 시작해야 합니다. 그 뒤 백업 파일이 있으면 [설정 → 백업·복원]에서 복원할 수 있습니다.\n이 기기의 데이터가 모두 사라집니다. 계속할까요?',
          async () => { await clearAll(); try { sessionStorage.setItem('unlocked', '1') } catch { /* 무시 */ } location.reload() }, '데이터 지우고 초기화')}>
          PIN을 잊었어요
        </button>
      </div>
      {dialog}
    </div>
  )
}
