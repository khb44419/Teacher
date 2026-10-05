import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 글꼴 파일을 앱 안에 포함 (외부 서버 요청 없음). 보통·굵게 두 가지만 넣어 용량을 줄임
import '@fontsource/ibm-plex-sans-kr/400.css'
import '@fontsource/ibm-plex-sans-kr/700.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
