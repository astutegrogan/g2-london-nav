import { GlassesSurface } from './sdk'
import { TEXT_ZONES, IMAGE_ZONES, MAP_W, MAP_H } from './hud/layout'
import { HudLoop } from './hud/render'
import { pickGpsSource, classifyGeoError, type Fix, type GpsSource } from './gps'
import { getDirections } from './routing/mapbox'
import { RouteTracker, type TrackerState } from './routing/tracker'
import { SearchScreen } from './ui/search'
import { PreviewScreen, setScreen } from './ui/preview'
import { bindNavInputs } from './input'
import { Compass } from './compass'
import { RoadCache } from './map/roads'
import { renderMap, ZOOM_LEVELS, DEFAULT_ZOOM_INDEX } from './map/render'
import type { LngLat, Route, GeocodeResult } from './routing/types'

class App {
  private surface!: GlassesSurface
  private hud!: HudLoop
  private gps: GpsSource = pickGpsSource()
  private compass = new Compass()
  private roads = new RoadCache({ radiusMeters: 800, refreshThresholdMeters: 300 })
  private lastFix: Fix | null = null
  private tracker: RouteTracker | null = null
  private trackerState: TrackerState | null = null
  private destination: GeocodeResult | null = null
  private route: Route | null = null
  private rerouting = false
  private unbindGlassesInput: (() => void) | null = null
  private locStatus!: HTMLElement
  private locBtn!: HTMLButtonElement
  private mapTimer: number | null = null
  private mapInflight = false
  private lastMapHeading: number | null = null
  private lastMapCenter: LngLat | null = null
  private zoomIndex = DEFAULT_ZOOM_INDEX

  async boot() {
    this.surface = await GlassesSurface.open(TEXT_ZONES, IMAGE_ZONES)
    this.hud = new HudLoop(this.surface, () => {
      if (!this.trackerState) return null
      return { state: this.trackerState, fix: this.lastFix }
    })

    this.locStatus = document.getElementById('loc-status')!
    this.locBtn = document.getElementById('loc-btn') as HTMLButtonElement
    this.locBtn.addEventListener('click', () => void this.requestLocation())

    this.gps.start(fix => this.onFix(fix))

    new SearchScreen(document.getElementById('screen-search')!, {
      onPick: r => void this.previewRoute(r),
    }, () => (this.lastFix ? [this.lastFix.lng, this.lastFix.lat] : null))

    new PreviewScreen(document.getElementById('screen-preview')!, {
      onStart: () => void this.startNav(),
      onBack: () => setScreen('search'),
    })

    document.getElementById('cancel-btn')!.addEventListener('click', () => this.endNav())

    this.hud.showMessage('Pick a destination on your phone.', 'Car Nav', '')
  }

  private onFix(fix: Fix) {
    this.lastFix = fix
    this.compass.setGpsHeading(fix.heading)
    this.setLocStatus('ok', `Location active · ±${Math.round(fix.accuracy)}m`)
    if (this.tracker) {
      this.trackerState = this.tracker.ingest(fix)
      if (this.trackerState.arrived) this.handleArrived()
      else if (this.tracker.shouldReroute(this.trackerState)) void this.reroute()
    }
  }

  private async requestLocation() {
    this.locBtn.disabled = true
    this.setLocStatus('warn', 'Locating…')
    try {
      const fix = await this.gps.requestNow()
      this.onFix(fix)
    } catch (err) {
      const e = classifyGeoError(err as GeolocationPositionError | Error)
      this.setLocStatus('err', e.message)
    } finally {
      this.locBtn.disabled = false
    }
  }

  private setLocStatus(kind: 'ok' | 'warn' | 'err', text: string) {
    this.locStatus.classList.remove('ok', 'warn', 'err')
    this.locStatus.classList.add(kind)
    this.locStatus.textContent = text
  }

