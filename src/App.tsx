import { useEffect, useState } from 'react'
import { ModeProvider, useMode } from './context/ModeContext'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import ComingSoon from './components/ComingSoon'
import { getFeature } from './features/registry'

// 主框架：側邊欄 + 主內容區。
// activeId 控制顯示緊邊個功能（null = 首頁概覽）。
function AppShell() {
  const { mode, modeDef } = useMode()
  const [activeId, setActiveId] = useState<string | null>(null)

  // 切換模式時，返返去首頁（因為功能會唔同）
  useEffect(() => {
    setActiveId(null)
  }, [mode])

  const feature = activeId ? getFeature(activeId) : undefined

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar activeId={activeId} onSelect={setActiveId} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
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
              <div>
                {feature.status === 'ready' && feature.component ? (
                  <feature.component />
                ) : (
                  <ComingSoon name={feature.name} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ModeProvider>
      <AppShell />
    </ModeProvider>
  )
}
