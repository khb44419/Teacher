/** 큰 한국어 '파일 고르기' 버튼 (브라우저 기본 버튼은 영어로 나올 수 있어서) */
export function FilePick({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  return (
    <label className="inline-flex items-center justify-center min-h-12 px-5 rounded-lg bg-white border-2 border-brand-600 text-brand-700 font-bold cursor-pointer hover:bg-brand-50">
      {label}
      <input type="file" className="sr-only" accept={accept}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </label>
  )
}
