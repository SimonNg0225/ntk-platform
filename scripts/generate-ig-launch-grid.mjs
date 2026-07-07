import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = process.cwd()
const outDir = path.join(root, 'marketing/ig/launch-grid')
const icon = pathToFileURL(path.join(root, 'marketing/app-icon-source.png')).href
const visual = pathToFileURL(path.join(root, 'marketing/eziteach-ai-poster-visual.png')).href

const posts = [
  ['01-brand-intro', 'EziTeach AI', '香港老師的|AI 工作台', ['備課・出題・改卷・簡報・行政', '一個地方整理每日教學工作'], '#facc15', 'icon'],
  ['02-late-night-slides', '老師痛點', '夜晚十一點，|仲做緊聽日份簡報？', ['由課題到教學簡報', '一鍵生成，下載即用'], '#22d3ee', 'visual'],
  ['03-lesson-workflow', '備課', '課題 → 教案|→ 活動 → 練習', ['將零散準備工序', '變成清晰教學流程'], '#a5b4fc', 'steps'],
  ['04-dse-drill', 'DSE 操練', '出題操練|更貼香港課堂', ['短答・長題・答題技巧', '幫學生練到重點'], '#38bdf8', 'cards'],
  ['05-marking-feedback', '改卷評語', 'AI 幫你寫初稿|老師保留判斷', ['快速整理失分位', '生成清晰改善建議'], '#fb7185', 'paper'],
  ['06-scan-pdf', '文件整理', '掃描 PDF，|教材唔再散晒', ['講義・試題・行政文件', '統一放入工作台'], '#34d399', 'files'],
  ['07-admin-calendar', '行政', '時間表、待辦|家長溝通一齊管', ['少啲來回搵資料', '多啲時間留畀教學'], '#f59e0b', 'timeline'],
  ['08-hk-workflow', '香港老師專用', '廣東話介面|貼近學校工作流', ['DSE 友善・多科可用', '由老師日常出發設計'], '#60a5fa', 'hk'],
  ['09-cta', '免費開始', '試用 EziTeach AI', ['開瀏覽器即用', 'eziteach.hk'], '#facc15', 'icon'],
]

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const textLines = (items, x, y) => items.map((t, i) => `<text x="${x}" y="${y + i * 58}" font-size="39" font-weight="540" fill="#e0e7ff">${esc(t)}</text>`).join('')

function art(kind, accent) {
  if (kind === 'visual') {
    return `<image href="${visual}" x="530" y="40" width="550" height="900" opacity="0.7" preserveAspectRatio="xMidYMid slice"/><rect x="500" y="0" width="580" height="1080" fill="url(#rightFade)"/>`
  }
  if (kind === 'icon') {
    return `<circle cx="850" cy="300" r="205" fill="#fff" opacity="0.08"/><image href="${icon}" x="716" y="166" width="268" height="268"/>`
  }
  if (kind === 'steps') {
    return `<g transform="translate(558 180)">${['課題', '教案', '活動', '練習'].map((t, i) => `<rect x="${i % 2 ? 210 : 0}" y="${Math.floor(i / 2) * 165}" width="180" height="110" rx="25" fill="#fff" opacity="0.13" stroke="${accent}"/><text x="${i % 2 ? 300 : 90}" y="${Math.floor(i / 2) * 165 + 68}" text-anchor="middle" font-size="31" font-weight="850" fill="#fff">${t}</text>`).join('')}<path d="M180 55h70M300 110v55M210 220h-70" stroke="${accent}" stroke-width="8" stroke-linecap="round"/></g>`
  }
  if (kind === 'cards') {
    return `<g transform="translate(570 160)">${['MC', '短答', '長題'].map((t, i) => `<rect x="${i * 70}" y="${i * 95}" width="300" height="150" rx="28" fill="#fff" opacity="${0.12 + i * 0.04}" stroke="${accent}"/><text x="${i * 70 + 38}" y="${i * 95 + 76}" font-size="44" font-weight="850" fill="#fff">${t}</text><rect x="${i * 70 + 38}" y="${i * 95 + 102}" width="170" height="16" rx="8" fill="${accent}"/>`).join('')}</g>`
  }
  if (kind === 'paper') {
    return `<g transform="translate(620 145)"><rect width="320" height="420" rx="28" fill="#fff" opacity="0.15" stroke="${accent}"/><rect x="42" y="72" width="210" height="18" rx="9" fill="#fff" opacity="0.62"/><rect x="42" y="130" width="242" height="14" rx="7" fill="#fff" opacity="0.35"/><rect x="42" y="174" width="190" height="14" rx="7" fill="#fff" opacity="0.28"/><path d="M66 272l48 48 112-130" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></g>`
  }
  if (kind === 'files') {
    return `<g transform="translate(590 160)">${[0, 1, 2].map((i) => `<rect x="${i * 54}" y="${i * 58}" width="250" height="330" rx="26" fill="#fff" opacity="${0.1 + i * 0.04}" stroke="${accent}"/><rect x="${i * 54 + 38}" y="${i * 58 + 76}" width="150" height="16" rx="8" fill="${accent}"/><rect x="${i * 54 + 38}" y="${i * 58 + 126}" width="176" height="12" rx="6" fill="#fff" opacity="0.35"/>`).join('')}</g>`
  }
  if (kind === 'timeline') {
    return `<g transform="translate(600 170)"><path d="M70 20v420" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>${['Day A', '待辦', '家長'].map((t, i) => `<circle cx="70" cy="${70 + i * 140}" r="28" fill="${accent}"/><rect x="124" y="${32 + i * 140}" width="250" height="76" rx="22" fill="#fff" opacity="0.14"/><text x="154" y="${82 + i * 140}" font-size="30" font-weight="780" fill="#fff">${t}</text>`).join('')}</g>`
  }
  return `<g transform="translate(600 180)"><rect width="340" height="300" rx="36" fill="#fff" opacity="0.12" stroke="${accent}"/><path d="M58 232c58-130 126-190 220-198" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round"/><text x="58" y="264" font-size="31" font-weight="850" fill="#fff">HK workflow</text></g>`
}

