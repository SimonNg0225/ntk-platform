import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { calendarsCol } from '../../../data/collections'
import type { CalendarCategory } from '../../../data/types'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { Button, IconButton, Input, Modal, cx } from '../../../ui'
import { CAL_COLORS, CAL_COLOR_KEYS, type CalColor } from './util'

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
    <Modal open onClose={onClose} title="管理行事曆" size="md">
      <div className="space-y-2">
        {calendars.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
          >
            <div className="flex items-center gap-2">
              <Input
                value={c.name}
                aria-label="行事曆名稱"
                onChange={(e) => calendarsCol.update(c.id, { name: e.target.value })}
                className="flex-1"
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
            <div className="mt-2 pl-0.5">
              <Swatches
                value={c.color}
                onPick={(ck) => calendarsCol.update(c.id, { color: ck })}
              />
            </div>
          </div>
        ))}

        {/* 新增 */}
        <div className="rounded-xl border border-dashed border-slate-300 p-2.5 dark:border-slate-600">
          <div className="flex items-center gap-2">
            <span className={cx('h-4 w-4 shrink-0 rounded-full', CAL_COLORS[newColor].dot)} />
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
          <div className="mt-2 pl-0.5">
            <Swatches value={newColor} onPick={setNewColor} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
