/**
 * 사용법 그림(public/help/*.jpg)을 실제 앱 화면으로 다시 찍는 스크립트.
 *   1) npm run dev   2) node scripts/capture-help.mjs [주소]
 * Playwright(크로미움)가 필요합니다.
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:5173/'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'help')
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

const browser = await chromium.launch({ executablePath: exe }).catch(() => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1.5, locale: 'ko-KR' })
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('페이지 오류:', e.message))
const go = (hash) => p.goto(BASE + hash)
const wait = (ms = 350) => p.waitForTimeout(ms)

/** 강조할 곳에 빨간 테두리 + 나머지는 어둡게 하고 찍기 */
async function shot(name, target) {
  await wait()
  if (target) {
    const el = target.first()
    await el.scrollIntoViewIfNeeded()
    await wait(150)
    const b = await el.boundingBox()
    if (b) {
      await p.evaluate((b) => {
        const d = document.createElement('div')
        d.id = '__hl'
        Object.assign(d.style, {
          position: 'fixed', left: `${b.x - 6}px`, top: `${b.y - 6}px`, width: `${b.width + 12}px`, height: `${b.height + 12}px`,
          border: '4px solid #e11d48', borderRadius: '14px', boxShadow: '0 0 0 4000px rgba(0,0,0,0.28)', zIndex: '99999', pointerEvents: 'none',
        })
        document.body.appendChild(d)
      }, b)
    } else console.log(`  (강조 대상 없음: ${name})`)
  }
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 62 })
  await p.evaluate(() => document.getElementById('__hl')?.remove())
  console.log('찍음', name)
}
const btn = (name, exact = false) => p.getByRole('button', { name, exact })
const card = (headingText) => p.locator(`h2:has-text("${headingText}")`).locator('..')

// ── 처음 설정 (진짜 데이터 공간, 빈 상태) ──
await go('')
await p.getByRole('dialog').waitFor()
await p.getByRole('button', { name: '닫기' }).first().click() // 자동으로 뜨는 사용법 닫기
await shot('start-1', btn('먼저 연습해 보기'))
await shot('start-2', p.locator('.rounded-xl.border').filter({ hasText: '이번 학기를 선택하세요' }).last())
await btn(/다음/).click()
await shot('start-3', btn('학급 만들기'))
await btn('학급 만들기').click()
await p.getByText('개 학급을 만들었습니다').waitFor()
await btn(/다음/).click()
await p.locator('textarea').fill('학년\t반\t번호\t이름\n1\t1\t1\t김가나\n1\t1\t2\t이다라\n1\t1\t3\t')
await shot('start-4', p.locator('table').first())
await btn(/다음/).click()
await shot('start-5', p.locator('label').filter({ hasText: '확인했습니다' }))
await p.locator('label').filter({ hasText: '확인했습니다' }).locator('input').check()
await btn(/다음/).click()
await shot('start-6', btn('평가 계획 만들기로 이동'))
await btn('대시보드로 가기').click()
await btn('알겠습니다').click()

// ── 연습 모드 ──
await go('#/settings')
await shot('practice-1', btn('연습 모드로 둘러보기'))
await btn('연습 모드로 둘러보기').click()
await p.getByText('중1학년 음악').first().waitFor({ timeout: 90000 })
await shot('practice-2', p.locator('div.bg-purple-700'))

// ── 처음 화면 ──
await shot('home-1', p.getByRole('link', { name: /점수 매기기/ }).locator('..'))
await shot('home-2', card('중1학년 음악'))
await go('#/')
await wait(600)
await shot('home-3', p.locator('nav'))
await shot('home-4', btn('빠른 메모'))
await shot('home-5', p.locator('label').filter({ hasText: '이름 가리기' }))

// ── 점수 입력 ──
await go('#/score')
await shot('score-1', btn('1반', true))
await btn('1반', true).first().click()
await shot('score-2', p.locator('button').filter({ hasText: '정기시험' }))
await p.locator('button').filter({ hasText: '정기시험' }).click()
await p.getByText(/명 완료/).waitFor()
await shot('score-3', btn('20', true).locator('..'))
await shot('score-4', p.getByLabel('점수 직접 입력').locator('..'))
await btn('18', true).click()
await shot('score-5', btn(/되돌리기/))
await shot('score-6', btn('1번으로 이동', true).locator('..'))

// ── 결석 ──
await shot('absence-1', btn(/결시·미제출/))
await btn(/결시·미제출/).click()
await shot('absence-2', p.locator('[role=dialog] button').filter({ hasText: '인정 결석' }).locator('..'))
await p.getByRole('button', { name: /^🏥 인정 결석|^인정 결석/ }).click()
await shot('absence-3', btn('질병', true).locator('..'))
await btn('질병', true).click()
await btn('2번으로 이동', true).click()
await shot('absence-4', btn(/재평가 불가/))

