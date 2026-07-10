import { getFeature } from '../features/registry'

export function appRouteId(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'app') return null
  const token = parts[1] === 'work' || parts[1] === 'learning' ? parts[2] : parts[1]
  if (!token) return null
  if (token === 'settings') return '__settings__'
  if (token === 'admin') return '__admin__'
  return getFeature(token) ? token : null
}
