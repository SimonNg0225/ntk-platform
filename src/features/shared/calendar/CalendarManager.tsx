import { useState } from 'react'
import { Eye, EyeOff, Layers, Plus, Trash2, X } from 'lucide-react'
import { calendarsCol } from '../../../data/collections'
import type { CalendarCategory } from '../../../data/types'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { Button, IconButton, Input, Modal, cx } from '../../../ui'
import { CAL_COLORS, CAL_COLOR_KEYS, colorOf, type CalColor } from './util'

function Swatches({
  value,
  onPick,
}: {
  value: string
  onPick: (c: CalColor) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAL_COLOR_KEYS.map((ck) => (
        <button
          key={ck}
          type="button"
          aria-label={CAL_COLORS[ck].label}
          aria-pressed={value === ck}
          onClick={() => onPick(ck)}
          className={cx(
            'h-5 w-5 rounded-full transition',
            CAL_COLORS[ck].dot,
            value === ck
              ? 'ring-2 ring-slate-400 ring-offset-1 dark:ring-slate-300 dark:ring-offset-slate-800'
              : 'hover:scale-110',
          )}
        />
      ))}
    </div>
  )
}

export default function CalendarManager({
  calendars,
  onClose,
}: {
  calendars: CalendarCategory[]
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<CalColor>('violet')

  function addCal() {
    const name = newName.trim()
    if (!name) return
    calendarsCol.add({
      name,
      color: newColor,
      visible: true,
      createdAt: new Date().toISOString(),
    })
    setNewName('')
    toast.success('已新增行事曆')
  }

  async function delCal(c: CalendarCategory) {
    const ok = await confirm({
      title: '刪除行事曆？',
      message: `「${c.name}」會被刪除。原有活動會變成未分類（仍保留）。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    calendarsCol.remove(c.id)
    toast.success('已刪除行事曆')
  }

  return (
    // 唔傳 title → 自管「週記」頁眉，令彈窗用返主畫面 serif + kicker + 雙線語言
    <Modal open onClose={onClose} size="md">
      {/* ───────── 週記頁眉：kicker + serif 標題 + 雙線封面分隔 ───────── */}
      <header className="-mx-5 -mt-5 mb-5 px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <Layers size={12} className="shrink-0" />
              色冊 · Calendars
            </p>
            <h2 className="mt-1 font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
              管理行事曆
            </h2>
          </div>
          <IconButton label="關閉" onClick={onClose} className="-mr-1 shrink-0">
            <X size={18} />
          </IconButton>
        </div>
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      <div className="space-y-2.5">
        {calendars.map((c) => {
          const tone = colorOf(c.color)
          return (
            <div
              key={c.id}
              className={cx(
                'relative overflow-hidden rounded-2xl border p-3 pl-4 transition-colors',
                c.visible
                  ? 'border-slate-200/80 bg-slate-50/50 dark:border-slate-700/60 dark:bg-slate-800/40'
                  : 'border-slate-200/70 bg-white dark:border-slate-700/50 dark:bg-slate-800/20',
              )}
            >
              {/* 柔和色脊 — 呼應主畫面事件 chip；隱藏時褪做灰 */}
              <span
                aria-hidden
                className={cx(
                  'absolute inset-y-2.5 left-0 w-1 rounded-full transition-colors',
                  c.visible ? tone.dot : 'bg-slate-300 dark:bg-slate-600',
                )}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={c.name}
                  aria-label="行事曆名稱"
                  onChange={(e) => calendarsCol.update(c.id, { name: e.target.value })}
                  className={cx('flex-1', !c.visible && 'text-slate-400 line-through dark:text-slate-500')}
                />
                <IconButton
                  label={c.visible ? '隱藏' : '顯示'}
                  active={c.visible}
                  onClick={() => calendarsCol.update(c.id, { visible: !c.visible })}
                >
                  {c.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </IconButton>
                <IconButton label="刪除行事曆" tone="danger" onClick={() => delCal(c)}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <div className="mt-2.5 pl-0.5">
                <Swatches
                  value={c.color}
                  onPick={(ck) => calendarsCol.update(c.id, { color: ck })}
                />
              </div>
            </div>
          )
        })}

        {/* 新增 — 虛線「空白頁」邀請，預覽色脊跟住所選色 */}
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 p-3 pl-4 dark:border-slate-600">
          <span
            aria-hidden
            className={cx('absolute inset-y-2.5 left-0 w-1 rounded-full', CAL_COLORS[newColor].dot)}
          />
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              aria-label="新行事曆名稱"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCal()}
              placeholder="新行事曆名稱"
              className="flex-1"
            />
            <Button size="sm" icon={Plus} onClick={addCal} disabled={!newName.trim()}>
              新增
            </Button>
          </div>
          <div className="mt-2.5 pl-0.5">
            <Swatches value={newColor} onPick={setNewColor} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
