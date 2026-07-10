import { CircleDashed, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type ServiceStatusProps = {
  title?: string
  message: string
  adminDetails?: string
}

export default function ServiceStatus({
  title = '此服務暫時未能使用',
  message,
  adminDetails,
}: ServiceStatusProps) {
  const { isAdmin } = useAuth()

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[14px] bg-slate-100/80 px-4 py-3 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
    >
      <CircleDashed size={18} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {message}
        </p>

        {isAdmin && adminDetails ? (
          <details className="mt-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
              <Wrench size={13} />
              管理員技術資料
            </summary>
            <p className="mt-1 break-words font-mono leading-5 text-slate-500 dark:text-slate-400">
              {adminDetails}
            </p>
          </details>
        ) : null}
      </div>
    </div>
  )
}
