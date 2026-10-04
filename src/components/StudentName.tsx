import { useApp } from '../app/AppContext'
import type { Student } from '../db/types'

/** "3번 김OO" 형태. 이름 가리기가 켜져 있거나 이름이 없으면 번호만 표시. */
export function StudentName({ student }: { student: Pick<Student, 'no' | 'name'> }) {
  const { hideNames } = useApp()
  return <>{studentLabel(student, hideNames)}</>
}

export const studentLabel = (s: Pick<Student, 'no' | 'name'>, hide: boolean) =>
  hide || !s.name ? `${s.no}번` : `${s.no}번 ${s.name}`
