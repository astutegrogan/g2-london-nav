import type { LngLat } from '../routing/types'
import type { MapFrame } from './types'

export const ZOOM_LEVELS = [0.15, 0.2, 0.3, 0.45, 0.65, 0.95]
export const DEFAULT_ZOOM_INDEX = 2

export async function renderMap(
  frame: MapFrame,
  w = 200,
  h = 100,
  pxPerMeter: number = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX],
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  const project = projector(frame.center, w, h, pxPerMeter)

  ctx.strokeStyle = '#80E080'
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const seg of frame.segments) {
    if (seg.coords.length < 2) continue
    ctx.beginPath()
    const first = project(seg.coords[0])
    ctx.moveTo(first[0], first[1])
    for (let i = 1; i < seg.coords.length; i++) {
      const p = project(seg.coords[i])
      ctx.lineTo(p[0], p[1])
    }
    ctx.stroke()
  }

  drawArrow(ctx, w / 2, h / 2, frame.headingDeg)
  drawBorder(ctx, w, h)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

function projector(center: LngLat, w: number, h: number, pxPerMeter: number) {
  const metersPerLng = 111320 * Math.cos((center[1] * Math.PI) / 180)
  return (p: LngLat): [number, number] => {
    const dxMeters = (p[0] - center[0]) * metersPerLng
    const dyMeters = (p[1] - center[1]) * 111320
    return [w / 2 + dxMeters * pxPerMeter, h / 2 - dyMeters * pxPerMeter]
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, headingDeg: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((headingDeg * Math.PI) / 180)
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(5, 6)
  ctx.lineTo(0, 3)
  ctx.lineTo(-5, 6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
}
