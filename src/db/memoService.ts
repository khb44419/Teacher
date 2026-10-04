import { db } from './db'

async function assertEditable(studentId: number) {
  const st = await db.students.get(studentId)
  const cls = st && (await db.classes.get(st.classId))
  const sem = cls && (await db.semesters.get(cls.semesterId))
  if (sem?.status === 'closed') throw new Error('마감된 학기의 학생에게는 메모를 쓸 수 없습니다 (읽기 전용)')
}

export async function addMemo(studentId: number, content: string, tags: string[]) {
  const c = content.trim()
  if (!c) throw new Error('메모 내용을 입력하세요')
  await assertEditable(studentId)
  return db.memos.add({ studentId, content: c, tags, createdAt: Date.now() })
}
export const updateMemo = (id: number, content: string, tags: string[]) => db.memos.update(id, { content: content.trim(), tags })
export const deleteMemo = (id: number) => db.memos.delete(id)
