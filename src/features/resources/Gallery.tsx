// ============================================================
//  資源分享廊 — 主列表
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { Search, Upload, SortAsc, Clock } from 'lucide-react'
import { Button, Input, Pills, EmptyState, Skeleton, cx } from '../../ui'
import { listResources } from './api'
import ResourceCard from './ResourceCard'
import UploadModal from './UploadModal'
import type { SharedResource, ResourceType, ResourceSort } from './types'

type FilterType = ResourceType | ''

const TYPE_FILTERS: { id: FilterType; label: string }[] = [
  { id: '', label: '全部' },
  { id: 'handout', label: '講義' },
  { id: 'slides', label: '簡報' },
  { id: 'paper', label: '試題' },
  { id: 'link', label: '連結' },
  { id: 'video', label: '影片' },
  { id: 'note', label: '筆記' },
]

function ResourceSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-slate-800">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export default function Gallery({
  onOpenResource,
}: {
  onOpenResource: (id: string) => void
  currentUserId?: string
}) {
  const [resources, setResources] = useState<SharedResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<FilterType>('')
  const [sort, setSort] = useState<ResourceSort>('new')
  const [q, setQ] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const load = useCallback(async (reset = true) => {
    setLoading(true); setError(null)
    try {
      const pg = reset ? 0 : page
      const { resources: rows, hasMore: more } = await listResources({
        type: typeFilter,
        sort,
        q,
        page: pg,
      })
      setResources((prev) => reset ? rows : [...prev, ...rows])
      setHasMore(more)
      if (reset) setPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, sort, q, page]) // eslint-disable-line

  // Reload when filters/sort/search change
  useEffect(() => { load(true) }, [typeFilter, sort, q]) // eslint-disable-line

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQ(searchInput)
  }

  const loadMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    setLoading(true)
    try {
      const { resources: rows, hasMore: more } = await listResources({
        type: typeFilter, sort, q, page: nextPage,
      })
      setResources((prev) => [...prev, ...rows])
      setHasMore(more)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-xs">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜尋資源…"
            icon={Search}
          />
        </form>
        <button
          type="button"
          onClick={() => setSort((s) => s === 'new' ? 'popular' : 'new')}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
            'border-black/[0.08] bg-white text-slate-600 hover:bg-black/[0.03] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300',
          )}
          title={sort === 'new' ? '切換：最多下載' : '切換：最新'}
        >
          {sort === 'new' ? <Clock size={15} /> : <SortAsc size={15} />}
          {sort === 'new' ? '最新' : '最多下載'}
        </button>
        <Button icon={Upload} onClick={() => setUploadOpen(true)}>上載資源</Button>
      </div>

      {/* Type filter pills */}
      <Pills<FilterType>
        options={TYPE_FILTERS}
        active={typeFilter}
        onChange={setTypeFilter}
        size="sm"
      />

      {/* Grid */}
      {error ? (
        <EmptyState icon="⚠️" title="載入失敗" hint={error} action={<Button variant="secondary" onClick={() => load(true)}>重試</Button>} />
      ) : loading && resources.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ResourceSkeleton key={i} />)}
        </div>
      ) : resources.length === 0 ? (
        <EmptyState
          icon="📚"
          title="未有資源"
          hint={q ? `找不到「${q}」相關資源。` : '做第一個分享教材的老師！'}
          action={<Button icon={Upload} onClick={() => setUploadOpen(true)}>上載資源</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} onClick={() => onOpenResource(r.id)} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={loadMore} loading={loading}>載入更多</Button>
            </div>
          )}
        </>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(r) => {
          setUploadOpen(false)
          onOpenResource(r.id)
          load(true)
        }}
      />
    </div>
  )
}
