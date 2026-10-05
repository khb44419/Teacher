import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { guides, type HelpTopic, type Slide } from '../help/slides'
import { Button } from './ui'
import { Icon } from './Icon'

const AUTO_MS = 6000

/** 영상처럼 자동으로 넘어가는 그림 설명 (직접 넘기기·멈추기 가능, 휴대폰은 밀어서 넘기기) */
export function SlideShow({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const g = guides[topic]
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const touchX = useRef<number | null>(null)
  const last = g.slides.length - 1
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(last, n))), [last])

  useEffect(() => {
    if (!playing) return
    if (i >= last) { setPlaying(false); return }
    const t = window.setTimeout(() => setI((x) => x + 1), AUTO_MS)
    return () => window.clearTimeout(t)
  }, [i, playing, last])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setPlaying(false); go(i + 1) }
      if (e.key === 'ArrowLeft') { setPlaying(false); go(i - 1) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [i, go, onClose])

  const s: Slide = g.slides[i]
  // 화면 전체(body)에 바로 띄움: 버튼이 놓인 곳(예: 남색 카드의 흰 글씨)의 모양을 물려받지 않도록
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-2 sm:p-4 text-ink font-normal text-left" onClick={onClose}>
      <div role="dialog" aria-label={`사용법: ${g.title}`} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl max-h-[96vh] rounded-[28px] flex flex-col overflow-hidden"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 50) { setPlaying(false); go(i + (dx < 0 ? 1 : -1)) }
          touchX.current = null
        }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <h2 className="font-bold text-lg flex-1 flex items-center gap-2"><Icon name="help" className="text-brand-600" /> {g.title}</h2>
          <span className="text-sm text-muted">{i + 1} / {g.slides.length}</span>
          <Button variant="ghost" onClick={onClose} aria-label="닫기">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {s.img && (
            <div className="bg-canvas flex justify-center">
              <img src={s.img} alt={s.title} className="max-h-[52vh] w-auto object-contain" />
            </div>
          )}
          <div className="p-4 space-y-1">
            <p className="text-xl font-bold"><span className="text-brand-700">{i + 1}.</span> {s.title}</p>
            <p className="text-lg leading-relaxed whitespace-pre-line">{s.text}</p>
          </div>
        </div>
        <div className="h-1.5 bg-gray-200">
          <div key={`${i}-${playing}`} className={`h-full bg-brand-600 ${playing ? 'help-progress' : ''}`}
            style={{ width: playing ? undefined : `${((i + 1) / g.slides.length) * 100}%`, animationDuration: `${AUTO_MS}ms` }} />
        </div>
        <div className="flex items-center gap-2 p-3 border-t">
          <Button variant="secondary" disabled={i === 0} onClick={() => { setPlaying(false); go(i - 1) }}>◀ 이전</Button>
          <Button variant="ghost" className="flex-1" onClick={() => { if (i >= last) setI(0); setPlaying(!playing || i >= last) }}>
            {playing ? '⏸ 멈추기' : i >= last ? '↺ 처음부터' : '▶ 자동으로 넘기기'}
          </Button>
          {i < last
            ? <Button onClick={() => { setPlaying(false); go(i + 1) }}>다음 ▶</Button>
            : <Button onClick={onClose}>다 봤어요</Button>}
        </div>
      </div>
    </div>
  , document.body)
}

/** 화면마다 오른쪽 위에 두는 "사용법" 버튼 */
export function HelpButton({ topic, label = '사용법' }: { topic: HelpTopic; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="min-h-11 px-4 rounded-full text-brand-700 font-bold bg-white shadow-sm whitespace-nowrap hover:bg-brand-50 inline-flex items-center gap-1.5">
        <Icon name="help" /> {label}
      </button>
      {open && <SlideShow topic={topic} onClose={() => setOpen(false)} />}
    </>
  )
}
