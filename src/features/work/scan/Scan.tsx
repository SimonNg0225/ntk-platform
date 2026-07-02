import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ScanLine, FileScan, Layers } from 'lucide-react'
import { Button, EmptyState, SectionTitle, FeatureGuide, PageHero, type FeatureGuideStep } from '../../../ui'
import type { ScanPage } from './lib/types'
import { downscaleDataUrl } from './lib/cv'
import { disposeOcr } from './lib/ocr'
import CameraCapture from './capture/CameraCapture'
import PageEditor from './edit/PageEditor'
import PageStrip from './pages/PageStrip'
import ExportBar from './ExportBar'

let seq = 0
const newId = () => `scan-${Date.now()}-${seq++}`

// ───────── 掃描教學引導（FeatureGuide：3 步「點用」）─────────
const SCAN_GUIDE: FeatureGuideStep[] = [
  {
    title: '影低或上載',
    desc: '撳「開始掃描」用鏡頭影文件，或上載相片，逐頁加入。',
  },
  {
    title: '拉正＋執相',
    desc: '系統自動偵測四角拉正；可手動微調邊界、揀濾鏡令字更清。',
  },
  {
    title: '輸出 PDF',
    desc: '開 OCR 令 PDF 可搜尋，再下載，或存入資源庫集中管理。',
  },
]

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
    <div className="space-y-5">
      <PageHero
        guideKey="scan"
        icon={FileScan}
        kicker={t('scan.kicker', { defaultValue: '文件掃描' })}
        title={t('scan.title', { defaultValue: '掃描 PDF' })}
        description={
          pages.length > 0
            ? t('scan.subtitleCount', {
                count: pages.length,
                defaultValue: '已加入 {{count}} 頁 · 拉正執相後輸出 PDF。',
              })
            : t('scan.subtitle', {
                defaultValue: '影低文件即變掃描檔，自動拉正、可搜尋，輸出 PDF。',
              })
        }
      />

      {capturing && <CameraCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />}

      {editing ? (
        <PageEditor page={editing} onDone={updatePage} onReshoot={() => { deletePage(editing.id); setCapturing(true) }} />
      ) : pages.length === 0 ? (
        <>
          <FeatureGuide
            storageKey="scan"
            title={t('scan.guideTitle', { defaultValue: '掃描 PDF 點用？' })}
            steps={SCAN_GUIDE}
          />
          <EmptyState
            icon={Camera}
            title={t('scan.emptyTitle', { defaultValue: '由第一頁開始' })}
            hint={t('scan.emptyDesc', {
              defaultValue: '影低或上載文件相片，自動拉正、可搜尋，一鍵輸出掃描 PDF。',
            })}
            action={
              <Button icon={Camera} onClick={() => setCapturing(true)}>
                {t('scan.start', { defaultValue: '開始掃描' })}
              </Button>
            }
          />
        </>
      ) : (
        <>
          <section>
            <SectionTitle
              icon={Layers}
              right={
                <Button size="sm" variant="ghost" icon={Camera} onClick={() => setCapturing(true)}>
                  {t('scan.addPage', { defaultValue: '加一頁' })}
                </Button>
              }
            >
              {t('scan.pagesLabel', { defaultValue: '掃描頁' })}
            </SectionTitle>
            <PageStrip pages={pages} onAdd={() => setCapturing(true)} onEdit={setEditingId} onDelete={deletePage} onMove={movePage} />
          </section>
          <section>
            <SectionTitle icon={ScanLine}>
              {t('scan.exportLabel', { defaultValue: '輸出 PDF' })}
            </SectionTitle>
            <ExportBar pages={pages} baseName={t('scan.defaultName', { defaultValue: '掃描' })} />
          </section>
        </>
      )}
    </div>
  )
}
