import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  MODES,
  MODE_ORDER,
  DEFAULT_MODE,
  type ModeId,
  type ModeDef,
} from '../modes/modes'

// ============================================================
//  ModeContext
//  ------------------------------------------------------------
//  全 App 共用嘅「目前模式」狀態。
//  - 會記住你揀過嘅模式 (localStorage)，下次開返一樣
//  - 切換模式時，自動將主題色寫入 CSS 變數
// ============================================================

const STORAGE_KEY = 'ntk.mode'

interface ModeContextValue {
  mode: ModeId
  modeDef: ModeDef
  setMode: (mode: ModeId) => void
  toggleMode: () => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

function readInitialMode(): ModeId {
  if (typeof localStorage === 'undefined') return DEFAULT_MODE
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'learning' || saved === 'work' ? saved : DEFAULT_MODE
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ModeId>(readInitialMode)

  // 將主題色套落 <html> 嘅 CSS 變數
  useEffect(() => {
    const def = MODES[mode]
    const root = document.documentElement
    root.style.setProperty('--accent', def.accent)
    root.style.setProperty('--accent-soft', def.accentSoft)
    root.style.setProperty('--accent-strong', def.accentStrong)
    root.dataset.mode = mode
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const value = useMemo<ModeContextValue>(() => {
    const setMode = (next: ModeId) => setModeState(next)
    const toggleMode = () =>
      setModeState((curr) => {
        const idx = MODE_ORDER.indexOf(curr)
        return MODE_ORDER[(idx + 1) % MODE_ORDER.length]
      })
    return { mode, modeDef: MODES[mode], setMode, toggleMode }
  }, [mode])

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode 必須喺 <ModeProvider> 入面用')
  return ctx
}
