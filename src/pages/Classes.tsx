import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../app/AppContext'
import { BulkClassForm } from '../components/BulkClassForm'
import { RosterImport } from '../components/RosterImport'
import { Card, Modal, Button } from '../components/ui'

export function Classes() {
  const { semester } = useApp()
  const [open, setOpen] = useState<'bulk' | 'import' | null>(null)
  const data = useLiveQuery(async () => {
    if (!semester?.id) return []
    const classes = await db.classes.where('semesterId').equals(semester.id).toArray()
    const counts = await Promise.all(classes.map((c) => db.students.where('classId').equals(c.id!).count()))
    return classes
      .map((c, i) => ({ ...c, count: counts[i] }))
      .sort((a, b) => (a.level === b.level ? 0 : a.level === '중' ? -1 : 1) || a.grade - b.grade || a.classNo - b.classNo)
  }, [semester?.id])
  const readOnly = semester?.status === 'closed'

  const groups = new Map<string, NonNullable<typeof data>>()
  data?.forEach((c) => {
    const k = `${c.level === '중' ? '중학교' : '고등학교'} ${c.grade}학년`
    groups.set(k, [...(groups.get(k) ?? []), c])
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to="/settings" className="text-brand-700 min-h-11 leading-[44px]">← 설정</Link>
        <h1 className="text-xl font-bold flex-1">학급·학생 관리</h1>
      </div>
      {readOnly && <p className="bg-gray-100 rounded-lg p-3">마감된 학기라 읽기 전용입니다.</p>}
      {!readOnly && semester?.id && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setOpen('bulk')}>＋ 학급 일괄 만들기</Button>
          <Button variant="secondary" onClick={() => setOpen('import')}>📋 명단 가져오기</Button>
        </div>
      )}
      {data?.length === 0 && <Card>아직 학급이 없습니다. 위 버튼으로 만들어 보세요.</Card>}
      {[...groups].map(([name, list]) => (
        <Card key={name}>
          <h2 className="font-bold mb-2">{name}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {list.map((c) => (
              <Link
                key={c.id}
                to={`/settings/classes/${c.id}`}
                className="min-h-14 rounded-lg border border-gray-300 bg-brand-50 flex flex-col items-center justify-center hover:bg-brand-100"
              >
                <b>{c.classNo}반</b>
                <span className="text-xs text-gray-600">{c.count}명</span>
              </Link>
            ))}
          </div>
        </Card>
      ))}
      {open === 'bulk' && semester?.id && (
        <Modal title="학급 일괄 만들기" onClose={() => setOpen(null)}>
          <BulkClassForm semesterId={semester.id} />
        </Modal>
      )}
      {open === 'import' && semester?.id && (
        <Modal title="명단 가져오기" onClose={() => setOpen(null)}>
          <RosterImport semesterId={semester.id} />
        </Modal>
      )}
    </div>
  )
}
