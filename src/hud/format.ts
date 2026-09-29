export function metersToDisplay(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
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
