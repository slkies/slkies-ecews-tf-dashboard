/**
 * Light or dark, remembered per browser.
 *
 * The choice is written to the root element as `data-theme`, which is exactly
 * what tokens.css keys off - so the palette is shared with the existing app
 * and neither has to know about the other.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'ecews.theme'

interface ThemeCtx { theme: Theme; toggle: () => void }
const Ctx = createContext<ThemeCtx | null>(null)

function initial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage blocked - fall through to the system preference */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light'
}

/**
 * Put the theme on the root element NOW, not in an effect. Charts read the
 * colour tokens while they render; applied in an effect, the class arrived
 * after them, so a chart drawn on load or just after a switch used the other
 * theme's colours - a white segment gap on a dark card (22 Oct 2026).
 * shadcn keys dark mode off `.dark`; `data-theme` is kept for older readers.
 */
function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = initial()
    apply(t)
    return t
  })

  useEffect(() => {
    apply(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* not fatal */ }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark'
    apply(next)
    return next
  }), [])
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const t = useContext(Ctx)
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>')
  return t
}
