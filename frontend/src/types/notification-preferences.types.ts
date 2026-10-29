export type LocationConsentStatus = 'accepted' | 'declined'
export type NearbyRadiusKm = 1 | 2 | 5 | 10
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
  nearbyRadiusKm: NearbyRadiusKm
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

// actualización parcial: al menos un campo
export type NotificationPreferencesInput = Partial<
  Pick<
    NotificationPreferencesDTO,
    | 'notifyMatch'
    | 'notifyMessage'
    | 'notifyStatusChange'
    | 'notifyNearby'
    | 'nearbyRadiusKm'
    | 'nearbyReportType'
  >
>
