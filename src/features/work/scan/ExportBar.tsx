import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Files, ScanText, Library } from 'lucide-react'
import { Button, SegmentedControl } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { downloadBlob } from '../../../lib/export/file'
import { isScanStorageConfigured, uploadScanPdf } from '../../../lib/supabaseStorage'
import type { OutputMode, ScanPage } from './lib/types'
import { buildScanPdf, buildPerPagePdfs } from './lib/buildPdf'
import { outputFilenames } from './lib/naming'
import { registerScanResource } from './scanStore'

export default function ExportBar({
  pages,
  baseName,
}: {
  pages: ScanPage[]
  baseName: string
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()
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

  // 去向②：存資源庫（雲端或本機 metadata）。
  //  · 已接雲端 + 已登入 → 上載 PDF 去 Supabase Storage，資源庫存可 click
  //    簽名連結（跨裝置打得開），唔強制下載。
  //  · 否則 → 降級：登記 metadata row + 下載個 PDF 畀用戶留底。
  async function saveToLibrary() {
    if (!pages.length) return
    setBusy(true)
    try {
      const names = outputFilenames(baseName, 'merged', pages.length)
      const bytes = await buildScanPdf(pages, { ocr })
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })

      // 雲端路徑：上載去 Storage，存簽名連結。
      if (isScanStorageConfigured && user) {
        try {
          const { path, url } = await uploadScanPdf(blob, names[0], user.id)
          registerScanResource({
            title: baseName,
            url,
            storagePath: path,
          })
          toast.success(
            t('scan.savedToCloud', {
              defaultValue: '已存上雲端資源庫，可喺資源庫直接開',
            }),
          )
          return
        } catch (err) {
          // 上載失敗（未開 bucket / RLS / 網絡）→ 跌落本機降級路徑。
          // 把真實錯誤 log + 顯示，方便診斷（例 "Bucket not found"）。
          console.error('[scan] 雲端上載失敗', err)
          const reason = err instanceof Error ? err.message : String(err)
          toast.error(
            t('scan.cloudFailed', {
              defaultValue: '雲端上載失敗，改為本機登記 + 下載留底',
            }) + (reason ? `（${reason}）` : ''),
          )
        }
      }

      // 降級：登記 metadata + 下載留底。
      downloadBlob(blob, names[0])
      registerScanResource({
        title: baseName,
      })
      toast.success(
        t('scan.savedToLib', {
          defaultValue: '已登記到資源庫，並下載 PDF 留底',
        }),
      )
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
    <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          {/* 去向②：存資源庫 */}
          <Button
            variant="ghost"
            icon={Library}
            onClick={saveToLibrary}
            disabled={busy || !pages.length}
          >
            {t('scan.saveToLib', { defaultValue: '存資源庫' })}
          </Button>
          {/* 去向①：下載（主要去向） */}
          <Button icon={Download} onClick={run} disabled={busy || !pages.length}>
            {busy
              ? t('scan.generating', { defaultValue: '生成中…' })
              : t('scan.download', { defaultValue: '下載 PDF' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
