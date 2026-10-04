import { db } from './db'

export async function addMemo(studentId: number, content: string, tags: string[]) {
  const c = content.trim()
  if (!c) throw new Error('메모 내용을 입력하세요')
  return db.memos.add({ studentId, content: c, tags, createdAt: Date.now() })
}
export const updateMemo = (id: number, content: string, tags: string[]) => db.memos.update(id, { content: content.trim(), tags })
export const deleteMemo = (id: number) => db.memos.delete(id)
