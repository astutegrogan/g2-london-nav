export type LngLat = [number, number]

export type TransitMode =
  | 'walking'
  | 'tube'
  | 'bus'
  | 'overground'
  | 'elizabeth-line'
  | 'dlr'
  | 'national-rail'
  | 'river-bus'
  | 'cable-car'

export type ManeuverType =
  | 'turn'
  | 'depart'
  | 'arrive'
  | 'board'
  | 'alight'
  | 'merge'
  | 'on ramp'
  | 'off ramp'
  | 'fork'
  | 'end of road'
  | 'continue'
  | 'roundabout'
  | 'rotary'
  | 'roundabout turn'
  | 'notification'
  | 'exit roundabout'
  | 'exit rotary'

export type ManeuverModifier =
  | 'uturn'
  | 'sharp right'
  | 'right'
  | 'slight right'
  | 'straight'
  | 'slight left'
  | 'left'
  | 'sharp left'

export interface TransitInfo {
  mode: TransitMode
  lineName: string
  direction: string
  fromStop: string
  toStop: string
  platform?: string
  stops?: string[]
}

export interface Step {
  distance: number
  duration: number
  geometry: { coordinates: LngLat[]; type: 'LineString' }
  name: string
  maneuver: {
    type: ManeuverType
    modifier?: ManeuverModifier
    instruction: string
    location: LngLat
    bearing_after?: number
    bearing_before?: number
  }
  transitInfo?: TransitInfo
  bannerInstructions?: BannerInstruction[]
  voiceInstructions?: VoiceInstruction[]
}

export interface BannerInstruction {
  distanceAlongGeometry: number
  primary: { text: string; type?: string; modifier?: string }
  secondary?: { text: string }
}

export interface VoiceInstruction {
  distanceAlongGeometry: number
  announcement: string
  ssmlAnnouncement?: string
}

export interface Leg {
  distance: number
  duration: number
  steps: Step[]
  geometry: { coordinates: LngLat[]; type: 'LineString' }
}

export interface Route {
  distance: number
  duration: number
  legs: Leg[]
  geometry: { coordinates: LngLat[]; type: 'LineString' }
}

export interface GeocodeResult {
  name: string
  address: string
  center: LngLat
}
