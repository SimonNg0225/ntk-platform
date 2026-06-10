import type { Theme } from './layout'
import { academic } from './academic'
import { playful } from './playful'
import { minimal } from './minimal'
import { chalk } from './chalk'

export type { Theme, LayoutParams } from './layout'

export const allThemes: Theme[] = [academic, playful, minimal, chalk]

export function getTheme(id: string): Theme {
  return allThemes.find((t) => t.id === id) ?? allThemes[0]
}
