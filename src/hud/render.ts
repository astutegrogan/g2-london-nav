import type { GlassesSurface } from '../sdk'
import type { TrackerState } from '../routing/tracker'
import type { Fix } from '../gps'
import { arrowFor } from './arrows'
import { eta, durationToMin, metersToDisplay, mpsToMph, truncate } from './format'

export interface HudInputs {
  state: TrackerState
  fix: Fix | null
}

export function buildFrame({ state, fix }: HudInputs): Record<string, string> {
  const arrow = arrowFor(state.currentStep.maneuver.type, state.currentStep.maneuver.modifier)
  const street = truncate(state.currentStep.name || state.currentStep.maneuver.instruction, 28)

  const speed = mpsToMph(fix?.speedMps ?? null)
  const limit = state.speedLimitMph
  const speedField = speed == null ? '' : limit == null ? `${speed} mph` : `${speed}/${limit} mph`

  const header = [
    eta(state.durationRemaining),
    durationToMin(state.durationRemaining),
    metersToDisplay(state.distanceRemaining),
    speedField,
  ]
    .filter(s => s.length > 0)
    .join(' · ')

  const maneuverLine1 = `${arrow}  ${metersToDisplay(state.distanceToNextManeuver)}`
  const maneuverLine2 = street
  const maneuver = `${maneuverLine1}\n${maneuverLine2}`

  let thenNext = ''
  if (state.nextStep) {
    const a2 = arrowFor(state.nextStep.maneuver.type, state.nextStep.maneuver.modifier)
    const s2 = truncate(state.nextStep.name || state.nextStep.maneuver.instruction, 30)
    thenNext = `then ${a2}  ${s2}`
  }

  return { header, maneuver, thennext: thenNext }
}

export class HudLoop {
  private last: Record<string, string> = {}
  private timer: number | null = null

  constructor(private surface: GlassesSurface, private getInputs: () => HudInputs | null) {}

  start(hz = 2) {
    this.tick()
    this.timer = window.setInterval(() => this.tick(), 1000 / hz)
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    const inputs = this.getInputs()
    if (!inputs) return
    const next = buildFrame(inputs)
    const diff: Record<string, string> = {}
    for (const [k, v] of Object.entries(next)) {
      if (this.last[k] !== v) diff[k] = v
    }
    if (Object.keys(diff).length === 0) return
    this.last = { ...this.last, ...diff }
    this.surface.update(diff).catch(err => console.error('[hud] update failed', err))
  }

  showMessage(maneuver: string, header = '', thennext = '') {
    const next = { header, maneuver, thennext }
    this.last = { ...this.last, ...next }
    this.surface.update(next).catch(err => console.error('[hud] update failed', err))
  }
}
