import type { LngLat, Route, Leg, Step, GeocodeResult, TransitMode } from './types'

interface ImportMetaWithEnv extends ImportMeta {
  env?: { VITE_TFL_APP_KEY?: string }
}

const APP_KEY = (import.meta as ImportMetaWithEnv).env?.VITE_TFL_APP_KEY ?? ''
const TFL_BASE = 'https://api.tfl.gov.uk'
const NOMINATIM = 'https://nominatim.openstreetmap.org'

// London bounding box for Nominatim
const LONDON_VIEWBOX = '-0.5103,51.2868,0.3340,51.6919'

export async function getJourney(from: LngLat, to: LngLat): Promise<Route> {
  const fromStr = `${from[1]},${from[0]}`
  const toStr = `${to[1]},${to[0]}`
  const params = new URLSearchParams({
    mode: 'tube,bus,walking,overground,elizabeth-line,dlr,national-rail,river-bus',
    nationalSearch: 'false',
    journeyPreference: 'leasttime',
  })
  if (APP_KEY) params.set('app_key', APP_KEY)
  const url = `${TFL_BASE}/Journey/JourneyResults/${encodeURIComponent(fromStr)}/to/${encodeURIComponent(toStr)}?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TfL journey ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const journey = data.journeys?.[0]
  if (!journey) throw new Error('No journey found')
  return normalizeJourney(journey)
}

function normalizeJourney(j: any): Route {
  const legs: Leg[] = j.legs.map(normalizeLeg)
  const allCoords = legs.flatMap(l => l.geometry.coordinates)
  return {
    distance: legs.reduce((s, l) => s + l.distance, 0),
    duration: legs.reduce((s, l) => s + l.duration, 0),
    legs,
    geometry: { type: 'LineString', coordinates: allCoords },
  }
}

function parsePath(lineString: string): LngLat[] {
  try {
    const raw: [number, number][] = JSON.parse(lineString)
    // TfL path.lineString is [[lon,lat],...] — already LngLat order
    return raw as LngLat[]
  } catch {
    return []
  }
}

function normalizeLeg(l: any): Leg {
  const mode: TransitMode = (l.mode?.id ?? 'walking') as TransitMode
  const durationSec = (l.duration ?? 0) * 60
  const distanceM = l.distance ?? 0
  const coords = parsePath(l.path?.lineString ?? '[]')
  const geometry = { type: 'LineString' as const, coordinates: coords }

  let steps: Step[]
  if (mode === 'walking') {
    steps = normalizeWalkingSteps(l, coords, durationSec, distanceM)
  } else {
    steps = normalizeTransitSteps(l, mode, coords, durationSec, distanceM)
  }

  return { distance: distanceM, duration: durationSec, steps, geometry }
}

function normalizeWalkingSteps(l: any, coords: LngLat[], totalDuration: number, totalDistance: number): Step[] {
  const instructionSteps: any[] = l.instruction?.steps ?? []
  if (instructionSteps.length === 0) {
    return [makeSingleWalkStep(l, coords, totalDuration, totalDistance)]
  }

  const steps: Step[] = instructionSteps.map((s: any, i: number) => {
    const loc: LngLat = [s.longitude ?? coords[0]?.[0] ?? 0, s.latitude ?? coords[0]?.[1] ?? 0]
    const dir = (s.turnDirection ?? 'straight').toLowerCase()
    const modifier = dirToModifier(dir)
    const isLast = i === instructionSteps.length - 1
    return {
      distance: s.distance ?? 0,
      duration: totalDuration / Math.max(instructionSteps.length, 1),
      geometry: { type: 'LineString', coordinates: [loc] },
      name: s.descriptionHeading ?? s.description ?? '',
      maneuver: {
        type: isLast ? 'arrive' : 'turn',
        modifier,
        instruction: s.description ?? '',
        location: loc,
      },
    }
  })

  // Ensure last step is 'arrive' at the arrival point
  if (steps.length > 0) {
    const lastCoord: LngLat = [l.arrivalPoint?.lon ?? 0, l.arrivalPoint?.lat ?? 0]
    steps.push({
      distance: 0,
      duration: 0,
      geometry: { type: 'LineString', coordinates: [lastCoord] },
      name: l.arrivalPoint?.commonName ?? '',
      maneuver: { type: 'arrive', modifier: 'straight', instruction: `Arrive at ${l.arrivalPoint?.commonName ?? 'destination'}`, location: lastCoord },
    })
  }

  return steps
}

function makeSingleWalkStep(l: any, coords: LngLat[], totalDuration: number, totalDistance: number): Step {
  const fromCoord: LngLat = [l.departurePoint?.lon ?? 0, l.departurePoint?.lat ?? 0]
  const toCoord: LngLat = [l.arrivalPoint?.lon ?? 0, l.arrivalPoint?.lat ?? 0]
  return {
    distance: totalDistance,
    duration: totalDuration,
    geometry: { type: 'LineString', coordinates: coords.length > 0 ? coords : [fromCoord, toCoord] },
    name: l.instruction?.summary ?? 'Walk',
    maneuver: {
      type: 'depart',
      modifier: 'straight',
      instruction: l.instruction?.summary ?? 'Walk',
      location: fromCoord,
    },
  }
}

function normalizeTransitSteps(l: any, mode: TransitMode, coords: LngLat[], totalDuration: number, totalDistance: number): Step[] {
  const fromStop = l.departurePoint?.commonName ?? ''
  const toStop = l.arrivalPoint?.commonName ?? ''
  const platform = l.departurePoint?.platformName ?? undefined
  const routeOpt = l.routeOptions?.[0]
  const lineName = routeOpt?.name ?? modeDisplayName(mode)
  const direction = routeOpt?.directions?.[0] ?? ''
  const stops: string[] = (l.path?.stopPoints ?? []).map((sp: any) => sp.name as string)
  const fromCoord: LngLat = [l.departurePoint?.lon ?? 0, l.departurePoint?.lat ?? 0]
  const toCoord: LngLat = [l.arrivalPoint?.lon ?? 0, l.arrivalPoint?.lat ?? 0]

  const transitInfo = { mode, lineName, direction, fromStop, toStop, platform, stops }

  const boardStep: Step = {
    distance: totalDistance,
    duration: totalDuration,
    geometry: { type: 'LineString', coordinates: coords.length > 0 ? coords : [fromCoord, toCoord] },
    name: lineName,
    maneuver: {
      type: 'board',
      modifier: 'straight',
      instruction: `${lineName}${direction ? ' towards ' + direction : ''} — board at ${fromStop}`,
      location: fromCoord,
    },
    transitInfo,
  }

  const alightStep: Step = {
    distance: 0,
    duration: 0,
    geometry: { type: 'LineString', coordinates: [toCoord] },
    name: toStop,
    maneuver: {
      type: 'alight',
      modifier: 'straight',
      instruction: `Alight at ${toStop}`,
      location: toCoord,
    },
    transitInfo,
  }

  return [boardStep, alightStep]
}

function dirToModifier(dir: string): import('./types').ManeuverModifier {
  const map: Record<string, import('./types').ManeuverModifier> = {
    left: 'left',
    right: 'right',
    'slight left': 'slight left',
    'slight right': 'slight right',
    'sharp left': 'sharp left',
    'sharp right': 'sharp right',
    uturn: 'uturn',
    straight: 'straight',
    continue: 'straight',
  }
  return map[dir] ?? 'straight'
}

function modeDisplayName(mode: TransitMode): string {
  const names: Record<TransitMode, string> = {
    walking: 'Walk',
    tube: 'Tube',
    bus: 'Bus',
    overground: 'London Overground',
    'elizabeth-line': 'Elizabeth line',
    dlr: 'DLR',
    'national-rail': 'National Rail',
    'river-bus': 'River Bus',
    'cable-car': 'Emirates Airline',
  }
  return names[mode] ?? mode
}

export async function geocode(query: string, proximity?: LngLat): Promise<GeocodeResult[]> {
  if (!query.trim()) return []

  const [stopResults, nominatimResults] = await Promise.allSettled([
    geocodeTflStops(query),
    geocodeNominatim(query, proximity),
  ])

  const stops = stopResults.status === 'fulfilled' ? stopResults.value : []
  const places = nominatimResults.status === 'fulfilled' ? nominatimResults.value : []

  // Deduplicate by proximity — stops first, then places
  const combined = [...stops, ...places]
  const seen = new Set<string>()
  return combined.filter(r => {
    const key = `${r.center[0].toFixed(4)},${r.center[1].toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 6)
}

async function geocodeTflStops(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    modes: 'tube,bus,overground,elizabeth-line,dlr,national-rail',
    maxResults: '4',
    includeHubs: 'true',
  })
  if (APP_KEY) params.set('app_key', APP_KEY)
  const url = `${TFL_BASE}/StopPoint/Search/${encodeURIComponent(query)}?${params}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.matches ?? []).map((m: any) => ({
    name: m.name,
    address: `${m.modes?.join(', ') ?? 'Stop'} · ${m.name}`,
    center: [m.lon, m.lat] as LngLat,
  }))
}

async function geocodeNominatim(query: string, proximity?: LngLat): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'gb',
    viewbox: LONDON_VIEWBOX,
    bounded: '1',
  })
  if (proximity) {
    // Nominatim doesn't support point proximity but viewbox biases results
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'g2-london-nav/1.0' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data as any[]).map((f: any) => ({
    name: f.namedetails?.name ?? f.display_name.split(',')[0],
    address: f.display_name,
    center: [parseFloat(f.lon), parseFloat(f.lat)] as LngLat,
  }))
}
