import type { RuleSettings } from '../db/types'

export type ByteRules = Pick<RuleSettings, 'byteHangul' | 'byteOther' | 'byteNewline'>

export const defaultByteRules: ByteRules = { byteHangul: 3, byteOther: 1, byteNewline: 2 }

export interface ByteCount {
  chars: number
  bytes: number
}

/**
 * NEIS 바이트 계산: 한글 1자=3, 영문·숫자·공백·일반 기호(ASCII)=1, 줄바꿈=2 (설정값으로 변경 가능).
 * 줄바꿈은 \r\n, \r, \n 모두 한 번의 줄바꿈으로 계산.
 * ASCII가 아닌 문자(한글, 한자, “ ” · … 같은 특수문자 등)는 모두 '한글'과 같은 바이트로 계산합니다
 * (실제보다 적게 세어 NEIS에서 넘치는 것을 막기 위한 보수적 처리).
 */
export function countBytes(text: string, rules: ByteRules = defaultByteRules): ByteCount {
  const t = text.replace(/\r\n?/g, '\n')
  let chars = 0
  let bytes = 0
  for (const ch of t) {
    chars++
    if (ch === '\n') bytes += rules.byteNewline
    else if (ch.codePointAt(0)! <= 0x7f) bytes += rules.byteOther
    else bytes += rules.byteHangul
  }
  return { chars, bytes }
}

export interface LimitStatus extends ByteCount {
  remaining: number // 남은 바이트 (초과하면 음수)
  over: boolean
}

export function limitStatus(
  text: string,
  rules: ByteRules & Pick<RuleSettings, 'seteukMaxBytes'>,
): LimitStatus {
  const c = countBytes(text, rules)
  const remaining = rules.seteukMaxBytes - c.bytes
  return { ...c, remaining, over: remaining < 0 }
}
