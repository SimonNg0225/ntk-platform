import { createCollection } from '../../../lib/store'
import type { SlideDeck } from './types'

// ⚠️ storage key 一旦定下不可改；localStorage 實際 key = ntk.slides.decks
export const slideDecksCol = createCollection<SlideDeck>('slides.decks')
