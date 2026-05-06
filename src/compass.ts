export class Compass {
  private current: number | null = null
  private gpsHeading: number | null = null
  private listening = false
  private permission: 'unknown' | 'granted' | 'denied' = 'unknown'

  async requestAndStart(): Promise<'granted' | 'denied' | 'unsupported'> {
    if (this.listening) return this.permission === 'denied' ? 'denied' : 'granted'
    const evtCtor = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    if (!evtCtor) return 'unsupported'
    if (typeof evtCtor.requestPermission === 'function') {
      try {
        const result = await evtCtor.requestPermission()
        if (result !== 'granted') {
          this.permission = 'denied'
          return 'denied'
        }
      } catch {
        this.permission = 'denied'
        return 'denied'
      }
    }
    this.permission = 'granted'
    window.addEventListener('deviceorientation', this.handle, true)
    this.listening = true
    return 'granted'
  }

  stop(): void {
    if (!this.listening) return
    window.removeEventListener('deviceorientation', this.handle, true)
    this.listening = false
  }

  setGpsHeading(h: number | null): void {
    this.gpsHeading = h != null && Number.isFinite(h) && h >= 0 ? h : null
  }

  heading(): number | null {
    return this.current ?? this.gpsHeading
  }

  private handle = (e: DeviceOrientationEvent) => {
    const wkc = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading
    if (typeof wkc === 'number') {
      this.current = wkc
      return
    }
    if (e.alpha != null) {
      this.current = (360 - e.alpha + 360) % 360
    }
  }
}
