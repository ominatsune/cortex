import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemeMode } from '@cortex/core'

interface ThemeContextValue {
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  children,
  vaultReady,
}: {
  children: ReactNode
  vaultReady: boolean
}) {
  const [theme, setThemeState] = useState<ThemeMode>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!vaultReady) return
    window.cortex.settings.getTheme().then(setThemeState).catch(() => {})
  }, [vaultReady])

  const setTheme = useCallback(
    async (next: ThemeMode) => {
      setThemeState(next)
      if (vaultReady) {
        try {
          await window.cortex.settings.setTheme(next)
        } catch {
          // vault may not be ready yet
        }
      }
    },
    [vaultReady]
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
