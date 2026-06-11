// ============================================================
//  DocAligner lcnet100 驗證腳本（node，一次性）
//  ------------------------------------------------------------
//  合成「淺灰枱面 + 白紙微斜」（light-on-light，real-world 失敗場景），
//  跑 ONNX 模型 → 由 4 張角點熱圖抽角 → 同 ground truth 比對。
//  用法：node scripts/verify-docaligner.mjs
// ============================================================

import * as ort from 'onnxruntime-node'

// 預設驗證 app 用緊嗰個（sa24）；可傳 arg 驗其他：node scripts/verify-docaligner.mjs lcnet100_...onnx
const MODEL_FILE = process.argv[2] ?? 'fastvit_sa24_h_e_bifpn_256_fp32.onnx'
const MODEL = new URL(`../public/vendor/docaligner/${MODEL_FILE}`, import.meta.url).pathname
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

function distToQuadEdge(p, q) {
  // 點到四邊形各邊嘅最短距離（粗略，畀陰影用）
  let best = Infinity
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4]
    const vx = b.x - a.x, vy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
    const dx = p.x - (a.x + t * vx), dy = p.y - (a.y + t * vy)
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

function buildInput() {
  // CHW float32 /255。盡量似真相（sa24 對「太假」嘅平色塊唔肯認）：
  //  · 背景：淺灰 + 光照漸變 + noise（似枱面）
  //  · 紙：白 + 漸變 + noise + 「文字行」（深色橫紋）
  //  · 紙邊外圍：輕微陰影
  const data = new Float32Array(3 * N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = { x, y }
      const inside = pointInQuad(p, GT)
      let v
      if (inside) {
        v = 0.93 + 0.04 * (1 - y / N) // 紙：上面光啲
        // 假文字行：每 9px 一行、行高 3px，行內隨機斷開（似字距）
        const rowPhase = y % 9
        if (rowPhase < 3 && y > 55 && y < 200 && x > 60 && x < 195) {
          if (Math.sin(x * 1.7 + y * 13.7) > -0.2) v = 0.28 + Math.random() * 0.1
        }
      } else {
        v = 0.80 + 0.06 * (x / N) // 枱面：左暗右光
        const d = distToQuadEdge(p, GT)
        if (d < 6) v -= 0.10 * (1 - d / 6) // 紙邊外輕微陰影
      }
      v = Math.min(1, Math.max(0, v + (Math.random() - 0.5) * 0.025))
      const i = y * N + x
      data[i] = v
      data[N * N + i] = v
      data[2 * N * N + i] = v * 0.98 // 輕微偏黃（白熾燈感）
    }
  }
  return data
}

// ---------- 熱圖 → 角點（門檻 0.3 → 最大連通 blob → 重心，跟官方） ----------
// ⚠️ 同 src/features/work/scan/lib/mlDetect.ts cornerFromHeatmap 保持一致。
const HEAT_THRESHOLD = 0.3
function cornerFromHeatmap(hm, hw, hh) {
  const n = hw * hh
  const label = new Int32Array(n).fill(-1)
  const stack = []
  let bestSum = 0
  let best = null
  let blobId = 0
  for (let start = 0; start < n; start++) {
    if (hm[start] < HEAT_THRESHOLD || label[start] !== -1) continue
    let sx = 0, sy = 0, sw = 0
    stack.push(start)
    label[start] = blobId
    while (stack.length) {
      const i = stack.pop()
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

// ---------- 純測試：雙 blob 陷阱（要揀大嗰團，唔係兩團平均） ----------
{
  const hw = 32, hh = 32
  const hm = new Float32Array(hw * hh)
  // 大 blob 喺 (5,5) 附近 3×3；細 blob 喺 (25,25) 單格
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) hm[(5 + dy) * hw + (5 + dx)] = 0.9
  hm[25 * hw + 25] = 0.8
  const p = cornerFromHeatmap(hm, hw, hh)
  const px = p.x * hw - 0.5, py = p.y * hh - 0.5
  if (Math.abs(px - 5) > 0.6 || Math.abs(py - 5) > 0.6) {
    console.log(`❌ blob 測試 FAIL：應揀大 blob (5,5)，實際 (${px.toFixed(1)},${py.toFixed(1)})`)
    process.exit(1)
  }
  console.log('✅ 雙 blob 陷阱：正確揀最大 blob（唔係平均）')
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
