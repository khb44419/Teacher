import type { AppDB } from '../db/db'

export const BACKUP_APP = 'music-teacher-app'
export const BACKUP_FORMAT = 1
/** 이 기기에만 해당하는 설정: 백업에 넣지 않고, 복원해도 그대로 둠 */
export const LOCAL_ONLY_KEYS = ['pinHash', 'privacyAck', 'lastBackupAt']

export interface BackupData {
  app: typeof BACKUP_APP
  format: number
  exportedAt: number
  tables: Record<string, unknown[]>
}
export interface EncryptedBackup {
  app: typeof BACKUP_APP
  format: number
  encrypted: true
  salt: string
  iv: string
  data: string
}

export async function exportAll(db: AppDB): Promise<BackupData> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) {
      const rows = await t.toArray()
      tables[t.name] = t.name === 'kv' ? (rows as { key: string }[]).filter((r) => !LOCAL_ONLY_KEYS.includes(r.key)) : rows
    }
  })
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: Date.now(), tables }
}

export function backupSummary(b: BackupData) {
  const n = (k: string) => b.tables[k]?.length ?? 0
  return { exportedAt: b.exportedAt, semesters: n('semesters'), classes: n('classes'), students: n('students'), scores: n('scores'), memos: n('memos'), seteuks: n('seteuks') }
}

/** 파일 내용 검사. 문제가 있으면 한국어 오류 메시지를 던짐 */
export function parseBackup(text: string, db: AppDB): BackupData | EncryptedBackup {
  let obj: unknown
  try { obj = JSON.parse(text) } catch { throw new Error('백업 파일을 읽을 수 없습니다 (JSON 형식이 아님)') }
  const o = obj as Partial<BackupData & EncryptedBackup>
  if (!o || o.app !== BACKUP_APP) throw new Error('이 앱의 백업 파일이 아닙니다')
  if (typeof o.format !== 'number' || o.format > BACKUP_FORMAT) throw new Error('더 새로운 버전의 앱에서 만든 백업입니다. 앱을 새로고침해 최신 버전으로 바꾼 뒤 다시 시도하세요')
  if (o.encrypted) {
    if (!o.salt || !o.iv || !o.data) throw new Error('암호화된 백업 파일이 손상되었습니다')
    return o as EncryptedBackup
  }
  const names = new Set(db.tables.map((t) => t.name))
  if (!o.tables || typeof o.tables !== 'object') throw new Error('백업 파일이 손상되었습니다 (데이터 없음)')
  for (const [k, v] of Object.entries(o.tables)) {
    if (!names.has(k)) throw new Error(`백업 파일에 알 수 없는 항목이 있습니다: ${k}`)
    if (!Array.isArray(v)) throw new Error(`백업 파일이 손상되었습니다: ${k}`)
  }
  return o as BackupData
}

/** 현재 데이터를 지우고 백업으로 바꿈 (이 기기 전용 설정은 유지). 하나의 트랜잭션이라 실패하면 원래대로. */
export async function restoreAll(db: AppDB, b: BackupData) {
  await db.transaction('rw', db.tables, async () => {
    const keep = await db.kv.bulkGet(LOCAL_ONLY_KEYS)
    for (const t of db.tables) {
      await t.clear()
      const rows = (b.tables[t.name] ?? []) as object[]
      const filtered = t.name === 'kv' ? (rows as { key: string }[]).filter((r) => !LOCAL_ONLY_KEYS.includes(r.key)) : rows
      if (filtered.length) await t.bulkAdd(filtered)
    }
    await db.kv.bulkPut(keep.filter((x): x is NonNullable<typeof x> => !!x))
  })
}

// ── 비밀번호 암호화 (브라우저 내장 WebCrypto: PBKDF2 + AES-GCM) ──
const enc = new TextEncoder()
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
function toB64Large(u: Uint8Array) {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 200000, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptBackup(b: BackupData, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(b))))
  return { app: BACKUP_APP, format: BACKUP_FORMAT, encrypted: true, salt: b64(salt), iv: b64(iv), data: toB64Large(data) }
}

export async function decryptBackup(e: EncryptedBackup, password: string, db: AppDB): Promise<BackupData> {
  const key = await deriveKey(password, unb64(e.salt))
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) as BufferSource }, key, unb64(e.data) as BufferSource)
  } catch {
    throw new Error('비밀번호가 맞지 않거나 파일이 손상되었습니다')
  }
  const parsed = parseBackup(new TextDecoder().decode(plain), db)
  if ('encrypted' in parsed) throw new Error('백업 파일이 손상되었습니다')
  return parsed
}

// ── 앱 잠금 PIN (화면 잠금용. 데이터 자체를 암호화하지는 않음) ──
export async function hashPin(pin: string, saltB64?: string) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']), 256)
  return { salt: b64(salt), hash: b64(new Uint8Array(bits)) }
}
export async function checkPin(pin: string, stored: { salt: string; hash: string }) {
  return (await hashPin(pin, stored.salt)).hash === stored.hash
}
