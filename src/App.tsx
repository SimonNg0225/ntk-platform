import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
import { ModeProvider, useMode } from './context/ModeContext'
import { AuthProvider } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import Sidebar from './components/Sidebar'
import MobileTopBar from './components/MobileTopBar'
import CommandPalette from './components/CommandPalette'
import BottomNav from './components/BottomNav'
import { pushRecentFeature } from './components/commandPalette/util'
import ShortcutsModal from './features/shared/shortcuts/ShortcutsModal'
import QuickAddButton from './features/shared/quickAdd/QuickAddButton'
import QuickAddModal from './features/shared/quickAdd/QuickAddModal'
import { OnboardingModal } from './components/OnboardingModal'
import PwaUpdater from './components/PwaUpdater'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import SupportButton from './components/SupportButton'
import { useToast } from './context/ToastContext'
import { seedAllDemo, hasOnboarded, markOnboarded } from './lib/demoData'
import Home from './pages/Home'
import Settings from './pages/Settings'
import ComingSoon from './components/ComingSoon'
import ErrorBoundary from './components/ErrorBoundary'
import { getFeature, preloadAllFeatures } from './features/registry'
import { FeatureIcon } from './features/featureIcons'
import { track } from './lib/observability'
import { useTranslation } from 'react-i18next'
import { featName, featDesc } from './i18n/appEn'

