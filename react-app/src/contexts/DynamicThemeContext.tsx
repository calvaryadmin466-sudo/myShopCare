import React, { createContext, useContext, useEffect, useState } from 'react'
import { useBusiness } from './BusinessContext'

interface DynamicThemeCtx {
  businessThemeColor: string | null
  applyBusinessTheme: () => void
  resetTheme: () => void
}

const DynamicThemeContext = createContext<DynamicThemeCtx | null>(null)

export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const { currentBusiness } = useBusiness()
  const [businessThemeColor, setBusinessThemeColor] = useState<string | null>(null)
  const [originalAccent, setOriginalAccent] = useState<string>('')

  // Store original accent color
  useEffect(() => {
    const root = document.documentElement
    const original = getComputedStyle(root).getPropertyValue('--accent').trim()
    setOriginalAccent(original)
  }, [])

  // Apply business theme color
  const applyBusinessTheme = () => {
    if (currentBusiness?.theme_color) {
      const root = document.documentElement
      root.style.setProperty('--accent', currentBusiness.theme_color)
      
      // Calculate lighter variant for accent-light
      const lightVariant = `${currentBusiness.theme_color}1A` // 10% opacity
      root.style.setProperty('--accent-light', lightVariant)
      
      // Calculate darker variant for accent2
      const darkerVariant = adjustColorBrightness(currentBusiness.theme_color, -20)
      root.style.setProperty('--accent2', darkerVariant)
      
      setBusinessThemeColor(currentBusiness.theme_color)
    }
  }

  // Reset to original theme
  const resetTheme = () => {
    const root = document.documentElement
    root.style.setProperty('--accent', originalAccent)
    root.style.setProperty('--accent-light', `${originalAccent}2E`) // ~18% opacity
    root.style.setProperty('--accent2', adjustColorBrightness(originalAccent, -20))
    setBusinessThemeColor(null)
  }

  // Auto-apply theme when business changes
  useEffect(() => {
    if (currentBusiness?.theme_color) {
      applyBusinessTheme()
    } else {
      resetTheme()
    }
  }, [currentBusiness?.theme_color])

  return (
    <DynamicThemeContext.Provider value={{ businessThemeColor, applyBusinessTheme, resetTheme }}>
      {children}
    </DynamicThemeContext.Provider>
  )
}

export function useDynamicTheme() {
  const ctx = useContext(DynamicThemeContext)
  if (!ctx) throw new Error('useDynamicTheme must be used inside DynamicThemeProvider')
  return ctx
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, amount: number): string {
  const color = hex.replace('#', '')
  const num = parseInt(color, 16)
  
  let r = (num >> 16) + amount
  let g = ((num >> 8) & 0x00FF) + amount
  let b = (num & 0x0000FF) + amount
  
  r = Math.max(Math.min(255, r), 0)
  g = Math.max(Math.min(255, g), 0)
  b = Math.max(Math.min(255, b), 0)
  
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}
