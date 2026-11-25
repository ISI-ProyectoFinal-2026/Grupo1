import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import DeleteAccountDialog from '@/components/account/DeleteAccountDialog'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { CheckIcon } from '@/components/ui/icons'
import { useDeleteAccount } from '@/hooks/useDeleteAccount'
import { useExportAccount } from '@/hooks/useExportAccount'
import { useUpdateProfile } from '@/hooks/useUpdateProfile'
import { getApiErrorCode } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { TWO_FACTOR_CODE_REQUIRED } from '@/types/auth'
import type { AccountDeleteInput } from '@/types/auth'
import {
  getAccountDeleteErrorMessage,
  getExportErrorMessage,
  getProfileErrorMessage,
} from '@/lib/account'
import { getPhoneError } from '@/lib/phone'

const EXPORT_FILE_NAME = 'patitas-mis-datos.json'
const FULL_NAME_MAX_LENGTH = 100

function AccountPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const updateMutation = useUpdateProfile()
  const exportMutation = useExportAccount()
  const deleteMutation = useDeleteAccount()

  // datos personales
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // exportación y baja
  const [exportError, setExportError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [codeRequired, setCodeRequired] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  const needsCode = user?.twoFactorEnabled === true || codeRequired

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    setProfileError(null)

    const nextPhoneError = getPhoneError(phone)
    setPhoneError(nextPhoneError)
    if (nextPhoneError) return

    try {
      const updated = await updateMutation.mutateAsync({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
      })
      setFullName(updated.fullName ?? '')
      setPhone(updated.phone ?? '')
      setSaved(true)
    } catch (err) {
      setProfileError(getProfileErrorMessage(err))
    }
  }

  async function handleExport() {
    setExportError(null)
    try {
      const blob = await exportMutation.mutateAsync()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = EXPORT_FILE_NAME
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(getExportErrorMessage(err))
    }
  }

  function openDelete() {
    setDeleteError(null)
    setIsDeleteOpen(true)
  }

  function closeDelete() {
    setIsDeleteOpen(false)
    setDeleteError(null)
    deleteButtonRef.current?.focus()
  }

  async function handleDelete(input: AccountDeleteInput) {
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync(input)
    } catch (err) {
      // el store puede no saber del 2FA (sesión vieja): el backend lo pide
      if (getApiErrorCode(err) === TWO_FACTOR_CODE_REQUIRED) setCodeRequired(true)
      setDeleteError(getAccountDeleteErrorMessage(err))
      return
    }
    // la cuenta ya no existe: misma limpieza que el cierre de sesión
    logout()
    queryClient.clear()
    navigate('/login', { replace: true, state: { accountDeleted: true } })
  }

  return (
    <div className='px-4 py-5 sm:px-6 lg:py-8'>
      <div className='mx-auto flex max-w-xl flex-col gap-4'>
        <h1 className='font-display text-display-lg'>Mi cuenta</h1>

        <section aria-labelledby='account-profile-title' className='card p-4 sm:p-5'>
          <h2 id='account-profile-title' className='font-display text-display-sm text-ink'>
            Datos personales
          </h2>
          {user && <p className='mt-1 break-words text-sm text-ink-muted'>Email: {user.email}</p>}

          <form noValidate onSubmit={handleProfileSubmit} className='mt-4 flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <label htmlFor='accountFullName' className='field-label'>
                Nombre
              </label>
              <input
                id='accountFullName'
                type='text'
                autoComplete='name'
                maxLength={FULL_NAME_MAX_LENGTH}
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value)
                  setSaved(false)
                }}
                className='field'
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <label htmlFor='accountPhone' className='field-label'>
                Teléfono
              </label>
              <input
                id='accountPhone'
                type='tel'
                autoComplete='tel'
                inputMode='tel'
                placeholder='+54 9 351 555-5555'
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value)
                  setSaved(false)
                }}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={
                  phoneError ? 'accountPhoneHint accountPhoneError' : 'accountPhoneHint'
                }
                className='field'
              />
              <p id='accountPhoneHint' className='text-sm text-ink-muted'>
                Opcional. Aparece en el flyer de un reporte solo si lo autorizás al crearlo.
              </p>
              {phoneError && (
                <p id='accountPhoneError' className='text-sm font-bold text-danger'>
                  {phoneError}
                </p>
              )}
            </div>

            {profileError && <ErrorMessage message={profileError} />}

            <div className='flex flex-wrap items-center gap-3'>
              <Button type='submit' variant='primary' isLoading={updateMutation.isPending}>
                Guardar cambios
              </Button>
              {saved && (
                <span
                  role='status'
                  className='inline-flex items-center gap-1 text-sm font-bold text-success-ink'
                >
                  <CheckIcon className='h-5 w-5 shrink-0' />
                  Guardamos tus datos
                </span>
              )}
            </div>
          </form>
        </section>

        <section aria-labelledby='account-export-title' className='card p-4 sm:p-5'>
          <h2 id='account-export-title' className='font-display text-display-sm text-ink'>
            Tus datos
          </h2>
          <p className='mt-1 text-sm text-ink-muted'>
            Descargá una copia de los datos de tu cuenta en un archivo JSON.
          </p>
          <div className='mt-4 flex flex-col items-start gap-3'>
            <Button variant='secondary' isLoading={exportMutation.isPending} onClick={handleExport}>
              Descargar mis datos
            </Button>
            {exportError && <ErrorMessage message={exportError} />}
          </div>
        </section>

        <section aria-labelledby='account-delete-title' className='card p-4 sm:p-5'>
          <h2 id='account-delete-title' className='font-display text-display-sm text-ink'>
            Eliminar cuenta
          </h2>
          <p className='mt-1 text-sm text-ink-muted'>
            Se borran tu cuenta, tus mascotas, tus reportes, tus chats (también para la otra
            persona) y, si tenés, tu comercio con sus anuncios. No se puede deshacer.
          </p>
          <button
            ref={deleteButtonRef}
            type='button'
            onClick={openDelete}
            className={buttonClasses('danger', 'md', 'mt-4')}
          >
            Eliminar mi cuenta
          </button>
        </section>
      </div>

      {isDeleteOpen && (
        <DeleteAccountDialog
          needsCode={needsCode}
          isLoading={deleteMutation.isPending}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={closeDelete}
        />
      )}
    </div>
  )
}

export default AccountPage
