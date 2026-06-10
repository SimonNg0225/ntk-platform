import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ScanLine } from 'lucide-react'
import { Button, EmptyState } from '../../../ui'
import type { ScanPage } from './lib/types'
import { downscaleDataUrl } from './lib/cv'
import { disposeOcr } from './lib/ocr'
import CameraCapture from './capture/CameraCapture'
import PageEditor from './edit/PageEditor'
import PageStrip from './pages/PageStrip'
import ExportBar from './ExportBar'

let seq = 0
const newId = () => `scan-${Date.now()}-${seq++}`

export default function Scan() {
  const { t } = useTranslation()
  const [pages, setPages] = useState<ScanPage[]>([])
  const [capturing, setCapturing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => () => { void disposeOcr() }, []) // 離開功能釋放 OCR worker

  async function handleCaptured(dataUrls: string[]) {
    setCapturing(false)
    const added: ScanPage[] = []
    for (const url of dataUrls) {
      const ds = await downscaleDataUrl(url)
      added.push({ id: newId(), rawDataUrl: ds.dataUrl, corners: null, filter: 'color', processedDataUrl: ds.dataUrl })
    }
    setPages((prev) => [...prev, ...added])
    if (added.length === 1) setEditingId(added[0].id) // 單張即入編輯
  }

  function updatePage(p: ScanPage) { setPages((prev) => prev.map((x) => (x.id === p.id ? p : x))); setEditingId(null) }
  function deletePage(id: string) { setPages((prev) => prev.filter((x) => x.id !== id)) }
  function movePage(id: string, dir: -1 | 1) {
    setPages((prev) => {
      const i = prev.findIndex((x) => x.id === id); const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev];[next[i], next[j]] = [next[j], next[i]]; return next
    })
  }

  const editing = pages.find((p) => p.id === editingId) ?? null

  return (
    <div className="space-y-6">
      {/* bespoke masthead */}
      <header className="-mx-1">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <ScanLine size={12} />{t('scan.kicker', { defaultValue: '文件掃描 · Scan' })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">{t('scan.title', { defaultValue: '掃描 PDF' })}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t('scan.subtitle', { defaultValue: '影低文件即變掃描檔，自動拉正、可搜尋，輸出 PDF。' })}</p>
      </header>

      {capturing && <CameraCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />}

      {editing ? (
        <PageEditor page={editing} onDone={updatePage} onReshoot={() => { deletePage(editing.id); setCapturing(true) }} />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={Camera}
          title={t('scan.emptyTitle', { defaultValue: '未有掃描' })}
          hint={t('scan.emptyDesc', { defaultValue: '影低或上載文件相片，自動變成掃描 PDF。' })}
          action={<Button icon={Camera} onClick={() => setCapturing(true)}>{t('scan.start', { defaultValue: '開始掃描' })}</Button>}
        />
      ) : (
        <>
          <PageStrip pages={pages} onAdd={() => setCapturing(true)} onEdit={setEditingId} onDelete={deletePage} onMove={movePage} />
          <ExportBar pages={pages} baseName={t('scan.defaultName', { defaultValue: '掃描' })} />
        </>
      )}
    </div>
  )
}
