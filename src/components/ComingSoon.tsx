// 預留位 — 比 status: 'soon' 的功能用
export default function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-800/50">
      <span className="text-4xl">🚧</span>
      <p className="mt-4 text-base font-medium text-slate-700 dark:text-slate-200">
        「{name}」即將推出
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-400 dark:text-slate-500">
        此功能已預留在框架中。告訴我你想如何使用，我就可以補上內容。
      </p>
    </div>
  )
}
