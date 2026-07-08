import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  FileText,
  HardDrive,
  Languages,
  LifeBuoy,
  Mail,
  Moon,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
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
import { smartApplyTopics, appendTopicsByText } from '../features/work/topicImport/applyTopics'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Card, Button, Field, Input } from '../ui'
import { seedAllDemo } from '../lib/demoData'
import {
  summarizeData,
  formatBackupReminder,
  type CollectionSummary,
  type DataOverview,
} from '../features/settings/dataOverview'
import ProfileSetupModal from '../features/onboarding/ProfileSetupModal'
import { isProfileConfigured } from '../lib/profile'
import { BRAND_FULL_ZH } from '../lib/brand'
import { COMPANY } from '../lib/companyInfo'

const LEGAL_LINKS = [
  { to: '/privacy', key: 'privacy', icon: ShieldCheck },
  { to: '/terms', key: 'terms', icon: FileText },
  { to: '/guidelines', key: 'guidelines', icon: LifeBuoy },
  { to: '/pricing', key: 'pricing', icon: Sparkles },
] as const

const SETTINGS_NAV: { id: string; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'settings-appearance', label: '外觀', hint: '主題、密度', icon: Palette },
  { id: 'settings-account', label: '帳戶', hint: '語言、名稱', icon: UserRound },
  { id: 'settings-subject', label: '任教科目', hint: '課題大綱', icon: BookOpen },
  { id: 'settings-data', label: '資料', hint: '備份、匯入', icon: Database },
  { id: 'settings-system', label: '系統', hint: '快取、更新', icon: RefreshCw },
  { id: 'settings-legal', label: '私隱支援', hint: '條款、支援', icon: ShieldCheck },
]

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// 設定頁：用 settings center 方式呈現，降低長表單感同橫向空白。
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
  const { user, configured, signOut } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [overview, setOverview] = useState<DataOverview | null>(null)
  const [checking, setChecking] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
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
    try {
      await preloadAllFeatures()
    } catch {
      /* ignore：照匯出已登記的 collection */
    }
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eziteach-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    markBackup()
    toast.success('已匯出備份檔案')
  }

  const loadDemo = async () => {
    const n = await seedAllDemo()
    toast.success(n > 0 ? `已載入 ${n} 筆試用資料` : '已有資料，毋須再載入')
  }

  const applySubject = async (mode: 'replace' | 'append') => {
    const pack = getSubjectPack(subjectPackId)
    if (!pack) return
    const incoming = packTopics(pack)
    if (incoming.length === 0) {
      toast.info('「自訂」科目沒有預設課題，可在「課程進度」自行新增。')
      return
    }
    if (mode === 'replace') {
      const ok = await confirm({
        title: `切換做「${pack.name}」課題？`,
        message:
          '智能切換：同名課題自動保留連繫（題庫／進度／評估／備課不甩號）；舊有但還有資料連住的會保留，沒有用的先清走。安全、不會失資料。',
        confirmText: '智能切換',
      })
      if (!ok) return
      const r = smartApplyTopics(incoming)
      toast.success(
        `已切換做「${pack.name}」：保留 ${r.matched} · 新增 ${r.added}` +
          (r.kept ? ` · 留存 ${r.kept}` : '') +
          (r.removed ? ` · 清走 ${r.removed}` : ''),
      )
    } else {
      const added = appendTopicsByText(incoming)
      toast.success(
        added > 0
          ? `已附加 ${added} 個課題`
          : '此科目的課題已經在清單中',
      )
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!(await confirm({
      title: '匯入資料？',
      message: '匯入會覆寫現有對應資料，此動作無法復原。',
      confirmText: '匯入',
    }))) {
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      const text = await file.text()
      await preloadAllFeatures()
      const n = importAllData(JSON.parse(text))
      toast.success(`已匯入 ${n} 類資料`)
    } catch {
      toast.error('匯入失敗：檔案格式不正確')
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
    await preloadAllFeatures()
    for (const col of collectionRegistry.values()) col.set([] as never[])
    toast.success('已清除所有資料')
  }

  const deleteAccount = async () => {
    if (!supabase || !user) return
    if (
      !(await confirm({
        title: '永久刪除雲端帳戶？',
        message:
          '會永久刪除你在雲端的所有資料同登入帳戶（包括電郵），不可逆。本機資料亦會一併清除。建議先匯出備份。',
        confirmText: '永久刪除',
        tone: 'danger',
      }))
    )
      return
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      })
      if (error) throw error
      await preloadAllFeatures()
      for (const col of collectionRegistry.values()) col.set([] as never[])
      await signOut()
      toast.success('帳戶已永久刪除')
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : '刪除失敗，請稍後再試或聯絡支援。',
      )
    }
  }

  const checkUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('此瀏覽器不支援離線快取')
      return
    }
    setChecking(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        toast.success('目前未啟用離線更新檢查')
        return
      }
      await reg.update()
      toast.success(
        reg.waiting
          ? '找到新版本！查看下方「更新」提示'
          : '已檢查 — 有新版會自動彈「更新」提示',
      )
    } catch {
      toast.error('檢查更新失敗，請再試')
    } finally {
      setChecking(false)
    }
  }

  const hardReset = async () => {
    if (
      !(await confirm({
        title: '清除快取並重新載入？',
        message:
          '會清除程式快取同 service worker，強制載入最新版本。你的資料（筆記、班別、成績等）儲在本機，不受影響。',
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

  const themes: { id: 'light' | 'dark' | 'system'; label: string; desc: string; icon: LucideIcon }[] =
    [
      { id: 'light', label: '淺色', desc: '適合日間備課', icon: Sun },
      { id: 'dark', label: '深色', desc: '夜晚調整設定更舒服', icon: Moon },
      { id: 'system', label: '跟隨系統', desc: '自動配合裝置', icon: Monitor },
    ]
  const BackupReminderIcon = reminder.stale ? AlertTriangle : CheckCircle2
  const selectedPack = getSubjectPack(subjectPackId)
  const activeTheme = themes.find((item) => item.id === theme) ?? themes[2]
  const activeLanguage = LANGUAGES.find((item) => item.id === i18n.language) ?? LANGUAGES[0]
  const dataRows = useMemo(() => buildDataPreview(overview), [overview])
  const syncLabel = user
    ? '已登入，可雲端同步'
    : configured
      ? '訪客模式，本機使用'
      : '本機模式'

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="space-y-5">
      <SettingsOverview
        displayName={displayName}
        themeLabel={activeTheme.label}
        languageLabel={activeLanguage.label}
        subjectLabel={selectedPack?.short ?? '未指定'}
        dataTotal={overview?.total ?? 0}
        backupText={reminder.text}
        syncLabel={syncLabel}
      />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden space-y-4 xl:sticky xl:top-2 xl:block xl:self-start">
          <Card className="p-3">
            <div className="px-2 pb-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                設定導覽
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                直接跳到要改的位置；日常較少用的法律與系統項目放到底部。
              </p>
            </div>
            <div className="space-y-1">
              {SETTINGS_NAV.map((item) => (
                <NavJump
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  hint={item.hint}
                  onClick={() => scrollToSection(item.id)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              目前狀態
            </p>
            <div className="mt-3 space-y-3">
              <StatusRow
                icon={BackupReminderIcon}
                label="備份"
                value={reminder.text}
                tone={reminder.stale ? 'warn' : 'ok'}
              />
              <StatusRow icon={BookOpen} label="課題" value={`${topics.length} 個`} />
              <StatusRow
                icon={HardDrive}
                label="資料"
                value={overview ? `${overview.total} 筆` : '計算中'}
              />
              <StatusRow icon={ShieldCheck} label="同步" value={syncLabel} />
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-5">
          <SettingsSection
            id="settings-appearance"
            icon={Palette}
            eyebrow="Preference"
            title={t('settings.appearance')}
            description="調整你每日打開工作台時的視覺節奏。"
          >
            <div className="grid gap-2 md:grid-cols-3">
              {themes.map((item) => (
                <ThemeChoice
                  key={item.id}
                  active={theme === item.id}
                  icon={item.icon}
                  label={item.label}
                  desc={item.desc}
                  onClick={() => setTheme(item.id)}
                />
              ))}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <ToggleRow
                label="減少動態效果"
                hint="收起頁面動畫同過場，畫面更安靜。"
                checked={reduceMotion}
                onChange={setReduceMotion}
              />
              <ToggleRow
                label="緊湊密度"
                hint="收窄主內容邊距，一屏查看多些。"
                checked={compactDensity}
                onChange={setCompactDensity}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-account"
            icon={UserRound}
            eyebrow="Account"
            title="帳戶與語言"
            description="設定顯示名稱、介面語言，以及需要時更新完整教師檔案。"
            right={<SmallPill icon={Languages}>{activeLanguage.label}</SmallPill>}
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    介面語言
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LANGUAGES.map((item) => (
                      <SegmentChoice
                        key={item.id}
                        active={i18n.language === item.id}
                        label={item.label}
                        onClick={() => setLanguage(item.id)}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">
                    {t('settings.languageHint')}
                  </p>
                </div>

                <Field label="顯示名稱" hint="用於首頁問候和本機個人化提示。">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例如：陳老師"
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent shadow-xs ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <UserRound size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {displayName || '未命名老師'}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email ?? syncLabel}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  註冊時填的完整檔案（頭像、身份、任教科目、學校、簡介）存在你帳戶，可隨時查看同改。
                </p>
                {isProfileConfigured && (
                  <Button
                    className="mt-4"
                    variant="secondary"
                    icon={UserRound}
                    onClick={() => setEditProfileOpen(true)}
                  >
                    編輯完整個人資料
                  </Button>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-subject"
            icon={BookOpen}
            eyebrow="Teaching Context"
            title={t('settings.subjects')}
            description="任教科目會影響教學 AI 語境，亦可一鍵載入起始課題大綱。"
            right={<SmallPill icon={BookOpen}>現有 {topics.length} 課題</SmallPill>}
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                <Field label="科目">
                  <select
                    value={subjectPackId}
                    onChange={(e) => setSubjectPackId(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-800 shadow-xs outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">未指定（全 app 顯示中性字眼）</option>
                    {SUBJECT_PACKS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    disabled={!subjectPackId}
                    icon={BookOpen}
                    onClick={() => applySubject('append')}
                  >
                    附加此科課題
                  </Button>
                  <Button
                    disabled={!subjectPackId}
                    icon={Sparkles}
                    onClick={() => applySubject('replace')}
                  >
                    智能切換做此科
                  </Button>
                </div>
                <p className="text-xs leading-5 text-slate-400 dark:text-slate-500">
                  起始大綱為精簡模板，未必涵蓋官方課程全部細項，可自行調整。
                </p>
              </div>

              <div className="rounded-xl border border-accent/15 bg-accent-soft p-4 dark:border-accent/25 dark:bg-accent/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-strong dark:text-accent">
                  Current Subject
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPack?.name ?? '未指定科目'}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {selectedPack
                    ? `可載入 ${selectedPack.topics.length} 個起始課題。`
                    : '未指定時，系統會使用較中性的教學語境。'}
                </p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-data"
            icon={Database}
            eyebrow="Data"
            title="資料與備份"
            description="把本機資料狀態、備份、匯入和清除集中在同一區，降低誤操作風險。"
            right={
              overview ? (
                <SmallPill icon={HardDrive}>共 {overview.total} 筆</SmallPill>
              ) : undefined
            }
          >
            <div
              className={cx(
                'mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm',
                reminder.stale
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20'
                  : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
              )}
            >
              <BackupReminderIcon size={17} className="mt-0.5 shrink-0" />
              <span>
                {reminder.text}
                {reminder.stale && <span className="font-semibold"> · 建議現在匯出備份</span>}
              </span>
            </div>

            {!overview ? (
              <p className="text-sm text-slate-400">計緊本機資料…</p>
            ) : overview.nonEmpty === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center dark:border-slate-800 dark:bg-slate-950/40">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  尚未有資料
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  可以在下方載入試用資料，或者開始建立自己的課堂工作流。
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {dataRows.map((row) => (
                  <DataStat key={row.key} row={row} />
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" icon={Download} onClick={doExport}>
                匯出備份
              </Button>
              <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
                匯入備份
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={onFile}
                className="hidden"
              />
              <Button variant="secondary" icon={Sparkles} onClick={loadDemo}>
                載入試用資料
              </Button>
              <Button variant="danger" icon={Trash2} onClick={clearAll}>
                清除所有資料
              </Button>
              {configured && user && (
                <Button variant="danger" icon={AlertTriangle} onClick={deleteAccount}>
                  刪除雲端帳戶
                </Button>
              )}
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-system"
            icon={RefreshCw}
            eyebrow="System"
            title={t('settings.appUpdate')}
            description="處理 PWA 快取或新版未即時出現的情況；不會清除你的教學資料。"
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={RefreshCw} loading={checking} onClick={checkUpdate}>
                {checking ? '檢查中…' : '檢查更新'}
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={hardReset}>
                清除快取並重新載入
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="settings-legal"
            icon={ShieldCheck}
            eyebrow="Trust"
            title={t('settings.legalTitle')}
            description={t('settings.legalHint')}
            right={<SmallPill icon={ShieldCheck}>{COMPANY.region}</SmallPill>}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {LEGAL_LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-accent/45 dark:hover:bg-accent/15 dark:hover:text-accent"
                  >
                    <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                    <span className="truncate">
                      {t(`settings.legalLinks.${item.key}`)}
                    </span>
                  </Link>
                )
              })}
            </div>
            <div className="mt-4 rounded-xl border border-accent/15 bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-slate-600 dark:border-accent/25 dark:bg-accent/10 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {t('settings.legalNoticeTitle')}
              </p>
              <p className="mt-1 leading-6">{t('settings.legalNotice')}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={`mailto:${COMPANY.supportEmail}`}
                className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-accent dark:text-slate-400 dark:hover:text-accent"
              >
                <Mail size={13} />
                {COMPANY.supportEmail}
              </a>
              <span>
                {t('settings.legalCopyright', {
                  year: new Date().getFullYear(),
                })}
              </span>
            </div>
          </SettingsSection>
        </div>
      </div>

      <ProfileSetupModal
        open={editProfileOpen}
        mode="edit"
        onDone={() => setEditProfileOpen(false)}
      />

      <p className="text-center text-xs text-slate-400">{BRAND_FULL_ZH}</p>
    </div>
  )
}

function SettingsOverview({
  displayName,
  themeLabel,
  languageLabel,
  subjectLabel,
  dataTotal,
  backupText,
  syncLabel,
}: {
  displayName: string
  themeLabel: string
  languageLabel: string
  subjectLabel: string
  dataTotal: number
  backupText: string
  syncLabel: string
}) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/70 dark:bg-slate-900">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <SmallPill icon={ShieldCheck}>設定中心</SmallPill>
            <SmallPill icon={HardDrive}>{syncLabel}</SmallPill>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {displayName || '老師'}，把工作台調到最適合自己用
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            常用偏好放前面，資料和法律資訊放後面。日常開 app 時保持乾淨，需要管理時先進入此頁。
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/35 sm:grid-cols-3 lg:grid-cols-2 lg:border-l lg:border-t-0">
          <OverviewMetric label="主題" value={themeLabel} />
          <OverviewMetric label="語言" value={languageLabel} />
          <OverviewMetric label="科目" value={subjectLabel} />
          <OverviewMetric label="資料" value={`${dataTotal} 筆`} />
          <OverviewMetric label="備份" value={backupText} wide />
        </div>
      </div>
    </section>
  )
}

function SettingsSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
  right,
  children,
}: {
  id: string
  icon: LucideIcon
  eyebrow: string
  title: string
  description?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong ring-1 ring-accent/15 dark:bg-accent/15 dark:text-accent dark:ring-accent/20">
              <Icon size={18} strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {eyebrow}
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-slate-50">
                {title}
              </h2>
              {description && (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
          </div>
          {right}
        </div>
        {children}
      </Card>
    </section>
  )
}

function ThemeChoice({
  active,
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 ring-1 ring-current/10 dark:bg-slate-950/50">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs opacity-75">{desc}</span>
      </span>
      {active && <CheckCircle2 size={17} className="ml-auto shrink-0" />}
    </button>
  )
}

function SegmentChoice({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
    >
      {label}
    </button>
  )
}

// 設定用的可達性開關列。用原生 button 做 role=switch，鍵盤可達。
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
    <div className="flex min-h-[76px] items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          checked ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cx(
            'inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

function NavJump({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-800/70"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      </span>
      <ChevronRight size={14} className="ml-auto shrink-0 text-slate-300" />
    </button>
  )
}

function StatusRow({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: LucideIcon
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          tone === 'ok' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
          tone === 'warn' && 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
          tone === 'neutral' && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        )}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {value}
        </p>
      </div>
    </div>
  )
}

function OverviewMetric({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={cx('p-3', wide && 'col-span-2 sm:col-span-1 lg:col-span-2')}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}

function SmallPill({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-slate-50 px-3 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
      <Icon size={13} />
      {children}
    </span>
  )
}

function DataStat({ row }: { row: CollectionSummary }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <span className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">
        {row.label}
      </span>
      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {row.count}
        <span className="ml-0.5 text-xs font-normal text-slate-400">{row.unit}</span>
      </span>
    </div>
  )
}

function buildDataPreview(overview: DataOverview | null): CollectionSummary[] {
  if (!overview) return []
  const rows = overview.rows.filter((row) => row.count > 0)
  const friendly: CollectionSummary[] = []
  let hiddenCount = 0

  for (const row of rows) {
    if (looksTechnical(row)) hiddenCount += row.count
    else friendly.push(row)
  }

  const visible = friendly.slice(0, 8)
  hiddenCount += friendly.slice(8).reduce((sum, row) => sum + row.count, 0)
  if (hiddenCount > 0) {
    visible.push({
      key: '__other__',
      label: '其他功能資料',
      unit: '項',
      count: hiddenCount,
    })
  }
  return visible
}

function looksTechnical(row: CollectionSummary) {
  if (row.label === row.key) return true
  return /[_]/.test(row.label) || /^[a-z0-9-]+$/i.test(row.label)
}
