import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isPracticeMode, setKv } from '../db/db'
import { ensurePracticeData } from '../db/practice'
import type { Semester } from '../db/types'

interface Ctx {
  ready: boolean
  practice: boolean
  semester: Semester | undefined
  hideNames: boolean
  setHideNames: (v: boolean) => void
  privacyAck: boolean
  ackPrivacy: () => void
  /** 자세히 모드: 끄면(기본) 규정 설정·변경 이력·보관함 등 세부 기능을 숨김 */
  detailed: boolean
  setDetailed: (v: boolean) => void
  bigText: boolean
  setBigText: (v: boolean) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const practice = isPracticeMode()
  const [practiceReady, setPracticeReady] = useState(!practice)
  useEffect(() => { if (practice) void ensurePracticeData().then(() => setPracticeReady(true)) }, [practice])
  const state = useLiveQuery(async () => {
    const kv = await db.kv.bulkGet(['currentSemesterId', 'hideNames', 'privacyAck', 'detailMode', 'bigText'])
    const semId = kv[0]?.value as number | undefined
    const semester = semId ? await db.semesters.get(semId) : undefined
    return {
      semester,
      hideNames: !!kv[1]?.value,
      privacyAck: !!kv[2]?.value,
      detailed: !!kv[3]?.value,
      bigText: !!kv[4]?.value,
    }
  }, [])
  const value: Ctx = {
    ready: state !== undefined && practiceReady,
    practice,
    semester: state?.semester,
    hideNames: state?.hideNames ?? false,
    setHideNames: (v) => void setKv('hideNames', v),
    privacyAck: state?.privacyAck ?? true,
    ackPrivacy: () => void setKv('privacyAck', true),
    detailed: state?.detailed ?? false,
    setDetailed: (v) => void setKv('detailMode', v),
    bigText: state?.bigText ?? false,
    setBigText: (v) => void setKv('bigText', v),
  }
  // 글자 크게 보기: 화면 전체 글자·버튼 크기를 키움
  useEffect(() => { document.documentElement.style.fontSize = state?.bigText ? '19px' : '' }, [state?.bigText])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('AppProvider 필요')
  return c
}
