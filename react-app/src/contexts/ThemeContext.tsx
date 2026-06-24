import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || saved === 'light' ? saved : 'light'
  })

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
