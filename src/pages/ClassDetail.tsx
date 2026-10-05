import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteClass, deleteStudent } from '../db/services'
import { useApp } from '../app/AppContext'
import { Button, Card, useConfirm } from '../components/ui'
import type { Student, StudentStatus } from '../db/types'
import { HelpButton } from '../components/Help'
import { Icon } from '../components/Icon'

// inputCls 의 w-full 을 빼고 칸 너비를 따로 정함
const field = 'min-h-11 px-3 rounded-2xl border border-line bg-white'

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
      {/* 휴대폰에서는 학생마다 두 줄(번호·이름 / 상태·비고), 넓은 화면에서는 한 줄 */}
      <Card className="p-0 overflow-hidden">
        <ul className="divide-y">
          {students.map((s) => (
            <li key={s.id} className="p-2 flex flex-wrap items-center gap-2">
              <span className="w-10 text-center text-lg font-bold shrink-0">{s.no}</span>
              <input
                key={`${s.id}-${s.name}`}
                className={`${field} flex-1 min-w-0 text-lg`}
                aria-label={`${s.no}번 이름`}
                defaultValue={hideNames ? '' : s.name ?? ''}
                placeholder={hideNames ? '(이름 가리기 중)' : '이름 (선택)'}
                disabled={readOnly || hideNames}
                onBlur={(e) => e.target.value.trim() !== (s.name ?? '') && patch(s, { name: e.target.value.trim() || undefined })}
              />
              <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-[1.3] flex gap-2 pl-12 sm:pl-0">
                <select className={`${field} w-24 shrink-0`} aria-label={`${s.no}번 상태`} value={s.status} disabled={readOnly}
                  onChange={(e) => patch(s, { status: e.target.value as StudentStatus })}>
                  <option>재학</option><option>전출</option><option>전입</option>
                </select>
                <input key={`${s.id}-${s.note}`} className={`${field} flex-1 min-w-0`} aria-label={`${s.no}번 비고`}
                  placeholder="비고" defaultValue={s.note ?? ''} disabled={readOnly}
                  onBlur={(e) => e.target.value !== (s.note ?? '') && patch(s, { note: e.target.value || undefined })} />
              </div>
              {!readOnly && (
                <Button variant="ghost" className="order-2 sm:order-3 px-2" aria-label={`${s.no}번 삭제`}
                  onClick={() => ask(`${s.no}번 학생과 그 학생의 점수·메모를 삭제합니다. 되돌릴 수 없습니다.`, () => void deleteStudent(s.id!), '삭제')}><Icon name="trash" /> </Button>
              )}
            </li>
          ))}
        </ul>
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
