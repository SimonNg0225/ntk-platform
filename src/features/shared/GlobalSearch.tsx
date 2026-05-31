import { useState, useMemo } from 'react'
import { useCollection } from '../../lib/store'
import {
  notesCol,
  questionsCol,
  resourcesCol,
  lessonPlansCol,
  meetingNotesCol,
  readingCol,
  journalCol,
  classesCol,
  studentsCol,
} from '../../data/collections'
import { useNav } from '../../context/NavContext'
import { Input, Card, Badge, SectionTitle, EmptyState } from '../../ui'
import { Search, HelpCircle } from 'lucide-react'
import type {
  Note,
  Question,
  Resource,
  LessonPlan,
  MeetingNote,
  ReadingItem,
  JournalEntry,
  Klass,
  Student,
} from '../../data/types'

// ============================================================
//  全域搜尋：跨多個資料源即時搵嘢，結果按類別分組
// ============================================================

const MAX_PER_GROUP = 5

// 每組搜尋結果（一個資料源）
interface ResultGroup {
  label: string
  featureId: string
  hits: { id: string; snippet: string }[]
}

// 由原始文字 + 關鍵字整出命中片段（前後留少少上文下理）
function makeSnippet(text: string, lowerKeyword: string): string | null {
  const idx = text.toLowerCase().indexOf(lowerKeyword)
  if (idx === -1) return null
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + lowerKeyword.length + 40)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

export default function GlobalSearch() {
  const { open } = useNav()
  const [keyword, setKeyword] = useState('')

  // 訂閱所有資料源
  const notes = useCollection(notesCol)
  const questions = useCollection(questionsCol)
  const resources = useCollection(resourcesCol)
  const lessonPlans = useCollection(lessonPlansCol)
  const meetingNotes = useCollection(meetingNotesCol)
  const reading = useCollection(readingCol)
  const journal = useCollection(journalCol)
  const classes = useCollection(classesCol)
  const students = useCollection(studentsCol)

  // 用一個陣列描述每個源（資料、標籤、featureId、攞文字欄位），避免重複邏輯
  const sources = useMemo(
    () => [
      {
        label: '學習筆記',
        featureId: 'learning-notes',
        items: notes,
        getText: (n: Note) => [n.content],
      },
      {
        label: '題庫',
        featureId: 'work-questions',
        items: questions,
        getText: (q: Question) => [q.stem],
      },
      {
        label: '資源',
        featureId: 'work-resources',
        items: resources,
        getText: (r: Resource) => [r.title, r.notes],
      },
      {
        label: '教案',
        featureId: 'work-lesson-plan',
        items: lessonPlans,
        getText: (l: LessonPlan) => [l.title, l.objectives, l.activities],
      },
      {
        label: '會議筆記',
        featureId: 'work-meeting-notes',
        items: meetingNotes,
        getText: (m: MeetingNote) => [m.title, m.content],
      },
      {
        label: '閱讀清單',
        featureId: 'learning-reading',
        items: reading,
        getText: (r: ReadingItem) => [r.title, r.author],
      },
      {
        label: '日誌',
        featureId: 'learning-journal',
        items: journal,
        getText: (j: JournalEntry) => [j.content],
      },
      {
        label: '班別',
        featureId: 'work-classes',
        items: classes,
        getText: (c: Klass) => [c.name, c.subject],
      },
      {
        label: '學生',
        featureId: 'work-gradebook',
        items: students,
        getText: (s: Student) => [s.name],
      },
    ],
    [
      notes,
      questions,
      resources,
      lessonPlans,
      meetingNotes,
      reading,
      journal,
      classes,
      students,
    ],
  )

  const trimmed = keyword.trim()
  const lowerKeyword = trimmed.toLowerCase()

  // 計算每組結果
  const groups = useMemo<ResultGroup[]>(() => {
    if (!lowerKeyword) return []
    return sources.map((source) => {
      const hits: { id: string; snippet: string }[] = []
      for (const item of source.items as { id: string }[]) {
        const fields = (
          source.getText as (i: { id: string }) => (string | undefined)[]
        )(item)
        let snippet: string | null = null
        for (const field of fields) {
          if (!field) continue
          snippet = makeSnippet(field, lowerKeyword)
          if (snippet) break
        }
        if (snippet) hits.push({ id: item.id, snippet })
      }
      return { label: source.label, featureId: source.featureId, hits }
    })
  }, [sources, lowerKeyword])

  const visibleGroups = groups.filter((g) => g.hits.length > 0)
  const totalHits = visibleGroups.reduce((sum, g) => sum + g.hits.length, 0)

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">全域搜尋</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          一次過喺所有筆記、題庫、資源、教案、班別、學生入面搵嘢（大細楷不分）。
        </p>
      </header>

      {/* 搜尋框 */}
      <Card className="p-4 sm:p-5">
        <label htmlFor="global-search" className="sr-only">
          全域搜尋
        </label>
        <Input
          id="global-search"
          autoFocus
          type="search"
          icon={Search}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜尋筆記、題庫、資源、班別、學生…"
        />

        {trimmed && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            共
            <Badge tone="accent" className="tabular-nums">{totalHits}</Badge>
            項命中
          </p>
        )}
      </Card>

      {/* 未輸入提示 */}
      {!trimmed && (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="輸入關鍵字即時開始搜尋"
            hint="一次過喺所有筆記、題庫、資源、教案、班別、學生入面搵嘢。"
          />
        </div>
      )}

      {/* 有輸入但無結果 */}
      {trimmed && totalHits === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={HelpCircle}
            title={`搵唔到「${trimmed}」嘅結果`}
            hint="試下換個關鍵字，或者檢查有冇打錯字。"
          />
        </div>
      )}

      {/* 有結果 */}
      {trimmed && totalHits > 0 && (
        <div className="mt-4 space-y-4">
          {visibleGroups.map((group) => (
            <Card key={group.featureId} className="p-4 sm:p-5">
              <SectionTitle
                right={
                  <Badge tone="accent" className="tabular-nums">
                    {group.hits.length}
                  </Badge>
                }
              >
                {group.label}
              </SectionTitle>

              <ul className="space-y-2">
                {group.hits.slice(0, MAX_PER_GROUP).map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => open(group.featureId)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-accent hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-accent dark:hover:bg-accent dark:hover:text-white"
                    >
                      {hit.snippet}
                    </button>
                  </li>
                ))}
                {group.hits.length > MAX_PER_GROUP && (
                  <li className="px-1 text-xs text-slate-400 dark:text-slate-500">
                    仲有{' '}
                    <span className="tabular-nums">
                      {group.hits.length - MAX_PER_GROUP}
                    </span>{' '}
                    項，撳上面任何一條去
                    {group.label}查看。
                  </li>
                )}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
