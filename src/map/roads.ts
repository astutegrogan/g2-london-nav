import type { LngLat } from '../routing/types'
import type { RoadSegment } from './types'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export async function fetchRoads(center: LngLat, radiusMeters = 800): Promise<RoadSegment[]> {
  const dLat = radiusMeters / 111320
  const dLng = radiusMeters / (111320 * Math.cos((center[1] * Math.PI) / 180))
  const south = center[1] - dLat
  const north = center[1] + dLat
  const west = center[0] - dLng
  const east = center[0] + dLng
  const exclude = 'footway|cycleway|path|steps|pedestrian|service|track|bridleway|corridor|elevator'
  const q = `[out:json][timeout:8];way["highway"]["highway"!~"${exclude}"](${south},${west},${north},${east});out geom;`
  const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const elements = (data.elements ?? []) as Array<{ geometry?: Array<{ lon: number; lat: number }> }>
  return elements
    .map(w => ({ coords: (w.geometry ?? []).map(g => [g.lon, g.lat] as LngLat) }))
    .filter(s => s.coords.length >= 2)
}

export class RoadCache {
  private last: { center: LngLat; segments: RoadSegment[] } | null = null
  private inflight: Promise<RoadSegment[]> | null = null
  private fetchRadius: number
  private refreshThreshold: number

  constructor(opts: { radiusMeters?: number; refreshThresholdMeters?: number } = {}) {
    this.fetchRadius = opts.radiusMeters ?? 800
    this.refreshThreshold = opts.refreshThresholdMeters ?? 300
  }

  current(): RoadSegment[] {
    return this.last?.segments ?? []
  }

  async update(center: LngLat): Promise<RoadSegment[]> {
    if (this.last && distanceMeters(this.last.center, center) < this.refreshThreshold) {
      return this.last.segments
    }
    if (this.inflight) return this.inflight
    this.inflight = fetchRoads(center, this.fetchRadius)
      .then(segs => {
        this.last = { center, segments: segs }
        return segs
      })
      .finally(() => {
        this.inflight = null
      })
    try {
      return await this.inflight
    } catch (err) {
      console.error('[roads]', err)
      return this.last?.segments ?? []
    }
  }
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
