// ============================================================
//  ML 文件四角偵測 —— DocAligner lcnet100（heatmap 模型，Apache-2.0）
//  ------------------------------------------------------------
//  Classical CV（Canny/contour）喺 light-on-light（白紙影喺淺色枱）
//  必死；DocAligner 係專門訓練「相 → 文件四角」嘅模型，合成低對比
//  場景驗證最大誤差 0.4px@256（scripts/verify-docaligner.mjs）。
//  · 模型 + ORT wasm 全部自存 /public/vendor/（離線可用、相唔離機）。
//  · 懶載：入到先 import onnxruntime-web、先 fetch 模型。
//  · 前處理跟官方：resize 256×256 → CHW float32 /255（無 mean/std）。
//  · 後處理：4 條 channel 熱圖，門檻 0.3 加權重心 → 0..1 正規化角點。
// ============================================================

import type { Corners, Pt } from './types'
import { isPlausibleQuad, orderCorners } from './geometry'

// 主力 fastvit_sa24（官方 benchmark 最準，79MB）；fetch/init 失敗先退 lcnet100（4.5MB）。
const MODEL_URLS = [
  '/vendor/docaligner/fastvit_sa24_h_e_bifpn_256_fp32.onnx',
  '/vendor/docaligner/lcnet100_h_e_bifpn_256_fp32.onnx',
]
// ORT wasm 自存。⚠️ 要用 object 形式淨指 .wasm：
//  · string prefix 會令 ORT 連 loader .mjs 都去嗰度 import —— vite dev
//    禁止由 public/ 模組式 import（?import 會 fail）。
//  · /wasm bundle 變體已內嵌 loader，淨係要 fetch .wasm 二進制（fetch 冇限制）。
const ORT_WASM_URL = '/vendor/ort/ort-wasm-simd-threaded.wasm'
const N = 256 // 模型輸入邊長
const HEAT_THRESHOLD = 0.3 // 跟官方 postprocess

type OrtModule = typeof import('onnxruntime-web')
type OrtSession = import('onnxruntime-web').InferenceSession

let sessionP: Promise<{ ort: OrtModule; session: OrtSession }> | null = null

function getSession() {
  if (sessionP) return sessionP
  sessionP = (async () => {
    // 用 /wasm 子路徑（wasm-only build）：default bundle 會拖埋 26MB jsep wasm。
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.wasmPaths = { wasm: ORT_WASM_URL }
    let lastErr: unknown = null
    for (const url of MODEL_URLS) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`模型載入失敗 ${resp.status}`)
        const session = await ort.InferenceSession.create(await resp.arrayBuffer(), {
          executionProviders: ['wasm'],
        })
        return { ort, session }
      } catch (e) {
        lastErr = e // 試下一個（sa24 落唔到 → lcnet100）
      }
    }
    throw lastErr ?? new Error('模型載入失敗')
  })()
  // 失敗就重置，下次再試（例如暫時網絡問題）。
  sessionP.catch(() => { sessionP = null })
  return sessionP
}

/**
 * 預熱：背景載入模型 + wasm + 跑一次 dummy 推論（JIT 編譯 kernel）。
 * 喺開鏡頭時 fire-and-forget，等用戶影完即用、慳走冷啟動延遲。
 */
export async function warmUpML(): Promise<void> {
  try {
    const { ort, session } = await getSession()
    const dummy = new ort.Tensor('float32', new Float32Array(3 * N * N), [1, 3, N, N])
    await session.run({ [session.inputNames[0]]: dummy })
  } catch {
    /* 預熱失敗無所謂，真正用時再試 / 退 classical */
  }
}

function imgFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片解碼失敗'))
    img.src = dataUrl
  })
}

/** 圖片 → 1×3×256×256 CHW float32（/255，直接 resize 唔保比例，跟官方）。 */
function toTensorData(img: HTMLImageElement): Float32Array {
  const c = document.createElement('canvas')
  c.width = N; c.height = N
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, N, N)
  const { data: rgba } = ctx.getImageData(0, 0, N, N)
  const out = new Float32Array(3 * N * N)
  for (let i = 0; i < N * N; i++) {
    out[i] = rgba[i * 4] / 255
    out[N * N + i] = rgba[i * 4 + 1] / 255
    out[2 * N * N + i] = rgba[i * 4 + 2] / 255
  }
  return out
}

/**
 * 單條 channel 熱圖 → 0..1 角點；冇訊號回 null。
 * 跟官方 postprocess：門檻 0.3 → **最大連通 blob** → 重心。
 * ⚠️ 唔可以用全圖重心：真實相片有時有第二團假響應（例如表格角落），
 * 全圖重心會俾佢拉到入面（角縮入紙內）；最大 blob 先穩。
 */
function cornerFromHeatmap(hm: Float32Array, hw: number, hh: number): Pt | null {
  const n = hw * hh
  // -1 = 未標記；0+ = blob id
  const label = new Int32Array(n).fill(-1)
  const stack: number[] = []
  let bestSum = 0
  let best: { sx: number; sy: number; sw: number } | null = null
  let blobId = 0
  for (let start = 0; start < n; start++) {
    if (hm[start] < HEAT_THRESHOLD || label[start] !== -1) continue
    // BFS/DFS flood fill（8 連通）
    let sx = 0, sy = 0, sw = 0
    stack.push(start)
    label[start] = blobId
    while (stack.length) {
      const i = stack.pop()!
      const x = i % hw, y = (i / hw) | 0
      const v = hm[i]
      sx += x * v; sy += y * v; sw += v
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= hw || ny >= hh) continue
          const j = ny * hw + nx
          if (label[j] === -1 && hm[j] >= HEAT_THRESHOLD) {
            label[j] = blobId
            stack.push(j)
          }
        }
      }
    }
    if (sw > bestSum) { bestSum = sw; best = { sx, sy, sw } }
    blobId++
  }
  if (!best || best.sw <= 0) return null
  return { x: (best.sx / best.sw + 0.5) / hw, y: (best.sy / best.sw + 0.5) / hh }
}

/**
 * ML 偵測文件四角，回**正規化**座標（0..1）；偵唔到 / 載入失敗 throw 或回 null
 * （caller 負責 fallback classical）。
 */
export async function detectCornersML(dataUrl: string): Promise<Corners | null> {
  const { ort, session } = await getSession()
  const img = await imgFromDataUrl(dataUrl)
  const W = img.naturalWidth, H = img.naturalHeight
  if (W <= 0 || H <= 0) return null

  const input = new ort.Tensor('float32', toTensorData(img), [1, 3, N, N])
  const out = await session.run({ [session.inputNames[0]]: input })
  const heat = out[session.outputNames[0]]
  const [, C, hh, hw] = heat.dims as number[]
  if (C < 4) return null
  const data = heat.data as Float32Array

  const pts: Pt[] = []
  for (let c = 0; c < 4; c++) {
    const p = cornerFromHeatmap(data.subarray(c * hh * hw, (c + 1) * hh * hw), hw, hh)
    if (!p) return null
    pts.push(p)
  }

  // 正規化 → 像素空間排序 + 驗證 → 回正規化。
  const px = pts.map((p) => ({ x: p.x * W, y: p.y * H }))
  const q = orderCorners(px)
  if (!isPlausibleQuad(q, W, H)) return null
  return {
    tl: { x: q.tl.x / W, y: q.tl.y / H },
    tr: { x: q.tr.x / W, y: q.tr.y / H },
    br: { x: q.br.x / W, y: q.br.y / H },
    bl: { x: q.bl.x / W, y: q.bl.y / H },
  }
}
