import { useMode } from '../context/ModeContext'
import { useSettings } from '../context/SettingsContext'
import { groupedFeatures } from '../features/registry'
import FeatureCard, { type ToneKey } from '../components/FeatureCard'
import { FeatureIcon } from '../features/featureIcons'

interface Props {
  onOpen: (id: string) => void
}

// 每個功能分組對應一隻色調（令 Bento 網格有層次，但唔會嘈）。
const GROUP_TONE: Record<string, ToneKey> = {
  概覽: 'accent',
  AI: 'violet',
  知識管理: 'blue',
  目標與習慣: 'amber',
  健康: 'rose',
  教學: 'blue',
  學生: 'emerald',
  行政: 'sky',
  理財: 'emerald',
  工具: 'slate',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '早晨'
  if (h < 18) return '午安'
  return '晚安'
}

// 首頁概覽 — Bento 風：漸變 hero + 按分組分色嘅功能磚。
export default function Home({ onOpen }: Props) {
  const { modeDef } = useMode()
  const { displayName } = useSettings()
  const groups = groupedFeatures(modeDef.id)
  const total = groups.reduce((n, g) => n + g.items.length, 0)

  const name = displayName.trim()
  const greeting = name ? `${timeGreeting()}，${name}` : modeDef.tagline
  const now = new Date()
  const dateLabel = `星期${WEEKDAYS[now.getDay()]} · ${now.getMonth() + 1}月${now.getDate()}日`

  return (
    <div className="space-y-8">
      {/* Hero — 漸變主視覺，跟模式主色（學習靛藍 / 工作青藍） */}
      <header className="hero-gradient relative overflow-hidden rounded-3xl px-6 py-8 text-white shadow-lg shadow-accent/25 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-28 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <FeatureIcon icon={modeDef.icon} size={14} />
            {modeDef.name}
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {dateLabel} · 呢個模式有 {total} 個功能，隨時喺左上角切換。
          </p>
        </div>
      </header>

      {groups.map((g) => (
        <section key={g.group}>
          <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {g.group}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((f) => (
              <FeatureCard
                key={f.id}
                feature={f}
                tone={GROUP_TONE[g.group] ?? 'accent'}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
