# 教學資源庫 × Google Drive 整合 — 實作計劃

> **For agentic workers:** 用 superpowers:executing-plans 逐 task 做。Steps 用 `- [ ]`。
> 純 client-side I/O 為主：pure helper 用 TDD（vitest），OAuth／網絡部分用 preview 人手驗證。

**Goal:** 喺教學資源庫加一個「Google Drive」模式，前端直連 Drive 一個資料夾，live 列檔／搜尋／開檔（唯讀、跨裝置）。

**Architecture:** 零後端。Google Identity Services（GIS）token client 攞 `drive.readonly` access token（memory cache）；Drive REST v3 `fetch` 列檔／搜尋；`window.open(webViewLink)` 開檔。Client ID 由 `VITE_GOOGLE_CLIENT_ID` env 提供，未設定就降級顯示設定指引。

**Tech Stack:** React 18 + TS + Vite env；GIS（`https://accounts.google.com/gsi/client`，動態 script）；Drive REST v3（fetch，免 SDK）；vitest。

來源 spec：`docs/superpowers/specs/2026-06-02-google-drive-resources-design.md`

## 檔案結構
- 建 `src/lib/googleDrive.ts` — GIS 載入 + token client + Drive REST（list/search）+ 純 helper。
- 建 `src/lib/googleDrive.test.ts` — 純 helper 單元測試。
- 建 `src/features/work/resourceLibrary/drive/store.ts` — `driveConfigCol`（'drive_config'）。
- 建 `src/features/work/resourceLibrary/drive/DriveView.tsx` — Drive 模式 UI。
- 改 `src/features/work/ResourceLibrary.tsx` — 加「我的庫 / Google Drive」檢視切換。
- 改 `.env.example` — 加 `VITE_GOOGLE_CLIENT_ID`。
- 改 `docs/SETUP.md` — 加 Google Cloud 設定步驟。

---

### Task 1：純 helper + 單元測試（mime 分類 / size 格式 / 查詢字串）

**Files:** Create `src/lib/googleDrive.ts`（先得 pure helper 部分）、`src/lib/googleDrive.test.ts`

- [ ] **Step 1：寫 failing test**
```ts
// src/lib/googleDrive.test.ts
import { describe, it, expect } from 'vitest'
import { mimeKind, formatBytes, folderListQuery, nameSearchQuery, isFolder } from './googleDrive'

describe('googleDrive helpers', () => {
  it('mimeKind 分類', () => {
    expect(mimeKind('application/vnd.google-apps.folder')).toBe('folder')
    expect(mimeKind('application/pdf')).toBe('pdf')
    expect(mimeKind('application/vnd.google-apps.document')).toBe('doc')
    expect(mimeKind('application/vnd.google-apps.presentation')).toBe('slides')
    expect(mimeKind('video/mp4')).toBe('video')
    expect(mimeKind('image/png')).toBe('image')
    expect(mimeKind('text/plain')).toBe('file')
  })
  it('isFolder', () => {
    expect(isFolder('application/vnd.google-apps.folder')).toBe(true)
    expect(isFolder('application/pdf')).toBe(false)
  })
  it('formatBytes', () => {
    expect(formatBytes(undefined)).toBe('')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })
  it('folderListQuery 用 parent + 去 trash', () => {
    expect(folderListQuery('ABC')).toBe("'ABC' in parents and trashed = false")
  })
  it('nameSearchQuery escape 單引號', () => {
    expect(nameSearchQuery("a'b")).toBe("name contains 'a\\'b' and trashed = false")
  })
})
```

- [ ] **Step 2：run，確認 fail**
Run: `npx vitest run src/lib/googleDrive.test.ts`
Expected: FAIL（googleDrive 仲未有呢啲 export）

- [ ] **Step 3：寫 helper**
```ts
// src/lib/googleDrive.ts  （檔案開頭：純 helper，無副作用）
export type DriveKind = 'folder' | 'pdf' | 'doc' | 'slides' | 'sheet' | 'video' | 'image' | 'file'

export function isFolder(mime: string): boolean {
  return mime === 'application/vnd.google-apps.folder'
}

export function mimeKind(mime: string): DriveKind {
  if (isFolder(mime)) return 'folder'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('google-apps.document')) return 'doc'
  if (mime.includes('google-apps.presentation')) return 'slides'
  if (mime.includes('google-apps.spreadsheet')) return 'sheet'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  return 'file'
}

export function formatBytes(n?: number): string {
  if (n === undefined || n === null) return ''
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

function escapeQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
export function folderListQuery(folderId: string): string {
  return `'${escapeQ(folderId)}' in parents and trashed = false`
}
export function nameSearchQuery(term: string): string {
  return `name contains '${escapeQ(term)}' and trashed = false`
}
```

