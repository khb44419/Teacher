import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-brand-50 text-ink hover:bg-brand-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-brand-700 hover:bg-brand-50',
}

// 손가락으로 누르기 쉽도록 최소 높이 44px
export function Button({
  variant = 'primary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`min-h-11 min-w-11 px-4 rounded-2xl font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-[22px] p-4 shadow-[0_4px_16px_rgba(28,37,65,0.06)] ${className}`}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full min-h-11 px-4 rounded-2xl border border-line bg-white focus:border-brand-600 focus:outline-none'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-t-[28px] sm:rounded-[28px] p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="w-11 h-11 rounded-full bg-canvas text-ink flex items-center justify-center hover:bg-brand-50"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 위험한 작업은 항상 확인 창을 거치도록 하는 훅. confirm(...)이 true를 주면 실행. */
export function useConfirm() {
  const [state, setState] = useState<{ msg: string; ok: string; run: () => void } | null>(null)
  const ask = (msg: string, run: () => void, ok = '확인') => setState({ msg, ok, run })
  const dialog = state && (
    <Modal title="확인해 주세요" onClose={() => setState(null)}>
      <p className="whitespace-pre-line mb-4">{state.msg}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => setState(null)}>취소</Button>
        <Button
          variant="danger"
          onClick={() => {
            const r = state.run
            setState(null)
            r()
          }}
        >
          {state.ok}
        </Button>
      </div>
    </Modal>
  )
  return { ask, dialog }
}