function svg([id, eyebrow, title, body, accent, kind], index) {
  const titleLines = title.split('|')
  const titleSvg = titleLines
    .map((line, i) => `<text y="${94 + i * 70}" font-size="60" font-weight="870" fill="#fff">${esc(line)}</text>`)
    .join('')
  const bodyY = titleLines.length > 1 ? 285 : 210
  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="0.45" stop-color="#111827"/><stop offset="1" stop-color="#4f46e5"/></linearGradient><linearGradient id="rightFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#020617" stop-opacity="0.72"/><stop offset="1" stop-color="#020617" stop-opacity="0.05"/></linearGradient><style>text{font-family:'PingFang HK','Noto Sans HK','Microsoft JhengHei','Hiragino Sans GB',Arial,sans-serif}</style></defs>
<rect width="1080" height="1080" fill="url(#bg)"/><circle cx="1020" cy="36" r="270" fill="#818cf8" opacity="0.12"/><circle cx="100" cy="1010" r="260" fill="${accent}" opacity="0.12"/>${art(kind, accent)}
<g transform="translate(80 78)"><rect width="250" height="58" rx="29" fill="#fff" opacity="0.12" stroke="#c7d2fe" stroke-opacity="0.32"/><circle cx="30" cy="29" r="15" fill="#4f46e5"/><path d="M23 29h14M30 22v14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><text x="58" y="38" font-size="25" font-weight="820" fill="#fff">EziTeach AI</text></g>
<g transform="translate(80 238)"><text y="0" font-size="30" font-weight="800" fill="${accent}">${esc(eyebrow)}</text>${titleSvg}<rect y="${titleLines.length > 1 ? 202 : 130}" width="300" height="8" rx="4" fill="${accent}"/>${textLines(body, 0, bodyY)}</g>
<g transform="translate(80 910)"><text font-size="28" font-weight="650" fill="#c7d2fe">@eziteach</text><text y="52" font-size="27" font-weight="520" fill="#e0e7ff">eziteach.hk</text><text x="900" y="52" text-anchor="end" font-size="24" font-weight="650" fill="#cbd5e1">${String(index + 1).padStart(2, '0')} / 09</text></g>
</svg>`
}

await fs.mkdir(outDir, { recursive: true })
for (const [index, post] of posts.entries()) {
  await fs.writeFile(path.join(outDir, `${post[0]}.svg`), svg(post, index), 'utf8')
}

const browser = await chromium.launch({ headless: true })
for (const post of posts) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(path.join(outDir, `${post[0]}.svg`)).href, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outDir, `${post[0]}.png`), clip: { x: 0, y: 0, width: 1080, height: 1080 } })
  await page.close()
}
await browser.close()

await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(posts.map((p, i) => ({
  order: i + 1,
  id: p[0],
  title: p[2].replaceAll('|', ' '),
  png: `marketing/ig/launch-grid/${p[0]}.png`,
  svg: `marketing/ig/launch-grid/${p[0]}.svg`,
})), null, 2) + '\n')
console.log(`Generated ${posts.length} IG launch grid posts in ${outDir}`)
