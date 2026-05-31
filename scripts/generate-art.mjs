#!/usr/bin/env node
// ============================================================
//  generate-art.mjs —— 用你嘅 GEMINI_API_KEY 生成 UI 插圖
//  ------------------------------------------------------------
//  用法：
//    export GEMINI_API_KEY=AIza...你的key
//    node scripts/generate-art.mjs            # 生成全部（已存在會略過）
//    node scripts/generate-art.mjs --force    # 重生全部
//    node scripts/generate-art.mjs --only=empty-notes
//    ART_MODEL=gemini-2.0-flash-preview-image-generation node scripts/generate-art.mjs
//
//  圖片直接叫 Google Generative Language API（用你 key，唔經
//  Supabase function、冇 session token 問題），存落 public/art/。
//  動作庫每個動作嘅示意圖會由 fitness/library/data.ts 自動補上。
//  ⚠️ 唔同帳戶/地區支援嘅 image model 名可能唔同；失敗就試改 ART_MODEL。
// ============================================================
import { writeFile, mkdir, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLOTS, STYLE } from './art-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'art')
const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.ART_MODEL || 'imagen-3.0-generate-002'
const args = process.argv.slice(2)
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1]
const force = args.includes('--force')

if (!KEY) {
  console.error('✗ 請先設定 key：export GEMINI_API_KEY=你的key')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exists = async (p) => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// 由動作庫 data.ts 抽 exercise（id + name）→ 每個一張示意圖 slot
async function exerciseSlots() {
  try {
    const txt = await readFile(join(ROOT, 'src/features/learning/fitness/library/data.ts'), 'utf8')
    const out = []
    const re = /id:\s*'([^']+)'[\s\S]{0,80}?name:\s*'([^']+)'/g
    let m
    while ((m = re.exec(txt))) {
      const id = m[1]
      const clean = m[2].replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim()
      out.push({
        name: `exercise-${id}`,
        prompt: `a single clear instructional illustration of a person correctly performing "${clean}", full body, side or three-quarter view, neutral gym setting`,
      })
    }
    return out
  } catch {
    return []
  }
}

// Imagen 系列：:predict
async function genImagen(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 180)}`)
  const data = await res.json()
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded
  if (!b64) throw new Error('回應冇圖片 bytes（檢查 model 名 / 帳戶權限）')
  return Buffer.from(b64, 'base64')
}

// Gemini image 系列：:generateContent + responseModalities
async function genGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 180)}`)
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  const img = parts.find((p) => p.inlineData?.data)
  if (!img) throw new Error('回應冇圖片（model 可能唔支援圖片輸出）')
  return Buffer.from(img.inlineData.data, 'base64')
}

const gen = MODEL.startsWith('gemini') ? genGemini : genImagen

async function main() {
  await mkdir(OUT, { recursive: true })
  const all = [...SLOTS, ...(await exerciseSlots())].filter((s) => !only || s.name === only)
  console.log(`插圖清單：${all.length} 張 · model=${MODEL} · 輸出→ public/art/`)
  let done = 0
  let skip = 0
  let fail = 0
  for (const s of all) {
    const file = join(OUT, `${s.name}.png`)
    if (!force && (await exists(file))) {
      skip++
      continue
    }
    try {
      const buf = await gen(`${s.prompt}. ${STYLE}`)
      await writeFile(file, buf)
      done++
      console.log(`✓ ${s.name}.png`)
      await sleep(1500) // 溫和 rate-limit
    } catch (e) {
      fail++
      console.error(`✗ ${s.name}: ${e.message}`)
    }
  }
  console.log(`\n完成：生成 ${done} · 略過 ${skip}（已存在）· 失敗 ${fail}`)
  if (fail > 0) {
    console.log('提示：image model 名因帳戶/地區而異。可試：')
    console.log('  ART_MODEL=imagen-3.0-fast-generate-001 node scripts/generate-art.mjs')
    console.log('  ART_MODEL=gemini-2.0-flash-preview-image-generation node scripts/generate-art.mjs')
  }
}

main()
