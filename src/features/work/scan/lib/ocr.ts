// 懶載 Tesseract（npm 套件 v7，但字庫由 CDN 攞）。
// 跟設計 Q4：OCR 走 CDN，當 bonus；冇網 → caller catch 後出純掃描 PDF。
//
// v7 備註：
// - createWorker(langs, oem, options) 仍有效；oem=1 = LSTM_ONLY。
// - worker / core 由 tesseract.js 自己解析（用已裝版本 v7.0.0 嘅 jsDelivr URL），
//   所以唔使手動寫死 @7 CDN（避免同實際 patch 版本飄移）。只set langPath。
// - ⚠️ v7 已冇頂層 data.words；要攞 word-level bbox 必須喺 recognize 傳
//   output { blocks: true }，再由 blocks[].paragraphs[].lines[].words[] 攤平。
// 註：tesseract.js 用 `export = Tesseract` + `export as namespace Tesseract`，
// 所以型別由全域 `Tesseract` namespace 攞（唔可以 named import）；
// runtime 值（createWorker / OEM）就由 dynamic import() 攞。
import type { OcrWord } from './types'

// chi_tra（繁中，~15MB）+ eng；gzip 字庫由呢個 CDN 攞（v7 預設 gzip:true → .traineddata.gz）。
const LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0'

let workerP: Promise<Tesseract.Worker> | null = null

async function getWorker(): Promise<Tesseract.Worker> {
  if (workerP) return workerP
  workerP = (async () => {
    const { createWorker, OEM } = await import('tesseract.js')
    // 只覆寫 langPath；workerPath / corePath 留俾 tesseract.js 自己解析（版本對齊）。
    const worker = await createWorker('chi_tra+eng', OEM.LSTM_ONLY, {
      langPath: LANG_PATH,
    })
    return worker
  })()
  return workerP
}

/** 對 dataUrl 圖做 OCR，回 word + bbox（像素）。失敗 throw（caller 降級出純掃描 PDF）。 */
export async function recognize(dataUrl: string): Promise<OcrWord[]> {
  const worker = await getWorker()
  // v7：傳 { blocks: true } 先有 data.blocks（內含 word-level bbox）。
  const { data } = await worker.recognize(dataUrl, {}, { blocks: true })
  const out: OcrWord[] = []
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          const text = (w.text ?? '').trim()
          if (text.length === 0) continue
          out.push({
            text,
            bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
          })
        }
      }
    }
  }
  return out
}

/** 釋放 worker（離開功能時叫）。 */
export async function disposeOcr(): Promise<void> {
  if (!workerP) return
  try {
    const w = await workerP
    await w.terminate()
  } catch {
    /* ignore */
  }
  workerP = null
}
