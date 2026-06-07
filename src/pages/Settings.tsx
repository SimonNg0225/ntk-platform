import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import { LANGUAGES, setLanguage } from '../i18n'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { exportAllData, importAllData, topicsCol } from '../data/collections'
import { collectionRegistry, useCollection } from '../lib/store'
import {
  SUBJECT_PACKS,
  getSubjectPack,
  packTopics,
} from '../data/subjects'
import { preloadAllFeatures } from '../features/registry'
import { Card, Button, Field, Input, SectionTitle } from '../ui'
import AdminSupportCard from '../components/AdminSupportCard'
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
    subjectPackId,
    setSubjectPackId,
  } = useSettings()
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [overview, setOverview] = useState<DataOverview | null>(null)
  const [checking, setChecking] = useState(false)
  const topics = useCollection(topicsCol)

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

  // 載入選定科目嘅課題大綱到 topics 集合。
  // 'replace'：清走現有課題換成新科（會影響已連住課題嘅進度 / 題目，故先確認）。
  // 'append' ：只加未存在（按 id）嘅課題，保留現有。
  const applySubject = async (mode: 'replace' | 'append') => {
    const pack = getSubjectPack(subjectPackId)
    if (!pack) return
    const incoming = packTopics(pack)
    if (incoming.length === 0) {
      toast.info('「自訂」科目冇預設課題，可喺「課程進度」自行新增。')
      return
    }
    if (mode === 'replace') {
      const ok = await confirm({
        title: `以「${pack.name}」課題取代現有？`,
        message:
          '會清走目前課題清單換成此科。已連住舊課題嘅教學進度 / 題目可能對唔返號，呢個動作無法復原。建議先匯出備份。',
        confirmText: '取代課題',
        tone: 'danger',
      })
      if (!ok) return
      topicsCol.set(incoming)
      toast.success(`已載入「${pack.name}」共 ${incoming.length} 個課題`)
    } else {
      const existing = new Set(topics.map((t) => t.id))
      const added = incoming.filter((t) => !existing.has(t.id))
      topicsCol.set([...topics, ...added])
      toast.success(
        added.length > 0
          ? `已附加 ${added.length} 個課題`
          : '呢個科目嘅課題已經喺清單入面',
      )
    }
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

  // 手動檢查 SW 更新（PwaUpdater 平時自動檢查；呢度做手動後備）。
  const checkUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('此瀏覽器唔支援離線快取')
      return
    }
    setChecking(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        toast.success('開發模式：暫未註冊 service worker')
        return
      }
      await reg.update()
      toast.success(
        reg.waiting
          ? '搵到新版本！睇下方「更新」提示'
          : '已檢查 — 有新版會自動彈「更新」提示',
      )
    } catch {
      toast.error('檢查更新失敗，請再試')
    } finally {
      setChecking(false)
    }
  }

  // 強制清除快取 + service worker 後重載（Safari 卡住舊版嘅終極後備）。
  // 只清程式快取／SW，唔掂 localStorage 嘅用戶資料。
  const hardReset = async () => {
    if (
      !(await confirm({
        title: '清除快取並重新載入？',
        message:
          '會清除程式快取同 service worker，強制載入最新版本。你嘅資料（筆記、班別、成績等）儲喺本機，唔受影響。',
        confirmText: '清除並重載',
      }))
    )
      return
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } finally {
      location.reload()
    }
  }

  const themes: { id: 'light' | 'dark' | 'system'; label: string; icon: LucideIcon }[] =
    [
      { id: 'light', label: '淺色', icon: Sun },
      { id: 'dark', label: '深色', icon: Moon },
      { id: 'system', label: '跟隨系統', icon: Monitor },
    ]

  return (
    <div className="space-y-6">
      {/* 客服收件箱（只 admin 顯示） */}
      <AdminSupportCard />

      {/* 外觀 */}
      <Card className="p-5">
        <SectionTitle>{t('settings.appearance')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.appearanceHint')}
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
              <t.icon size={22} strokeWidth={1.75} />
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

      {/* 語言 / Language */}
      <Card className="p-5">
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.languageHint')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id)}
              className={`rounded-xl border p-3 text-sm font-medium transition ${
                i18n.language === l.id
                  ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 個人資料 */}
      <Card className="p-5">
        <SectionTitle>{t('settings.profile')}</SectionTitle>
        <Field label="顯示名稱" hint="會喺歡迎訊息顯示">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例如：陳老師"
          />
        </Field>
      </Card>

      {/* 任教科目（多科課程包） */}
      <Card className="p-5">
        <SectionTitle
          right={
            <span className="text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
              現有 {topics.length} 課題
            </span>
          }
        >
          {t('settings.subjects')}
        </SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.subjectsHint')}
        </p>
        <Field label="科目">
          <select
            value={subjectPackId}
            onChange={(e) => setSubjectPackId(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 dark:text-slate-100"
          >
            {SUBJECT_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => applySubject('append')}>
            附加此科課題
          </Button>
          <Button onClick={() => applySubject('replace')}>以此科取代課題</Button>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          起始大綱為精簡模板，未必涵蓋官方課程全部細項，可自行調整。
        </p>
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
          {t('settings.dataOverview')}
        </SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.dataOverviewHint')}
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
        <SectionTitle>{t('settings.dataManagement')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.dataManagementHint')}
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

      {/* 應用程式更新（PWA 手動後備） */}
      <Card className="p-5">
        <SectionTitle>{t('settings.appUpdate')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.appUpdateHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={checkUpdate} disabled={checking}>
            🔄 {checking ? '檢查中…' : '檢查更新'}
          </Button>
          <Button variant="secondary" onClick={hardReset}>
            🧹 清除快取並重新載入
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-slate-400">
        EziTeach 教學易 · 教師工作台
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
