import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui'

/** 새 버전 알림 + 저장공간 영구 보관 요청 */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  useEffect(() => {
    // 브라우저가 저장공간이 부족할 때 이 앱의 데이터를 임의로 지우지 않도록 요청 (지원하는 브라우저만)
    void navigator.storage?.persist?.().catch(() => undefined)
  }, [])
  if (!needRefresh) return null
  return (
    <div className="fixed bottom-20 left-4 right-20 z-50 bg-gray-900 text-white rounded-xl p-3 flex items-center gap-2 shadow-lg">
      <span className="flex-1 text-sm">새 버전이 준비되었습니다. 입력을 마친 뒤 업데이트하세요. (데이터는 그대로 남습니다)</span>
      <Button onClick={() => void updateServiceWorker(true)}>업데이트</Button>
      <Button variant="ghost" className="text-white" onClick={() => setNeedRefresh(false)}>나중에</Button>
    </div>
  )
}
