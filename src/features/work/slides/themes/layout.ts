import type { SlideType } from '../types'

export interface LayoutParams {
  align: 'left' | 'center'
  titleScale: number   // 標題字級倍率
  density: 'airy' | 'normal' | 'tight'
}

export interface Theme {
  id: string
  nameKey: string       // i18n key（slides.theme<Id>）
  nameDefault: string   // zh-HK 回退
  tokens: {
    palette: {
      bg: string; surface: string; primary: string
      accent: string; text: string; muted: string
    }
    fonts: { display: string; body: string }
    bg: 'solid' | 'gradient' | 'geometric' | 'grid' | 'paper' | 'chalk'
    shape: { radius: number; border: boolean; shadow: boolean; accentBar: boolean }
  }
  recipe: Record<SlideType, LayoutParams>
  motif: { iconStyle: 'flat' | 'line' | 'doodle' | 'sketch' }
  favors: SlideType[]
}

// 大部分 theme 共用的版面食譜底；個別 theme 可覆蓋。
export function baseRecipe(over: Partial<Record<SlideType, LayoutParams>> = {}): Record<SlideType, LayoutParams> {
  const d: LayoutParams = { align: 'left', titleScale: 1, density: 'normal' }
  const base: Record<SlideType, LayoutParams> = {
    title: { align: 'center', titleScale: 1.6, density: 'airy' },
    section: { align: 'center', titleScale: 1.3, density: 'airy' },
    bullets: { ...d },
    twoCol: { ...d },
    imageText: { ...d },
    quote: { align: 'center', titleScale: 1.2, density: 'airy' },
    compare: { ...d },
    timeline: { ...d },
    quiz: { ...d, density: 'airy' },
    summary: { ...d },
  }
  return { ...base, ...over }
}
