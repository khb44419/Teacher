import { Link, NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../app/AppContext'
import { Button, Modal } from './ui'

const tabs = [
  { to: '/', label: '대시보드', icon: '🏠' },
  { to: '/score', label: '점수 입력', icon: '✏️' },
  { to: '/memo', label: '메모', icon: '📝' },
  { to: '/report', label: '성적·세특', icon: '📊' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]

export function Layout() {
  const { semester, hideNames, setHideNames, privacyAck, ackPrivacy, ready } = useApp()
  const confirmedYear = useLiveQuery(async () => (await db.rules.get('main'))?.confirmedYear ?? null, [])
  const needConfirm = semester && confirmedYear !== undefined && confirmedYear !== semester.year
  return (
    <div className="h-full flex flex-col">
      <header className="bg-brand-600 text-white px-4 py-2 flex items-center gap-3">
        <div className="font-bold flex-1 truncate">
          🎵 음악 수행평가
          {semester && (
            <span className="ml-2 text-sm font-normal opacity-90">
              {semester.year}학년도 {semester.term}학기{semester.status === 'closed' && ' (마감·읽기 전용)'}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 min-h-11 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            className="w-5 h-5"
            checked={hideNames}
            onChange={(e) => setHideNames(e.target.checked)}
          />
          이름 가리기
        </label>
      </header>
      {needConfirm && (
        <Link to="/settings/rules" className="bg-yellow-100 border-b border-yellow-400 px-4 py-2 text-sm text-center font-semibold">
          ⚠ {semester.year}학년도 기재요령과 학교 학업성적관리규정을 확인하셨나요? 눌러서 규정 설정 확인 →
        </Link>
      )}
      <main className="flex-1 overflow-auto p-4 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
      <nav className="bg-white border-t border-gray-200 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-h-14 text-xs ${
                isActive ? 'text-brand-700 font-bold bg-brand-50' : 'text-gray-600'
              }`
            }
          >
            <span className="text-xl" aria-hidden>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
      {ready && !privacyAck && (
        <Modal title="처음 오셨네요" onClose={ackPrivacy}>
          <p className="mb-2">🔒 학생 데이터는 <b>이 기기에만 저장</b>되며 외부로 전송되지 않습니다.</p>
          <p className="mb-4">기기를 바꾸거나 브라우저 데이터를 지우면 사라질 수 있으니 <b>정기적으로 백업</b>하세요.</p>
          <Button className="w-full" onClick={ackPrivacy}>알겠습니다</Button>
        </Modal>
      )}
    </div>
  )
}
