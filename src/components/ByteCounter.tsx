import type { RuleSettings } from '../db/types'
import { limitStatus } from '../lib/bytes'

/** 글자 수 / 바이트 / 남은 바이트 실시간 표시, 초과 시 빨간 경고 */
export function ByteCounter({ text, rules }: { text: string; rules: RuleSettings }) {
  const s = limitStatus(text, rules)
  return (
    <p className={`font-semibold ${s.over ? 'text-red-600' : 'text-gray-700'}`} aria-live="polite">
      글자 {s.chars}자 · {s.bytes.toLocaleString()} / {rules.seteukMaxBytes.toLocaleString()}바이트 ·{' '}
      {s.over ? `⚠ ${(-s.remaining).toLocaleString()}바이트 초과` : `남은 ${s.remaining.toLocaleString()}바이트`}
    </p>
  )
}
