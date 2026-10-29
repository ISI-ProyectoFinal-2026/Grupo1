export type LocationConsentStatus = 'accepted' | 'declined'
export type NearbyReportType = 'lost' | 'found' | 'both'

export interface UserLocationDTO {
  latitude: number
  longitude: number
  updatedAt: string
}

export interface NotificationPreferencesDTO {
  notifyMatch: boolean
  notifyMessage: boolean
  notifyStatusChange: boolean
  notifyNearby: boolean
  nearbyRadiusKm: number
  nearbyReportType: NearbyReportType
  // null = nunca se le preguntó
  locationConsentStatus: LocationConsentStatus | null
  locationConsentAt: string | null
  location: UserLocationDTO | null
}

export interface UpdateLocationInput {
  latitude: number
  longitude: number
}
