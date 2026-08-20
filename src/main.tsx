import { lazy, StrictMode, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Providers, AppShell } from './App.tsx'
import CookieConsent from './components/CookieConsent.tsx'
import SupportWidget from './components/SupportWidget.tsx'
import { initObservability, trackPageView } from './lib/observability.ts'
import './i18n'
import './index.css'

const Landing = lazy(() => import('./marketing/Landing.tsx'))
const Login = lazy(() => import('./marketing/Login.tsx'))
const AuthCallback = lazy(() => import('./marketing/AuthCallback.tsx'))
const Pricing = lazy(() => import('./marketing/Pricing.tsx'))
const Privacy = lazy(() => import('./marketing/Privacy.tsx'))
const Terms = lazy(() => import('./marketing/Terms.tsx'))
const Guidelines = lazy(() => import('./marketing/Guidelines.tsx'))

// 商業化：啟動可觀測性（未設 env → no-op）
initObservability()

function RouteAnalytics() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/app')) return
    trackPageView({
      page_kind: 'marketing',
      route: location.pathname,
      search: location.search || undefined,
    })
  }, [location.pathname, location.search])

  return null
}

// 路由：
//   /         → 行銷首頁（公開、SEO）
//   /login    → 品牌登入頁
//   /auth/callback → OAuth 回流中繼頁
//   /pricing  → 定價頁
//   /app/*    → 產品（原有 30+ 功能，內部用 state 導航）
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Providers>
          <RouteAnalytics />
          <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/app/*" element={<AppShell />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <CookieConsent />
          <SupportWidget />
        </Providers>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
