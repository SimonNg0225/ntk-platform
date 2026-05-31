import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// ============================================================
//  Error Boundary — 隔離單一功能嘅 runtime 錯誤
//  ------------------------------------------------------------
//  一個功能 throw 唔會再令成個 app 白畫面；只喺該功能位置顯示
//  友善錯誤 + 重試。用喺 App 包住每個 feature 渲染（key=featureId，
//  切功能自動 reset）。
// ============================================================

interface Props {
  children: ReactNode
  /** 重試時順手做（例如返首頁） */
  onReset?: () => void
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // 純前端：log 出嚟方便除錯（將來可接 Sentry 等）
    console.error('[ErrorBoundary]', error)
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-500/30 dark:bg-rose-500/5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-500/15">
          <AlertTriangle size={24} strokeWidth={1.75} />
        </span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          呢個功能出咗錯
        </p>
        <p className="max-w-md break-words text-xs text-slate-400 dark:text-slate-500">
          {error.message || '發生未知錯誤'}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <RotateCcw size={15} />
          重試
        </button>
      </div>
    )
  }
}
