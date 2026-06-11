// 懶載自存 OpenCV.js（注入 <script>）+ jscanify。只喺入到編輯器先 import 呢個檔。
import type { Corners, Filter, Pt } from './types'
import { downscaleDims, isPlausibleQuad, orderCorners } from './geometry'
// 用 'jscanify/client'（瀏覽器版）；bare 'jscanify' 係 Node 版（require canvas/jsdom）行唔到。
import type jscanifyType from 'jscanify/client'

const OPENCV_SRC = '/vendor/opencv/opencv.js'
// 原圖長邊上限：保留多啲細節畀 warp 高解析度取樣（12MP 相只輕微縮）。
const MAX_EDGE = 3200
// JPEG 輸出質素（高啲減少文字邊糊化）。
const JPEG_Q = 0.95
// warp 輸出目標長邊（唔夠就喺 warp 階段由原圖插值放大；只放大唔縮細）。
// 黑白要喺高解析度先 threshold（~285 DPI A4），先冇「低 DPI」鋸齒感。
const TARGET_LONG: Record<Filter, number> = { bw: 3300, gray: 2600, color: 2400 }

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

/** 由一個 contour 抽四角：approxPolyDP →（唔係四點）convex hull →（再唔係）minAreaRect。 */
function quadFromContour(cv: any, cnt: any): Pt[] | null {
  const read = (m: any): Pt[] => {
    const d = m.data32S as Int32Array
    return [
      { x: d[0], y: d[1] }, { x: d[2], y: d[3] },
      { x: d[4], y: d[5] }, { x: d[6], y: d[7] },
    ]
  }
  // 1) 直接 approxPolyDP（理想：清晰四邊形）
  const approx = new cv.Mat()
  cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true)
  let pts: Pt[] | null = approx.rows === 4 ? read(approx) : null
  approx.delete()
  if (pts) return pts
  // 2) 凸包再 approx（邊有缺口時補返）
  const hull = new cv.Mat()
  cv.convexHull(cnt, hull, false, true)
  const approx2 = new cv.Mat()
  cv.approxPolyDP(hull, approx2, 0.02 * cv.arcLength(hull, true), true)
  if (approx2.rows === 4) pts = read(approx2)
  approx2.delete(); hull.delete()
  if (pts) return pts
  // 3) minAreaRect 最小旋轉外框（終極 fallback：至少框到最大那塊）
  try {
    const rr = cv.minAreaRect(cnt)
    const v = cv.RotatedRect.points(rr)
    return [
      { x: v[0].x, y: v[0].y }, { x: v[1].x, y: v[1].y },
      { x: v[2].x, y: v[2].y }, { x: v[3].x, y: v[3].y },
    ]
  } catch {
    return null
  }
}

/**
 * 自動偵文件四角，回**正規化**座標（0..1，相對圖片）；偵唔到 / 結果離譜回 null。
 *
 * 引擎次序：
 *   1. ML（DocAligner heatmap，mlDetect.ts）—— light-on-light 都食得到，主力。
 *   2. Classical OpenCV（下面 detectCornersClassical）—— ML 載入失敗時保底。
 */
export async function detectCorners(dataUrl: string): Promise<Corners | null> {
  try {
    const { detectCornersML } = await import('./mlDetect')
    const ml = await detectCornersML(dataUrl)
    if (ml) return ml
  } catch {
    // ML 引擎唔得（模型/wasm 載入失敗、舊瀏覽器）→ 跌落 classical。
  }
  return detectCornersClassical(dataUrl)
}

/**
 * Classical 文件偵測（應付低對比能力有限，做 ML 嘅保底）：
 *   灰階 → 模糊 → Otsu 自適應 Canny → 形態學 close 駁口 → findContours
 *   → 揀面積最大（≥15%）嘅 contour → quadFromContour（approx/hull/minAreaRect）。
 */
