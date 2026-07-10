import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Share2, Search, SearchX, Download, Bookmark, BookmarkCheck, Flag, ExternalLink, Users, Plus, FileText, Presentation, ClipboardList, Link2, Video, StickyNote, Info, type LucideIcon } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  PageHero,
  Tabs,
  Textarea,
  Tooltip,
  cx,
  type FeatureGuideStep,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { SUBJECT_PACKS } from '../../../data/subjects'
import { resourcesCol } from '../../../data/collections'
import { TYPE_COLOR, TYPE_LABEL, TYPE_ORDER } from '../resourceLibrary/util'
import {
  isCommunityConfigured,
  listResources,
  bumpDownload,
  saveResource,
  unsaveResource,
  isSaved,
  rateResource,
  getMyRating,
  reportResource,
  downloadResourceFile,
  type CommunityResource,
} from '../../../lib/community'
import {
  publicName,
  avgRating,
  matchesFilter,
  sortResources,
  SORT_LABELS,
  type ResourceFilter,
  type ResourceSort,
} from './util'
import { Avatar, Stars, StarPicker, subjectName } from './parts'
import ProfileTab from './ProfileTab'
import MyShares from './MyShares'
import PublishForm from './PublishForm'
import { DEMO_RESOURCES } from './demo'

type Tab = 'browse' | 'mine' | 'profile'

export default function Community() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('browse')
  const [publishing, setPublishing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const openPublish = () => setPublishing(true)

  return (
    <div className="space-y-5">
      <PageHero
        guideKey="community"
        icon={Share2}
        kicker={t('community.kicker', { defaultValue: '教學社群' })}
        title={t('community.title', { defaultValue: '資源分享區' })}
        description={t('community.subtitle', { defaultValue: '先瀏覽同收藏合用教材；準備好時，再用署名或匿名方式分享資源。' })}
        actions={
          <button
            type="button"
            onClick={openPublish}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Plus size={15} /> {t('community.share', { defaultValue: '分享資源' })}
          </button>
        }
      />

      {!isCommunityConfigured && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <Info size={12} strokeWidth={2} className="shrink-0" />
          {t('community.demoNote', { defaultValue: '試用資料 · 完成雲端連線後顯示真實分享' })}
        </span>
      )}

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'browse', label: t('community.tabBrowse', { defaultValue: '瀏覽' }) },
          { id: 'mine', label: t('community.tabMine', { defaultValue: '我的分享' }) },
          { id: 'profile', label: t('community.tabProfile', { defaultValue: '我的身份' }) },
        ]}
        icons={{ browse: Search, mine: Bookmark, profile: Users }}
      />

      {tab === 'browse' && <BrowseTab key={`b${reloadKey}`} onPublish={openPublish} />}
      {tab === 'mine' && <MyShares key={`m${reloadKey}`} onPublish={openPublish} />}
      {tab === 'profile' && <ProfileTab />}

      <PublishForm
        open={publishing}
        onClose={() => setPublishing(false)}
        onPublished={() => setReloadKey((k) => k + 1)}
      />
    </div>
  )
}

// ───────── 瀏覽 ─────────

// 教學引導步驟（zh-HK source；正式翻譯可加 i18n key）
const BROWSE_GUIDE: FeatureGuideStep[] = [
  { title: '搜尋 / 篩選', desc: '用上面搜尋框，或選擇科目、類型同排序，快速找到適合用的教材。' },
  { title: '預覽同下載', desc: '按資源卡查看詳情；按「下載」即取檔案，連結型就直接開啟。' },
  { title: '評分同收藏', desc: '好用就給星支持作者；「收藏」會同時加入你的資源庫。' },
]

