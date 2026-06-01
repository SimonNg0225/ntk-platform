import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { exportAllData, importAllData } from '../data/collections'
import { collectionRegistry } from '../lib/store'
import { preloadAllFeatures } from '../features/registry'
import { Card, Button, Field, Input, SectionTitle } from '../ui'
import { seedAllDemo } from '../lib/demoData'
import {
  summarizeData,
  formatBackupReminder,
  type DataOverview,
} from '../features/settings/dataOverview'

// 設定頁：外觀、個人資料、資料管理（匯出/匯入/清除）
export default function Settings() {
  const {
    theme,
    setTheme,
    displayName,
    setDisplayName,
    lastBackupAt,
    markBackup,
    reduceMotion,
    setReduceMotion,
    compactDensity,
    setCompactDensity,
  } = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [overview, setOverview] = useState<DataOverview | null>(null)

  // 我的資料一覽：先 preload 全部 feature collection 登記齊（同匯出/匯入同源），
  // 再枚舉 collectionRegistry 數每個集合筆數。之後訂閱所有 collection，資料一
  // 變即時重算（匯入/清除/載入示範後個一覽會跟住更新）。
  useEffect(() => {
    let alive = true
    const recompute = () => {
      if (alive) setOverview(summarizeData(exportAllData().data))
    }
    const unsubs: (() => void)[] = []
    preloadAllFeatures()
      .catch(() => {})
      .finally(() => {
        if (!alive) return
        recompute()
        for (const col of collectionRegistry.values())
          unsubs.push(col.subscribe(recompute))
      })
    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [])

  const reminder = formatBackupReminder(lastBackupAt)

  const doExport = async () => {
    // 先確保所有 lazy feature collection 登記齊，再枚舉 collectionRegistry
    // 匯出（同匯入/清除/sync 同源）—— 否則功能 chunk 未載入時會匯出殘缺備份。
    // preload 失敗唔阻匯出：照匯出已登記部分（同 sync.ts 的 catch 一致）。
    try {
      await preloadAllFeatures()
    } catch {
      /* ignore：照匯出已登記嘅 collection */
    }
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ntk-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    markBackup()
    toast.success('已匯出備份檔案')
  }

  const loadDemo = async () => {
    const n = await seedAllDemo()
    toast.success(n > 0 ? `已載入 ${n} 筆示範資料` : '已有資料，毋須再載入')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!(await confirm({
      title: '匯入資料？',
      message: '匯入會覆寫現有對應資料，呢個動作無法復原。',
      confirmText: '匯入',
    }))) {
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      const text = await file.text()
      // 先確保所有 lazy feature collection 登記齊，再枚舉 collectionRegistry
      // 匯入（同匯出/清除/sync 同源）—— 否則只覆寫已登記 col，其餘靜靜跳過。
      await preloadAllFeatures()
      const n = importAllData(JSON.parse(text))
      toast.success(`已匯入 ${n} 類資料`)
    } catch {
      toast.error('匯入失敗：檔案格式唔啱')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const clearAll = async () => {
    if (!(await confirm({
      title: '清除所有資料？',
      message: '會刪除全部筆記、班別、成績等本機資料，無法復原。建議先匯出備份。',
      confirmText: '全部清除',
      tone: 'danger',
    })))
      return
    // 先確保所有 lazy feature collection 登記齊，再用 collectionRegistry
    // 清晒（同匯出/匯入同源）—— 唔係淨係清靜態核心清單，避免大量 feature
    // 資料（筆記/日誌/健康/健身…）殘留。
    await preloadAllFeatures()
    for (const col of collectionRegistry.values()) col.set([] as never[])
    toast.success('已清除所有資料')
  }

  const themes: { id: 'light' | 'dark' | 'system'; label: string; icon: string }[] =
    [
      { id: 'light', label: '淺色', icon: '☀️' },
      { id: 'dark', label: '深色', icon: '🌙' },
      { id: 'system', label: '跟隨系統', icon: '💻' },
    ]

  return (
    <div className="space-y-6">
      {/* 外觀 */}
      <Card className="p-5">
        <SectionTitle>外觀</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          選擇介面主題
        </p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition ${
                theme === t.id
                  ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 可達性偏好（純 CSS 開關，預設關＝行為不變） */}
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            可達性
          </p>
          <ToggleRow
            label="減少動態效果"
            hint="收起頁面動畫同過場，畫面更安靜"
            checked={reduceMotion}
            onChange={setReduceMotion}
          />
          <ToggleRow
            label="緊湊密度"
            hint="收窄主內容邊距，一屏睇多啲"
            checked={compactDensity}
            onChange={setCompactDensity}
          />
        </div>
      </Card>

      {/* 個人資料 */}
      <Card className="p-5">
        <SectionTitle>個人資料</SectionTitle>
        <Field label="顯示名稱" hint="會喺歡迎訊息顯示">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如：陳老師"
          />
        </Field>
      </Card>

      {/* 我的資料一覽 */}
      <Card className="p-5">
        <SectionTitle right={
          overview ? (
            <span className="text-xs font-semibold tabular-nums text-accent-strong dark:text-accent">
              共 {overview.total} 筆
            </span>
          ) : undefined
        }>
          我的資料一覽
        </SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          睇清楚本機儲存咗幾多嘢，匯出備份前心裡有數。
        </p>
        {!overview ? (
          <p className="text-sm text-slate-400">計緊…</p>
        ) : overview.nonEmpty === 0 ? (
          <p className="text-sm text-slate-400">
            仲未有資料。可以喺下面載入示範資料試吓。
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {overview.rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <li
                  key={r.key}
                  className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 text-sm dark:border-slate-800"
                >
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {r.label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {r.count}
                    <span className="ml-0.5 text-xs font-normal text-slate-400">
                      {r.unit}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      {/* 資料管理 */}
      <Card className="p-5">
        <SectionTitle>資料管理</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          你嘅資料目前儲存喺呢部裝置嘅瀏覽器。定期匯出備份，或者喺換機時匯入。
        </p>
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            reminder.stale
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
              : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <span>{reminder.stale ? '⚠️' : '🛟'}</span>
          <span>{reminder.text}</span>
          {reminder.stale && (
            <span className="font-medium">· 建議而家匯出備份</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport}>
            ⬇ 匯出備份
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            ⬆ 匯入備份
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={onFile}
            className="hidden"
          />
          <Button variant="secondary" onClick={loadDemo}>
            ✨ 載入示範資料
          </Button>
          <Button variant="danger" onClick={clearAll}>
            🗑 清除所有資料
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-slate-400">
        NTK Platform · 個人與工作平台
      </p>
    </div>
  )
}

// 設定用嘅可達性開關列（label + 說明 + 右側 switch）。用原生 button 做
// role=switch，鍵盤可達；同 repo 其他 aria-pressed 切換風格一致。
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          checked ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
