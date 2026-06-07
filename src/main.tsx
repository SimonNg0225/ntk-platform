import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Providers, AppShell } from './App.tsx'
import Landing from './marketing/Landing.tsx'
import Pricing from './marketing/Pricing.tsx'
import Privacy from './marketing/Privacy.tsx'
import Terms from './marketing/Terms.tsx'
import CookieConsent from './components/CookieConsent.tsx'
import SupportWidget from './components/SupportWidget.tsx'
import { initObservability } from './lib/observability.ts'
import './i18n'
import './index.css'

// 商業化：啟動可觀測性（未設 env → no-op）
initObservability()

// 路由：
//   /         → 行銷首頁（公開、SEO）
//   /pricing  → 定價頁
//   /app/*    → 產品（原有 30+ 功能，內部用 state 導航）
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Providers>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/app/*" element={<AppShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CookieConsent />
          <SupportWidget />
        </Providers>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
