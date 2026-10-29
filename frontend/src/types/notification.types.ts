// valores segun modelo Notification de Prisma
export type NotificationType =
  'match_suggested' | 'message' | 'report_status_change' | 'nearby_report'

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
