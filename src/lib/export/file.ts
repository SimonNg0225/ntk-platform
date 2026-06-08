// 觸發瀏覽器下載一個 Blob
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 安全檔名（去走唔合法字元）。 */
export function safeFilename(name: string, ext: string): string {
  const base = (name || '檔案').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || '檔案'
  return `${base}.${ext}`
}
