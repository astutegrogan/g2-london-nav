export function metersToDisplay(m: number): string {
  if (!Number.isFinite(m)) return '—'
  const ft = m * 3.28084
  if (ft < 1000) return `${Math.round(ft / 50) * 50} ft`
  const mi = m / 1609.344
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

export function metersToDisplayShort(m: number): string {
  if (!Number.isFinite(m)) return '—'
  const ft = m * 3.28084
  if (ft < 1000) return `${Math.round(ft / 50) * 50}ft`
  const mi = m / 1609.344
  if (mi < 10) return `${mi.toFixed(1)}mi`
  return `${Math.round(mi)}mi`
}

export function mpsToMph(mps: number | null): number | null {
  if (mps == null || !Number.isFinite(mps) || mps < 0) return null
  return Math.round(mps * 2.23694)
}

export function durationToMin(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${h}h ${r}m`
}

export function eta(durationSeconds: number, now = new Date()): string {
  const arrive = new Date(now.getTime() + durationSeconds * 1000)
  let h = arrive.getHours()
  const m = arrive.getMinutes()
  const ampm = h >= 12 ? 'p' : 'a'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')}${ampm}`
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, Math.max(0, max - 1)) + '…'
}
