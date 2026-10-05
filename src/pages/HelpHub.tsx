import { useState } from 'react'
import { Link } from 'react-router-dom'
import { guides, situations, type HelpTopic } from '../help/slides'
import { SlideShow } from '../components/Help'
import { Card } from '../components/ui'

export function HelpHub() {
  const [open, setOpen] = useState<HelpTopic | null>(null)
  const entries = Object.entries(guides) as [HelpTopic, (typeof guides)[HelpTopic]][]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="text-brand-700 min-h-11 leading-[44px]">← 설정</Link>
        <h1 className="text-xl font-bold flex-1">❓ 사용법 모음</h1>
      </div>
      <p className="text-gray-700">궁금한 것을 누르면 실제 화면 그림이 자동으로 넘어가며 설명합니다. 화면마다 오른쪽 위 <b>❓ 사용법</b> 버튼으로도 볼 수 있어요.</p>
      {situations.map((sit) => (
        <Card key={sit} className="space-y-2">
          <h2 className="font-bold text-lg">{sit}</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {entries.filter(([, g]) => g.situation === sit).map(([k, g]) => (
              <button key={k} onClick={() => setOpen(k)}
                className="flex items-center gap-3 min-h-16 px-3 rounded-xl border border-gray-200 bg-white hover:bg-brand-50 text-left">
                {g.slides[0].img && <img src={g.slides[0].img} alt="" className="w-12 h-16 object-cover object-top rounded border" />}
                <span className="flex-1">
                  <span className="block font-bold">{g.title}</span>
                  <span className="block text-sm text-gray-600">그림 {g.slides.length}장 · ▶ 눌러서 보기</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ))}
      {open && <SlideShow topic={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
