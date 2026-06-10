import type { Theme } from './layout'
import { academic } from './academic'

export type { Theme, LayoutParams } from './layout'

// Task 3 會 append playful / minimal / chalk
export const allThemes: Theme[] = [academic]

export function getTheme(id: string): Theme {
  return allThemes.find((t) => t.id === id) ?? allThemes[0]
}