async function detectCornersClassical(dataUrl: string): Promise<Corners | null> {
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
    const gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat(), otsuTmp = new cv.Mat()
    const contours = new cv.MatVector(), hier = new cv.Mat()
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
      // Otsu 計門檻 → Canny 跟對比自動調（捉得到淡邊）。
      const otsu = cv.threshold(blur, otsuTmp, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
      cv.Canny(blur, edges, Math.max(10, otsu * 0.5), otsu)
      // 形態學 close 駁返斷咗嘅邊（5×5）。
      const ker = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, ker)
      ker.delete()
      cv.findContours(edges, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      // 揀面積最大（且 ≥ 偵測圖 15%）嘅 contour 做文件外框。
      let bestIdx = -1
      let bestArea = dw * dh * 0.15
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const a = cv.contourArea(cnt)
        cnt.delete()
        if (a > bestArea) { bestArea = a; bestIdx = i }
      }
      if (bestIdx < 0) return null

      const cnt = contours.get(bestIdx)
      const best = quadFromContour(cv, cnt)
      cnt.delete()
      if (!best) return null

      // 縮放返原尺寸 → 排序四角 → 合理性驗證 → 正規化。
      const full = best.map((p) => ({ x: p.x / scale, y: p.y / scale }))
      const q = orderCorners(full)
      if (!isPlausibleQuad(q, W, H)) return null
      const norm = (p: Pt): Pt => ({ x: p.x / W, y: p.y / H })
      return { tl: norm(q.tl), tr: norm(q.tr), br: norm(q.br), bl: norm(q.bl) }
    } finally {
      src.delete(); gray.delete(); blur.delete(); edges.delete(); otsuTmp.delete()
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

  const target = TARGET_LONG[filter]
  let outCanvas: HTMLCanvasElement
  if (corners) {
    // 基準尺寸 = 四角距離（原圖像素）；唔夠目標就喺 warp 階段直接由原圖
    // 插值放大（warpPerspective 取樣，質素好過事後 upscale）。只放大唔縮細。
    const baseW = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y)
    const baseH = Math.hypot(corners.bl.x - corners.tl.x, corners.bl.y - corners.tl.y)
    const k = Math.max(1, target / Math.max(baseW, baseH))
    const w = Math.round(baseW * k)
    const h = Math.round(baseH * k)
    const cps = {
      topLeftCorner: corners.tl, topRightCorner: corners.tr,
      bottomLeftCorner: corners.bl, bottomRightCorner: corners.br,
    }
    // cps 已傳 → jscanify 唔會回 null；保險起見偵唔到就退回全幅。
    outCanvas = scanner.extractPaper(srcCanvas, w, h, cps) ?? srcCanvas
  } else if (Math.max(srcCanvas.width, srcCanvas.height) < target) {
    // 全幅（無裁切）：都放大到目標，等 bw threshold 喺高解析度做。
    const k = target / Math.max(srcCanvas.width, srcCanvas.height)
    const up = document.createElement('canvas')
    up.width = Math.round(srcCanvas.width * k)
    up.height = Math.round(srcCanvas.height * k)
    const uctx = up.getContext('2d')!
    uctx.imageSmoothingQuality = 'high'
    uctx.drawImage(srcCanvas, 0, 0, up.width, up.height)
    outCanvas = up
  } else {
    outCanvas = srcCanvas
  }

  // 濾鏡：color 直接回（唔掂 OpenCV）；gray / bw 先用 OpenCV。
  if (filter === 'color') return outCanvas.toDataURL('image/jpeg', JPEG_Q)

  const src = cv.imread(outCanvas)
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  let dst = gray
  let png = false
  if (filter === 'bw') {
    dst = new cv.Mat()
    // adaptiveThreshold 鄰域隨圖大細放大（高解析度用大 block，減少筆畫內雜訊）；必須奇數。
    const minEdge = Math.min(outCanvas.width, outCanvas.height)
    let bs = Math.round(minEdge / 45)
    if (bs % 2 === 0) bs += 1
    bs = Math.max(15, Math.min(61, bs)) // 高解析度（~300DPI）行大啲嘅鄰域
    cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, bs, 12)
    png = true // 二值圖用 PNG（無損）；JPEG 會喺黑白硬邊整出鋸齒/糊化，似低 DPI。
  }
  const show = document.createElement('canvas')
  cv.imshow(show, dst)
  src.delete(); gray.delete(); if (dst !== gray) dst.delete()
  return png ? show.toDataURL('image/png') : show.toDataURL('image/jpeg', JPEG_Q)
}
