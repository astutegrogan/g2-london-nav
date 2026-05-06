export interface Fix {
  lat: number
  lng: number
  heading: number | null
  speedMps: number | null
  accuracy: number
  timestamp: number
}

export type FixListener = (fix: Fix) => void

export type GpsErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'unknown'

export interface GpsError {
  kind: GpsErrorKind
  message: string
}

export interface GpsSource {
  start(cb: FixListener): void
  stop(): void
  requestNow(): Promise<Fix>
  restart(): void
}

function mapPosition(pos: GeolocationPosition): Fix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
    speedMps: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  }
}

export function classifyGeoError(err: GeolocationPositionError | Error): GpsError {
  if ('code' in err) {
    if (err.code === 1) return { kind: 'denied', message: 'Location permission denied. Enable it in iOS Settings → Even Realities → Location.' }
    if (err.code === 2) return { kind: 'unavailable', message: 'Location unavailable. Check that location services are on.' }
    if (err.code === 3) return { kind: 'timeout', message: 'Timed out waiting for a GPS fix. Try again outdoors.' }
  }
  return { kind: 'unknown', message: err.message || 'Unknown location error.' }
}

export function liveGps(): GpsSource {
  let watchId: number | null = null
  let listener: FixListener | null = null

  const beginWatch = () => {
    if (!('geolocation' in navigator)) {
      console.error('[gps] navigator.geolocation unavailable')
      return
    }
    if (!listener) return
    watchId = navigator.geolocation.watchPosition(
      pos => listener?.(mapPosition(pos)),
      err => console.error('[gps]', err.code, err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    )
  }

  return {
    start(cb) {
      listener = cb
      beginWatch()
    },
    stop() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      watchId = null
    },
    restart() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      watchId = null
      beginWatch()
    },
    requestNow() {
      return new Promise<Fix>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('Geolocation not supported in this WebView.'))
          return
        }
        navigator.geolocation.getCurrentPosition(
          pos => {
            const fix = mapPosition(pos)
            listener?.(fix)
            if (watchId === null) beginWatch()
            resolve(fix)
          },
          err => reject(err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        )
      })
    },
  }
}

export interface MockTrackPoint {
  lat: number
  lng: number
  heading?: number
  speedMps?: number
}

export function mockGps(track: MockTrackPoint[], hz = 1): GpsSource {
  let timer: number | null = null
  let i = 0
  let listener: FixListener | null = null

  const fixAt = (idx: number): Fix => {
    const p = track[Math.min(Math.max(idx, 0), track.length - 1)]
    return {
      lat: p.lat,
      lng: p.lng,
      heading: p.heading ?? null,
      speedMps: p.speedMps ?? null,
      accuracy: 5,
      timestamp: Date.now(),
    }
  }

  const tick = () => {
    if (!listener) return
    if (i >= track.length) return
    listener(fixAt(i))
    i++
  }

  const begin = () => {
    tick()
    timer = window.setInterval(tick, 1000 / hz)
  }

  return {
    start(cb) {
      listener = cb
      begin()
    },
    stop() {
      if (timer !== null) window.clearInterval(timer)
      timer = null
    },
    restart() {
      if (timer !== null) window.clearInterval(timer)
      timer = null
      i = 0
      begin()
    },
    requestNow() {
      const fix = fixAt(i)
      listener?.(fix)
      return Promise.resolve(fix)
    },
  }
}

export function pickGpsSource(): GpsSource {
  const mode = (import.meta as ImportMetaWithEnv).env?.VITE_GPS_MODE
  if (mode === 'mock') {
    return mockGps([
      { lat: 42.6875, lng: -83.4366, heading: 90, speedMps: 13 },
      { lat: 42.6877, lng: -83.4358, heading: 90, speedMps: 14 },
      { lat: 42.6879, lng: -83.4350, heading: 90, speedMps: 14 },
    ], 1)
  }
  return liveGps()
}

interface ImportMetaWithEnv extends ImportMeta {
  env?: { VITE_GPS_MODE?: string }
}
