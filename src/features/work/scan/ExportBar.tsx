import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Files, ScanText, Library, Users } from 'lucide-react'
import { Button, SegmentedControl, Select } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { useCollection } from '../../../lib/store'
import { classesCol, studentsCol } from '../../../data/collections'
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
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)
  const [mode, setMode] = useState<OutputMode>('merged')
  const [ocr, setOcr] = useState(true)
  const [busy, setBusy] = useState(false)
  // 去向②③：存資源庫（可選綁班級／學生）
  const [bindOpen, setBindOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const classStudents = students.filter((s) => s.classId === classId)

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

  // 去向②③：存資源庫（+ 可選綁班級／學生）。
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
            classId: classId || undefined,
            studentId: studentId || undefined,
            url,
            storagePath: path,
          })
          toast.success(
            t('scan.savedToCloud', {
              defaultValue: '已存上雲端資源庫，可喺資源庫直接開',
            }),
          )
          setBindOpen(false)
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
        classId: classId || undefined,
        studentId: studentId || undefined,
      })
      toast.success(
        t('scan.savedToLib', {
          defaultValue: '已登記到資源庫，並下載 PDF 留底',
        }),
      )
      setBindOpen(false)
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
          {/* 去向③：綁班級／學生（展開內聯選擇器） */}
          <Button
            variant={bindOpen ? 'primary' : 'ghost'}
            icon={Users}
            onClick={() => setBindOpen((v) => !v)}
            disabled={busy || !pages.length}
          >
            {t('scan.bind', { defaultValue: '綁班級／學生' })}
          </Button>
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

      {bindOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('scan.class', { defaultValue: '班級' })}
            </span>
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                setStudentId('')
              }}
              className="min-w-[10rem]"
            >
              <option value="">
                {t('scan.classNone', { defaultValue: '— 不綁班級 —' })}
              </option>
              {classes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.subject ? ` · ${k.subject}` : ''}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('scan.student', { defaultValue: '學生（選填）' })}
            </span>
            <Select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={!classId}
              className="min-w-[10rem]"
            >
              <option value="">
                {t('scan.studentNone', { defaultValue: '— 全班（不指定）—' })}
              </option>
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            icon={Library}
            onClick={saveToLibrary}
            disabled={busy || !pages.length}
          >
            {t('scan.saveBound', { defaultValue: '存入並綁定' })}
          </Button>
        </div>
      )}
    </div>
  )
}