- [ ] **Step 4：run，確認 pass**
Run: `npx vitest run src/lib/googleDrive.test.ts` → PASS

- [ ] **Step 5：commit**
```bash
git add src/lib/googleDrive.ts src/lib/googleDrive.test.ts
git commit -m "feat(drive): Drive helper（mime 分類 / size / 查詢字串）+ 單元測試"
```

---

### Task 2：GIS 載入 + token client + Drive REST（list / search）

**Files:** Modify `src/lib/googleDrive.ts`（接住 Task 1 加）

- [ ] **Step 1：加 config + 型別 + GIS 載入 + token**
```ts
// 續 src/lib/googleDrive.ts
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
export const isDriveConfigured = Boolean(CLIENT_ID)
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: number
  webViewLink?: string
  iconLink?: string
}

// GIS script 動態載入（一次）
let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if ((window as unknown as { google?: { accounts?: unknown } }).google?.accounts) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('GIS script 載入失敗'))
    document.head.appendChild(s)
  })
  return gisPromise
}

// token（memory only；唔存落任何 storage）
let accessToken: string | null = null
let tokenExpiry = 0
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
let tokenClient: TokenClient | null = null

/** 取得有效 token；無 / 過期就彈 Google 授權。需 isDriveConfigured。 */
export async function getAccessToken(interactive = true): Promise<string> {
  if (!CLIENT_ID) throw new Error('未設定 VITE_GOOGLE_CLIENT_ID')
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken
  await loadGis()
  return new Promise<string>((resolve, reject) => {
    const oauth2 = (window as unknown as {
      google: { accounts: { oauth2: { initTokenClient: (c: Record<string, unknown>) => TokenClient } } }
    }).google.accounts.oauth2
    tokenClient = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) return reject(new Error(resp.error || '授權失敗'))
        accessToken = resp.access_token
        tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000
        resolve(accessToken)
      },
    })
    tokenClient!.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

export function signOutDrive(): void {
  accessToken = null
  tokenExpiry = 0
}
export function isDriveConnected(): boolean {
  return Boolean(accessToken && Date.now() < tokenExpiry)
}
```

- [ ] **Step 2：加 REST 呼叫（list / search）**
```ts
// 續 src/lib/googleDrive.ts
const FIELDS = 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink)'

async function driveFetch(q: string): Promise<DriveFile[]> {
  const token = await getAccessToken()
  const url =
    'https://www.googleapis.com/drive/v3/files?' +
    new URLSearchParams({
      q,
      fields: FIELDS,
      orderBy: 'folder,name',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    }).toString()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) { signOutDrive(); throw new Error('授權過期，請重新連接') }
  if (!res.ok) throw new Error(`Drive API 錯誤 ${res.status}`)
  const data = (await res.json()) as { files?: DriveFile[] }
  return (data.files ?? []).map((f) => ({ ...f, size: f.size ? Number(f.size) : undefined }))
}

/** 列一個資料夾內容（folderId；'root' = 我的雲端硬碟根）。 */
export function listFolder(folderId: string): Promise<DriveFile[]> {
  return driveFetch(folderListQuery(folderId))
}
/** 用檔名搜尋（drive.readonly 範圍內）。 */
export function searchByName(term: string): Promise<DriveFile[]> {
  return driveFetch(nameSearchQuery(term))
}
/** 攞一個 folder 嘅名（breadcrumb / 設定根用）。 */
export async function getFileName(fileId: string): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return ''
  return ((await res.json()) as { name?: string }).name ?? ''
}
```

- [ ] **Step 3：tsc 乾淨**
Run: `npx tsc --noEmit 2>&1 | grep googleDrive`（應無 error）

- [ ] **Step 4：commit**
```bash
git add src/lib/googleDrive.ts
git commit -m "feat(drive): GIS token client + Drive REST v3 列檔/搜尋（client-side、唯讀）"
```

---

