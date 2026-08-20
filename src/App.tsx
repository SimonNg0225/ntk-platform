import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, PanelLeft, Settings as SettingsIcon, Wrench } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ModeProvider, useMode } from './context/ModeContext'
import { AuthProvider } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import type { AppNavParams } from './context/NavContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import Sidebar from './components/Sidebar'
import MobileTopBar from './components/MobileTopBar'
import CommandPalette from './components/CommandPalette'
import BottomNav from './components/BottomNav'
import NextStepsBar from './components/NextStepsBar'
import { pushRecentFeature } from './components/commandPalette/util'
import ShortcutsModal from './features/shared/shortcuts/ShortcutsModal'
import QuickAddButton from './features/shared/quickAdd/QuickAddButton'
import QuickAddModal from './features/shared/quickAdd/QuickAddModal'
import { OnboardingModal } from './components/OnboardingModal'
import ProfileGate from './features/onboarding/ProfileGate'
import PwaUpdater from './components/PwaUpdater'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import SupportButton from './components/SupportButton'
import AnnouncementBanner from './components/AnnouncementBanner'
import { useToast } from './context/ToastContext'
import { hasOnboarded, seedAllDemo, markOnboarded } from './lib/demoData'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import ComingSoon from './components/ComingSoon'
import ErrorBoundary from './components/ErrorBoundary'
import PaidGate from './components/PaidGate'
import { useSubscription } from './hooks/useSubscription'
import { getFeature } from './features/registry'
import { FeatureIcon } from './features/featureIcons'
import {
  track,
  trackOnce,
  trackPageView,
  trackRetentionMilestones,
} from './lib/observability'
import { useTranslation } from 'react-i18next'
import { featName, featDesc } from './i18n/appEn'
import { writeComposerHandoff } from './features/shared/composerHandoff'
import { appRouteId } from './lib/appRoute'

const SIDEBAR_MODE_KEY = 'ntk.sidebarMode.v2'

