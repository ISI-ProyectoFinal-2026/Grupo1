import { useCallback } from 'react'

// publica el alto de la barra de acciones pegada abajo para que el botón de ayuda quede encima
export function useHelpBarOffset() {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return
    const root = document.documentElement
    const apply = () => root.style.setProperty('--help-bar-h', `${el.offsetHeight}px`)
    apply()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--help-bar-h')
    }
  }, [])
}
