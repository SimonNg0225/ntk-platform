import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AudioLines,
  ListChecks,
  MessageSquareText,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { cx } from '../../../ui'
import type { LiveVoiceStatus } from './liveVoice'

export type VoiceCallStageStatus =
  | LiveVoiceStatus
  | 'awaiting-confirmation'
  | 'executing'

export type VoiceCallTurn = {
  id: string
  role: 'user' | 'model'
  content: string
}

const BAR_SHAPE = [0.42, 0.7, 0.5, 0.92, 0.62, 1, 0.58, 0.82, 0.46]

const STATUS_META: Record<
  VoiceCallStageStatus,
  { label: string; dot: string; bars: string }
> = {
  idle: {
    label: '通話已結束',
    dot: 'bg-slate-400',
    bars: 'bg-slate-400 dark:bg-slate-500',
  },
  connecting: {
    label: '正在接通',
    dot: 'bg-sky-500',
    bars: 'bg-sky-500',
  },
  listening: {
    label: '正在聆聽',
    dot: 'bg-emerald-500',
    bars: 'bg-emerald-500',
  },
  thinking: {
    label: '正在理解',
    dot: 'bg-amber-500',
    bars: 'bg-amber-500',
  },
  speaking: {
    label: 'Ezi 正在回覆',
    dot: 'bg-accent',
    bars: 'bg-accent',
  },
  error: {
    label: '通話暫時中斷',
    dot: 'bg-rose-500',
    bars: 'bg-rose-500',
  },
  'awaiting-confirmation': {
    label: '等待你確認',
    dot: 'bg-amber-500',
    bars: 'bg-amber-500',
  },
  executing: {
    label: '正在執行',
    dot: 'bg-sky-500',
    bars: 'bg-sky-500',
  },
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function CallControl({
  label,
  active = false,
  destructive = false,
  disabled = false,
  expanded,
  controls,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  destructive?: boolean
  disabled?: boolean
  expanded?: boolean
  controls?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <div className="flex w-16 flex-col items-center gap-2">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        aria-expanded={expanded}
        aria-controls={controls}
        disabled={disabled}
        onClick={onClick}
        className={cx(
          'flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40',
          destructive
            ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700'
            : active
              ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        )}
      >
        {children}
      </button>
      <span className="text-center text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </div>
  )
}

export default function VoiceCallStage({
  status,
  inputLevel,
  inputMuted,
  outputMuted,
  canMute,
  languageLabel,
  statusMessage,
  latestUserText,
  latestModelText,
  turns,
  panelOpen,
  actionPanel,
  actionPending,
  onTogglePanel,
  onToggleInputMute,
  onToggleOutputMute,
  onRetry,
  onEnd,
}: {
  status: VoiceCallStageStatus
  inputLevel: number
  inputMuted: boolean
  outputMuted: boolean
  canMute: boolean
  languageLabel: string
  statusMessage: string
  latestUserText: string
  latestModelText: string
  turns: VoiceCallTurn[]
  panelOpen: boolean
  actionPanel?: ReactNode
  actionPending: boolean
  onTogglePanel: () => void
  onToggleInputMute: () => void
  onToggleOutputMute: () => void
  onRetry: () => void
  onEnd: () => void
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const meta = STATUS_META[status]
  const animated = ['connecting', 'thinking', 'speaking', 'executing'].includes(status)
  const focusText = useMemo(() => {
    if (status === 'error') return statusMessage || '未能保持語音連線，請重新接通。'
    if (status === 'awaiting-confirmation') return '我已整理好操作內容，確認後才會改動平台資料。'
    if (status === 'executing') return statusMessage || '正在處理已確認的工作。'
    if (status === 'speaking') return latestModelText || statusMessage
    if (status === 'thinking') return latestUserText || statusMessage
    if (status === 'connecting') return '正在建立語音連線'
    return latestUserText || '我在聽'
  }, [latestModelText, latestUserText, status, statusMessage])

  return (
    <section
      aria-label="Ezi 語音通話"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fa] dark:bg-slate-950"
    >
      <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 sm:px-6 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
            <AudioLines size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-white sm:text-base">
              Ezi 智能助手
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className={cx('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
              語音通話
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 sm:gap-4">
          <span aria-label={`通話時間 ${formatDuration(elapsedSeconds)}`}>
            {formatDuration(elapsedSeconds)}
          </span>
          <span className="hidden border-l border-slate-200 pl-4 dark:border-slate-700 sm:inline">
            {languageLabel}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
            <div
              className="flex h-28 w-full max-w-56 items-center justify-center gap-2"
              role="img"
              aria-label={meta.label}
            >
              {BAR_SHAPE.map((shape, index) => {
                const activity =
                  status === 'listening'
                    ? inputMuted
                      ? 0
                      : Math.max(0.08, inputLevel)
                    : status === 'speaking'
                      ? 0.72
                      : status === 'idle' || status === 'error'
                        ? 0.08
                        : 0.34
                const height = 14 + Math.round(activity * (34 + shape * 42))
                return (
                  <span
                    key={`${shape}-${index}`}
                    className={cx(
                      'block w-2 rounded-full transition-[height] duration-100 motion-reduce:transition-none',
                      meta.bars,
                      animated && 'ezi-voice-bar motion-reduce:animate-none',
                    )}
                    style={{
                      height: `${height}px`,
                      animationDelay: `${index * -85}ms`,
                    }}
                    aria-hidden
                  />
                )
              })}
            </div>

            <p
              className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
              aria-live="polite"
            >
              <span className={cx('h-2 w-2 rounded-full', meta.dot)} aria-hidden />
              {inputMuted ? '咪高峰已靜音' : meta.label}
            </p>
            <p className="mt-4 max-h-24 max-w-2xl overflow-hidden px-2 text-xl font-medium leading-8 text-slate-700 dark:text-slate-200 sm:text-2xl sm:leading-9">
              {focusText}
            </p>

            {status === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                <RefreshCw size={17} aria-hidden />
                重新接通
              </button>
            )}
          </div>

          <div className="mx-auto mt-4 flex w-full max-w-md shrink-0 items-start justify-center gap-2 sm:gap-5">
            <CallControl
              label={inputMuted ? '解除靜音' : '靜音'}
              active={inputMuted}
              disabled={!canMute}
              onClick={onToggleInputMute}
            >
              {inputMuted ? <MicOff size={21} /> : <Mic size={21} />}
            </CallControl>
            <CallControl
              label={actionPending ? '確認操作' : '對話記錄'}
              active={panelOpen}
              expanded={panelOpen}
              controls="voice-call-panel"
              onClick={onTogglePanel}
            >
              {actionPending ? <ListChecks size={21} /> : <MessageSquareText size={21} />}
            </CallControl>
            <CallControl
              label={outputMuted ? '開啟聲音' : '關閉聲音'}
              active={outputMuted}
              onClick={onToggleOutputMute}
            >
              {outputMuted ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </CallControl>
            <CallControl label="結束" destructive onClick={onEnd}>
              <PhoneOff size={21} />
            </CallControl>
          </div>
        </main>

        {panelOpen && (
          <aside
            id="voice-call-panel"
            aria-label={actionPanel ? '執行前確認' : '對話記錄'}
            className="absolute inset-x-3 bottom-3 top-3 z-20 flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[390px] dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                {actionPanel ? '執行前確認' : '對話記錄'}
              </h2>
              <button
                type="button"
                aria-label="關閉側欄"
                onClick={onTogglePanel}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {actionPanel ? (
                actionPanel
              ) : turns.length > 0 ? (
                <ol className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
                  {turns.map((turn) => (
                    <li key={turn.id} className="py-4">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {turn.role === 'user' ? '你' : 'Ezi'}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-200">
                        {turn.content}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
                  尚未有對話內容
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}
