import type { ImageRef } from '../types'

const MAX_EDGE = 1280
const QUALITY = 0.82

// File（相片）→ 縮圖 data URL → ImageRef(kind 'upload')。失敗 reject。
export function fileToImageRef(file: File): Promise<ImageRef> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('唔係圖片檔'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas 唔支援')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
        resolve({ kind: 'upload', src: dataUrl, alt: file.name })
      } catch (e) {
        reject(e instanceof Error ? e : new Error('圖片處理失敗'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('讀唔到圖片'))
    }
    img.src = url
  })
}
