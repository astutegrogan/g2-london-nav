import type { LngLat, Route, GeocodeResult, Leg, Step } from './types'

const TOKEN = (import.meta as ImportMetaWithEnv).env?.VITE_MAPBOX_TOKEN
if (!TOKEN) console.warn('[mapbox] VITE_MAPBOX_TOKEN missing — set it in .env.local')

interface ImportMetaWithEnv extends ImportMeta {
  env?: { VITE_MAPBOX_TOKEN?: string }
}

export async function getDirections(from: LngLat, to: LngLat): Promise<Route> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`
  const params = new URLSearchParams({
    access_token: TOKEN ?? '',
    steps: 'true',
    banner_instructions: 'true',
    voice_instructions: 'true',
    geometries: 'geojson',
    overview: 'full',
    annotations: 'maxspeed,speed,duration',
    language: 'en',
    voice_units: 'imperial',
  })
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapbox directions ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const r = data.routes?.[0]
  if (!r) throw new Error('No route returned')
  return normalizeRoute(r)
}

function normalizeRoute(r: any): Route {
  return {
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry,
    legs: r.legs.map(normalizeLeg),
  }
}

function normalizeLeg(l: any): Leg {
  return {
    distance: l.distance,
    duration: l.duration,
    annotation: l.annotation,
    steps: l.steps.map(normalizeStep),
    geometry: combineStepGeometries(l.steps),
  }
}

function normalizeStep(s: any): Step {
  return {
    distance: s.distance,
    duration: s.duration,
    geometry: s.geometry,
    name: s.name ?? '',
    maneuver: s.maneuver,
    bannerInstructions: s.bannerInstructions,
    voiceInstructions: s.voiceInstructions,
  }
}

function combineStepGeometries(steps: any[]): { coordinates: LngLat[]; type: 'LineString' } {
  const coords: LngLat[] = []
  for (const s of steps) {
    for (const c of s.geometry?.coordinates ?? []) {
      if (coords.length === 0 || coords[coords.length - 1][0] !== c[0] || coords[coords.length - 1][1] !== c[1]) {
        coords.push(c as LngLat)
      }
    }
  }
  return { coordinates: coords, type: 'LineString' }
}

export async function geocode(query: string, proximity?: LngLat): Promise<GeocodeResult[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({
    access_token: TOKEN ?? '',
    limit: '5',
    autocomplete: 'true',
    types: 'address,poi,place,locality,neighborhood',
  })
  if (proximity) params.set('proximity', `${proximity[0]},${proximity[1]}`)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapbox geocode ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.features ?? []).map((f: any) => ({
    name: f.text,
    address: f.place_name,
    center: f.center as LngLat,
  }))
}
