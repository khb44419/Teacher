import { useApp } from '../app/AppContext'
import { exitPractice } from '../db/practice'
import { Icon } from './Icon'

/** 연습 모드일 때 맨 위에 항상 보이는 띠 */
export function PracticeBanner() {
  const { practice } = useApp()
  if (!practice) return null
  return (
    <div className="bg-[#5B3BA8] text-white px-4 py-2 flex items-center gap-2 text-sm">
      <Icon name="cap" />
      <span className="flex-1"><b>연습 모드</b>
        <span className="hidden sm:inline"> · 마음껏 눌러 보세요. 여기서 한 것은 진짜 데이터에 아무 영향이 없습니다.</span>
        <span className="sm:hidden"> · 데이터 안전</span>
      </span>
      <button className="min-h-11 px-4 rounded-full bg-white text-[#5B3BA8] font-bold whitespace-nowrap" onClick={() => void exitPractice()}>연습 끝내기</button>
    </div>
  )
}
