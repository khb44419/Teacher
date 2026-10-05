/** 선 아이콘 (시안 B). 그림 문자(이모지) 대신 써서 기기마다 모양이 달라지지 않게 함. */
const paths: Record<string, string> = {
  home: 'M3 11l9-7 9 7|M5 10v10h14V10',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z|M14 6l4 4',
  note: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M9 8h6M9 12h6M9 16h4',
  chart: 'M3 21h18|M6 17v-6M12 17V5M18 17v-9',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z|M14 3v6h6M8 13h8M8 17h5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7|M12 17h.01',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
  undo: 'M9 14L4 9l5-5|M4 9h11a5 5 0 0 1 0 10h-3',
  repeat: 'M17 2l4 4-4 4|M3 11V9a3 3 0 0 1 3-3h15|M7 22l-4-4 4-4|M21 13v2a3 3 0 0 1-3 3H3',
  upload: 'M12 15V3M7 8l5-5 5 5|M5 21h14',
  download: 'M12 3v12M7 10l5 5 5-5|M5 21h14',
  trash: 'M4 7h16|M10 11v6M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  lock: 'M6 11h12v10H6z|M8 11V7a4 4 0 0 1 8 0v4',
  cap: 'M2 9l10-5 10 5-10 5z|M6 11v5c3 2 9 2 12 0v-5',
  folder: 'M3 6h6l2 2h10v11H3z',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M5.6 5.6l12.8 12.8',
  save: 'M12 3v12M7 10l5 5 5-5|M5 21h14',
  layers: 'M12 3l9 5-9 5-9-5z|M3 13l9 5 9-5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  music: 'M9 18V5l11-2v13|M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z|M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  alert: 'M12 3l10 18H2z|M12 10v4|M12 18h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z|M9 12l2 2 4-4',
  clipboard: 'M9 4h6v3H9z|M8 5H6v16h12V5h-2|M9 12h6M9 16h4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  plus: 'M12 5v14M5 12h14',
  medical: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z|M11 18h2',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M2 21c0-4 3-6 7-6s7 2 7 6|M16 3.5a4 4 0 0 1 0 7|M22 21c0-3-1.5-5-4-5.7',
  flask: 'M9 3h6|M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  check: 'M5 12l5 5 9-10',
  flag: 'M5 21V4|M5 4h11l-2 4 2 4H5',
  send: 'M22 2L11 13|M22 2l-7 20-4-9-9-4z',
  receive: 'M12 3v12M7 10l5 5 5-5|M3 17v4h18v-4',
  close: 'M6 6l12 12M18 6L6 18',
}
export type IconName = keyof typeof paths

export function Icon({ name, size = 20, className = '', strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 align-[-0.15em] ${className}`} aria-hidden="true">
      {paths[name].split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
