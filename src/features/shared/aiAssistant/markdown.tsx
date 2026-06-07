import { memo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { cx } from '../../../ui'
import './i18n'

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
          className="rounded-md bg-accent-soft/70 px-1.5 py-0.5 font-mono text-[0.82em] text-accent-strong ring-1 ring-inset ring-accent/15 dark:bg-accent/15 dark:text-accent dark:ring-accent/20"
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
            className="font-medium text-accent underline decoration-accent/30 decoration-1 underline-offset-2 transition-colors hover:decoration-accent"
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
            <strong key={key} className="font-semibold text-slate-800 dark:text-slate-100">
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
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-700/70 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-100/60 px-3 py-1.5 dark:border-slate-700/60 dark:bg-slate-800/50">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          {lang || 'code'}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 opacity-0 transition hover:bg-slate-200/70 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-700/70 dark:hover:text-slate-200"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? t('aiasst.codeCopied', { defaultValue: '已複製' }) : t('aiasst.codeCopy', { defaultValue: '複製' })}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[12.5px] leading-relaxed">
        <code className="font-mono text-slate-700 dark:text-slate-200">{code}</code>
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
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/70">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50/90 dark:bg-slate-800/50">
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {renderInline(h, `th${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {body.map((r, ri) => (
            <tr key={ri} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              {r.map((c, ci) => (
                <td key={ci} className="px-3.5 py-2 text-slate-600 dark:text-slate-300">
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
function MarkdownImpl({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  // 連續列表項暫存
  let listBuf: { ordered: boolean; items: string[] } | null = null
  const flushList = () => {
    if (!listBuf) return
    const { ordered, items } = listBuf
    const cls = 'my-2 space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300 marker:text-accent/70 dark:marker:text-accent/80'
    blocks.push(
      ordered ? (
        <ol key={key++} className={cx('list-decimal marker:font-medium marker:text-slate-400 dark:marker:text-slate-500', cls)}>
          {items.map((it, k) => (
            <li key={k} className="pl-1">{renderInline(it, `ol${key}-${k}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key++} className={cx('list-disc', cls)}>
          {items.map((it, k) => (
            <li key={k} className="pl-1">{renderInline(it, `ul${key}-${k}`)}</li>
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
      const sizes = ['text-[15px]', 'text-sm', 'text-[13.5px]', 'text-[13.5px]']
      blocks.push(
        <p
          key={key++}
          className={cx(
            'mb-1 mt-3.5 font-semibold tracking-tight text-slate-800 first:mt-0 dark:text-slate-100',
            sizes[level - 1],
            level <= 2 &&
              'flex items-center gap-2 before:h-3.5 before:w-1 before:rounded-full before:bg-accent/70',
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
          className="my-2 rounded-r-lg border-l-[3px] border-accent/50 bg-accent-soft/40 py-1.5 pl-3 pr-2 text-[13.5px] leading-relaxed text-slate-600 dark:bg-accent/10 dark:text-slate-300"
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
        <hr key={key++} className="my-4 border-slate-200/70 dark:border-slate-700/60" />,
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
      <p key={key++} className="text-[13.5px] leading-[1.7] text-slate-600 dark:text-slate-300">
        {renderInline(line, `p${key}`)}
      </p>,
    )
    i++
  }
  flushList()

  return <div className={cx('space-y-1', className)}>{blocks}</div>
}

// memo：text 係字串，shallow compare 完美 —— 打字時 content 無變嘅訊息唔會重新解析
// markdown（之前每打一字都重解析所有訊息，造成「跳/唔連貫」）。
export const Markdown = memo(MarkdownImpl)