// ── 표 모드 ──
await shot('table-1', btn('표 모드', true))
await btn('표 모드', true).click()
await shot('table-2', btn('미입력', true).locator('..'))
await p.getByRole('button', { name: /^3번/ }).first().click()
await shot('table-3', p.getByRole('dialog'))
await p.getByRole('dialog').getByRole('button', { name: '닫기' }).click()

// ── 메모 ──
await go('#/')
await btn('빠른 메모').click()
await p.getByLabel('학급', { exact: true }).selectOption({ label: '중1-1' })
await shot('memo-1', p.getByLabel('학급', { exact: true }).locator('..'))
await p.getByLabel('학생', { exact: true }).selectOption({ index: 3 })
await btn('#참여').click()
await p.locator('[role=dialog] button').filter({ hasText: '＋' }).first().click()
await shot('memo-2', p.getByRole('dialog'))
await btn('저장', true).click()
await wait(300)
await p.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
await go('#/memo')
await p.getByLabel('학급 선택').selectOption({ label: '중1-1 (음악)' })
await btn(/^1 학생01/).click()
await shot('memo-3', card('학생별 메모'))
await shot('memo-4', btn('#협력').locator('../..'))

// ── 성적표 ──
await go('#/report')
await p.getByLabel('학급 선택').selectOption({ label: '중1-1 (음악)' })
await p.getByText('학급 평균').waitFor()
await shot('report-1', p.locator('table').first().locator('..'))
await shot('report-2', p.locator('p').filter({ hasText: '표시:' }))
await btn('📤 엑셀 내보내기').click()
await shot('report-3', btn(/이 학급/).locator('../..'))
await p.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
await shot('report-4', card('항목별 점수 분포'))

// ── 세특 ──
await go('#/seteuk')
await p.getByLabel('학급 선택').selectOption({ label: '중1-1 (음악)' })
await shot('seteuk-1', btn('✨ 빈 학생 초안 생성'))
await btn('✨ 빈 학생 초안 생성').click()
await p.getByText(/초안 \d+명 생성/).waitFor()
await btn(/^1번 학생01/).click()
await shot('seteuk-2', p.getByLabel('세부능력 및 특기사항'))
await shot('seteuk-3', p.locator('p[aria-live=polite]'))
await btn('📤 엑셀 내보내기').click()
await shot('seteuk-4', p.getByRole('dialog'))
await p.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
await go('#/seteuk/templates')
await shot('templates-1', card('합창·합주'))
await shot('templates-2', card('관찰 메모 태그 문구'))

// ── 평가 계획 ──
await go('#/plans')
await shot('plans-1', p.getByRole('link').filter({ hasText: '중1학년 음악' }))
await btn(/계획 불러오기/).click()
await shot('plans-2', p.getByRole('dialog'))
await p.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).first().click()
await p.getByRole('link').filter({ hasText: '중1학년 음악' }).click()
await shot('plans-3', p.locator('ul').first().locator('..'))
await btn('＋ 새 항목').click()
await p.getByPlaceholder('예: 리코더 연주').fill('리코더 연주')
await shot('plans-4', p.getByRole('dialog').locator('fieldset'))
await p.locator('summary').filter({ hasText: '더 보기' }).click()
await shot('plans-5', p.locator('details'))
await btn('취소', true).click()

// ── 학급 ──
await go('#/settings/classes')
await shot('classes-1', card('중학교 1학년'))
await p.getByRole('link', { name: /^1반/ }).first().click()
await shot('classes-2', p.locator('table'))
await go('#/settings/classes')
await btn('📋 명단 가져오기').click()
await p.locator('textarea').fill('2026학년도 1학년 1반 명렬표\n학년\t반\t번호\t성명\t성별\n1\t1\t1\t김가나\t여\n1\t1\t2\t이다라\t남')
await shot('classes-3', p.locator('[role=dialog] table'))
await p.getByRole('dialog').getByRole('button', { name: '닫기' }).click()

// ── 규정·설정 ──
await go('#/settings/rules')
await shot('rules-1', card('세부능력 및 특기사항'))
await shot('rules-2', p.locator('.border.rounded-lg.p-3').first())
await go('#/settings')
await shot('settings-1', p.getByRole('link', { name: /학급·학생 관리/ }).locator('..'))
await shot('settings-2', p.locator('label').filter({ hasText: '글자 크게 보기' }).locator('..'))
await shot('settings-3', card('학기'))

// ── 백업 (연습을 끝내고 진짜 데이터 공간에서) ──
await btn('연습 끝내기').first().click()
await p.getByText('안녕하세요').waitFor()
await go('#/settings/backup')
await shot('backup-1', p.locator('p').filter({ hasText: '노트북 ↔ 휴대폰 옮기는 순서' }).locator('..'))
await shot('backup-2', card('① 보내기'))
await shot('backup-3', card('② 받기'))

await browser.close()
console.log('완료:', OUT)
