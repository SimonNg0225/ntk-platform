import { baseRecipe, type Theme } from './layout'

export const minimal: Theme = {
  id: 'minimal',
  nameKey: 'slides.themeMinimal',
  nameDefault: '極簡墨',
  tokens: {
    palette: {
      bg: '#ffffff', surface: '#ffffff', primary: '#111111',
      accent: '#dc2626', text: '#111111', muted: '#9ca3af',
    },
    fonts: { display: '"Inter", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif' },
    bg: 'solid',
    shape: { radius: 0, border: false, shadow: false, accentBar: false },
  },
  recipe: baseRecipe({
    quote: { align: 'left', titleScale: 1.5, density: 'airy' },
    bullets: { align: 'left', titleScale: 1.1, density: 'airy' },
  }),
  motif: { iconStyle: 'line' },
  favors: ['quote', 'imageText', 'section'],
}
