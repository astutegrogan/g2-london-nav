import type { LngLat } from '../routing/types'

export interface RoadSegment {
  coords: LngLat[]
}

export interface MapFrame {
  center: LngLat
  headingDeg: number
  segments: RoadSegment[]
}
