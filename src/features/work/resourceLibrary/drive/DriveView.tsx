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
  BookmarkPlus,
  BookmarkCheck,
  FolderInput,
  Check,
} from 'lucide-react'
import { Button, Input, EmptyState, IconButton, Tooltip, cx } from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import { useCollection } from '../../../../lib/store'
import { resourcesCol } from '../../../../data/collections'
import type { ResourceType } from '../../../../data/types'
import { driveConfigCol } from './store'
import {
  isDriveConfigured,
  getAccessToken,
  isDriveConnected,
  listFolder,
  searchByName,
  parseDriveFolderId,
  getFileMeta,
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

// Drive 類型 → 我的庫資源類型（綁定時用）
const KIND_TO_RES: Record<DriveKind, ResourceType> = {
  folder: 'link',
  pdf: 'paper',
  doc: 'handout',
  slides: 'slides',
  sheet: 'handout',
  video: 'video',
  image: 'link',
  file: 'link',
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
  // 自訂起點資料夾（畀「電腦 / Computers」備份等 My Drive 根以外嘅資料夾用）
  const [showRoot, setShowRoot] = useState(false)
  const [folderInput, setFolderInput] = useState('')
  const [settingRoot, setSettingRoot] = useState(false)

  const cur = path[path.length - 1]

  // 已綁定到我的庫嘅 url（用嚟標示「已加入」+ 防重複）
  const resources = useCollection(resourcesCol)
  const addedUrls = new Set(resources.map((r) => r.url).filter((u): u is string => !!u))

  function addToLib(f: DriveFile) {
    if (!f.webViewLink) {
      toast.error('呢個檔冇開啟連結，加唔到')
      return
    }
    if (addedUrls.has(f.webViewLink)) return
    resourcesCol.add({
      title: f.name,
      type: KIND_TO_RES[mimeKind(f.mimeType)],
      url: f.webViewLink,
      createdAt: new Date().toISOString(),
    })
    toast.success(`已加入我的庫：${f.name}`)
  }

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

  // 把貼上嘅 Drive 資料夾連結 / ID 設做起點（支援 My Drive 以外，如 Computers 備份）
  async function applyRoot() {
    const id = parseDriveFolderId(folderInput)
    if (!id) {
      toast.error('貼唔到資料夾 ID —— 請貼 Drive 資料夾連結（含 /folders/…）或資料夾 ID')
      return
    }
    setSettingRoot(true)
    try {
      const meta = await getFileMeta(id)
      if (!isFolder(meta.mimeType)) {
        toast.error('呢個連結唔係資料夾')
        return
      }
      if (cfg) driveConfigCol.update(cfg.id, { rootFolderId: meta.id, rootFolderName: meta.name })
      else driveConfigCol.add({ rootFolderId: meta.id, rootFolderName: meta.name })
      setPath([{ id: meta.id, name: meta.name }])
      setTerm('')
      setFolderInput('')
      setShowRoot(false)
      toast.success(`起點已設為：${meta.name}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSettingRoot(false)
    }
  }

  function resetRoot() {
    if (cfg) driveConfigCol.update(cfg.id, { rootFolderId: undefined, rootFolderName: undefined })
    setPath([{ id: 'root', name: '我的雲端硬碟' }])
    setTerm('')
    setShowRoot(false)
    toast.success('已回到我的雲端硬碟')
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
          <Tooltip label="設定起點資料夾（連 電腦 / Computers 備份）">
            <IconButton
              label="設定起點資料夾"
              size="sm"
              active={showRoot}
              onClick={() => setShowRoot((v) => !v)}
            >
              <FolderInput size={15} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {showRoot && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void applyRoot()
              }}
              placeholder="貼上 Drive 資料夾連結（含 /folders/…）或資料夾 ID…"
              aria-label="Drive 資料夾連結"
              className="h-9 w-full"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              想睇「電腦 / 其他電腦」嘅備份？喺 Google Drive 網頁開嗰個資料夾 → 複製網址 → 貼上面。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" icon={Check} onClick={() => void applyRoot()} disabled={settingRoot}>
              {settingRoot ? '設定中…' : '設為起點'}
            </Button>
            {cfg?.rootFolderId && (
              <Button size="sm" variant="secondary" icon={Home} onClick={resetRoot}>
                回我的雲端硬碟
              </Button>
            )}
          </div>
        </div>
      )}

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
            const added = !!f.webViewLink && addedUrls.has(f.webViewLink)
            return (
              <div
                key={f.id}
                className="flex w-full items-center gap-1 border-b border-slate-100 px-1.5 transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <button
                  onClick={() => openItem(f)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-1.5 text-left"
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
                </button>
                {folder ? (
                  <ChevronRight size={15} className="mr-1.5 shrink-0 text-slate-300 dark:text-slate-600" />
                ) : (
                  <div className="flex shrink-0 items-center">
                    <Tooltip label={added ? '已喺我的庫' : '加入我的庫'}>
                      <IconButton
                        label={added ? '已喺我的庫' : '加入我的庫'}
                        size="sm"
                        active={added}
                        onClick={() => addToLib(f)}
                      >
                        {added ? (
                          <BookmarkCheck size={15} className="text-emerald-500" />
                        ) : (
                          <BookmarkPlus size={15} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip label="喺 Drive 開啟">
                      <IconButton label="開啟" size="sm" onClick={() => openItem(f)}>
                        <ExternalLink size={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