// 主框架：側邊欄 + 主內容區。
// - 桌面（md 以上）：側邊欄固定在左
// - 手機：側邊欄收埋，改用頂欄漢堡掣 + 滑出式抽屜
// - ⌘K / Ctrl+K：指令面板
export function AppShell() {
  const { t } = useTranslation()
  const { modeDef } = useMode()
  const location = useLocation()
  const routerNavigate = useNavigate()
  const { isPaid, loading: subLoading, plan, isTest } = useSubscription()
  const activeId = appRouteId(location.pathname)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(
    () => !hasOnboarded() && !new URLSearchParams(window.location.search).has('invite'),
  )
  // 桌面側欄三態：展開（w-72）→ 幼條（icon rail）→ 完全收起。記在 localStorage。
  const [sidebarMode, setSidebarMode] = useState<'expanded' | 'rail' | 'hidden'>(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_MODE_KEY)
      if (v === 'expanded' || v === 'rail' || v === 'hidden') return v
    } catch {
      /* ignore */
    }
    return 'hidden'
  })
  const toast = useToast()
  const drawerRef = useRef<HTMLDivElement>(null)
  const appOpenedRef = useRef(false)
  // iOS：開抽屜嗰下 tap，遮罩瞬間彈出在手指底，touch→mouse 相容 click 會打中遮罩即關。
  // 開啟後短暫「未武裝」，等開掣嗰下 ghost click 吃不到自己（要按兩次先開到的元兇）。
  const dismissArmedRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode)
    } catch {
      /* ignore */
    }
  }, [sidebarMode])

  // 連續切換：展開 → 幼條 → 收起 →（回）展開
  const cycleSidebar = () =>
    setSidebarMode((m) => (m === 'expanded' ? 'rail' : m === 'rail' ? 'hidden' : 'expanded'))

  // 手機抽屜開啟時：初始焦點入抽屜、Esc 關閉、Tab focus-trap、關閉還原焦點（無障礙對話框）
  useEffect(() => {
    if (!drawerOpen) return
    const prevActive = document.activeElement as HTMLElement | null
    const panel = drawerRef.current
    panel?.focus()
    // 開啟瞬間遮罩不武裝，350ms 後先可點擊關閉（過濾掉開掣嗰下 ghost click）
    dismissArmedRef.current = false
    const armTimer = window.setTimeout(() => {
      dismissArmedRef.current = true
    }, 350)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setDrawerOpen(false)
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(armTimer)
      dismissArmedRef.current = false
      document.removeEventListener('keydown', onKey)
      prevActive?.focus?.()
    }
  }, [drawerOpen])

  // 漏斗：進入產品（一次）
  useEffect(() => {
    if (appOpenedRef.current) return
    appOpenedRef.current = true
    track('app_opened')
    trackRetentionMilestones()
  }, [])

  useEffect(() => {
    if (subLoading || !isPaid || isTest) return
    trackOnce('subscription_activated', { plan })
  }, [isPaid, isTest, plan, subLoading])

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

  // ⌘J / Ctrl+J 開「快速記低」（自然語言 → 待辦／提醒／行事曆）
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

  // ? (Shift+/) 彈出鍵盤快捷鍵速查；在輸入框 / 可編輯區聚焦時不觸發
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

  const navigate = (id: string | null, params?: AppNavParams) => {
    setDrawerOpen(false)
    if (id && id !== '__settings__' && id !== '__admin__') pushRecentFeature(id)
    if (id === '__settings__') routerNavigate('/app/settings')
    else if (id === '__admin__') routerNavigate('/app/admin')
    else if (id) {
      const search = new URLSearchParams()
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, String(value))
        }
      }
      const suffix = search.size ? `?${search.toString()}` : ''
      routerNavigate(`/app/${id}${suffix}`)
    }
    else routerNavigate('/app')
  }

  useEffect(() => {
    if (!onboardOpen) return
    trackOnce('onboarding_viewed', { onboarding_version: 'task_first_v2' })
  }, [onboardOpen])

  // 舊版邀請連結指向 /app?invite=...；自動帶到真正會處理 token 的團隊工作區。
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('invite')) return
    setOnboardOpen(false)
    if (location.pathname === '/app') {
      routerNavigate(`/app/work-team${location.search}`, { replace: true })
    }
  }, [location.pathname, location.search, routerNavigate])

  const isSettings = activeId === '__settings__'
  const isAdmin = activeId === '__admin__'
  const feature = activeId && !isSettings && !isAdmin ? getFeature(activeId) : undefined
  const featureFullHeight = Boolean(feature?.fullHeight)

  useEffect(() => {
    const screen = isSettings ? 'settings' : isAdmin ? 'admin' : feature ? 'feature' : 'overview'
    const virtualPath =
      screen === 'feature' && feature
        ? `/app/${modeDef.id}/${feature.id}`
        : `/app/${modeDef.id}/${screen}`
    const props = {
      page_kind: 'app',
      virtual_path: virtualPath,
      app_mode: modeDef.id,
      app_screen: screen,
      feature_id: feature?.id,
      feature_name: feature ? featName(t, feature) : undefined,
      feature_status: feature?.status,
    }
    trackPageView(props)
    track('app_screen_viewed', props)
    if (feature) {
      track('feature_opened', {
        feature_id: feature.id,
        feature_name: featName(t, feature),
        feature_status: feature.status,
        feature_paid: Boolean(feature.requiresPaid),
        mode: modeDef.id,
      })
    }
  }, [activeId, feature, isAdmin, isSettings, modeDef.id, t])

  return (
    <NavProvider open={navigate}>
      <div className="flex h-screen overflow-hidden bg-[color:var(--app-bg)] text-slate-900 dark:text-slate-100">
        {/* 桌面側邊欄（展開 / 幼條 rail；收起時不 render，改用浮掣展開）*/}
        {sidebarMode !== 'hidden' && !featureFullHeight && (
          <Sidebar
            activeId={activeId}
            onSelect={navigate}
            onOpenSettings={() => navigate('__settings__')}
            onOpenAdmin={() => navigate('__admin__')}
            rail={sidebarMode === 'rail'}
            onCollapse={cycleSidebar}
            onExpand={() => setSidebarMode('expanded')}
            className={
              sidebarMode === 'rail'
                ? 'hidden md:flex'
                : 'hidden md:my-3 md:ml-3 md:mr-2 md:flex'
            }
          />
        )}

        {/* 手機抽屜 */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                if (dismissArmedRef.current) setDrawerOpen(false)
              }}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('shell.navDrawer', { defaultValue: '導覽選單' })}
              tabIndex={-1}
              className="absolute left-0 top-0 h-full animate-[slideIn_0.2s_ease-out] shadow-2xl focus:outline-none"
            >
              <Sidebar
                activeId={activeId}
                onSelect={navigate}
                onOpenSettings={() => navigate('__settings__')}
                onOpenAdmin={() => navigate('__admin__')}
                onClose={() => setDrawerOpen(false)}
                className="my-2.5 ml-2.5 h-[calc(100%-1.25rem)]"
              />
            </div>
          </div>
        )}

        {/* 主內容區 */}
        <main
          id="main-content"
          tabIndex={-1}
          className={`relative flex flex-1 flex-col overflow-hidden focus:outline-none ${
            sidebarMode === 'expanded' && !featureFullHeight
              ? 'et-main-panel md:my-3 md:mr-3'
              : ''
          }`}
        >
          <MobileTopBar
            onMenu={() => setDrawerOpen(true)}
            onSearch={() => setPaletteOpen(true)}
            onQuickAdd={() => setQuickAddOpen(true)}
          />

          {/* 全站公告橫額（登入用戶；admin 在後台出） */}
          <AnnouncementBanner />

          {/* 桌面右上角固定「快速記低」浮掣（手機改用頂欄 icon）。
              絕對定位在 <main> 右上，z-30 浮在內容之上；位於右邊內距區，
              不會撞到內容區左上的「← 返回概覽」同標題。 */}
          {activeId !== null && !featureFullHeight && (
            <QuickAddButton
              onClick={() => setQuickAddOpen(true)}
              className="absolute right-5 top-5 z-30 hidden md:inline-flex lg:right-8"
            />
          )}

          {/* 側欄收起時：桌面左上角浮出「展開側欄」掣 */}
          {sidebarMode === 'hidden' && !featureFullHeight && (
            <button
              onClick={() => setSidebarMode('expanded')}
              title={t('shell.expandSidebar', { defaultValue: '展開側欄（⌘B）' })}
              aria-label={t('shell.expandSidebar', { defaultValue: '展開側欄' })}
              className="absolute left-3 top-4 z-30 hidden h-9 w-9 items-center justify-center rounded-lg border border-black/[0.06] bg-white/85 text-slate-500 shadow-sm backdrop-blur-xl transition hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:inline-flex dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:text-accent"
            >
              <PanelLeft size={18} strokeWidth={1.75} />
            </button>
          )}

          {/* overflow-x-hidden：杜絕任何過寬子元素令整頁可左右捲（iOS 尤甚）；寬表格各自有 overflow-x-auto 內捲，不受影響 */}
          <div
            className={`min-w-0 flex-1 overflow-x-hidden ${
              featureFullHeight ? 'overflow-y-hidden' : 'overflow-y-auto'
            }`}
          >
            <div
              className={`app-content mx-auto w-full ${
                featureFullHeight
                  ? 'h-full max-w-none px-2 py-2 sm:px-3 sm:py-3'
                  : `px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${
                      !isSettings && !isAdmin && !feature ? 'max-w-none' : 'max-w-[1800px]'
                    }`
              }`}
            >
              {isSettings ? (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-slate-500 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <ArrowLeft size={15} strokeWidth={1.9} />
                    {t('shell.backOverview', { defaultValue: '返回概覽' })}
                  </button>
                  <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-[28px]">
                    <SettingsIcon size={24} strokeWidth={1.75} className="text-accent" />{' '}
                    {t('shell.settings', { defaultValue: '設定' })}
                  </h1>
                  <Settings />
                </div>
              ) : isAdmin ? (
                <div className="space-y-5">
                  <button
                    onClick={() => navigate(null)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-slate-500 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <ArrowLeft size={15} strokeWidth={1.9} />
                    {t('shell.backOverview', { defaultValue: '返回概覽' })}
                  </button>
                  <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-[28px]">
                    <Wrench size={24} strokeWidth={1.75} className="text-accent" /> 後台管理
                  </h1>
                  <ErrorBoundary onReset={() => navigate(null)}>
                    <Admin />
                  </ErrorBoundary>
                </div>
              ) : !feature ? (
                <Home onOpen={navigate} />
              ) : (
                <div className={featureFullHeight ? 'flex h-full min-h-0 flex-col' : 'space-y-5'}>
                  <button
                    onClick={() => navigate(null)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-slate-600 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300"
                  >
                    <ArrowLeft size={15} strokeWidth={1.9} />
                    {t('shell.backToMode', {
                      mode: t(`mode.${modeDef.id}.name`, { defaultValue: modeDef.name }),
                      defaultValue: `返回${modeDef.name}概覽`,
                    })}
                  </button>
                  {/* 標準 header；selfManagedHeader 的功能自管 masthead，host 不重複出標題 */}
                  {!feature.selfManagedHeader && (
                    <div>
                      <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-[28px]">
                        <FeatureIcon icon={feature.icon} size={24} className="text-accent" />
                        {featName(t, feature)}
                      </h1>
                      <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
                        {featDesc(t, feature)}
                      </p>
                    </div>
                  )}
                  <div className={featureFullHeight ? 'feature-runtime min-h-0 flex-1' : 'feature-runtime'}>
                    {feature.requiresPaid && !isPaid ? (
                      <PaidGate feature={feature} loading={subLoading} />
                    ) : feature.status === 'ready' && feature.component ? (
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
                  {feature.status === 'ready' &&
                    !feature.hideNextSteps &&
                    !(feature.requiresPaid && !isPaid) && (
                    <NextStepsBar
                      activeId={feature.id}
                      mode={modeDef.id}
                      onOpen={navigate}
                    />
                  )}
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
            track('onboarding_skipped', { onboarding_version: 'task_first_v2' })
            markOnboarded()
            setOnboardOpen(false)
          }}
          onLoadDemo={async () => {
            const n = await seedAllDemo()
            track('onboarding_demo_loaded', {
              onboarding_version: 'task_first_v2',
              rows_added: n,
            })
            markOnboarded()
            setOnboardOpen(false)
            toast.success(n > 0 ? `已載入 ${n} 筆試用資料。` : '已有資料，毋須載入')
          }}
          onStart={(task) => {
            track('onboarding_task_started', {
              onboarding_version: 'task_first_v2',
              task_id: task.taskId,
              feature_id: task.featureId,
              has_subject: task.hasSubject,
              has_topic: task.hasTopic,
            })
            if (task.prompt) {
              writeComposerHandoff({
                featureId: task.featureId,
                text: task.prompt,
                materialTool: task.materialTool,
              })
            }
            markOnboarded()
            setOnboardOpen(false)
            navigate(task.featureId)
          }}
        />

        {/* 新用戶首次登入：彈出個人資料登記（已登入 + 未登記先出） */}
        <ProfileGate suspended={onboardOpen} />

        <PwaUpdater />
        <PwaInstallPrompt />
        {activeId !== null && !featureFullHeight && <SupportButton />}
      </div>
    </NavProvider>
  )
}

// 共用 Provider 樹：行銷頁（Landing / Pricing）同產品（AppShell）一起用，
// 令主題、登入狀態、Toast 在成個 App（包括路由）一致。
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
