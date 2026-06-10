import { baseRecipe, type Theme } from './layout'

export const playful: Theme = {
  id: 'playful',
  nameKey: 'slides.themePlayful',
  nameDefault: '活力橙',
  tokens: {
    palette: {
      bg: '#fff7ed', surface: '#ffffff', primary: '#ea580c',
      accent: '#0d9488', text: '#1c1917', muted: '#78716c',
    },
    fonts: { display: '"Nunito", system-ui, sans-serif', body: '"Nunito", system-ui, sans-serif' },
    bg: 'geometric',
    shape: { radius: 24, border: false, shadow: true, accentBar: false },
  },
  recipe: baseRecipe({ imageText: { align: 'left', titleScale: 1.2, density: 'airy' } }),
  motif: { iconStyle: 'doodle' },
  favors: ['imageText', 'quiz', 'title'],
}