function BrowseTab({ onPublish }: { onPublish: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<ResourceSort>('recent')
  const [rows, setRows] = useState<CommunityResource[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<CommunityResource | null>(null)

  const filter: ResourceFilter = useMemo(
    () => ({ q, subjectPackId: subject || undefined, type: (type || undefined) as ResourceFilter['type'] }),
    [q, subject, type],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (!isCommunityConfigured) {
      // demo：純函式篩選排序
      const list = sortResources(DEMO_RESOURCES.filter((r) => matchesFilter(r, filter)), sort)
      setRows(list)
      setLoading(false)
      return
    }
    listResources(filter, sort)
      .then((list) => !cancelled && setRows(list))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort])

  // 快捷下載（卡片直接按，不用開詳情）；試用模式提示稍後連線。
  async function handleDownload(r: CommunityResource) {
    if (!isCommunityConfigured) return toast.error('試用資料暫未提供下載；完成雲端連線及登入後可用。')
    try {
      await bumpDownload(r.id)
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, downloadCount: x.downloadCount + 1 } : x)))
      if (r.filePath) await downloadResourceFile(r.filePath, r.fileName ?? undefined)
      else if (r.externalUrl) window.open(r.externalUrl, '_blank', 'noopener')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下載失敗')
    }
  }

  const hasFilter = !!(q || subject || type)
  const clearFilters = () => {
    setQ('')
    setSubject('')
    setType('')
  }

  return (
    <div className="space-y-4">
      {/* 教學引導：教用家點搜尋 + 如何使用資源 */}
      <FeatureGuide
        storageKey="community"
        title={t('community.guideTitle', { defaultValue: '資源分享區使用說明' })}
        steps={BROWSE_GUIDE}
      />

      {/* 工具列 */}
      <Card padded className="space-y-3">
        <Input
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('community.searchPlaceholder', { defaultValue: '搜尋標題、描述、標籤…' })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
            <option value="">{t('community.allSubjects', { defaultValue: '所有科目' })}</option>
            {SUBJECT_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
            <option value="">{t('community.allTypes', { defaultValue: '所有類型' })}</option>
            {TYPE_ORDER.map((tp) => (
              <option key={tp} value={tp}>
                {TYPE_LABEL[tp]}
              </option>
            ))}
          </Select>
          <span className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <Select value={sort} onChange={(e) => setSort(e.target.value as ResourceSort)} className="w-auto">
            {(Object.keys(SORT_LABELS) as ResourceSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
          <span className="ml-auto flex items-center gap-2.5 text-xs text-slate-400 dark:text-slate-500">
            {hasFilter && (
              <button
                onClick={clearFilters}
                className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-slate-400 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:text-slate-500"
              >
                {t('community.clearFilters', { defaultValue: '清除篩選' })}
              </button>
            )}
            <span className="tabular-nums slashed-zero">
              {t('community.countResources', { n: rows.length, defaultValue: `${rows.length} 份資源` })}
            </span>
          </span>
        </div>
      </Card>

      {/* 列表 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={SearchX}
            title={t('community.emptyFilteredTitle', { defaultValue: '搜尋不到符合的資源' })}
            hint={t('community.emptyFilteredHint', { defaultValue: '嘗試換個科目或關鍵字，或清除全部篩選再查看。' })}
            action={
              <Button size="sm" variant="secondary" icon={SearchX} onClick={clearFilters}>
                {t('community.clearFilters', { defaultValue: '清除篩選' })}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Share2}
            title={t('community.emptyTitle', { defaultValue: '尚未有資源' })}
            hint={t('community.emptyHint', { defaultValue: '可以先由你第一份可分享教材開始；記得確認版權同移除學生個人資料。' })}
            action={
              <Button size="sm" variant="secondary" icon={Plus} onClick={onPublish}>
                {t('community.share', { defaultValue: '分享資源' })}
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ResourceCard key={r.id} r={r} onOpen={() => setOpen(r)} onDownload={() => handleDownload(r)} />
          ))}
        </div>
      )}

      <ResourceDetail r={open} onClose={() => setOpen(null)} />
    </div>
  )
}

// ───────── 資源卡 ─────────

// 每個類型一隻線性圖示（type tile / 無縮圖封面用）
const TYPE_ICON: Record<string, LucideIcon> = {
  handout: FileText,
  slides: Presentation,
  paper: ClipboardList,
  link: Link2,
  video: Video,
  note: StickyNote,
}

function CardSkeleton() {
  return (
    <Card clip className="flex flex-col">
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="mt-1 flex items-center justify-between border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </Card>
  )
}

function ResourceCard({
  r,
  onOpen,
  onDownload,
}: {
  r: CommunityResource
  onOpen: () => void
  onDownload: () => void
}) {
  const c = TYPE_COLOR[r.type]
  const subj = subjectName(r.subjectPackId)
  const TypeIcon = TYPE_ICON[r.type] ?? FileText
  const meta = [subj, r.grade].filter(Boolean).join(' · ')
  const canDownload = !!(r.filePath || r.externalUrl)

  return (
    <Card hover clip onClick={onOpen} className="group flex cursor-pointer flex-col">
      {/* 有縮圖：真圖做 16:9 封面 + 類型 badge 疊上；沒有縮圖：body 用 type tile。 */}
      {r.thumbUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={r.thumbUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <span className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/25 to-transparent" />
          <span className={cx('absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm', c.bar)}>
            {TYPE_LABEL[r.type]}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {r.thumbUrl ? (
          meta && <p className="text-[11px] text-slate-400">{meta}</p>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', c.chipBg, c.chipText)}>
              <TypeIcon size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className={cx('text-[11px] font-semibold', c.chipText)}>{TYPE_LABEL[r.type]}</p>
              {meta && <p className="truncate text-[11px] text-slate-400">{meta}</p>}
            </div>
          </div>
        )}

        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
          {r.title}
        </h3>
        {r.description && (
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {r.description}
          </p>
        )}
        {r.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {r.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-700/60">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar profile={r.owner} size={22} />
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {r.owner ? publicName(r.owner) : '老師'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <Stars value={avgRating(r)} />
            <span className="inline-flex items-center gap-0.5">
              <Download size={12} /> <span className="tabular-nums slashed-zero">{r.downloadCount}</span>
            </span>
          </span>
        </div>

        {canDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDownload()
            }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 px-3 text-[12px] font-medium text-slate-600 transition hover:border-accent/40 hover:bg-accent-soft/50 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:text-slate-300 dark:hover:text-accent"
          >
            {r.filePath ? <Download size={13} strokeWidth={2} /> : <ExternalLink size={13} strokeWidth={2} />}
            {r.filePath ? '下載' : '開啟連結'}
          </button>
        )}
      </div>
    </Card>
  )
}

// ───────── 詳情 ─────────

const REPORT_REASONS: { v: string; l: string }[] = [
  { v: 'copyright', l: '侵犯版權' },
  { v: 'inappropriate', l: '不當內容' },
  { v: 'quality', l: '質素差 / 與描述不符' },
  { v: 'other', l: '其他' },
]

function ResourceDetail({ r, onClose }: { r: CommunityResource | null; onClose: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [stat, setStat] = useState({ down: 0, save: 0, sum: 0, count: 0 })
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('copyright')
  const [reportDetail, setReportDetail] = useState('')

  useEffect(() => {
    setReporting(false)
    setReason('copyright')
    setReportDetail('')
    if (!r) return
    setStat({ down: r.downloadCount, save: r.saveCount, sum: r.ratingSum, count: r.ratingCount })
    setSaved(false)
    setMyRating(null)
    if (!isCommunityConfigured) return
    isSaved(r.id).then(setSaved).catch(() => {})
    getMyRating(r.id).then(setMyRating).catch(() => {})
  }, [r])

  if (!r) return null
  const c = TYPE_COLOR[r.type]
  const subj = subjectName(r.subjectPackId)
  const avg = stat.count > 0 ? stat.sum / stat.count : 0
  const needBackend = () => toast.error('試用資料暫未提供下載；完成雲端連線及登入後可用。')

  async function onDownload() {
    if (!r) return
    if (!isCommunityConfigured) return needBackend()
    try {
      setBusy(true)
      await bumpDownload(r.id)
      setStat((x) => ({ ...x, down: x.down + 1 }))
      if (r.filePath) {
        // 檔案：blob 下載（不彈 cross-origin prompt、使用靚檔名）
        await downloadResourceFile(r.filePath, r.fileName ?? undefined)
      } else if (r.externalUrl) {
        // 純連結：照開新分頁
        window.open(r.externalUrl, '_blank', 'noopener')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下載失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onToggleSave() {
    if (!r) return
    if (!isCommunityConfigured) return needBackend()
    try {
      setBusy(true)
      if (saved) {
        await unsaveResource(r.id)
        setSaved(false)
        setStat((x) => ({ ...x, save: Math.max(0, x.save - 1) }))
      } else {
        await saveResource(r.id)
        setSaved(true)
        setStat((x) => ({ ...x, save: x.save + 1 }))
        // 同時加入本地個人資源庫（連結型存 URL；檔案型留書籤，在社群再下載）
        resourcesCol.add({
          title: r.title,
          type: r.type,
          url: r.externalUrl ?? undefined,
          topicId: r.topicId ?? undefined,
          tags: r.tags,
          notes: '來自資源分享區',
          createdAt: new Date().toISOString(),
        })
        toast.success('已收藏，亦加入了你的資源庫')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setBusy(false)
    }
  }

  async function onRate(n: number) {
    if (!r) return
    if (!isCommunityConfigured) return needBackend()
    try {
      await rateResource(r.id, n)
      setStat((x) => ({
        ...x,
        sum: x.sum - (myRating ?? 0) + n,
        count: myRating != null ? x.count : x.count + 1,
      }))
      setMyRating(n)
      toast.success('多謝評分。')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '評分失敗')
    }
  }

  async function submitReport() {
    if (!r) return
    if (!isCommunityConfigured) return needBackend()
    try {
      setBusy(true)
      await reportResource(r.id, reason, reportDetail)
      toast.success('已收到檢舉，管理員會跟進')
      setReporting(false)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '檢舉失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!r} onClose={onClose} title={reporting ? '檢舉資源' : ''} size="lg">
      {reporting ? (
        <div className="space-y-3.5">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            檢舉「{r.title}」。管理員會審核，成立會下架。
          </p>
          <Field label="原因">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="補充（選填）">
            <Textarea rows={3} value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReporting(false)}>
              取消
            </Button>
            <Button variant="danger" icon={Flag} onClick={submitReport} loading={busy}>
              提交檢舉
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cx('-mx-5 -mt-5 mb-1 h-1.5', c.bar)} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cx('rounded-md px-2 py-0.5 text-[11px] font-semibold', c.chipBg, c.chipText)}>
              {TYPE_LABEL[r.type]}
            </span>
            {subj && <Badge tone="slate">{subj}</Badge>}
            {r.grade && <Badge tone="blue">{r.grade}</Badge>}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Stars value={avg} count={stat.count} />
            </span>
          </div>

          <h2 className="text-lg font-semibold leading-snug text-slate-800 dark:text-slate-100">{r.title}</h2>
          {r.description && (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {r.description}
            </p>
          )}

          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* 發佈者 */}
          <Card className="flex items-center gap-3 p-3">
            <Avatar profile={r.owner} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {r.owner ? publicName(r.owner) : '老師'}
              </p>
              {r.owner?.bio && !r.owner.anonymous && (
                <p className="line-clamp-1 text-[11px] text-slate-400">{r.owner.bio}</p>
              )}
            </div>
          </Card>

          {/* 統計 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: '下載', value: stat.down },
              { label: '收藏', value: stat.save },
              { label: '評分', value: stat.count ? avg.toFixed(1) : '—' },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border border-slate-200/80 py-2 dark:border-slate-700/60">
                <p className="text-base font-semibold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">{x.value}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{x.label}</p>
              </div>
            ))}
          </div>

          {/* 你的評分 */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-700/60">
            <span className="text-[12px] text-slate-500 dark:text-slate-400">{myRating ? '你的評分' : '給個評分'}</span>
            <StarPicker value={myRating ?? 0} onPick={onRate} />
          </div>

          {/* 動作 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={r.filePath ? Download : ExternalLink} onClick={onDownload} loading={busy} fullWidth={false}>
              {r.filePath ? '下載' : '開啟連結'}
            </Button>
            <Button variant={saved ? 'primary' : 'secondary'} icon={saved ? BookmarkCheck : Bookmark} onClick={onToggleSave} disabled={busy}>
              {saved ? '已收藏' : '收藏'}
            </Button>
            <span className="ml-auto" />
            <Tooltip label="檢舉">
              <IconButton label="檢舉" tone="danger" onClick={() => setReporting(true)}>
                <Flag size={16} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      )}
    </Modal>
  )
}