// 主框架：側邊欄 + 主內容區。
// - 桌面（md 以上）：側邊欄固定喺左
// - 手機：側邊欄收埋，改用頂欄漢堡掣 + 滑出式抽屜
// - ⌘K / Ctrl+K：指令面板
export function AppShell() {
  const { t } = useTranslation()
  const { mode, modeDef } = useMode()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(() => !hasOnboarded())
  // 桌面側欄三態：展開（w-72）→ 幼條（icon rail）→ 完全收起。記喺 localStorage。
  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'rail' | 'hidden'>(() => {
    try {
      const v = localStorage.getItem('ntk.sidebarMode')
      if (v === 'expanded' || v === 'rail' || v === 'hidden') return v
    } catch {
      /* ignore */
    }
    return 'expanded'
  })
  const toast = useToast()

  useEffect(() => {
    try {
      localStorage.setItem('ntk.sidebarMode', sidebarMode)
    } catch {
      /* ignore */
    }
  }, [sidebarMode])

  // 連續切換：展開 → 幼條 → 收起 →（回）展開
  const cycleSidebar = () =>
    setSidebarMode((m) => (m === 'expanded' ? 'rail' : m === 'rail' ? 'hidden' : 'expanded'))

  // 切換模式時，返返去首頁（因為功能會唔同）
  useEffect(() => {
    setActiveId(null)
  }, [mode])

  // 背景預載全部功能 chunk（idle）→ 導航即時 + 所有 collection 登記齊（同步/匯出完整）
  useEffect(() => {
    const id = setTimeout(() => preloadAllFeatures(), 1200)
    return () => clearTimeout(id)
  }, [])

  // 漏斗：進入產品（一次）
  useEffect(() => {
    track('app_opened')
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

  // ⌘J / Ctrl+J 開「快速加入」（自然語言 → 待辦／提醒／行事曆）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setQuickAddOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ⌘B / Ctrl+B 切換側欄（展開 → 幼條 → 收起 → 展開）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarMode((m) => (m === 'expanded' ? 'rail' : m === 'rail' ? 'hidden' : 'expanded'))
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
    if (id && id !== '__settings__') pushRecentFeature(id)
  }

  const isSettings = activeId === '__settings__'
  const feature = activeId && !isSettings ? getFeature(activeId) : undefined

  return (
    <NavProvider open={navigate}>
      <div className="flex h-screen overflow-hidden bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
        {/* 桌面側邊欄（展開 / 幼條 rail；收起時唔 render，改用浮掣展開）*/}
        {sidebarMode !== 'hidden' && (
          <Sidebar
            activeId={activeId}
            onSelect={navigate}
            onOpenSettings={() => navigate('__settings__')}
            rail={sidebarMode === 'rail'}
            onCollapse={cycleSidebar}
            onExpand={() => setSidebarMode('expanded')}
            className="hidden border-r border-black/[0.06] dark:border-white/[0.06] md:flex"
          />
        )}

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
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <MobileTopBar
            onMenu={() => setDrawerOpen(true)}
            onSearch={() => setPaletteOpen(true)}
            onQuickAdd={() => setQuickAddOpen(true)}
          />

          {/* 桌面右上角固定「快速加入」浮掣（手機改用頂欄 icon）。
              絕對定位喺 <main> 右上，z-30 浮喺內容之上；位於右邊內距區，
              唔會撞到內容區左上嘅「← 返回概覽」同標題。 */}
          <QuickAddButton
            onClick={() => setQuickAddOpen(true)}
            className="absolute right-5 top-5 z-30 hidden md:inline-flex lg:right-8"
          />

          {/* 側欄收起時：桌面左上角浮出「展開側欄」掣 */}
          {sidebarMode === 'hidden' && (
            <button
              onClick={() => setSidebarMode('expanded')}
              title={t('shell.expandSidebar', { defaultValue: '展開側欄（⌘B）' })}
              aria-label={t('shell.expandSidebar', { defaultValue: '展開側欄' })}
              className="absolute left-3 top-4 z-30 hidden h-9 w-9 items-center justify-center rounded-lg border border-black/[0.06] bg-white/85 text-slate-500 shadow-sm backdrop-blur-xl transition hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:inline-flex dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:text-accent"
            >
              <PanelLeft size={18} strokeWidth={1.75} />
            </button>
          )}

          {/* overflow-x-hidden：杜絕任何過寬子元素令整頁可左右捲（iOS 尤甚）；寬表格各自有 overflow-x-auto 內捲，唔受影響 */}
          <div
            className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${
              sidebarMode === 'hidden' ? 'md:pl-12' : ''
            }`}
          >
            <div className="app-content mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-8 sm:py-8">
              {isSettings ? (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="text-[13px] text-slate-400 transition hover:text-accent"
                  >
                    ← {t('shell.backOverview', { defaultValue: '返回概覽' })}
                  </button>
                  <h1 className="flex items-center gap-2.5 text-[28px] font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-[32px]">
                    <FeatureIcon icon="⚙️" size={24} className="text-accent" />{' '}
                    {t('shell.settings', { defaultValue: '設定' })}
                  </h1>
                  <Settings />
                </div>
              ) : !feature ? (
                <Home onOpen={navigate} />
              ) : (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="text-[13px] text-slate-400 transition hover:text-accent"
                  >
                    ← {t('shell.backToMode', {
                      mode: t(`mode.${modeDef.id}.name`, { defaultValue: modeDef.name }),
                      defaultValue: `返回${modeDef.name}概覽`,
                    })}
                  </button>
                  {/* 標準 header；selfManagedHeader 嘅功能自管 masthead，host 唔重複出標題 */}
                  {!feature.selfManagedHeader && (
                    <div>
                      <h1 className="flex items-center gap-2.5 text-[28px] font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-[32px]">
                        <FeatureIcon icon={feature.icon} size={24} className="text-accent" />
                        {featName(t, feature)}
                      </h1>
                      <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
                        {featDesc(t, feature)}
                      </p>
                    </div>
                  )}
                  <div>
                    {feature.status === 'ready' && feature.component ? (
                      <ErrorBoundary key={feature.id} onReset={() => navigate(null)}>
                        <Suspense
                          fallback={
                            <div className="py-20 text-center text-sm text-slate-400">
                              {t('shell.loading', { defaultValue: '載入中…' })}
                            </div>
                          }
                        >
                          <feature.component />
                        </Suspense>
                      </ErrorBoundary>
                    ) : (
                      <ComingSoon name={featName(t, feature)} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 手機底部導航（桌面用側邊欄） */}
          <BottomNav
            activeId={activeId}
            onSelect={navigate}
            onMore={() => setDrawerOpen(true)}
          />
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={navigate}
          onQuickAdd={() => setQuickAddOpen(true)}
        />

        <ShortcutsModal
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />

        <QuickAddModal
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
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

        <PwaUpdater />
        <PwaInstallPrompt />
        <SupportButton />
      </div>
    </NavProvider>
  )
}

// 共用 Provider 樹：行銷頁（Landing / Pricing）同產品（AppShell）一齊用，
// 令主題、登入狀態、Toast 喺成個 App（包括路由）一致。
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <ModeProvider>{children}</ModeProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  )
}
