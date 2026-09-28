import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Input from '@/components/ui/Input'

describe('Input', () => {
  it('asocia el label con el campo usando el id', () => {
    render(<Input label='Zona' id='filter-zone' />)

    expect(screen.getByLabelText('Zona')).toHaveAttribute('id', 'filter-zone')
  })

  // Sin este fallback, un campo declarado solo con `name` queda sin asociar y
  // deja de ser accesible por label.
  it('cae al name cuando no le pasan id', () => {
    render(<Input label='Teléfono' name='phone' />)

    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('id', 'phone')
  })

  it('muestra el hint cuando no hay error', () => {
    render(<Input label='Email' name='email' hint='Te mandamos un aviso acá' />)

    expect(screen.getByText('Te mandamos un aviso acá')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false')
  })

  it('reemplaza el hint por el error y marca el campo como invalido', () => {
    render(<Input label='Email' name='email' hint='Te mandamos un aviso acá' error='Email inválido' />)

    expect(screen.getByText('Email inválido')).toBeInTheDocument()
    expect(screen.queryByText('Te mandamos un aviso acá')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('reenvia los eventos al input nativo', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input label='Zona' name='zone' onChange={onChange} />)

    await user.type(screen.getByLabelText('Zona'), 'Guemes')

    expect(onChange).toHaveBeenCalled()
  })
})
