import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { LibraryItem } from '../db/types'
import { Button, Modal, useConfirm } from './ui'
import { Icon } from './Icon'

/** 항목 보관함: 자주 쓰는 항목을 저장해 두고 골라 쓰기 */
export function LibraryDialog({ onClose, onPick }: { onClose: () => void; onPick?: (l: LibraryItem) => void }) {
  const list = useLiveQuery(() => db.itemLibrary.toArray(), [])
  const { ask, dialog } = useConfirm()
  return (
    <Modal title="항목 보관함" onClose={onClose}>
      {!list?.length && (
        <p className="text-muted mb-2">보관된 항목이 없습니다. 평가 계획의 항목에서 &quot;보관함에 저장&quot;을 누르면 여기에 쌓입니다. (예: 리코더 연주, 가창, 음악 감상문)</p>
      )}
      <ul className="space-y-2">
        {list?.map((l) => (
          <li key={l.id} className="border rounded-2xl p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{l.name}</div>
              <div className="text-xs text-muted">{l.type} · {l.scoring === 'score' ? '점수형' : '수준형'} · 만점 {l.maxScore} · 반영 {l.weight}%</div>
            </div>
            {onPick && <Button onClick={() => { onPick(l); onClose() }}>추가</Button>}
            <Button variant="ghost" aria-label={`${l.name} 삭제`} onClick={() => ask(`보관함에서 "${l.name}"을(를) 삭제합니다. (이미 계획에 넣은 항목은 그대로입니다)`, () => void db.itemLibrary.delete(l.id!), '삭제')}><Icon name="trash" /> </Button>
          </li>
        ))}
      </ul>
      {dialog}
    </Modal>
  )
}
