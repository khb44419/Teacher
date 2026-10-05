import { describe, expect, it } from 'vitest'
import { parseRoster, parseTable } from './roster'

describe('명단 파싱', () => {
  it('머리글이 있는 탭 구분 표', () => {
    const rows = parseTable('학년\t반\t번호\t이름\n1\t2\t3\t김민수\n1\t2\t4\t이서연')
    const r = parseRoster(rows, '중')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ level: '중', grade: 1, classNo: 2, no: 3, name: '김민수' })
    expect(r.every((x) => !x.error)).toBe(true)
  })
  it('이름 열이 없어도 허용 (3열)', () => {
    const r = parseRoster(parseTable('1,1,1\n1,1,2'), '고')
    expect(r.map((x) => x.name)).toEqual([undefined, undefined])
    expect(r[1].no).toBe(2)
  })
  it('열 순서가 다른 머리글', () => {
    const r = parseRoster(parseTable('번호,이름,학년,반\n7,홍길동,2,5'), '중')
    expect(r[0]).toMatchObject({ grade: 2, classNo: 5, no: 7, name: '홍길동' })
  })
  it('학교급 열(5열)과 "1학년" 같은 표기', () => {
    const r = parseRoster(parseTable('고,1학년,3반,05번,가나다'), '중')
    expect(r[0]).toMatchObject({ level: '고', grade: 1, classNo: 3, no: 5 })
  })
  it('오류 행과 중복 표시', () => {
    const r = parseRoster(parseTable('1,1,a\n1,1,2\n1,1,2'), '중')
    expect(r[0].error).toMatch(/번호/)
    expect(r[1].error).toBeUndefined()
    expect(r[2].error).toMatch(/중복/)
  })
})

describe('NEIS 명렬표 형식', () => {
  it('제목 줄 아래 머리글, 성별 등 추가 열, 빈 줄은 무시', () => {
    const rows = [
      ['2026학년도 1학년 3반 명렬표', '', '', '', ''],
      ['', '', '', '', ''],
      ['학년', '반', '번호', '성명', '성별'],
      ['1', '3', '1', '김가나', '여'],
      ['', '', '', '', ''],
      ['1', '3', '2', '이다라', '남'],
    ]
    const r = parseRoster(rows, '중')
    expect(r.map((x) => [x.no, x.name, x.error])).toEqual([[1, '김가나', undefined], [2, '이다라', undefined]])
    expect(r[0].line).toBe(4)
  })
  it('출석번호·학생명 머리글', () => {
    const r = parseRoster(parseTable('학년,반,출석번호,학생명\n2,1,5,홍길동'), '고')
    expect(r[0]).toMatchObject({ grade: 2, classNo: 1, no: 5, name: '홍길동' })
  })
})
