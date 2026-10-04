import { Card } from '../components/ui'

export function Placeholder({ title, stage }: { title: string; stage: number }) {
  return (
    <Card>
      <h1 className="text-xl font-bold mb-2">{title}</h1>
      <p className="text-gray-600">이 화면은 {stage}단계에서 만듭니다. (아직 준비 중)</p>
    </Card>
  )
}
