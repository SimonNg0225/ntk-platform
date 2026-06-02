import { Suspense, useEffect, useState } from 'react'
import { ModeProvider, useMode } from './context/ModeContext'
import { AuthProvider } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import Sidebar from './components/Sidebar'
import MobileTopBar from './components/MobileTopBar'
import CommandPalette from './components/CommandPalette'
import ShortcutsModal from './features/shared/shortcuts/ShortcutsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { useToast } from './context/ToastContext'
import { seedAllDemo, hasOnboarded, markOnboarded } from './lib/demoData'
import Home from './pages/Home'
import Settings from './pages/Settings'
import ComingSoon from './components/ComingSoon'
import ErrorBoundary from './components/ErrorBoundary'
import { getFeature, preloadAllFeatures } from './features/registry'
import { FeatureIcon } from './features/featureIcons'

// 主框架：側邊欄 + 主內容區。
// - 桌面（md 以上）：側邊欄固定喺左
// - 手機：側邊欄收埋，改用頂欄漢堡掣 + 滑出式抽屜
// - ⌘K / Ctrl+K：指令面板
function AppShell() {
  const { mode, modeDef } = useMode()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(() => !hasOnboarded())
  const toast = useToast()

  // 切換模式時，返返去首頁（因為功能會唔同）
  useEffect(() => {
    setActiveId(null)
  }, [mode])

  // 背景預載全部功能 chunk（idle）→ 導航即時 + 所有 collection 登記齊（同步/匯出完整）
  useEffect(() => {
    const id = setTimeout(() => preloadAllFeatures(), 1200)
    return () => clearTimeout(id)
  }, [])

  // ⌘K / Ctrl+K 開指令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ? (Shift+/) 彈出鍵盤快捷鍵速查；喺輸入框 / 可編輯區聚焦時唔觸發
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable)
        return
      e.preventDefault()
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigate = (id: string | null) => {
    setActiveId(id)
    setDrawerOpen(false)
  }

  const isSettings = activeId === '__settings__'
  const feature = activeId && !isSettings ? getFeature(activeId) : undefined

  return (
    <NavProvider open={navigate}>
      <div className="flex h-screen overflow-hidden bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
        {/* 桌面側邊欄 */}
        <Sidebar
          activeId={activeId}
          onSelect={navigate}
          onOpenSettings={() => navigate('__settings__')}
          className="hidden border-r border-slate-200 dark:border-slate-800 md:flex"
        />

        {/* 手機抽屜 */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full animate-[slideIn_0.2s_ease-out] shadow-2xl">
              <Sidebar
                activeId={activeId}
                onSelect={navigate}
                onOpenSettings={() => navigate('__settings__')}
                onClose={() => setDrawerOpen(false)}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* 主內容區 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <MobileTopBar
            onMenu={() => setDrawerOpen(true)}
            onSearch={() => setPaletteOpen(true)}
          />

          {/* overflow-x-hidden：杜絕任何過寬子元素令整頁可左右捲（iOS 尤甚）；寬表格各自有 overflow-x-auto 內捲，唔受影響 */}
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="app-content mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
              {isSettings ? (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="text-sm text-slate-400 transition hover:text-accent"
                  >
                    ← 返回概覽
                  </button>
                  <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    <span>⚙️</span> 設定
                  </h1>
                  <Settings />
                </div>
              ) : !feature ? (
                <Home onOpen={navigate} />
              ) : (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="text-sm text-slate-400 transition hover:text-accent"
                  >
                    ← 返回{modeDef.name}概覽
                  </button>
                  {/* 標準 header；selfManagedHeader 嘅功能自管 masthead，host 唔重複出標題 */}
                  {!feature.selfManagedHeader && (
                    <div>
                      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                        <FeatureIcon icon={feature.icon} size={24} className="text-accent" />
                        {feature.name}
                      </h1>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {feature.description}
                      </p>
                    </div>
                  )}
                  <div>
                    {feature.status === 'ready' && feature.component ? (
                      <ErrorBoundary key={feature.id} onReset={() => navigate(null)}>
                        <Suspense
                          fallback={
                            <div className="py-20 text-center text-sm text-slate-400">
                              載入中…
                            </div>
                          }
                        >
                          <feature.component />
                        </Suspense>
                      </ErrorBoundary>
                    ) : (
                      <ComingSoon name={feature.name} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={navigate}
        />

        <ShortcutsModal
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />

        <OnboardingModal
          open={onboardOpen}
          onClose={() => {
            markOnboarded()
            setOnboardOpen(false)
          }}
          onLoadDemo={async () => {
            const n = await seedAllDemo()
            markOnboarded()
            setOnboardOpen(false)
            toast.success(n > 0 ? `已載入 ${n} 筆示範資料 🎉` : '已有資料，毋須載入')
          }}
        />
      </div>
    </NavProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <ModeProvider>
              <AppShell />
            </ModeProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}
