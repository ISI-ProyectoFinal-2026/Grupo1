import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// con globals:false el cleanup automatico de RTL no se registra solo
afterEach(() => {
  cleanup()
})
