import { useEffect, useState, useCallback } from 'react'
import {
  CloudOff,
  FolderOpen,
  Search,
  RefreshCw,
  LogIn,
  ChevronRight,
  ExternalLink,
  Home,
  Folder,
  FileText,
  Film,
  Image as ImageIcon,
  FileType,
  Loader2,
} from 'lucide-react'
import { Button, Input, EmptyState, cx } from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import { useCollection } from '../../../../lib/store'
import { driveConfigCol } from './store'
import {
  isDriveConfigured,
  getAccessToken,
  isDriveConnected,
  listFolder,
  searchByName,
  mimeKind,
  formatBytes,
  isFolder,
  type DriveFile,
  type DriveKind,
} from '../../../../lib/googleDrive'

const KIND_ICON: Record<DriveKind, typeof Folder> = {
  folder: Folder,
  pdf: FileType,
  doc: FileText,
  slides: FileText,
  sheet: FileText,
  video: Film,
  image: ImageIcon,
  file: FileText,
}

// ───────── 教學資源庫 · Google Drive 模式（唯讀、live 瀏覽/搜尋/開檔）─────────
export default function DriveView() {
  const toast = useToast()
  const cfg = useCollection(driveConfigCol)[0]
  const rootId = cfg?.rootFolderId || 'root'
  const rootName = cfg?.rootFolderName || '我的雲端硬碟'

  const [connected, setConnected] = useState(isDriveConnected())
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: rootId, name: rootName }])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [term, setTerm] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const cur = path[path.length - 1]

  const load = useCallback(async (folderId: string) => {
    setLoading(true)
    setErr(null)
    try {
      setFiles(await listFolder(folderId))
    } catch (e) {
      setErr((e as Error).message)
      setConnected(isDriveConnected())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (connected) void load(cur.id)
  }, [connected, cur.id, load])

  async function connect() {
    try {
      await getAccessToken(true)
      setConnected(true)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function runSearch() {
    const t = term.trim()
    if (!t) {
      void load(cur.id)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      setFiles(await searchByName(t))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function openItem(f: DriveFile) {
    if (isFolder(f.mimeType)) {
      setTerm('')
      setPath((p) => [...p, { id: f.id, name: f.name }])
    } else if (f.webViewLink) {
      window.open(f.webViewLink, '_blank', 'noopener,noreferrer')
    }
  }
  function gotoCrumb(i: number) {
    setTerm('')
    setPath((p) => p.slice(0, i + 1))
  }

  // 降級：未設定 client ID
  if (!isDriveConfigured) {
    return (
      <EmptyState
        icon={CloudOff}
        title="未連接 Google Drive"
        hint="要喺環境變數設定 VITE_GOOGLE_CLIENT_ID（步驟見 docs/SETUP.md「Google Drive」一節）先用得。設定好之後，呢度就可以直接瀏覽你 Drive 嘅教材。"
      />
    )
  }

  // 未授權
  if (!connected) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="連接你嘅 Google Drive"
        hint="授權後可以喺度直接瀏覽、搜尋同開你 Drive 嘅教材（唯讀，唔會改你啲檔）。"
        action={
          <Button icon={LogIn} onClick={connect}>
            連接 Google Drive
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* 麵包屑 + 搜尋 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm text-slate-500 dark:text-slate-400">
          {path.map((c, i) => (
            <span key={c.id + ':' + i} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />}
              <button
                onClick={() => gotoCrumb(i)}
                className={cx(
                  'inline-flex max-w-[12rem] items-center gap-1 truncate rounded px-1.5 py-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-800',
                  i === path.length - 1 && 'font-medium text-slate-700 dark:text-slate-200',
                )}
              >
                {i === 0 && <Home size={13} className="shrink-0" />}
                <span className="truncate">{c.name}</span>
              </button>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            icon={Search}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch()
            }}
            placeholder="搜尋檔名…"
            className="h-9 w-44"
            aria-label="搜尋 Drive 檔名"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => (term.trim() ? void runSearch() : void load(cur.id))}
          >
            重新整理
          </Button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> 載入緊…
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Search}
          title={term.trim() ? '搵唔到相符檔案' : '呢個資料夾係空'}
          hint={term.trim() ? '試下改吓關鍵字。' : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {files.map((f) => {
            const kind = mimeKind(f.mimeType)
            const I = KIND_ICON[kind]
            const folder = isFolder(f.mimeType)
            return (
              <button
                key={f.id}
                onClick={() => openItem(f)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <span
                  className={cx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    folder
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  <I size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {f.name}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {folder
                      ? '資料夾'
                      : [kind.toUpperCase(), formatBytes(f.size)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {folder ? (
                  <ChevronRight size={15} className="shrink-0 text-slate-300 dark:text-slate-600" />
                ) : (
                  <ExternalLink size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
