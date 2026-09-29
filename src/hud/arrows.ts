import type { ManeuverModifier, ManeuverType, TransitMode } from '../routing/types'

const WALK_MAP: Record<string, string> = {
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

const TRANSIT_MODE_ICON: Record<TransitMode, string> = {
  walking: '↑',
  tube: '[M]',
  bus: '[B]',
  overground: '[O]',
  'elizabeth-line': '[E]',
  dlr: '[D]',
  'national-rail': '[R]',
  'river-bus': '[~]',
  'cable-car': '[C]',
}

export function arrowFor(type: ManeuverType, modifier?: ManeuverModifier): string {
  const key = `${type}:${modifier ?? 'straight'}`
  return WALK_MAP[key] ?? WALK_MAP[`${type}:straight`] ?? '↑'
}

export function transitIcon(mode: TransitMode): string {
  return TRANSIT_MODE_ICON[mode] ?? '[?]'
}
