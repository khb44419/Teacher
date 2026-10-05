import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteClass, deleteStudent } from '../db/services'
import { useApp } from '../app/AppContext'
import { Button, Card, inputCls, useConfirm } from '../components/ui'
import type { Student, StudentStatus } from '../db/types'
import { HelpButton } from '../components/Help'

export function ClassDetail() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const { semester, hideNames } = useApp()
  const { ask, dialog } = useConfirm()
  const cls = useLiveQuery(() => db.classes.get(id), [id])
  const students = useLiveQuery(() => db.students.where('classId').equals(id).sortBy('no'), [id])
  const readOnly = semester?.status === 'closed'
  if (!cls || !students) return null

  const patch = (s: Student, p: Partial<Student>) => db.students.update(s.id!, p)
  const addStudent = () =>
    db.students.add({ classId: id, no: Math.max(0, ...students.map((s) => s.no)) + 1, status: '재학' })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings/classes" className="text-brand-700 min-h-11 leading-[44px]">← 학급 목록</Link>
        <h1 className="text-xl font-bold flex-1">
          {cls.level === '중' ? '중' : '고'}{cls.grade}-{cls.classNo} ({cls.subject}) · {students.length}명
        </h1>
        <HelpButton topic="classes" />
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-sm">
            <tr><th className="p-2 w-14">번호</th><th>이름 (선택)</th><th className="w-28">상태</th><th>비고</th><th className="w-14"></th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 text-center font-semibold">{s.no}</td>
                <td className="p-1">
                  <input
                    key={`${s.id}-${s.name}`}
                    className={inputCls}
                    defaultValue={hideNames ? '' : s.name ?? ''}
                    placeholder={hideNames ? '(이름 가리기 중)' : '이름 없음'}
                    disabled={readOnly || hideNames}
                    onBlur={(e) => e.target.value.trim() !== (s.name ?? '') && patch(s, { name: e.target.value.trim() || undefined })}
                  />
                </td>
                <td className="p-1">
                  <select className={inputCls} value={s.status} disabled={readOnly} onChange={(e) => patch(s, { status: e.target.value as StudentStatus })}>
                    <option>재학</option><option>전출</option><option>전입</option>
                  </select>
                </td>
                <td className="p-1">
                  <input key={`${s.id}-${s.note}`} className={inputCls} defaultValue={s.note ?? ''} disabled={readOnly}
                    onBlur={(e) => e.target.value !== (s.note ?? '') && patch(s, { note: e.target.value || undefined })} />
                </td>
                <td className="p-1">
                  {!readOnly && (
                    <Button variant="ghost" aria-label={`${s.no}번 삭제`}
                      onClick={() => ask(`${s.no}번 학생과 그 학생의 점수·메모를 삭제합니다. 되돌릴 수 없습니다.`, () => void deleteStudent(s.id!), '삭제')}>🗑</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={addStudent}>＋ 학생 추가 (번호 {Math.max(0, ...students.map((s) => s.no)) + 1})</Button>
          <Button variant="danger" onClick={() => ask(`${cls.grade}학년 ${cls.classNo}반 전체와 학생 ${students.length}명의 점수·메모를 삭제합니다. 되돌릴 수 없습니다.`, async () => { await deleteClass(id); nav('/settings/classes') }, '학급 삭제')}>
            이 학급 삭제
          </Button>
        </div>
      )}
      {dialog}
    </div>
  )
}
