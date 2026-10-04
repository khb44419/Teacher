import type { SchoolClass } from '../db/types'

export const classLabel = (c: Pick<SchoolClass, 'level' | 'grade' | 'classNo'>) => `${c.level}${c.grade}-${c.classNo}`

export const classSort = (a: SchoolClass, b: SchoolClass) =>
  (a.level === b.level ? 0 : a.level === '중' ? -1 : 1) || a.grade - b.grade || a.classNo - b.classNo
