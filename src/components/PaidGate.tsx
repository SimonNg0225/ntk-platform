import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Lock,
  Loader2,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FeatureIcon } from '../features/featureIcons'
import type { Feature } from '../features/types'
import { useNav } from '../context/NavContext'

// ============================================================
//  付費功能上鎖提示
//  ------------------------------------------------------------
//  免費用戶開到要付費嘅功能（requiresPaid）時，唔 render 功能本體，
//  改顯示升級引導。訂閱狀態載入中 → spinner（避免閃一閃）。
// ============================================================

interface GateCopy {
  label: string
  outcome: string
  included: string[]
  fallbackId: string
  fallbackLabel: string
  fallbackDesc: string
  icon: LucideIcon
}

const GATE_COPY: Record<string, GateCopy> = {
  'work-slides': {
    label: '節省簡報製作時間',
    outcome: '把課題或教材轉成 PowerPoint 初稿，連版式、封面、內頁同下載流程一次完成。',
    included: ['34 套簡報模板', '自動安排版式和配圖', '匯出 .pptx 繼續編輯'],
    fallbackId: 'work-generate',
    fallbackLabel: '先生成教材',
    fallbackDesc: '先用免費教材生成，把內容整理好再手動製作簡報。',
    icon: Sparkles,
  },
  'work-admin-docs': {
    label: '行政文件自動套版',
    outcome: '把 Word 範本的欄位逐項填好，保持原格式輸出，減少重複複製貼上。',
    included: ['辨識 Word 標籤欄位', '逐欄填寫再生成 .docx', '適合通告、表格和行政文件'],
    fallbackId: 'work-doc-digest',
    fallbackLabel: '先速讀文件',
    fallbackDesc: '先用文件速讀抽重點，再手動整理到現有範本。',
    icon: FileText,
  },
  'work-scan': {
    label: '紙本資料數碼化',
    outcome: '用鏡頭或相片自動偵邊、拉正、套掃描濾鏡，輸出可搜尋 PDF。',
    included: ['自動偵測紙張邊界', '拉正和掃描濾鏡', '生成可搜尋 PDF'],
    fallbackId: 'work-resources',
    fallbackLabel: '先存入資源庫',
    fallbackDesc: '先把現有檔案或連結放入資源庫，保持教材集中管理。',
    icon: ScanLine,
  },
}

const DEFAULT_GATE: GateCopy = {
  label: '進階工作流',
  outcome: '呢個功能屬於節省時間的進階工具，升級後可配合更多 AI 點數同同步能力使用。',
  included: ['更多 AI 點數', '多裝置同步', '優先支援'],
  fallbackId: 'work-lesson-plan',
  fallbackLabel: '先準備下一堂',
  fallbackDesc: '先用免費備課流程完成最核心工作。',
  icon: ClipboardList,
}

export default function PaidGate({
  feature,
  loading,
}: {
  feature: Feature
  loading?: boolean
}) {
  const { t } = useTranslation()
  const nav = useNav()
  const copy = GATE_COPY[feature.id] ?? DEFAULT_GATE
  const CopyIcon = copy.icon

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-300 dark:text-slate-600">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <section className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white shadow-sm dark:bg-slate-900/50">
        <div className="border-b border-[color:var(--border)] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative inline-flex w-fit">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft dark:bg-accent/15">
                <FeatureIcon icon={feature.icon} size={30} className="text-accent" />
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow">
                <Lock size={14} strokeWidth={2.5} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                <CopyIcon size={13} strokeWidth={1.75} />
                {copy.label}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                {t('gate.title', {
                  name: feature.name,
                  defaultValue: `「${feature.name}」係付費功能`,
                })}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {copy.outcome}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              升級後解鎖
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {copy.included.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              未升級都可繼續
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {copy.fallbackDesc}
            </p>
            <button
              type="button"
              onClick={() => nav.open(copy.fallbackId)}
              className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:text-slate-200"
            >
              {copy.fallbackLabel}
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[color:var(--border)] bg-slate-50 px-5 py-4 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Plus 適合日常備課；Pro 適合密集出卷、簡報和高階模型。
          </p>
          <Link
            to="/pricing"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Sparkles size={15} strokeWidth={2.25} />
            {t('gate.cta', { defaultValue: '睇方案升級' })}
          </Link>
        </div>
      </section>
    </div>
  )
}
