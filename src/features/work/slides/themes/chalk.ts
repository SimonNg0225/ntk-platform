import { baseRecipe, type Theme } from './layout'

export const chalk: Theme = {
  id: 'chalk',
  nameKey: 'slides.themeChalk',
  nameDefault: '黑板綠',
  tokens: {
    palette: {
      bg: '#1f3b30', surface: '#27483b', primary: '#fef9c3',
      accent: '#fde047', text: '#f8fafc', muted: '#a7c4b5',
    },
    fonts: { display: '"Patrick Hand", "Comic Sans MS", cursive', body: 'system-ui, sans-serif' },
    bg: 'chalk',
    shape: { radius: 4, border: true, shadow: false, accentBar: false },
  },
  recipe: baseRecipe({ timeline: { align: 'left', titleScale: 1.1, density: 'normal' } }),
  motif: { iconStyle: 'sketch' },
  favors: ['timeline', 'compare', 'bullets'],
}
