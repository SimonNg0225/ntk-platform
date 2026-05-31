import { useRef } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { exportAllData, importAllData } from '../data/collections'
import { collectionRegistry } from '../lib/store'
import { preloadAllFeatures } from '../features/registry'
import { Card, Button, Field, Input, SectionTitle } from '../ui'
import { seedAllDemo } from '../lib/demoData'

// 設定頁：外觀、個人資料、資料管理（匯出/匯入/清除）
export default function Settings() {
  const { theme, setTheme, displayName, setDisplayName } = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ntk-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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

      {/* 資料管理 */}
      <Card className="p-5">
        <SectionTitle>資料管理</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          你嘅資料目前儲存喺呢部裝置嘅瀏覽器。定期匯出備份，或者喺換機時匯入。
        </p>
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
