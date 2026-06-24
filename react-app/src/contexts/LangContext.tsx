import React, { createContext, useContext, useState } from 'react'
import type { Lang } from '../types'
import { translations } from '../lib/translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LangContext = createContext<LangCtx | null>(null)

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'sw')

  function t(key: string): string {
    return translations[lang][key] ?? translations['en'][key] ?? key
  }

  function handleSetLang(l: Lang) {
    setLang(l)
    localStorage.setItem('lang', l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be inside LangProvider')
  return ctx
}
