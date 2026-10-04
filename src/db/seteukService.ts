import { db } from './db'
import { defaultSeteukBands } from './defaults'
import { loadClassData } from './reportData'
import { computeStudent } from '../lib/grading'
import { buildDraft } from '../lib/seteuk'
import type { Score } from './types'

async function assertEditableStudent(studentId: number) {
  const st = await db.students.get(studentId)
  const cls = st && (await db.classes.get(st.classId))
  const sem = cls && (await db.semesters.get(cls.semesterId))
  if (sem?.status === 'closed') throw new Error('마감된 학기는 수정할 수 없습니다 (읽기 전용)')
}

export async function saveSeteuk(studentId: number, text: string) {
  await assertEditableStudent(studentId)
  const prev = await db.seteuks.where('studentId').equals(studentId).first()
  if (prev) await db.seteuks.update(prev.id!, { text, updatedAt: Date.now() })
  else await db.seteuks.add({ studentId, text, updatedAt: Date.now() })
}

/** 학급의 세특 초안 생성. studentIds 를 주면 그 학생만. overwrite=false 면 이미 쓴 학생은 건너뜀. */
export async function generateDrafts(classId: number, opts: { studentIds?: number[]; overwrite: boolean }) {
  const d = await loadClassData(classId)
  const rules = await db.rules.get('main')
  if (!d || !rules) return { written: 0, skipped: 0 }
  const items = d.items.filter((i) => i.enabled)
  const templates = await db.seteukTemplates.where('itemId').anyOf([0, ...items.map((i) => i.id!)]).toArray()
  const usage = new Map<string, number>()
  const targets = d.students.filter((s) => s.status !== '전출' && (!opts.studentIds || opts.studentIds.includes(s.id!))).sort((a, b) => a.no - b.no)
  let written = 0, skipped = 0
  for (const st of targets) {
    const existing = await db.seteuks.where('studentId').equals(st.id!).first()
    if (existing?.text.trim() && !opts.overwrite) { skipped++; continue }
    const scores = new Map<number, Score>(d.scores.filter((s) => s.studentId === st.id).map((s) => [s.itemId, s]))
    const memos = await db.memos.where('studentId').equals(st.id!).toArray()
    const text = buildDraft({
      items, result: computeStudent(items, scores, rules), memos, templates,
      bands: rules.seteukBands ?? defaultSeteukBands(), usage,
    })
    await saveSeteuk(st.id!, text)
    written++
  }
  return { written, skipped }
}

/** 문구 템플릿 저장 (항목+수준 하나에 표현 여러 개). 표현이 없으면 삭제. */
export async function saveTemplate(itemId: number, levelLabel: string, phrases: string[]) {
  const list = phrases.map((p) => p.trim()).filter(Boolean)
  const prev = await db.seteukTemplates.where('itemId').equals(itemId).filter((t) => t.levelLabel === levelLabel).first()
  if (!list.length) { if (prev) await db.seteukTemplates.delete(prev.id!); return }
  if (prev) await db.seteukTemplates.update(prev.id!, { phrases: list })
  else await db.seteukTemplates.add({ itemId, levelLabel, phrases: list })
}
