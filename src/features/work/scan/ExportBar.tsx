import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Files, ScanText } from 'lucide-react'
import { Button, SegmentedControl } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { downloadBlob } from '../../../lib/export/file'
import type { OutputMode, ScanPage } from './lib/types'
import { buildScanPdf, buildPerPagePdfs } from './lib/buildPdf'
import { outputFilenames } from './lib/naming'

export default function ExportBar({
  pages,
  baseName,
}: {
  pages: ScanPage[]
  baseName: string
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [mode, setMode] = useState<OutputMode>('merged')
  const [ocr, setOcr] = useState(true)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!pages.length) return
    setBusy(true)
    try {
      const names = outputFilenames(baseName, mode, pages.length)
      if (mode === 'merged') {
        const bytes = await buildScanPdf(pages, { ocr })
        downloadBlob(
          new Blob([bytes as BlobPart], { type: 'application/pdf' }),
          names[0],
        )
      } else {
        const all = await buildPerPagePdfs(pages, { ocr })
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        all.forEach((b, i) => zip.file(names[i], b))
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, `${outputFilenames(baseName, 'merged', 1)[0].replace(/\.pdf$/, '')}.zip`)
      }
      toast.success(t('scan.done', { defaultValue: '已生成 PDF' }))
    } catch {
      toast.error(t('scan.failed', { defaultValue: '生成失敗，請再試' }))
    } finally {
      setBusy(false)
    }
  }

  const modeOpts = [
    { id: 'merged' as const, label: t('scan.merged', { defaultValue: '合併一個' }), icon: FileText },
    { id: 'perPage' as const, label: t('scan.perPage', { defaultValue: '逐張分檔' }), icon: Files },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl options={modeOpts} value={mode} onChange={setMode} />
        <Button
          variant={ocr ? 'primary' : 'ghost'}
          icon={ScanText}
          onClick={() => setOcr((v) => !v)}
        >
          {ocr
            ? t('scan.ocrOn', { defaultValue: 'OCR：開' })
            : t('scan.ocrOff', { defaultValue: 'OCR：關' })}
        </Button>
      </div>
      <Button icon={Download} onClick={run} disabled={busy || !pages.length}>
        {busy
          ? t('scan.generating', { defaultValue: '生成中…' })
          : t('scan.download', { defaultValue: '下載 PDF' })}
      </Button>
    </div>
  )
}
