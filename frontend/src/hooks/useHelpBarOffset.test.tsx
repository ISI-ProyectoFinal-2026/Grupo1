import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHelpBarOffset } from '@/hooks/useHelpBarOffset'

function Bar() {
  return <aside ref={useHelpBarOffset()}>barra</aside>
}

const root = () => document.documentElement.style.getPropertyValue('--help-bar-h')

function setHeight(value: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value })
}

describe('useHelpBarOffset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
  })

  it('publica el alto de la barra y lo actualiza al cambiar', () => {
    setHeight(96)
    let notify: () => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe() {}
        disconnect = disconnect
      }
    )

    const { unmount } = render(<Bar />)
    expect(root()).toBe('96px')

    setHeight(120)
    notify()
    expect(root()).toBe('120px')

    unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(root()).toBe('')
  })

  it('funciona sin ResizeObserver', () => {
    setHeight(50)
    const { unmount } = render(<Bar />)
    expect(root()).toBe('50px')
    unmount()
    expect(root()).toBe('')
  })
})
