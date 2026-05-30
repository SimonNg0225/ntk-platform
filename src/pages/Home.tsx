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
    <div className="space-y-6">
      <header className="rounded-2xl bg-accent p-6 text-white">
        <p className="text-sm opacity-90">{modeDef.icon} {modeDef.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{modeDef.tagline}</h1>
        <p className="mt-2 text-sm opacity-90">
          而家有 {ready} 個功能可以即刻用，仲有更多即將推出。
          隨時喺左上角切換另一個模式。
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          功能
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.id} feature={f} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </div>
  )
}
