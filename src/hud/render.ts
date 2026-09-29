import type { GlassesSurface } from '../sdk'
import type { TrackerState } from '../routing/tracker'
import type { Fix } from '../gps'
import { arrowFor, transitIcon } from './arrows'
import { eta, durationToMin, metersToDisplay, truncate } from './format'

export interface HudInputs {
  state: TrackerState
  fix: Fix | null
}

export function buildFrame({ state }: HudInputs): Record<string, string> {
  const { currentStep, nextStep } = state

  const header = [
    eta(state.durationRemaining),
    durationToMin(state.durationRemaining),
    metersToDisplay(state.distanceRemaining),
  ].join(' · ')

  let maneuver: string
  let thenNext = ''

  if (currentStep.transitInfo) {
    const t = currentStep.transitInfo
    const icon = transitIcon(t.mode)

    if (currentStep.maneuver.type === 'board') {
      const line1 = `${icon}  ${truncate(t.lineName, 22)}`
      const line2 = t.direction ? `towards ${truncate(t.direction, 24)}` : `board at ${truncate(t.fromStop, 22)}`
      maneuver = `${line1}\n${line2}`
      if (t.stops && t.stops.length > 0) {
        const stopCount = t.stops.length
        thenNext = `alight at ${truncate(t.toStop, 20)} (${stopCount} stop${stopCount !== 1 ? 's' : ''})`
      } else {
        thenNext = `alight at ${truncate(t.toStop, 28)}`
      }
    } else {
      // alight
      const dist = metersToDisplay(state.distanceToNextManeuver)
      maneuver = `◎  ${truncate(t.toStop, 26)}\n${dist}`
    }
  } else {
    const arrow = arrowFor(currentStep.maneuver.type, currentStep.maneuver.modifier)
    const street = truncate(currentStep.name || currentStep.maneuver.instruction, 28)
    const dist = metersToDisplay(state.distanceToNextManeuver)
    maneuver = `${arrow}  ${dist}\n${street}`
  }

  if (!thenNext && nextStep) {
    if (nextStep.transitInfo && nextStep.maneuver.type === 'board') {
      const t = nextStep.transitInfo
      const icon = transitIcon(t.mode)
      thenNext = `then ${icon}  ${truncate(t.lineName, 22)}`
    } else if (!nextStep.transitInfo) {
      const a2 = arrowFor(nextStep.maneuver.type, nextStep.maneuver.modifier)
      const s2 = truncate(nextStep.name || nextStep.maneuver.instruction, 30)
      thenNext = `then ${a2}  ${s2}`
    }
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
