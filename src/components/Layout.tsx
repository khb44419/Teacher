import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../app/AppContext'
import { Button, Modal } from './ui'
import { QuickMemo } from './QuickMemo'
import { lockNow } from './LockScreen'
import { PracticeBanner } from './PracticeBanner'
import { useState } from 'react'
import { Icon, type IconName } from './Icon'

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '처음 화면', icon: 'home' },
  { to: '/score', label: '점수 입력', icon: 'pencil' },
  { to: '/memo', label: '메모', icon: 'note' },
  { to: '/report', label: '성적·세특', icon: 'chart' },
  { to: '/settings', label: '설정', icon: 'gear' },
]

export function Layout() {
  const { semester, hideNames, setHideNames, privacyAck, ackPrivacy, ready } = useApp()
  const [memo, setMemo] = useState(false)
  const { pathname } = useLocation()
  const hasPin = useLiveQuery(async () => !!(await db.kv.get('pinHash')), [])
  return (
    <div className="h-full flex flex-col">
      <PracticeBanner />
      <header className="px-4 pt-3 pb-1 flex items-center gap-2 max-w-5xl w-full mx-auto">
        <span className="w-9 h-9 rounded-xl bg-navy text-white flex items-center justify-center shrink-0"><Icon name="music" size={18} /></span>
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="font-bold truncate">음악 수행평가</span>
          {semester && (
            <span className="text-sm text-muted whitespace-nowrap">
              <span className="hidden sm:inline">{semester.year}학년도 </span>
              <span className="sm:hidden">{semester.year % 100}-</span>
              {semester.term}학기{semester.status === 'closed' && ' (마감·읽기 전용)'}
            </span>
          )}
        </div>
        {hasPin && (
          <button className="w-11 h-11 rounded-full bg-white text-ink flex items-center justify-center shadow-sm" onClick={lockNow} aria-label="잠그기" title="잠그기">
            <Icon name="lock" />
          </button>
        )}
        <label className={`flex items-center gap-2 min-h-11 px-3 rounded-full cursor-pointer select-none text-sm font-semibold ${hideNames ? 'bg-navy text-white' : 'bg-white text-ink shadow-sm'}`}>
          <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />
          이름 가리기
        </label>
      </header>
      <main className="flex-1 overflow-auto px-4 pt-3 pb-28 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
      {semester?.status !== 'closed' && pathname !== '/score' && (
        <button onClick={() => setMemo(true)} aria-label="빠른 메모"
          className="fixed right-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 w-14 h-14 rounded-full bg-navy text-white shadow-lg flex items-center justify-center hover:bg-brand-700">
          <Icon name="note" size={26} />
        </button>
      )}
      {memo && <QuickMemo onClose={() => setMemo(false)} />}
      <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <nav className="pointer-events-auto mx-3 mb-3 max-w-xl sm:mx-auto rounded-[22px] bg-white shadow-[0_4px_16px_rgba(28,37,65,0.12)] grid grid-cols-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-16 text-xs ${isActive ? 'text-brand-600 font-bold' : 'text-muted'}`
              }
            >
              <Icon name={t.icon} size={22} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {ready && !privacyAck && (
        <Modal title="처음 오셨네요" onClose={ackPrivacy}>
          <p className="mb-2">학생 데이터는 <b>이 기기에만 저장</b>되며 외부로 전송되지 않습니다.</p>
          <p className="mb-4">기기를 바꾸거나 브라우저 데이터를 지우면 사라질 수 있으니 <b>정기적으로 백업</b>하세요.</p>
          <Button className="w-full" onClick={ackPrivacy}>알겠습니다</Button>
        </Modal>
      )}
    </div>
  )
}
