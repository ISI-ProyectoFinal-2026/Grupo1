export type ReportType = 'lost' | 'found'
export type ReportStatus = 'pending' | 'published' | 'rejected' | 'resolved'

export interface ReportLocation {
  lat: number
  lng: number
}

export interface ReportDTO {
  id: number
  userId: number
  petId: number | null
  reportType: ReportType
  status: ReportStatus
  title: string
  description: string | null
  imageUrl: string | null
  customFlyerUrl: string | null
  locationAddress: string | null
  location: ReportLocation | null
  tag: { label: string; color: string }
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type MatchStatus = 'pending' | 'confirmed' | 'rejected'

export interface MatchDTO {
  matchId: number
  reportId: number
  title: string
  imageUrl: string | null
  reportType: ReportType
  similarityScore: number | null
  status: MatchStatus
  createdAt: string
}

export interface MatchDecisionDTO {
  matchId: number
  status: MatchStatus
  confirmedAt: string | null
}

export interface CreateReportInput {
  petId?: number
  reportType: ReportType
  title: string
  description?: string
  imageUrl?: string
  location: ReportLocation
  locationAddress?: string
}

export interface ListReportsQuery {
  type?: ReportType
  status?: ReportStatus
  breed?: string
  zone?: string
  dateFrom?: string
  dateTo?: string
  order?: 'asc' | 'desc'
}
