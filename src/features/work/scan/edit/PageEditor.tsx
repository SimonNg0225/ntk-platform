import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw } from 'lucide-react'
import { Button, SegmentedControl, cx } from '../../../../ui'
import type { Corners, Filter, ScanPage } from '../lib/types'
import { detectCorners, warpEnhance } from '../lib/cv'
import CornerOverlay from './CornerOverlay'

const FULL: Corners = { tl: { x: 0.04, y: 0.04 }, tr: { x: 0.96, y: 0.04 }, br: { x: 0.96, y: 0.96 }, bl: { x: 0.04, y: 0.96 } }

export default function PageEditor({
  page, onDone, onReshoot,
}: { page: ScanPage; onDone: (p: ScanPage) => void; onReshoot: () => void }) {
  const { t } = useTranslation()
  const [imgDims, setImgDims] = useState({ w: 1, h: 1 })
  const [corners, setCorners] = useState<Corners>(FULL)
  const [filter, setFilter] = useState<Filter>(page.filter)
  const [busy, setBusy] = useState(false)

  // 載入時量圖 + 自動偵邊（偵唔到用 FULL）。
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.onload = () => { if (alive) setImgDims({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.src = page.rawDataUrl
    detectCorners(page.rawDataUrl).then((c) => {
      if (!alive || !c) return
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1
      setCorners({
        tl: { x: c.tl.x / w, y: c.tl.y / h }, tr: { x: c.tr.x / w, y: c.tr.y / h },
        br: { x: c.br.x / w, y: c.br.y / h }, bl: { x: c.bl.x / w, y: c.bl.y / h },
      })
    })
    return () => { alive = false }
  }, [page.rawDataUrl])

  async function apply() {
    setBusy(true)
    try {
      const px: Corners = {
        tl: { x: corners.tl.x * imgDims.w, y: corners.tl.y * imgDims.h },
        tr: { x: corners.tr.x * imgDims.w, y: corners.tr.y * imgDims.h },
        br: { x: corners.br.x * imgDims.w, y: corners.br.y * imgDims.h },
        bl: { x: corners.bl.x * imgDims.w, y: corners.bl.y * imgDims.h },
      }
      const processed = await warpEnhance(page.rawDataUrl, px, filter)
      onDone({ ...page, corners: px, filter, processedDataUrl: processed })
    } finally { setBusy(false) }
  }

  const filterOpts: { id: Filter; label: string }[] = [
    { id: 'color', label: t('scan.filterColor', { defaultValue: '彩色' }) },
    { id: 'gray', label: t('scan.filterGray', { defaultValue: '灰階' }) },
    { id: 'bw', label: t('scan.filterBw', { defaultValue: '黑白' }) },
  ]

  return (
    <div className="space-y-4">
      <div className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        <img src={page.rawDataUrl} alt="" className="block w-full" />
        <CornerOverlay corners={corners} onChange={setCorners} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={filterOpts} value={filter} onChange={setFilter} />
        <div className="flex gap-2">
          <Button variant="ghost" icon={RefreshCw} onClick={onReshoot}>{t('scan.reshoot', { defaultValue: '重影' })}</Button>
          <Button icon={Check} onClick={apply} disabled={busy} className={cx(busy && 'opacity-60')}>
            {busy ? t('scan.applying', { defaultValue: '處理中…' }) : t('scan.apply', { defaultValue: '套用' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
