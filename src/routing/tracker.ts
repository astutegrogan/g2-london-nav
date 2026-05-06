import type { Fix } from '../gps'
import type { LngLat, Route, Step } from './types'

export interface TrackerState {
  legIndex: number
  stepIndex: number
  distanceToNextManeuver: number
  distanceRemaining: number
  durationRemaining: number
  currentStep: Step
  nextStep: Step | null
  speedLimitMph: number | null
  offRouteSeconds: number
  arrived: boolean
}

const OFFROUTE_THRESHOLD_M = 30
const REROUTE_AFTER_SECONDS = 5
const ARRIVAL_THRESHOLD_M = 25

export class RouteTracker {
  private legIndex = 0
  private stepIndex = 0
  private offRouteSince: number | null = null
  private lastFix: Fix | null = null

  constructor(private route: Route) {}

  setRoute(route: Route) {
    this.route = route
    this.legIndex = 0
    this.stepIndex = 0
    this.offRouteSince = null
  }

  ingest(fix: Fix): TrackerState {
    this.lastFix = fix
    const leg = this.route.legs[this.legIndex]
    const here: LngLat = [fix.lng, fix.lat]

    while (this.stepIndex < leg.steps.length - 1) {
      const cur = leg.steps[this.stepIndex]
      const advance = projectAndAdvance(here, cur)
      if (advance.passedManeuver) this.stepIndex++
      else break
    }

    const currentStep = leg.steps[this.stepIndex]
    const nextStep = leg.steps[this.stepIndex + 1] ?? null
    const distToManeuver = distanceMeters(here, currentStep.maneuver.location)

    const polyDist = perpendicularDistance(here, currentStep.geometry.coordinates)
    if (polyDist > OFFROUTE_THRESHOLD_M) {
      if (this.offRouteSince === null) this.offRouteSince = fix.timestamp
    } else {
      this.offRouteSince = null
    }

    const offRouteSeconds = this.offRouteSince === null ? 0 : (fix.timestamp - this.offRouteSince) / 1000

    let distanceRemaining = distToManeuver
    let durationRemaining = currentStep.duration * (distToManeuver / Math.max(currentStep.distance, 1))
    for (let i = this.stepIndex + 1; i < leg.steps.length; i++) {
      distanceRemaining += leg.steps[i].distance
      durationRemaining += leg.steps[i].duration
    }

    const speedLimitMph = lookupSpeedLimit(here, leg)
    const arrived =
      this.stepIndex === leg.steps.length - 1 &&
      distToManeuver < ARRIVAL_THRESHOLD_M

    return {
      legIndex: this.legIndex,
      stepIndex: this.stepIndex,
      distanceToNextManeuver: distToManeuver,
      distanceRemaining,
      durationRemaining,
      currentStep,
      nextStep,
      speedLimitMph,
      offRouteSeconds,
      arrived,
    }
  }

  shouldReroute(state: TrackerState): boolean {
    return state.offRouteSeconds >= REROUTE_AFTER_SECONDS
  }

  lastPosition(): Fix | null {
    return this.lastFix
  }
}

function projectAndAdvance(here: LngLat, step: Step): { passedManeuver: boolean } {
  const target = step.maneuver.location
  const d = distanceMeters(here, target)
  return { passedManeuver: d < ARRIVAL_THRESHOLD_M }
}

function lookupSpeedLimit(here: LngLat, leg: { annotation?: { maxspeed?: any[] }; geometry: { coordinates: LngLat[] } }): number | null {
  const ms = leg.annotation?.maxspeed
  if (!ms || ms.length === 0) return null
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < leg.geometry.coordinates.length; i++) {
    const d = distanceMeters(here, leg.geometry.coordinates[i])
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  const segIdx = Math.min(Math.max(best - 1, 0), ms.length - 1)
  const entry = ms[segIdx]
  if (!entry) return null
  if (entry.unknown || entry.none) return null
  if (entry.speed == null) return null
  if (entry.unit === 'km/h') return Math.round(entry.speed * 0.621371)
  return Math.round(entry.speed)
}

function distanceMeters(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function perpendicularDistance(here: LngLat, line: LngLat[]): number {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    best = Math.min(best, segDist(here, line[i], line[i + 1]))
  }
  if (line.length === 1) best = distanceMeters(here, line[0])
  return best
}

function segDist(p: LngLat, a: LngLat, b: LngLat): number {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1], px = p[0], py = p[1]
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return distanceMeters(p, a)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const proj: LngLat = [ax + t * dx, ay + t * dy]
  return distanceMeters(p, proj)
}
