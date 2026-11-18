// valores segun modelo Notification de Prisma
export type NotificationType =
  'match_suggested' | 'match_confirmed' | 'message' | 'report_status_change' | 'nearby_report' | 'role_change'
  | 'inactivity_warning' | 'inactivity_closed'

export interface NotificationDTO {
  id: number
  userId: number
  type: NotificationType | null
  title: string | null
  message: string | null
  reportId: number | null
  isRead: boolean
  createdAt: string
}
