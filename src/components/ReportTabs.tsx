import { NavLink } from 'react-router-dom'

export function ReportTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center min-h-11 leading-[44px] font-semibold ${isActive ? 'bg-brand-600 text-white' : 'bg-white'}`
  return (
    <div className="flex rounded-lg border overflow-hidden">
      <NavLink to="/report" end className={cls}>📊 성적표</NavLink>
      <NavLink to="/seteuk" className={cls}>✍️ 세특</NavLink>
    </div>
  )
}
