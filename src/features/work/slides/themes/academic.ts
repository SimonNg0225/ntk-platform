import { baseRecipe, type Theme } from './layout'

export const academic: Theme = {
  id: 'academic',
  nameKey: 'slides.themeAcademic',
  nameDefault: '學術藍',
  tokens: {
    palette: {
      bg: '#f8fafc', surface: '#ffffff', primary: '#1e3a8a',
      accent: '#2563eb', text: '#0f172a', muted: '#64748b',
    },
    fonts: { display: '"Source Han Serif", Georgia, serif', body: 'system-ui, sans-serif' },
    bg: 'grid',
    shape: { radius: 6, border: true, shadow: false, accentBar: true },
  },
  recipe: baseRecipe(),
  motif: { iconStyle: 'line' },
  favors: ['bullets', 'compare', 'summary'],
}
