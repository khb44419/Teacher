import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
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
      className={`min-h-11 min-w-11 px-4 rounded-lg font-semibold disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full min-h-11 px-3 rounded-lg border border-gray-300 bg-white'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="닫기">✕</Button>
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