  private async previewRoute(dest: GeocodeResult) {
    if (!this.lastFix) {
      this.setLocStatus('err', 'Location required. Tap "Pull Current Location" above.')
      return
    }
    const from: LngLat = [this.lastFix.lng, this.lastFix.lat]
    try {
      this.route = await getDirections(from, dest.center)
      this.destination = dest
      const screen = document.getElementById('screen-preview')!
      const preview = new PreviewScreen(screen, {
        onStart: () => void this.startNav(),
        onBack: () => setScreen('search'),
      })
      preview.show(dest, this.route)
      setScreen('preview')
    } catch (e) {
      alert(`Route error: ${(e as Error).message}`)
    }
  }

  private async startNav() {
    if (!this.route) return
    this.tracker = new RouteTracker(this.route)
    if (this.lastFix) this.trackerState = this.tracker.ingest(this.lastFix)
    setScreen('nav')

    const compassResult = await this.compass.requestAndStart()
    if (compassResult !== 'granted') {
      console.warn('[compass]', compassResult, '— falling back to GPS heading')
    }

    this.hud.start(2)
    this.startMapLoop()
    this.unbindGlassesInput = bindNavInputs(this.surface, {
      onCancelRoute: () => this.endNav(),
      onZoomIn: () => this.zoom(+1),
      onZoomOut: () => this.zoom(-1),
    })
  }

  private endNav() {
    this.hud.stop()
    this.stopMapLoop()
    this.compass.stop()
    this.tracker = null
    this.trackerState = null
    this.route = null
    this.destination = null
    this.unbindGlassesInput?.()
    this.unbindGlassesInput = null
    setScreen('search')
    this.hud.showMessage('Pick a destination on your phone.', 'Car Nav', '')
  }

  private handleArrived() {
    this.hud.showMessage('Arrived', 'You have arrived', '')
    this.tracker = null
  }

  private async reroute() {
    if (this.rerouting || !this.lastFix || !this.destination) return
    this.rerouting = true
    try {
      const from: LngLat = [this.lastFix.lng, this.lastFix.lat]
      const r = await getDirections(from, this.destination.center)
      this.route = r
      this.tracker?.setRoute(r)
    } catch (e) {
      console.error('[reroute]', e)
    } finally {
      this.rerouting = false
    }
  }

  private zoom(delta: number) {
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, this.zoomIndex + delta))
    if (next === this.zoomIndex) return
    this.zoomIndex = next
    this.lastMapCenter = null
    this.lastMapHeading = null
    void this.tickMap()
  }

  private startMapLoop() {
    void this.tickMap()
    this.mapTimer = window.setInterval(() => void this.tickMap(), 2000)
  }

  private stopMapLoop() {
    if (this.mapTimer !== null) window.clearInterval(this.mapTimer)
    this.mapTimer = null
  }

  private async tickMap() {
    if (this.mapInflight || !this.lastFix) return
    const center: LngLat = [this.lastFix.lng, this.lastFix.lat]
    const heading = this.compass.heading() ?? 0

    if (this.lastMapCenter && this.lastMapHeading != null) {
      const movedTrivially = haversineMeters(this.lastMapCenter, center) < 5
      const turnedTrivially = Math.abs(angleDelta(this.lastMapHeading, heading)) < 5
      if (movedTrivially && turnedTrivially) return
    }

    this.mapInflight = true
    try {
      const segments = await this.roads.update(center)
      const bytes = await renderMap(
        { center, headingDeg: heading, segments },
        MAP_W,
        MAP_H,
        ZOOM_LEVELS[this.zoomIndex],
      )
      await this.surface.pushImage('map', bytes)
      this.lastMapCenter = center
      this.lastMapHeading = heading
    } catch (e) {
      console.error('[map]', e)
    } finally {
      this.mapInflight = false
    }
  }
}

function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function angleDelta(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180
  if (d <= -180) d += 360
  return d
}

new App().boot().catch(err => {
  console.error('[boot]', err)
  const root = document.getElementById('app')
  if (root) root.textContent = `Boot failed: ${(err as Error).message}`
})
