import { useEffect, useMemo, useState } from 'react'
import { Share2, Search, Download, Bookmark, BookmarkCheck, Flag, ExternalLink, Users, Sparkles, Plus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
  Tooltip,
  cx,
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
  const [tab, setTab] = useState<Tab>('browse')
  const [publishing, setPublishing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const openPublish = () => setPublishing(true)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <Share2 size={13} className="shrink-0" /> 教學社群 · Community
          </p>
          <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
            資源分享區
          </h1>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            全港老師互相分享教學資源 —— 上載、瀏覽、下載、評分、收藏。{' '}
            {!isCommunityConfigured && <span className="text-amber-600 dark:text-amber-400">（示範資料；接 Supabase 後顯示真實分享）</span>}
          </p>
        </div>
        <Button icon={Plus} onClick={openPublish} className="shrink-0">
          分享資源
        </Button>
      </header>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'browse', label: '瀏覽' },
          { id: 'mine', label: '我的分享' },
          { id: 'profile', label: '我的身份' },
        ]}
        icons={{ browse: Search, mine: Sparkles, profile: Users }}
      />

      {tab === 'browse' && <BrowseTab key={`b${reloadKey}`} />}
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

function BrowseTab() {
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

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <Card padded className="space-y-3">
        <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋標題、描述、標籤…" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-auto">
            <option value="">所有科目</option>
            {SUBJECT_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
            <option value="">所有類型</option>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <span className="mx-1 hidden h-4 w-px bg-black/[0.08] dark:bg-white/10 sm:block" />
          <Select value={sort} onChange={(e) => setSort(e.target.value as ResourceSort)} className="w-auto">
            {(Object.keys(SORT_LABELS) as ResourceSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-xs text-slate-400">{rows.length} 份資源</span>
        </div>
      </Card>

      {/* 列表 */}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">載入中…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="🔍" title="搵唔到資源" hint="試吓換個科目或關鍵字。" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ResourceCard key={r.id} r={r} onOpen={() => setOpen(r)} />
          ))}
        </div>
      )}

      <ResourceDetail r={open} onClose={() => setOpen(null)} />
    </div>
  )
}

// ───────── 資源卡 ─────────

function ResourceCard({ r, onOpen }: { r: CommunityResource; onOpen: () => void }) {
  const c = TYPE_COLOR[r.type]
  const subj = subjectName(r.subjectPackId)
  return (
    <Card hover clip onClick={onOpen} className="flex cursor-pointer flex-col">
      <div className={cx('h-1 w-full', c.bar)} />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', c.chipBg, c.chipText)}>
            {TYPE_LABEL[r.type]}
          </span>
          {subj && <Badge tone="slate">{subj}</Badge>}
          {r.grade && <span className="text-[11px] text-slate-400">{r.grade}</span>}
        </div>
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
          {r.title}
        </h3>
        {r.description && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            {r.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar profile={r.owner} size={22} />
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {r.owner ? publicName(r.owner) : '老師'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
            <Stars value={avgRating(r)} />
            <span className="inline-flex items-center gap-0.5">
              <Download size={12} /> {r.downloadCount}
            </span>
          </span>
        </div>
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
  const needBackend = () => toast.error('示範資料；接 Supabase + 登入後先用到')

  async function onDownload() {
    if (!r) return
    if (!isCommunityConfigured) return needBackend()
    try {
      setBusy(true)
      await bumpDownload(r.id)
      setStat((x) => ({ ...x, down: x.down + 1 }))
      if (r.filePath) {
        // 檔案：blob 下載（唔彈 cross-origin prompt、用返靚檔名）
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
        // 同時加入本地個人資源庫（連結型存 URL；檔案型留書籤，喺社群再下載）
        resourcesCol.add({
          title: r.title,
          type: r.type,
          url: r.externalUrl ?? undefined,
          topicId: r.topicId ?? undefined,
          tags: r.tags,
          notes: '來自資源分享區',
          createdAt: new Date().toISOString(),
        })
        toast.success('已收藏，亦加入咗你嘅資源庫')
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
      toast.success('多謝評分 🙏')
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
              <div key={x.label} className="rounded-xl border border-black/[0.06] py-2 dark:border-white/[0.08]">
                <p className="text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">{x.value}</p>
                <p className="text-[11px] text-slate-400">{x.label}</p>
              </div>
            ))}
          </div>

          {/* 你嘅評分 */}
          <div className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2.5 dark:border-white/[0.08]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400">{myRating ? '你嘅評分' : '畀個評分'}</span>
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
