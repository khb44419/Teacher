import { db } from './db'
import { logChanges, type ChangeEntry } from './services'
import { diffItem, planLabel, rescaleScore, type ItemDraft } from '../lib/plans'
import type { AssessmentItem, AssessmentPlan, LibraryItem, SchoolLevel } from './types'

const T = '평가 계획'

async function assertEditable(semesterId: number) {
  const s = await db.semesters.get(semesterId)
  if (s?.status === 'closed') throw new Error('마감된 학기의 평가 계획은 수정할 수 없습니다 (읽기 전용)')
}
async function planOf(planId: number) {
  const p = await db.plans.get(planId)
  if (!p) throw new Error('평가 계획을 찾을 수 없습니다')
  return p
}

export async function createPlan(semesterId: number, level: SchoolLevel, grade: number, subject: string) {
  await assertEditable(semesterId)
  const dup = await db.plans.where('semesterId').equals(semesterId)
    .filter((p) => p.level === level && p.grade === grade && p.subject === subject).first()
  if (dup) return { id: dup.id!, existed: true }
  const id = await db.plans.add({ semesterId, level, grade, subject, createdAt: Date.now() })
  await logChanges([{ target: T, detail: `계획 만들기: ${planLabel({ level, grade, subject })}` }])
  return { id, existed: false }
}

export async function itemScoreCount(itemId: number) {
  return db.scores.where('itemId').equals(itemId).count()
}

/** 해당 항목에 점수가 입력된 학생 수 (반영 비율·만점 변경의 영향 범위) */
export async function affectedStudentCount(itemId: number) {
  return new Set(await db.scores.where('itemId').equals(itemId).primaryKeys().then(async (ids) =>
    (await db.scores.bulkGet(ids)).map((s) => s!.studentId))).size
}

/** 점수가 이미 입력된 수준 이름 (수준 삭제·이름 변경 시 막기 위함) */
export async function usedLevelLabels(itemId: number) {
  const rows = await db.scores.where('itemId').equals(itemId).toArray()
  return new Set(rows.map((r) => r.levelLabel).filter((x): x is string => !!x))
}

export const itemToDraft = (i: AssessmentItem): ItemDraft => ({
  name: i.name, type: i.type, scoring: i.scoring, maxScore: i.maxScore, minScore: i.minScore, weight: i.weight,
  levels: i.levels, rubric: i.rubric, startDate: i.startDate, endDate: i.endDate, enabled: i.enabled,
})

export async function addItem(planId: number, draft: ItemDraft) {
  const plan = await planOf(planId)
  await assertEditable(plan.semesterId)
  const items = await db.items.where('planId').equals(planId).toArray()
  const id = await db.items.add({
    ...draft,
    levels: draft.scoring === 'level' ? draft.levels : undefined,
    planId,
    order: Math.max(0, ...items.map((i) => i.order)) + 1,
  })
  await logChanges([{ target: T, detail: `${planLabel(plan)} · 항목 추가: ${draft.name}`, after: `만점 ${draft.maxScore}, 반영 ${draft.weight}%` }])
  return id
}

/**
 * 항목 수정. 만점이 바뀌고 점수가 있으면 rescale 로 "비율대로 환산 / 그대로 유지"를 선택.
 */
export async function updateItem(itemId: number, draft: ItemDraft, opts: { rescale?: boolean } = {}) {
  const old = await db.items.get(itemId)
  if (!old) throw new Error('항목을 찾을 수 없습니다')
  const plan = await planOf(old.planId)
  await assertEditable(plan.semesterId)
  const changes = diffItem(itemToDraft(old), draft)
  if (!changes.length) return
  await db.transaction('rw', [db.items, db.scores, db.changeLogs], async () => {
    if (opts.rescale && old.scoring === 'score' && draft.scoring === 'score' && old.maxScore !== draft.maxScore) {
      const rows = await db.scores.where('itemId').equals(itemId).toArray()
      for (const s of rows) {
        await db.scores.update(s.id!, {
          value: s.value === undefined ? undefined : rescaleScore(s.value, old.maxScore, draft.maxScore),
          computed: s.computed === undefined ? undefined : rescaleScore(s.computed, old.maxScore, draft.maxScore),
          updatedAt: Date.now(),
        })
      }
      changes.push({ label: '기존 점수 처리', before: '', after: '비율대로 환산' })
    } else if (old.maxScore !== draft.maxScore && (await itemScoreCount(itemId)) > 0) {
      changes.push({ label: '기존 점수 처리', before: '', after: '그대로 유지' })
    }
    await db.items.update(itemId, { ...draft, levels: draft.scoring === 'level' ? draft.levels : undefined })
    await logChanges(changes.map((c): ChangeEntry => ({
      target: T, detail: `${planLabel(plan)} · ${draft.name} · ${c.label}`, before: c.before, after: c.after,
    })))
  })
}