### Task 3：drive_config collection（root 資料夾，跟帳戶 sync）

**Files:** Create `src/features/work/resourceLibrary/drive/store.ts`

- [ ] **Step 1：寫 store**
```ts
// src/features/work/resourceLibrary/drive/store.ts
import { createCollection, type Entity } from '../../../../lib/store'

export interface DriveConfig extends Entity {
  rootFolderId?: string
  rootFolderName?: string
}
// 只存「邊個資料夾做起點」；token 唔存（每裝置自己授權）。
export const driveConfigCol = createCollection<DriveConfig>('drive_config', [])
```

- [ ] **Step 2：tsc 乾淨**
Run: `npx tsc --noEmit 2>&1 | grep drive/store`（應無 error）

- [ ] **Step 3：commit**
```bash
git add src/features/work/resourceLibrary/drive/store.ts
git commit -m "feat(drive): drive_config collection（root 資料夾設定，跟帳戶同步）"
```

---

### Task 4：DriveView UI（連接 / 導航 / 搜尋 / 開檔 / 降級）

**Files:** Create `src/features/work/resourceLibrary/drive/DriveView.tsx`

- [ ] **Step 1：寫組件**（完整檔，跟資源庫 bespoke 視覺；用共用 kit）
```tsx
// src/features/work/resourceLibrary/drive/DriveView.tsx
import { useEffect, useState, useCallback } from 'react'
import { CloudOff, FolderOpen, Search, RefreshCw, LogIn, ChevronRight, ExternalLink, Home, Folder, FileText, Film, Image as ImageIcon, FileType, Loader2 } from 'lucide-react'
import { Button, Input, EmptyState, cx } from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import { useCollection } from '../../../../lib/store'
import { driveConfigCol } from './store'
import {
  isDriveConfigured, getAccessToken, isDriveConnected, listFolder, searchByName,
  mimeKind, formatBytes, isFolder, type DriveFile, type DriveKind,
} from '../../../../lib/googleDrive'

const KIND_ICON: Record<DriveKind, typeof Folder> = {
  folder: Folder, pdf: FileType, doc: FileText, slides: FileText, sheet: FileText,
  video: Film, image: ImageIcon, file: FileText,
}

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
    setLoading(true); setErr(null)
    try { setFiles(await listFolder(folderId)) }
    catch (e) { setErr((e as Error).message); setConnected(isDriveConnected()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (connected) void load(cur.id) }, [connected, cur.id, load])

  async function connect() {
    try { await getAccessToken(true); setConnected(true) }
    catch (e) { toast.error((e as Error).message) }
  }

  async function runSearch() {
    const t = term.trim()
    if (!t) { void load(cur.id); return }
    setLoading(true); setErr(null)
    try { setFiles(await searchByName(t)) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  function openItem(f: DriveFile) {
    if (isFolder(f.mimeType)) { setTerm(''); setPath((p) => [...p, { id: f.id, name: f.name }]) }
    else if (f.webViewLink) window.open(f.webViewLink, '_blank', 'noopener,noreferrer')
  }
  function gotoCrumb(i: number) { setTerm(''); setPath((p) => p.slice(0, i + 1)) }

  // 降級：未設定 client ID
  if (!isDriveConfigured) {
    return (
      <EmptyState icon={CloudOff} title="未連接 Google Drive"
        hint="要喺環境變數設定 VITE_GOOGLE_CLIENT_ID（見 docs/SETUP.md「Google Drive」一節）先用得。" />
    )
  }
  // 未授權
  if (!connected) {
    return (
      <EmptyState icon={FolderOpen} title="連接你嘅 Google Drive"
        hint="授權後可以喺度直接瀏覽、搜尋、開你 Drive 嘅教材（唯讀，唔會改你啲檔）。"
        action={<Button icon={LogIn} onClick={connect}>連接 Google Drive</Button>} />
    )
  }

  return (
    <div className="space-y-3">
      {/* 麵包屑 + 搜尋 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          {path.map((c, i) => (
            <span key={c.id + i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={13} className="text-slate-300" />}
              <button onClick={() => gotoCrumb(i)}
                className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800',
                  i === path.length - 1 && 'font-medium text-slate-700 dark:text-slate-200')}>
                {i === 0 && <Home size={13} />}{c.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input icon={Search} value={term} onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runSearch() }}
            placeholder="搜尋檔名…" className="h-9 w-44" aria-label="搜尋 Drive 檔名" />
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => (term.trim() ? runSearch() : load(cur.id))}>重新整理</Button>
        </div>
      </div>

      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> 載入緊…
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={Search} title={term.trim() ? '搵唔到相符檔案' : '呢個資料夾係空'} hint={term.trim() ? '試下改吓關鍵字。' : undefined} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {files.map((f) => {
            const kind = mimeKind(f.mimeType)
            const I = KIND_ICON[kind]
            return (
              <button key={f.id} onClick={() => openItem(f)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  kind === 'folder' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                  <I size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{f.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {isFolder(f.mimeType) ? '資料夾' : [kind.toUpperCase(), formatBytes(f.size)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {!isFolder(f.mimeType) && <ExternalLink size={14} className="shrink-0 text-slate-300" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2：tsc 乾淨**
Run: `npx tsc --noEmit 2>&1 | grep DriveView`（清走未用 import；應無 error）

- [ ] **Step 3：commit**
```bash
git add src/features/work/resourceLibrary/drive/DriveView.tsx
git commit -m "feat(drive): DriveView — 連接/麵包屑導航/檔名搜尋/開檔 + 未設定降級"
```

---

### Task 5：接入 ResourceLibrary（檢視切換）+ env + SETUP + 驗證

**Files:** Modify `src/features/work/ResourceLibrary.tsx`、`.env.example`、`docs/SETUP.md`

- [ ] **Step 1：ResourceLibrary 加「我的庫 / Google Drive」切換**
喺主檢視 state 加一個 `source: 'lib' | 'drive'`（預設 'lib'），喺現有「內建/我的」tab 附近加一個 SegmentedControl 或兩個 pill；`source==='drive'` 時 render `<DriveView/>`（lazy import 亦可），否則行返現有資源庫內容。**唔好郁現有 link 收藏邏輯**。
```tsx
// ResourceLibrary.tsx 頂部
import DriveView from './resourceLibrary/drive/DriveView'
// 主組件內
const [source, setSource] = useState<'lib' | 'drive'>('lib')
// 喺 toolbar：
// <SegmentedControl value={source} onChange={setSource}
//   options={[{id:'lib',label:'我的庫',icon:FolderOpen},{id:'drive',label:'Google Drive',icon:HardDrive}]} />
// 內容區：source==='drive' ? <DriveView/> : (現有資源庫 JSX)
```

- [ ] **Step 2：env example**
```bash
# .env.example 加一行
# Google Drive 整合（教學資源庫）— OAuth 用戶端 ID（可公開），未設定就自動隱藏 Drive 功能
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 3：SETUP.md 加「Google Drive」一節**
抄 spec「設定」嗰 6 步（Google Cloud：建 project → 啟用 Drive API → OAuth 同意畫面（測試中 + 加 email）→ 建 OAuth 用戶端 ID（授權來源加 Vercel 網域 + http://localhost:5173）→ 抄 client ID → 放 Vercel env `VITE_GOOGLE_CLIENT_ID`）。

- [ ] **Step 4：權威驗證**
Run: `npx tsc --noEmit`（0 error）→ `npm run build`（綠）→ `npx vitest run src/lib/googleDrive.test.ts`（pass）。
Preview：教學資源庫 → 切「Google Drive」→ 未設 env 應見降級提示（唔 crash）。

- [ ] **Step 5：commit**
```bash
git add -A src/features/work/ResourceLibrary.tsx .env.example docs/SETUP.md
git commit -m "feat(drive): 教學資源庫加 Google Drive 檢視切換 + env + SETUP 指引"
```

---

## 驗證（全部 task 後）
- `tsc` 0 error、`vitest` pass、`vite build` 綠。
- 未設 `VITE_GOOGLE_CLIENT_ID`：Drive 分頁顯示降級提示，其餘 app 正常（degrade gracefully ✓）。
- 設好 client ID + 你做完 Google Cloud：preview「連接 Google Drive」→ 授權 → 列你 Drive 檔、入資料夾、搜尋、開檔（Safari 都測）。
- 現有 link 收藏功能不受影響。

## 範圍外（spec 已列）
唯讀（唔 upload/改/刪）；OAuth 測試模式（≤100 用戶）；token ~1hr 重新授權；離線唔連到 Drive。
