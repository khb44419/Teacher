import { createContext, useContext, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setKv } from '../db/db'
import type { Semester } from '../db/types'

interface Ctx {
  ready: boolean
  semester: Semester | undefined
  hideNames: boolean
  setHideNames: (v: boolean) => void
  privacyAck: boolean
  ackPrivacy: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useLiveQuery(async () => {
    const kv = await db.kv.bulkGet(['currentSemesterId', 'hideNames', 'privacyAck'])
    const semId = kv[0]?.value as number | undefined
    const semester = semId ? await db.semesters.get(semId) : undefined
    return {
      semester,
      hideNames: !!kv[1]?.value,
      privacyAck: !!kv[2]?.value,
    }
  }, [])
  const value: Ctx = {
    ready: state !== undefined,
    semester: state?.semester,
    hideNames: state?.hideNames ?? false,
    setHideNames: (v) => void setKv('hideNames', v),
    privacyAck: state?.privacyAck ?? true,
    ackPrivacy: () => void setKv('privacyAck', true),
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('AppProvider 필요')
  return c
}