export async function deleteItem(itemId: number) {
  const item = await db.items.get(itemId)
  if (!item) return
  const plan = await planOf(item.planId)
  await assertEditable(plan.semesterId)
  const n = await itemScoreCount(itemId)
  await db.transaction('rw', [db.items, db.scores, db.seteukTemplates, db.changeLogs], async () => {
    await db.scores.where('itemId').equals(itemId).delete()
    await db.seteukTemplates.where('itemId').equals(itemId).delete()
    await db.items.delete(itemId)
    await logChanges([{ target: T, detail: `${planLabel(plan)} · 항목 삭제: ${item.name}`, before: n ? `입력된 점수 ${n}건도 함께 삭제` : '' }])
  })
}

export async function moveItem(itemId: number, dir: -1 | 1) {
  const item = await db.items.get(itemId)
  if (!item) return
  const plan = await planOf(item.planId)
  await assertEditable(plan.semesterId)
  const list = (await db.items.where('planId').equals(item.planId).toArray()).sort((a, b) => a.order - b.order)
  const i = list.findIndex((x) => x.id === itemId)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  await db.transaction('rw', [db.items, db.changeLogs], async () => {
    // order 값이 겹쳐 있어도 안전하도록 순서를 다시 매김
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    await Promise.all(next.map((x, k) => db.items.update(x.id!, { order: k + 1 })))
    await logChanges([{ target: T, detail: `${planLabel(plan)} · 순서 변경: ${item.name}`, before: `${i + 1}번째`, after: `${j + 1}번째` }])
  })
}

export async function deletePlan(planId: number) {
  const plan = await planOf(planId)
  await assertEditable(plan.semesterId)
  const items = await db.items.where('planId').equals(planId).toArray()
  for (const i of items) await deleteItem(i.id!)
  await db.plans.delete(planId)
  await logChanges([{ target: T, detail: `계획 삭제: ${planLabel(plan)}` }])
}

export interface CopyTarget {
  semesterId: number
  level: SchoolLevel
  grade: number
  subject: string
}

/**
 * 다른 학기·학년의 계획을 복사. 원본은 바뀌지 않음.
 * 점수는 복사하지 않고, 평가 예정 기간은 비웁니다. 항목에 연결된 세특 문구 템플릿은 함께 복사.
 * 이미 같은 계획이 있으면 건너뜀(existed).
 */
export async function copyPlan(srcPlanId: number, target: CopyTarget): Promise<{ id?: number; existed: boolean }> {
  await assertEditable(target.semesterId)
  const src = await planOf(srcPlanId)
  const dup = await db.plans.where('semesterId').equals(target.semesterId)
    .filter((p) => p.level === target.level && p.grade === target.grade && p.subject === target.subject).first()
  if (dup) return { existed: true }
  let newId = 0
  await db.transaction('rw', [db.plans, db.items, db.seteukTemplates, db.changeLogs], async () => {
    newId = await db.plans.add({ ...target, createdAt: Date.now() } as AssessmentPlan)
    const items = (await db.items.where('planId').equals(srcPlanId).toArray()).sort((a, b) => a.order - b.order)
    for (const it of items) {
      const newItemId = await db.items.add({ ...it, id: undefined, planId: newId, startDate: undefined, endDate: undefined })
      const tpls = await db.seteukTemplates.where('itemId').equals(it.id!).toArray()
      if (tpls.length) await db.seteukTemplates.bulkAdd(tpls.map((t) => ({ ...t, id: undefined, itemId: newItemId })))
    }
    await logChanges([{ target: T, detail: `계획 불러오기: ${planLabel(src)} → ${planLabel(target)}`, after: `항목 ${items.length}개 복사` }])
  })
  return { id: newId, existed: false }
}

// ── 항목 보관함 ──
export async function saveToLibrary(item: AssessmentItem) {
  const { name, type, scoring, maxScore, minScore, weight, levels, rubric } = item
  await db.itemLibrary.add({ name, type, scoring, maxScore, minScore, weight, levels, rubric })
}

export const libraryToDraft = (l: LibraryItem): ItemDraft => ({
  name: l.name, type: l.type, scoring: l.scoring, maxScore: l.maxScore, minScore: l.minScore,
  weight: l.weight, levels: l.levels, rubric: l.rubric, enabled: true,
})
