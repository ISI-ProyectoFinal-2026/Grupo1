import { useMutation } from '@tanstack/react-query'
import { exportAccount } from '@/services/auth.service'

export function useExportAccount() {
  // gcTime 0: los datos personales no quedan en la cache de mutaciones
  return useMutation({ mutationFn: () => exportAccount(), gcTime: 0 })
}
