// ============================================================
//  Google Drive 整合（教學資源庫用）
//  ------------------------------------------------------------
//  · 純前端：GIS（Google Identity Services）token client 攞 drive.readonly
//    access token（只留 memory），再用 Drive REST v3 fetch 列檔／搜尋。
//  · 零後端、冇 client secret；client ID 由 VITE_GOOGLE_CLIENT_ID 提供。
//  · 未設定 client ID → isDriveConfigured=false，功能靜靜降級。
//  · 唯讀：唔會改用戶 Drive。
// ============================================================

// ───────── 純 helper（無副作用，可單元測試）─────────
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
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
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

// ───────── 設定 / 型別 ─────────
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

// ───────── GIS 載入（動態 script，一次）─────────
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
    s.onerror = () => reject(new Error('Google 登入元件載入失敗（檢查網絡）'))
    document.head.appendChild(s)
  })
  return gisPromise
}

// ───────── token（只留 memory；唔存任何 storage）─────────
let accessToken: string | null = null
let tokenExpiry = 0
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
let tokenClient: TokenClient | null = null

interface GisOAuth2 {
  initTokenClient: (c: {
    client_id: string
    scope: string
    callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void
  }) => TokenClient
}

/** 取得有效 access token；無 / 將過期就彈 Google 授權。需 isDriveConfigured。 */
export async function getAccessToken(interactive = true): Promise<string> {
  if (!CLIENT_ID) throw new Error('未設定 VITE_GOOGLE_CLIENT_ID')
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken
  await loadGis()
  return new Promise<string>((resolve, reject) => {
    const oauth2 = (
      window as unknown as { google: { accounts: { oauth2: GisOAuth2 } } }
    ).google.accounts.oauth2
    tokenClient = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
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

// ───────── Drive REST v3 ─────────
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
  if (res.status === 401) {
    signOutDrive()
    throw new Error('授權過期，請重新連接 Google Drive')
  }
  if (!res.ok) throw new Error(`Drive API 錯誤（${res.status}）`)
  const data = (await res.json()) as { files?: DriveFile[] }
  return (data.files ?? []).map((f) => ({
    ...f,
    size: f.size !== undefined ? Number(f.size) : undefined,
  }))
}

/** 列一個資料夾內容（folderId；'root' = 我的雲端硬碟根）。 */
export function listFolder(folderId: string): Promise<DriveFile[]> {
  return driveFetch(folderListQuery(folderId))
}
/** 用檔名搜尋（drive.readonly 範圍內）。 */
export function searchByName(term: string): Promise<DriveFile[]> {
  return driveFetch(nameSearchQuery(term))
}
