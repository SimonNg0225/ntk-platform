// 懶載自存 OpenCV.js（注入 <script>）+ jscanify。只喺入到編輯器先 import 呢個檔。
import type { Corners, Filter, Pt } from './types'
import { downscaleDims, isPlausibleQuad } from './geometry'
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

/**
 * 自動偵文件四角，回**正規化**座標（0..1，相對圖片）；偵唔到 / 結果離譜回 null。
 * 回正規化（而非像素）→ caller 唔使再除圖片尺寸（避免 naturalWidth 未 load 嘅 race）。
 */
export async function detectCorners(dataUrl: string): Promise<Corners | null> {
  const cv = (window as any).cv
  let mat: any = null
  let contour: any = null
  try {
    const scanner = await getScanner()
    const img = await imgFromDataUrl(dataUrl)
    const W = img.naturalWidth, H = img.naturalHeight
    if (W <= 0 || H <= 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    mat = cv.imread(canvas)
    contour = scanner.findPaperContour(mat)
    if (!contour) return null
    const pts = scanner.getCornerPoints(contour)
    const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = pts
    if (!tl || !tr || !br || !bl) return null
    const px: Corners = {
      tl: { x: tl.x, y: tl.y }, tr: { x: tr.x, y: tr.y },
      br: { x: br.x, y: br.y }, bl: { x: bl.x, y: bl.y },
    }
    // jscanify 有時會回退化／太細／出界嘅四邊形 → 過濾，退回 null 由 caller 用全頁。
    if (!isPlausibleQuad(px, W, H)) return null
    const norm = (p: Pt): Pt => ({ x: p.x / W, y: p.y / H })
    return { tl: norm(px.tl), tr: norm(px.tr), br: norm(px.br), bl: norm(px.bl) }
  } catch {
    return null
  } finally {
    // contour 由 contours.get(i) 攞返嚟（係 view，唔使 delete）；mat 一定要釋放。
    if (mat) { try { mat.delete() } catch { /* noop */ } }
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
