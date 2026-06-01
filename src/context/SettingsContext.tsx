import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ============================================================
//  設定系統（深色模式、密度、預設模式…）
//  存喺 localStorage，開機即套用。
// ============================================================

type ThemeMode = 'light' | 'dark' | 'system'

interface Settings {
  theme: ThemeMode
  displayName: string
  /** 上次匯出備份嘅時間戳（ISO）；未備份過 = null */
  lastBackupAt: string | null
}

interface SettingsApi extends Settings {
  setTheme: (t: ThemeMode) => void
  setDisplayName: (n: string) => void
  /** 記低「啱啱成功匯出備份」嘅時間戳（設定頁匯出成功後呼叫） */
  markBackup: () => void
  /** 目前實際生效嘅深淺（system 會解析做 light/dark） */
  resolvedDark: boolean
}

const STORAGE_KEY = 'ntk.settings'
const DEFAULTS: Settings = { theme: 'system', displayName: '', lastBackupAt: null }

const SettingsContext = createContext<SettingsApi | null>(null)

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

function systemPrefersDark(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // 監聽系統深淺變化（theme = system 時用到）
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemDark(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && systemDark)

  // 套用 .dark class + 儲存
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark)
  }, [resolvedDark])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const api = useMemo<SettingsApi>(
    () => ({
      ...settings,
      resolvedDark,
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setDisplayName: (displayName) =>
        setSettings((s) => ({ ...s, displayName })),
      markBackup: () =>
        setSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() })),
    }),
    [settings, resolvedDark],
  )

  return (
    <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings 必須喺 <SettingsProvider> 入面用')
  return ctx
}
