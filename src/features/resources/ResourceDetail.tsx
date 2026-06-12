// ============================================================
//  資源詳情頁
// ============================================================

import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Star, Bookmark, Flag, Trash2, FileText, ExternalLink } from 'lucide-react'
import { Button, Badge, Card, EmptyState } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  getResource,
  downloadResource,
  rateResource,
  getMyRating,
  toggleSave,
  isSaved,
  reportResource,
  deleteResource,
  getFileSignedUrl,
} from './api'
import { avg, fileKind } from './logic'
import type { SharedResource } from './types'

const TYPE_LABEL: Record<string, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}

function StarControl({ value, onChange }: { value: number | null; onChange: (s: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className="p-0.5 transition"
          aria-label={`${i} 星`}
        >
          <Star
            size={20}
            className={i <= display
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ResourceDetail({
  resourceId,
  currentUserId,
  onBack,
  onDeleted,
}: {
  resourceId: string
  currentUserId?: string
  onBack: () => void
  onDeleted?: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [resource, setResource] = useState<SharedResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([
      getResource(resourceId),
      getMyRating(resourceId).catch(() => null),
      isSaved(resourceId).catch(() => false),
    ]).then(([r, rating, savedState]) => {
      setResource(r)
      setMyRating(rating)
      setSaved(savedState)
      // Fetch file signed URL for preview
      if (r?.file_path) {
        getFileSignedUrl(r.file_path).then(setFileUrl).catch(() => {})
      }
    }).catch((e) => setError(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }, [resourceId])

  const handleDownload = async () => {
    if (!resource) return
    try {
      setDownloading(true)
      await downloadResource(resource)
      setResource((r) => r ? { ...r, download_count: r.download_count + 1 } : r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下載失敗')
    } finally {
      setDownloading(false)
    }
  }

  const handleRate = async (stars: number) => {
    if (!resource) return
    try {
      await rateResource(resource.id, stars)
      setMyRating(stars)
      toast.success(`已評 ${stars} 星`)
      // Refresh resource to get updated rating
      const r = await getResource(resource.id)
      if (r) setResource(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '評分失敗')
    }
  }

  const handleToggleSave = async () => {
    if (!resource) return
    try {
      await toggleSave(resource.id, !saved)
      setSaved(!saved)
      toast.success(saved ? '已取消收藏' : '已收藏')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失敗')
    }
  }

  const handleDelete = async () => {
    if (!resource) return
    const ok = await confirm({ title: '確定刪除？', message: '刪除後不可復原。', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    try {
      await deleteResource(resource.id)
      toast.success('已刪除')
      onDeleted?.()
      onBack()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  const handleReport = async () => {
    if (!resource || !reportReason.trim()) { toast.error('請填寫舉報原因'); return }
    try {
      await reportResource(resource.id, reportReason.trim())
      toast.success('已提交舉報')
      setReporting(false)
      setReportReason('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '舉報失敗')
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent">
        <ArrowLeft size={15} /> 返回列表
      </button>
      <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
    </div>
  )

  if (error || !resource) return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent">
        <ArrowLeft size={15} /> 返回列表
      </button>
      <EmptyState icon="🔍" title="找不到資源" hint={error ?? '資源可能已被移除。'} />
    </div>
  )

  const rating = avg(resource.rating_sum, resource.rating_count)
  const kind = resource.file_mime && resource.file_name
    ? fileKind(resource.file_mime, resource.file_name)
    : null
  const isOwner = currentUserId && resource.owner_id === currentUserId

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent">
        <ArrowLeft size={15} /> 返回列表
      </button>

      <Card padded className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={
                resource.type === 'handout' ? 'blue'
                : resource.type === 'slides' ? 'accent'
                : resource.type === 'paper' ? 'amber'
                : resource.type === 'link' ? 'green'
                : resource.type === 'video' ? 'rose'
                : 'slate'
              }>{TYPE_LABEL[resource.type] ?? resource.type}</Badge>
              {resource.tags.map((tag) => (
                <Badge key={tag} tone="slate">{tag}</Badge>
              ))}
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{resource.title}</h1>
            <p className="text-sm text-slate-500">
              {resource.authorName ?? '老師'} · {new Date(resource.created_at).toLocaleDateString('zh-HK')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button variant="danger" size="sm" icon={Trash2} onClick={handleDelete}>刪除</Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={Bookmark}
              onClick={handleToggleSave}
              className={saved ? 'text-accent' : ''}
            >
              {saved ? '已收藏' : '收藏'}
            </Button>
            <Button size="sm" icon={downloading ? undefined : Download} loading={downloading} onClick={handleDownload}>
              下載
            </Button>
          </div>
        </div>

        {/* Description */}
        {resource.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{resource.description}</p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1"><Download size={14} /> {resource.download_count} 下載</span>
          <span className="inline-flex items-center gap-1">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            {rating.toFixed(1)} ({resource.rating_count} 評分)
          </span>
        </div>
      </Card>

      {/* Preview */}
      {(fileUrl || resource.external_url) && (
        <Card padded>
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">預覽</h2>
          {kind === 'image' && fileUrl && (
            <img src={fileUrl} alt={resource.title} className="max-h-96 w-full rounded-lg object-contain" />
          )}
          {kind === 'pdf' && fileUrl && (
            <iframe
              src={fileUrl}
              className="h-[500px] w-full rounded-lg border border-slate-200 dark:border-slate-700"
              title={resource.title}
            />
          )}
          {kind === 'office' && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
              {resource.thumbUrl && (
                <img src={resource.thumbUrl} alt="" className="max-h-48 rounded-lg object-contain shadow" />
              )}
              {!resource.thumbUrl && <FileText size={40} className="opacity-40" />}
              <p className="text-sm">Office 文件請下載後查看</p>
            </div>
          )}
          {resource.external_url && (
            <a
              href={resource.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <ExternalLink size={14} /> {resource.external_url}
            </a>
          )}
        </Card>
      )}

      {/* Rating */}
      <Card padded>
        <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">評分</h2>
        <div className="flex items-center gap-3">
          <StarControl value={myRating} onChange={handleRate} />
          <span className="text-xs text-slate-400">{myRating ? `你評了 ${myRating} 星` : '點擊評分'}</span>
        </div>
      </Card>

      {/* Report */}
      <div className="flex justify-end">
        {!reporting ? (
          <button
            onClick={() => setReporting(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500"
          >
            <Flag size={12} /> 舉報
          </button>
        ) : (
          <Card padded className="w-full space-y-3">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">舉報資源</h2>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              placeholder="舉報原因…"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setReporting(false); setReportReason('') }}>取消</Button>
              <Button variant="danger" size="sm" icon={Flag} onClick={handleReport}>提交舉報</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
