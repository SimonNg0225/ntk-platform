import { useEffect, useState } from 'react'
import { ModeProvider, useMode } from './context/ModeContext'
import { AuthProvider } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import Sidebar from './components/Sidebar'
import MobileTopBar from './components/MobileTopBar'
import Home from './pages/Home'
import ComingSoon from './components/ComingSoon'
import { getFeature } from './features/registry'

// 主框架：側邊欄 + 主內容區。
// - 桌面（md 以上）：側邊欄固定喺左
// - 手機：側邊欄收埋，改用頂欄漢堡掣 + 滑出式抽屜
function AppShell() {
  const { mode, modeDef } = useMode()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 切換模式時，返返去首頁（因為功能會唔同）
  useEffect(() => {
    setActiveId(null)
  }, [mode])

  const feature = activeId ? getFeature(activeId) : undefined

  return (
    <NavProvider open={setActiveId}>
    <div className="flex h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
      {/* 桌面側邊欄 */}
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        className="hidden border-r border-slate-200 md:flex"
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
              onSelect={setActiveId}
              onClose={() => setDrawerOpen(false)}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* 主內容區 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
            {!feature ? (
              <Home onOpen={setActiveId} />
            ) : (
              <div className="space-y-5">
                <button
                  onClick={() => setActiveId(null)}
                  className="text-sm text-slate-400 transition hover:text-accent"
                >
                  ← 返回{modeDef.name}概覽
                </button>
                <div>
                  <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                    <span>{feature.icon}</span>
                    {feature.name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {feature.description}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  {feature.status === 'ready' && feature.component ? (
                    <feature.component />
                  ) : (
                    <ComingSoon name={feature.name} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
    </NavProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ModeProvider>
        <AppShell />
      </ModeProvider>
    </AuthProvider>
  )
}
