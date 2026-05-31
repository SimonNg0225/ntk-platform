import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cx } from '../../../ui'

// ============================================================
//  輕量 Markdown 渲染器（零依賴，純自製）
//  ------------------------------------------------------------
//  支援：# 標題、**粗** *斜* `inline code`、```fenced code```（連
//  複製掣）、- / 1. 列表、> 引用、--- 分隔線、| 表格 |、[連結]()。
//  足夠靚仔地顯示 LLM 輸出，唔引入任何 markdown library。
// ============================================================

// ───────── inline：粗體 / 斜體 / code / 連結 ─────────
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // 先處理 inline code（最高優先，避免 code 入面嘅 * 被當格式）
  const codeParts = text.split(/(`[^`]+`)/g)
  codeParts.forEach((part, ci) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      nodes.push(
        <code
          key={`${keyBase}-c${ci}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-accent-strong dark:bg-slate-900/70 dark:text-accent"
        >
          {part.slice(1, -1)}
        </code>,
      )
      return
    }
    // 連結 [text](url)
    const linkSplit = part.split(/(\[[^\]]+\]\([^)]+\))/g)
    linkSplit.forEach((seg, li) => {
      const link = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        nodes.push(
          <a
            key={`${keyBase}-c${ci}-l${li}`}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {link[1]}
          </a>,
        )
        return
      }
      // 粗體 / 斜體
      const styled = seg.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g)
      styled.forEach((s, si) => {
        const key = `${keyBase}-c${ci}-l${li}-s${si}`
        if (/^(\*\*|__).+(\*\*|__)$/.test(s)) {
          nodes.push(
            <strong key={key} className="font-semibold text-slate-900 dark:text-white">
              {s.slice(2, -2)}
            </strong>,
          )
        } else if (/^(\*|_).+(\*|_)$/.test(s)) {
          nodes.push(
            <em key={key} className="italic">
              {s.slice(1, -1)}
            </em>,
          )
        } else if (s) {
          nodes.push(<span key={key}>{s}</span>)
        }
      })
    })
  })
  return nodes
}

// ───────── 程式碼區塊（連複製掣）─────────
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-3 py-1 dark:border-slate-700 dark:bg-slate-800/70">
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
          {lang || 'code'}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已複製' : '複製'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono text-slate-800 dark:text-slate-100">{code}</code>
      </pre>
    </div>
  )
}

// ───────── 表格 ─────────
function MdTable({ rows }: { rows: string[] }) {
  const parse = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
  const header = parse(rows[0])
  const body = rows.slice(2).map(parse) // rows[1] 係分隔線
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300"
              >
                {renderInline(h, `th${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {body.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                  {renderInline(c, `td${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 表格分隔行：以 | 開頭結尾，中間淨係 - : 空白 |（用逐字檢查，
// 避免喺 source 出現會被 Tailwind 誤掃嘅 regex 字元類）
function isTableDivider(line: string): boolean {
  const s = line.trim()
  if (s.length < 3 || s[0] !== '|' || s[s.length - 1] !== '|') return false
  const allowed = new Set(['-', ':', ' ', '|'])
  let hasDash = false
  for (const ch of s) {
    if (!allowed.has(ch)) return false
    if (ch === '-') hasDash = true
  }
  return hasDash
}

// ───────── 主渲染：逐行掃描成 block ─────────
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  // 連續列表項暫存
  let listBuf: { ordered: boolean; items: string[] } | null = null
  const flushList = () => {
    if (!listBuf) return
    const { ordered, items } = listBuf
    const cls = 'my-1.5 space-y-1 pl-5 text-[13.5px] leading-relaxed'
    blocks.push(
      ordered ? (
        <ol key={key++} className={cx('list-decimal', cls)}>
          {items.map((it, k) => (
            <li key={k}>{renderInline(it, `ol${key}-${k}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key++} className={cx('list-disc', cls)}>
          {items.map((it, k) => (
            <li key={k}>{renderInline(it, `ul${key}-${k}`)}</li>
          ))}
        </ul>
      ),
    )
    listBuf = null
  }

  while (i < lines.length) {
    const line = lines[i]

    // 程式碼區塊
    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      flushList()
      const lang = fence[1]
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳過收尾 ```
      blocks.push(<CodeBlock key={key++} code={buf.join('\n')} lang={lang} />)
      continue
    }

    // 表格（連續 | 開頭，且第二行係分隔線）
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushList()
      const buf: string[] = []
      while (i < lines.length && /^\|.*\|/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      blocks.push(<MdTable key={key++} rows={buf} />)
      continue
    }

    // 標題
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      const content = heading[2]
      const sizes = ['text-base', 'text-[15px]', 'text-sm', 'text-sm']
      blocks.push(
        <p
          key={key++}
          className={cx(
            'mt-2.5 font-bold text-slate-900 dark:text-white',
            sizes[level - 1],
          )}
        >
          {renderInline(content, `h${key}`)}
        </p>,
      )
      i++
      continue
    }

    // 引用
    if (line.startsWith('> ')) {
      flushList()
      blocks.push(
        <blockquote
          key={key++}
          className="my-1.5 border-l-2 border-accent/40 pl-3 text-[13.5px] italic text-slate-500 dark:text-slate-400"
        >
          {renderInline(line.slice(2), `q${key}`)}
        </blockquote>,
      )
      i++
      continue
    }

    // 分隔線
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushList()
      blocks.push(
        <hr key={key++} className="my-3 border-slate-200 dark:border-slate-700" />,
      )
      i++
      continue
    }

    // 列表
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const ordered = !!ol
      const item = (ul ? ul[1] : ol![1])
      if (!listBuf || listBuf.ordered !== ordered) {
        flushList()
        listBuf = { ordered, items: [] }
      }
      listBuf.items.push(item)
      i++
      continue
    }

    // 空行
    if (line.trim() === '') {
      flushList()
      i++
      continue
    }

    // 普通段落
    flushList()
    blocks.push(
      <p key={key++} className="text-[13.5px] leading-relaxed">
        {renderInline(line, `p${key}`)}
      </p>,
    )
    i++
  }
  flushList()

  return <div className={cx('space-y-0.5', className)}>{blocks}</div>
}
