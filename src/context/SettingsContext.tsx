import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  APPEARANCE_DEFAULTS,
  appearanceHtmlClasses,
  normalizeAppearancePrefs,
  REDUCE_MOTION_CLASS,
  COMPACT_DENSITY_CLASS,
  type AppearancePrefs,
} from '../features/settings/appearancePrefs'
import { DEFAULT_SUBJECT_PACK_ID } from '../data/subjects'

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
  /** 減少動態效果（可達性偏好；預設關＝行為不變，套 .reduce-motion） */
  reduceMotion: boolean
  /** 緊湊密度（可達性偏好；預設關＝行為不變，套 .density-compact） */
  compactDensity: boolean
  /** 任教科目包 id（驅動課題大綱 / 教學 AI 語境）；預設 BAFS */
  subjectPackId: string
}

interface SettingsApi extends Settings {
  setTheme: (t: ThemeMode) => void
  setDisplayName: (n: string) => void
  /** 記低「啱啱成功匯出備份」嘅時間戳（設定頁匯出成功後呼叫） */
  markBackup: () => void
  /** 開關「減少動態效果」 */
  setReduceMotion: (v: boolean) => void
  /** 開關「緊湊密度」 */
  setCompactDensity: (v: boolean) => void
  /** 設定任教科目包 */
  setSubjectPackId: (id: string) => void
  /** 目前實際生效嘅深淺（system 會解析做 light/dark） */
  resolvedDark: boolean
}

const STORAGE_KEY = 'ntk.settings'
const DEFAULTS: Settings = {
  theme: 'system',
  displayName: '',
  lastBackupAt: null,
  subjectPackId: DEFAULT_SUBJECT_PACK_ID,
  ...APPEARANCE_DEFAULTS,
}

const SettingsContext = createContext<SettingsApi | null>(null)

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 正規化外觀偏好：壞值 / 缺欄位一律 fallback 做關（保住「不變行為」）
      const appearance: AppearancePrefs = normalizeAppearancePrefs(parsed)
      return { ...DEFAULTS, ...parsed, ...appearance }
    }
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

  // 套用外觀可達性 class（.reduce-motion / .density-compact）到 <html>。
  // 預設全關 → 兩個 class 都唔加，行為同未加功能前一模一樣。
  useEffect(() => {
    const root = document.documentElement
    const active = new Set(
      appearanceHtmlClasses({
        reduceMotion: settings.reduceMotion,
        compactDensity: settings.compactDensity,
      }),
    )
    root.classList.toggle(REDUCE_MOTION_CLASS, active.has(REDUCE_MOTION_CLASS))
    root.classList.toggle(COMPACT_DENSITY_CLASS, active.has(COMPACT_DENSITY_CLASS))
  }, [settings.reduceMotion, settings.compactDensity])

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
      setReduceMotion: (reduceMotion) =>
        setSettings((s) => ({ ...s, reduceMotion })),
      setCompactDensity: (compactDensity) =>
        setSettings((s) => ({ ...s, compactDensity })),
      setSubjectPackId: (subjectPackId) =>
        setSettings((s) => ({ ...s, subjectPackId })),
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
