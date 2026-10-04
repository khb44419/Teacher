import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './app/AppContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Wizard } from './pages/Wizard'
import { Settings } from './pages/Settings'
import { Classes } from './pages/Classes'
import { ClassDetail } from './pages/ClassDetail'
import { Rules } from './pages/Rules'
import { Placeholder } from './pages/Placeholder'

function Routed() {
  const { ready, semester } = useApp()
  if (!ready) return <div className="p-8">불러오는 중…</div>
  // 학기가 하나도 없으면 첫 실행 마법사로
  if (!semester) {
    return (
      <Routes>
        <Route path="/setup" element={<Wizard />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route path="/setup" element={<Wizard />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="score" element={<Placeholder title="점수 입력" stage={4} />} />
        <Route path="memo" element={<Placeholder title="관찰 메모" stage={7} />} />
        <Route path="report" element={<Placeholder title="성적·세특" stage={5} />} />
        <Route path="plans" element={<Placeholder title="평가 계획" stage={3} />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/rules" element={<Rules />} />
        <Route path="settings/classes" element={<Classes />} />
        <Route path="settings/classes/:id" element={<ClassDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  // HashRouter: 정적 호스팅(GitHub Pages 등)에서 새로고침해도 404가 나지 않음
  return (
    <AppProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AppProvider>
  )
}
