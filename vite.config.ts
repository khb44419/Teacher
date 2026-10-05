/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' : GitHub Pages 하위 경로나 Netlify 어디에 올려도 동작
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // PWA: 홈 화면 설치 + 오프라인 동작. 모든 파일을 기기에 저장해 두므로 처음 한 번 연 뒤에는 인터넷 없이도 열림.
    VitePWA({
      registerType: 'prompt', // 새 버전은 교사가 '업데이트'를 눌렀을 때만 적용 (입력 중 갑자기 새로고침되지 않도록)
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '음악 수행평가 관리',
        short_name: '음악평가',
        description: '음악 교사용 수행평가·세특 관리 (데이터는 이 기기에만 저장)',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7f6',
        theme_color: '#23315c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,webmanifest}'], // 사용법 그림(jpg)도 오프라인에서 보이도록
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
