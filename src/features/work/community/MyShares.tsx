import { useEffect, useState } from 'react'
import { Plus, Download, Bookmark, EyeOff, Eye, Trash2, RefreshCw } from 'lucide-react'
import { Badge, Button, EmptyState, IconButton, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { TYPE_COLOR, TYPE_LABEL } from '../resourceLibrary/util'
import {
  isCommunityConfigured,
  myResources,
  setResourceStatus,
  deleteResource,
  type CommunityResource,
} from '../../../lib/community'
import { avgRating } from './util'
import { Stars, subjectName } from './parts'
import { DEMO_RESOURCES } from './demo'

const DEMO_MINE = DEMO_RESOURCES.filter((r) => r.ownerId === 'demo-chan')

export default function MyShares({ onPublish }: { onPublish: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<CommunityResource[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    if (!isCommunityConfigured) {
      setRows(DEMO_MINE)
      setLoading(false)
      return
    }
    myResources()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const demoBlock = () => toast.error('示範模式：接 Supabase + 登入後先用到。')

  async function toggleStatus(r: CommunityResource) {
    if (!isCommunityConfigured) return demoBlock()
    const next = r.status === 'published' ? 'draft' : 'published'
    try {
      setBusy(r.id)
      await setResourceStatus(r.id, next)
      setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, status: next } : x)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(null)
    }
  }

  async function remove(r: CommunityResource) {
    if (!isCommunityConfigured) return demoBlock()
    const ok = await confirm({ title: `刪除「${r.title}」？`, tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    try {
      setBusy(r.id)
      await deleteResource(r.id)
      setRows((cur) => cur.filter((x) => x.id !== r.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">你上載過嘅資源同數據。</p>
        <Button size="sm" icon={Plus} onClick={onPublish}>
          分享資源
        </Button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">載入中…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="📤" title="未分享過資源" hint="分享你第一份教材，幫到全港老師。" action={<Button icon={Plus} onClick={onPublish}>分享資源</Button>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const c = TYPE_COLOR[r.type]
            const subj = subjectName(r.subjectPackId)
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.08]">
                <span className={cx('h-9 w-1 shrink-0 rounded-full', c.bar)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</span>
                    <Badge tone={r.status === 'published' ? 'green' : r.status === 'draft' ? 'amber' : 'rose'}>
                      {r.status === 'published' ? '已發佈' : r.status === 'draft' ? '草稿' : '已下架'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    <span>{TYPE_LABEL[r.type]}</span>
                    {subj && <span>{subj}</span>}
                    <span className="inline-flex items-center gap-0.5"><Download size={11} /> {r.downloadCount}</span>
                    <span className="inline-flex items-center gap-0.5"><Bookmark size={11} /> {r.saveCount}</span>
                    <Stars value={avgRating(r)} count={r.ratingCount} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton
                    label={r.status === 'published' ? '下架' : '重新發佈'}
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => toggleStatus(r)}
                  >
                    {r.status === 'published' ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                  <IconButton label="刪除" size="sm" tone="danger" disabled={busy === r.id} onClick={() => remove(r)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!isCommunityConfigured && (
        <p className="flex items-center justify-center gap-1 pt-1 text-[11px] text-amber-600 dark:text-amber-400">
          <RefreshCw size={11} /> 示範資料；接 Supabase 後顯示你真實嘅分享。
        </p>
      )}
    </div>
  )
}
