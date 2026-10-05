import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

export function ReportTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center min-h-11 leading-[44px] font-semibold ${isActive ? 'bg-brand-600 text-white' : 'bg-white'}`
  return (
    <div className="flex rounded-2xl border overflow-hidden">
      <NavLink to="/report" end className={cls}><Icon name="chart" /> 성적표</NavLink>
      <NavLink to="/seteuk" className={cls}><Icon name="pencil" /> 세특</NavLink>
    </div>
  )
}
