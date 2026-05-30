import { createContext, useContext, type ReactNode } from 'react'

// 簡單導航 context：畀任何功能可以叫 App 開啟另一個功能（null = 首頁概覽）
interface NavValue {
  open: (featureId: string | null) => void
}

const NavContext = createContext<NavValue>({ open: () => {} })

export function NavProvider({
  open,
  children,
}: {
  open: (id: string | null) => void
  children: ReactNode
}) {
  return <NavContext.Provider value={{ open }}>{children}</NavContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNav() {
  return useContext(NavContext)
}
