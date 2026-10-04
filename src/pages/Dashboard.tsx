import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { useApp } from '../app/AppContext'
import { Card } from '../components/ui'

// 6단계에서 진행 현황 표로 확장됩니다. 지금은 학급·학생 현황만 보여 줍니다.
export function Dashboard() {
  const { semester } = useApp()
  const stat = useLiveQuery(async () => {
    if (!semester?.id) return undefined
    const classes = await db.classes.where('semesterId').equals(semester.id).toArray()
    const ids = classes.map((c) => c.id!)
    const students = await db.students.where('classId').anyOf(ids).count()
    return { classes: classes.length, students }
  }, [semester?.id])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">대시보드</h1>
      <Card>
        <p className="text-lg">
          학급 <b>{stat?.classes ?? 0}</b>개 · 학생 <b>{stat?.students ?? 0}</b>명
        </p>
        <Link to="/settings/classes" className="inline-block mt-2 text-brand-700 font-semibold underline min-h-11 leading-[44px]">
          학급·학생 관리 →
        </Link>
      </Card>
      <Card className="text-gray-600 text-sm">진행 현황 표는 6단계에서 만듭니다.</Card>
    </div>
  )
}
