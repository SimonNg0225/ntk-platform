// 懶載自存 OpenCV.js（注入 <script>）+ jscanify。只喺入到編輯器先 import 呢個檔。
import type { Corners, Filter, Pt } from './types'
import { downscaleDims, isPlausibleQuad, orderCorners } from './geometry'
// 用 'jscanify/client'（瀏覽器版）；bare 'jscanify' 係 Node 版（require canvas/jsdom）行唔到。
import type jscanifyType from 'jscanify/client'

const OPENCV_SRC = '/vendor/opencv/opencv.js'
// 文件掃描要夠細節（~200 DPI A4 ≈ 2339px），長邊封 2400 平衡清晰度同記憶體。
const MAX_EDGE = 2400
// JPEG 輸出質素（高啲減少文字邊糊化）。
const JPEG_Q = 0.95

let cvReady: Promise<void> | null = null
let scannerP: Promise<jscanifyType> | null = null

function loadOpenCv(): Promise<void> {
  if (cvReady) return cvReady
  cvReady = new Promise<void>((resolve, reject) => {
    const w = window as any
    if (w.cv && w.cv.Mat) return resolve()
    const s = document.createElement('script')
    s.src = OPENCV_SRC
    s.async = true
    s.onload = () => {
      const tryReady = () => {
        if (w.cv && w.cv.Mat) resolve()
        else if (w.cv) w.cv.onRuntimeInitialized = () => resolve()
        else setTimeout(tryReady, 50)
      }
      tryReady()
    }
    s.onerror = () => reject(new Error('OpenCV 載入失敗'))
    document.body.appendChild(s)
  })
  return cvReady
}

async function getScanner(): Promise<jscanifyType> {
  if (scannerP) return scannerP
  scannerP = (async () => {
    await loadOpenCv()
    const { default: JScanify } = await import('jscanify/client')
    return new JScanify()
  })()
  return scannerP
}

function imgFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片解碼失敗'))
    img.src = dataUrl
  })
}

/**
 * 先降採樣（慳記憶體/加快），回新 dataUrl + 像素尺寸。
 * 已經係 JPEG 又唔使縮 → 唔重新編碼（避免多一次 lossy pass，保留原畫質）。
 */
export async function downscaleDataUrl(dataUrl: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = await imgFromDataUrl(dataUrl)
  const ow = img.naturalWidth, oh = img.naturalHeight
  const { w, h } = downscaleDims(ow, oh, MAX_EDGE)
  const noResize = w === ow && h === oh
  if (noResize && dataUrl.startsWith('data:image/jpeg')) {
    return { dataUrl, w, h }
  }
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return { dataUrl: c.toDataURL('image/jpeg', JPEG_Q), w, h }
}

// 偵測用嘅工作解析度（細啲快好多，搵大張紙嘅四邊形夠用）。
const DETECT_MAX = 900

/**
 * 自動偵文件四角，回**正規化**座標（0..1，相對圖片）；偵唔到 / 結果離譜回 null。
 *
 * 用標準 OpenCV 文件偵測管線（比 jscanify getCornerPoints 準好多，
 * 傾斜 / 唔填滿畫面都食得到）：
 *   灰階 → 高斯模糊 → Canny 邊緣 → 膨脹補口 → findContours
 *   → 對每個 contour approxPolyDP，揀「四點 + 凸 + 面積最大」嗰個做文件。
 * 回正規化座標（而非像素）→ caller 唔使再除尺寸（避免 naturalWidth race）。
 */
export async function detectCorners(dataUrl: string): Promise<Corners | null> {
  try {
    await getScanner() // 確保 OpenCV 載入（window.cv 就緒）
    const cv = (window as any).cv
    const img = await imgFromDataUrl(dataUrl)
    const W = img.naturalWidth, H = img.naturalHeight
    if (W <= 0 || H <= 0) return null

    // 縮細做偵測（快 + 穩）。
    const scale = Math.min(1, DETECT_MAX / Math.max(W, H))
    const dw = Math.max(1, Math.round(W * scale)), dh = Math.max(1, Math.round(H * scale))
    const canvas = document.createElement('canvas')
    canvas.width = dw; canvas.height = dh
    canvas.getContext('2d')!.drawImage(img, 0, 0, dw, dh)

    const src = cv.imread(canvas)
    const gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat()
    const contours = new cv.MatVector(), hier = new cv.Mat()
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
      cv.Canny(blur, edges, 75, 200)
      const ker = cv.Mat.ones(3, 3, cv.CV_8U)
      cv.dilate(edges, edges, ker)
      ker.delete()
      cv.findContours(edges, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      // 搵「四點 + 凸 + 面積最大（且 ≥ 偵測圖 15%）」嘅 contour 做文件外框。
      let best: Pt[] | null = null
      let bestArea = 0
      const detArea = dw * dh
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const approx = new cv.Mat()
        const peri = cv.arcLength(cnt, true)
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const area = cv.contourArea(approx)
          if (area > bestArea && area > detArea * 0.15) {
            bestArea = area
            const d = approx.data32S as Int32Array
            best = [
              { x: d[0], y: d[1] }, { x: d[2], y: d[3] },
              { x: d[4], y: d[5] }, { x: d[6], y: d[7] },
            ]
          }
        }
        approx.delete()
        cnt.delete()
      }
      if (!best) return null

      // 縮放返原尺寸 → 排序四角 → 合理性驗證 → 正規化。
      const full = best.map((p) => ({ x: p.x / scale, y: p.y / scale }))
      const q = orderCorners(full)
      if (!isPlausibleQuad(q, W, H)) return null
      const norm = (p: Pt): Pt => ({ x: p.x / W, y: p.y / H })
      return { tl: norm(q.tl), tr: norm(q.tr), br: norm(q.br), bl: norm(q.bl) }
    } finally {
      src.delete(); gray.delete(); blur.delete(); edges.delete()
      contours.delete(); hier.delete()
    }
  } catch {
    return null
  }
}

/**
 * 用四角拉正透視 + 套濾鏡，回 processed dataUrl。
 * corners=null → 唔做透視，淨係套濾鏡。
 */
export async function warpEnhance(dataUrl: string, corners: Corners | null, filter: Filter): Promise<string> {
  const scanner = await getScanner()
  const cv = (window as any).cv
  const img = await imgFromDataUrl(dataUrl)
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = img.naturalWidth; srcCanvas.height = img.naturalHeight
  srcCanvas.getContext('2d')!.drawImage(img, 0, 0)

  let outCanvas: HTMLCanvasElement
  if (corners) {
    const w = Math.round(Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y))
    const h = Math.round(Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y))
    const cps = {
      topLeftCorner: corners.tl, topRightCorner: corners.tr,
      bottomLeftCorner: corners.bl, bottomRightCorner: corners.br,
    }
    // cps 已傳 → jscanify 唔會回 null；保險起見偵唔到就退回全幅。
    outCanvas = scanner.extractPaper(srcCanvas, w, h, cps) ?? srcCanvas
  } else {
    outCanvas = srcCanvas
  }

  // 濾鏡：color 直接回（唔掂 OpenCV）；gray / bw 先用 OpenCV。
  if (filter === 'color') return outCanvas.toDataURL('image/jpeg', JPEG_Q)

  const src = cv.imread(outCanvas)
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  let dst = gray
  if (filter === 'bw') {
    dst = new cv.Mat()
    cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 10)
  }
  const show = document.createElement('canvas')
  cv.imshow(show, dst)
  src.delete(); gray.delete(); if (dst !== gray) dst.delete()
  return show.toDataURL('image/jpeg', JPEG_Q)
}
