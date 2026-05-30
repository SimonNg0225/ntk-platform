import { useMode } from '../context/ModeContext'
import { featuresForMode } from '../features/registry'
import FeatureCard from '../components/FeatureCard'

interface Props {
  onOpen: (id: string) => void
}

// 首頁概覽 — 按目前模式顯示問候語同功能網格
export default function Home({ onOpen }: Props) {
  const { modeDef } = useMode()
  const features = featuresForMode(modeDef.id)
  const ready = features.filter((f) => f.status === 'ready').length

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
            {modeDef.tagline}
          </h1>
          <p className="mt-3 max-w-md text-sm opacity-90">
            而家有 {ready} 個功能可以即刻用，仲有更多即將推出。
            隨時喺左上角切換另一個模式。
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          功能
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.id} feature={f} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </div>
  )
}
