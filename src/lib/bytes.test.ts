import { describe, expect, it } from 'vitest'
import { countBytes, limitStatus } from './bytes'

describe('NEIS 바이트 계산', () => {
  it('한글 1자 = 3바이트', () => {
    expect(countBytes('가나다')).toEqual({ chars: 3, bytes: 9 })
  })
  it('영문·숫자·공백·ASCII 기호 = 1바이트', () => {
    expect(countBytes('abc 123 !?.,')).toEqual({ chars: 12, bytes: 12 })
  })
  it('줄바꿈 = 2바이트 (\\n, \\r\\n 동일)', () => {
    expect(countBytes('가\n나').bytes).toBe(3 + 2 + 3)
    expect(countBytes('가\r\n나').bytes).toBe(3 + 2 + 3)
    expect(countBytes('가\r\n나').chars).toBe(3)
  })
  it('혼합 문장', () => {
    // 음(3)악(3) 공백(1) A(1) 줄바꿈(2) 1(1)
    expect(countBytes('음악 A\n1').bytes).toBe(11)
  })
  it('빈 문자열', () => {
    expect(countBytes('')).toEqual({ chars: 0, bytes: 0 })
  })
  it('ASCII가 아닌 특수문자(“ ” ·)는 한글과 같이 계산', () => {
    expect(countBytes('“·”').bytes).toBe(9)
  })
  it('설정값을 바꾸면 반영', () => {
    expect(countBytes('가a\n', { byteHangul: 2, byteOther: 1, byteNewline: 1 }).bytes).toBe(4)
  })
  it('한도: 1,500바이트 정확히는 허용, 1바이트 초과는 경고', () => {
    const rules = { byteHangul: 3, byteOther: 1, byteNewline: 2, seteukMaxBytes: 1500 }
    const ok = limitStatus('가'.repeat(500), rules)
    expect(ok).toMatchObject({ bytes: 1500, remaining: 0, over: false })
    const over = limitStatus('가'.repeat(500) + 'a', rules)
    expect(over).toMatchObject({ bytes: 1501, remaining: -1, over: true })
  })
})
