import { useMode } from '../context/ModeContext'
import { useSettings } from '../context/SettingsContext'
import { groupedFeatures } from '../features/registry'
import FeatureCard from '../components/FeatureCard'

interface Props {
  onOpen: (id: string) => void
}

// 首頁概覽 — 按目前模式分組顯示功能
export default function Home({ onOpen }: Props) {
  const { modeDef } = useMode()
  const { displayName } = useSettings()
  const groups = groupedFeatures(modeDef.id)
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const greeting = displayName.trim() ? `早晨，${displayName.trim()}` : modeDef.tagline

  return (
    <div className="space-y-7">
      {/* Hero 漸變主視覺 */}
      <header className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-lg shadow-accent/20 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-16 top-20 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm opacity-90">
            {modeDef.icon} {modeDef.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-3 max-w-md text-sm opacity-90">
            呢個模式有 {total} 個功能。隨時喺左上角切換另一個模式。
          </p>
        </div>
      </header>

      {groups.map((g) => (
        <section key={g.group}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            {g.group}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((f) => (
              <FeatureCard key={f.id} feature={f} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
