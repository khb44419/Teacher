import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './app/AppContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Wizard } from './pages/Wizard'
import { Settings } from './pages/Settings'
import { Classes } from './pages/Classes'
import { ClassDetail } from './pages/ClassDetail'
import { Rules } from './pages/Rules'
import { Plans } from './pages/Plans'
import { PlanDetail } from './pages/PlanDetail'
import { History } from './pages/History'
import { ScoreEntry } from './pages/ScoreEntry'
import { Report } from './pages/Report'
import { Memos } from './pages/Memos'
import { Backup } from './pages/Backup'
import { HelpHub } from './pages/HelpHub'
import { LockGate } from './components/LockScreen'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Seteuk } from './pages/Seteuk'
import { SeteukTemplates } from './pages/SeteukTemplates'

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
        <Route path="score" element={<ScoreEntry />} />
        <Route path="memo" element={<Memos />} />
        <Route path="report" element={<Report />} />
        <Route path="seteuk" element={<Seteuk />} />
        <Route path="seteuk/templates" element={<SeteukTemplates />} />
        <Route path="plans" element={<Plans />} />
        <Route path="plans/history" element={<History />} />
        <Route path="plans/:id" element={<PlanDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<HelpHub />} />
        <Route path="settings/backup" element={<Backup />} />
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
      <LockGate>
        <HashRouter>
          <Routed />
        </HashRouter>
      </LockGate>
      <UpdatePrompt />
    </AppProvider>
  )
}
