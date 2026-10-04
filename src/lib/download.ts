/** 파일 내려받기 (브라우저 안에서만 처리, 외부 전송 없음) */
export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function downloadWorkbook(wb: unknown, filename: string) {
  const XLSX = await import('xlsx')
  const buf = XLSX.write(wb as import('xlsx').WorkBook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  downloadBlob(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export const todayStamp = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
