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
//  全 App 共用的「目前模式」狀態。
//  - 會記住你選擇過的模式 (localStorage)，下次開返一樣
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
  const saved = localStorage.getItem(STORAGE_KEY) as ModeId | null
  // 只接受「目前開放」的模式（MODE_ORDER）；舊用戶選擇過現在收起了的模式
  // （例如 learning）→ 回預設工作模式。
  return saved && MODE_ORDER.includes(saved) ? saved : DEFAULT_MODE
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ModeId>(readInitialMode)

  // 將主題色套落 <html> 的 CSS 變數
  useEffect(() => {
    const def = MODES[mode]
    const root = document.documentElement
    root.style.setProperty('--accent', def.accent)
    root.style.setProperty('--accent-soft', def.accentSoft)
    root.style.setProperty('--accent-strong', def.accentStrong)
    root.style.setProperty('--accent-grad-from', def.gradFrom)
    root.style.setProperty('--accent-grad-to', def.gradTo)
    root.dataset.mode = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // 忽略寫入錯誤 (storage 滿 / 私密瀏覽模式)
    }
  }, [mode])

  const value = useMemo<ModeContextValue>(() => {
    // 收起了的模式（不在 MODE_ORDER）不給切換過去；防止任何 caller 跳入隱藏模式。
    const setMode = (next: ModeId) => {
      if (MODE_ORDER.includes(next)) setModeState(next)
    }
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
  if (!ctx) throw new Error('useMode 必須在 <ModeProvider> 中用')
  return ctx
}
