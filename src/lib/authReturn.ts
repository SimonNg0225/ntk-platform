const AUTH_RETURN_KEY = 'ntk.auth.returnTo'
const MAX_RETURN_AGE_MS = 30 * 60 * 1000

export function isSafeAppReturnPath(value: string): boolean {
  return /^\/app(?:\/|\?|$)/.test(value) && !value.startsWith('//')
}

export function rememberAuthReturnTo(path: string): void {
  const safePath = isSafeAppReturnPath(path) ? path : '/app'
  try {
    sessionStorage.setItem(
      AUTH_RETURN_KEY,
      JSON.stringify({ path: safePath, createdAt: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function readAuthReturnTo(): string {
  try {
    const raw = sessionStorage.getItem(AUTH_RETURN_KEY)
    if (!raw) return '/app'
    const parsed = JSON.parse(raw) as { path?: string; createdAt?: number }
    if (
      typeof parsed.path !== 'string' ||
      !isSafeAppReturnPath(parsed.path) ||
      typeof parsed.createdAt !== 'number' ||
      Date.now() - parsed.createdAt > MAX_RETURN_AGE_MS
    ) {
      return '/app'
    }
    return parsed.path
  } catch {
    return '/app'
  }
}
