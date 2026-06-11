// ============================================================
//  DocAligner lcnet100 驗證腳本（node，一次性）
//  ------------------------------------------------------------
//  合成「淺灰枱面 + 白紙微斜」（light-on-light，real-world 失敗場景），
//  跑 ONNX 模型 → 由 4 張角點熱圖抽角 → 同 ground truth 比對。
//  用法：node scripts/verify-docaligner.mjs
// ============================================================

import * as ort from 'onnxruntime-node'

const MODEL = new URL('../public/vendor/docaligner/lcnet100_h_e_bifpn_256_fp32.onnx', import.meta.url).pathname
const N = 256

// ---------- 合成圖：淺灰底 + 白紙四邊形（微旋轉 + 輕微透視） ----------
// ground truth 角（256 空間，順序 tl,tr,br,bl）
const GT = [
  { x: 50, y: 38 },
  { x: 210, y: 52 },
  { x: 198, y: 224 },
  { x: 38, y: 208 },
]

function pointInQuad(p, q) {
  // 對凸四邊形：逐邊 cross product 同號
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross !== 0) {
      const s = Math.sign(cross)
      if (sign === 0) sign = s
      else if (s !== sign) return false
    }
  }
  return true
}

function buildInput() {
  // CHW float32 /255。背景 0.82（淺灰），紙 0.95（白），加少少 noise 似真相。
  const data = new Float32Array(3 * N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inside = pointInQuad({ x, y }, GT)
      const base = inside ? 0.95 : 0.82
      const noise = (Math.random() - 0.5) * 0.02
      const v = Math.min(1, Math.max(0, base + noise))
      const i = y * N + x
      data[i] = v               // R
      data[N * N + i] = v       // G
      data[2 * N * N + i] = v   // B
    }
  }
  return data
}

// ---------- 熱圖 → 角點（門檻 0.3，加權重心，跟官方 postprocess 簡化） ----------
function cornerFromHeatmap(hm, hw, hh) {
  let peak = 0
  for (let i = 0; i < hm.length; i++) if (hm[i] > peak) peak = hm[i]
  if (peak < 0.3) return null
  let sx = 0, sy = 0, sw = 0
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const v = hm[y * hw + x]
      if (v >= 0.3) { sx += x * v; sy += y * v; sw += v }
    }
  }
  if (sw <= 0) return null
  return { x: (sx / sw + 0.5) / hw, y: (sy / sw + 0.5) / hh } // 0..1
}

const session = await ort.InferenceSession.create(MODEL)
console.log('inputs :', session.inputNames)
console.log('outputs:', session.outputNames)

const input = new ort.Tensor('float32', buildInput(), [1, 3, N, N])
const out = await session.run({ [session.inputNames[0]]: input })
const heat = out[session.outputNames[0]]
console.log('heatmap dims:', heat.dims)

const [, C, hh, hw] = heat.dims
const data = heat.data
const corners = []
for (let c = 0; c < C; c++) {
  const hm = data.subarray(c * hh * hw, (c + 1) * hh * hw)
  corners.push(cornerFromHeatmap(hm, hw, hh))
}
console.log('detected (norm):', corners.map((p) => p && { x: +(p.x).toFixed(3), y: +(p.y).toFixed(3) }))

// 同 GT 比（GT 換 0..1）
let maxErr = 0
let fail = false
corners.forEach((p, i) => {
  if (!p) { fail = true; return }
  const gt = GT[i]
  const err = Math.hypot(p.x * N - gt.x, p.y * N - gt.y)
  maxErr = Math.max(maxErr, err)
  console.log(`corner ${i}: det=(${(p.x * N).toFixed(1)},${(p.y * N).toFixed(1)}) gt=(${gt.x},${gt.y}) err=${err.toFixed(1)}px`)
})

if (fail) {
  console.log('❌ 有角偵唔到')
  process.exit(1)
}
console.log(maxErr <= 12 ? `✅ PASS（max err ${maxErr.toFixed(1)}px ≤ 12px @256）` : `❌ FAIL（max err ${maxErr.toFixed(1)}px）`)
process.exit(maxErr <= 12 ? 0 : 1)
