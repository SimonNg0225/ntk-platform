import type { ExportDoc } from './types'

// ============================================================
//  匯出 PDF —— 行「列印 → 儲存為 PDF」（瀏覽器處理中文完美，零字型負擔）
//  開新視窗寫入乾淨 A4 排版 HTML，自動觸發列印對話框。
// ============================================================

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function blocksHtml(doc: ExportDoc): string {
  const parts: string[] = []
  for (const b of doc.blocks) {
    if (b.kind === 'heading') {
      parts.push(b.level === 2 ? `<h3>${esc(b.text)}</h3>` : `<h2>${esc(b.text)}</h2>`)
    } else if (b.kind === 'paragraph') {
      parts.push(`<p>${esc(b.text)}</p>`)
    } else if (b.kind === 'bullets') {
      parts.push(`<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`)
    } else if (b.kind === 'numbered') {
      parts.push(`<ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`)
    }
  }
  return parts.join('\n')
}

export function printDoc(doc: ExportDoc): void {
  const html = `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8">
<title>${esc(doc.title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "PingFang HK","Microsoft JhengHei","Noto Sans HK",-apple-system,system-ui,sans-serif; color:#1e293b; line-height:1.6; font-size:13px; }
  h1 { font-size:22px; margin:0 0 2px; }
  .sub { color:#64748b; margin:0 0 16px; font-size:12px; }
  h2 { font-size:15px; margin:18px 0 6px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; }
  h3 { font-size:13px; margin:12px 0 4px; }
  p { margin:4px 0; }
  ul,ol { margin:4px 0 8px; padding-left:22px; }
  li { margin:2px 0; }
  @media print { .hint { display:none; } }
  .hint { background:#eff6ff; color:#2563eb; padding:8px 12px; border-radius:8px; font-size:12px; margin-bottom:14px; }
</style></head><body>
<div class="hint">喺列印對話框揀「另存為 PDF / Save as PDF」就可以下載成 PDF。</div>
<h1>${esc(doc.title)}</h1>
${doc.subtitle ? `<p class="sub">${esc(doc.subtitle)}</p>` : ''}
${blocksHtml(doc)}
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('瀏覽器擋咗彈出視窗，請允許後再試。')
  }
  w.document.write(html)
  w.document.close()
}
