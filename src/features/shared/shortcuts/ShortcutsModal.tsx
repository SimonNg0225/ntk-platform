import { Fragment, useMemo, useState } from 'react'
import { Keyboard, Search } from 'lucide-react'
import { Modal, Kbd, Input } from '../../../ui'
import {
  SHORTCUT_SECTIONS,
  filterShortcuts,
  countShortcuts,
} from './util'

// ============================================================
//  鍵盤快捷鍵速查 Modal — 全域按 ?（Shift+/）彈出
//  分區列出成個 app 嘅鍵盤快捷，附搜尋過濾。
//  純展示：資料同篩選邏輯喺 ./util（已有單元測試）。
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
}

export default function ShortcutsModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')

  // 關閉時清空搜尋字，下次開返係乾淨狀態
  const sections = useMemo(
    () => filterShortcuts(SHORTCUT_SECTIONS, query),
    [query],
  )
  const total = countShortcuts(SHORTCUT_SECTIONS)
  const shown = countShortcuts(sections)

  return (
    <Modal
      open={open}
      onClose={() => {
        setQuery('')
        onClose()
      }}
      size="lg"
      title="鍵盤快捷鍵"
    >
      <div className="space-y-4">
        <Input
          icon={Search}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋快捷（例如「翻面」、「搜尋」、⌘K）…"
        />

        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
            <Keyboard size={24} className="text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              搵唔到「{query}」相關嘅快捷
            </p>
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {sections.map((sec) => (
              <section key={sec.title} className="space-y-2">
                <h4 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {sec.title}
                  {sec.scope && (
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400/80">
                      {sec.scope}
                    </span>
                  )}
                </h4>
                <ul className="space-y-1">
                  {sec.items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-slate-50/70 dark:odd:bg-slate-800/40"
                    >
                      <span className="text-slate-600 dark:text-slate-300">
                        {it.desc}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {it.keys.map((k, ki) => (
                          <Fragment key={ki}>
                            {ki > 0 && (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">
                                +
                              </span>
                            )}
                            <Kbd>{k}</Kbd>
                          </Fragment>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
          {query.trim() ? (
            <>顯示 {shown} / {total} 個快捷</>
          ) : (
            <>
              共 {total} 個快捷 · 按 <Kbd>?</Kbd> 隨時開呢個速查
            </>
          )}
        </p>
      </div>
    </Modal>
  )
}
