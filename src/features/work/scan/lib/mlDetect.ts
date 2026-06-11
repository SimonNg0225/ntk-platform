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

const MODEL_URL = '/vendor/docaligner/lcnet100_h_e_bifpn_256_fp32.onnx'
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
    const resp = await fetch(MODEL_URL)
    if (!resp.ok) throw new Error('模型載入失敗')
    const session = await ort.InferenceSession.create(await resp.arrayBuffer(), {
      executionProviders: ['wasm'],
    })
    return { ort, session }
  })()
  // 失敗就重置，下次再試（例如暫時網絡問題）。
  sessionP.catch(() => { sessionP = null })
  return sessionP
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

/** 單條 channel 熱圖 → 0..1 角點（門檻 0.3 加權重心）；冇訊號回 null。 */
function cornerFromHeatmap(hm: Float32Array, hw: number, hh: number): Pt | null {
  let peak = 0
  for (let i = 0; i < hm.length; i++) if (hm[i] > peak) peak = hm[i]
  if (peak < HEAT_THRESHOLD) return null
  let sx = 0, sy = 0, sw = 0
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const v = hm[y * hw + x]
      if (v >= HEAT_THRESHOLD) { sx += x * v; sy += y * v; sw += v }
    }
  }
  if (sw <= 0) return null
  return { x: (sx / sw + 0.5) / hw, y: (sy / sw + 0.5) / hh }
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
