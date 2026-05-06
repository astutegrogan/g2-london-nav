import type { ManeuverModifier, ManeuverType } from '../routing/types'

const MAP: Record<string, string> = {
  'turn:left': '↰',
  'turn:right': '↱',
  'turn:sharp left': '↰',
  'turn:sharp right': '↱',
  'turn:slight left': '↖',
  'turn:slight right': '↗',
  'turn:straight': '↑',
  'turn:uturn': '↺',
  'merge:left': '↖',
  'merge:right': '↗',
  'merge:straight': '↑',
  'on ramp:left': '↖',
  'on ramp:right': '↗',
  'on ramp:straight': '↑',
  'off ramp:left': '↖',
  'off ramp:right': '↗',
  'fork:left': '↖',
  'fork:right': '↗',
  'roundabout:left': '↺',
  'roundabout:right': '↻',
  'roundabout:straight': '↻',
  'rotary:left': '↺',
  'rotary:right': '↻',
  'continue:left': '↖',
  'continue:right': '↗',
  'continue:straight': '↑',
  'depart:straight': '↑',
  'arrive:straight': '◎',
  'arrive:left': '◎',
  'arrive:right': '◎',
  'end of road:left': '↰',
  'end of road:right': '↱',
}

export function arrowFor(type: ManeuverType, modifier?: ManeuverModifier): string {
  const key = `${type}:${modifier ?? 'straight'}`
  return MAP[key] ?? MAP[`${type}:straight`] ?? '↑'
}
