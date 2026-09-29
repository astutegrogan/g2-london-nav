import type { TextZone, ImageZone } from '../sdk'

export const DISPLAY_W = 576
export const DISPLAY_H = 288

export const MAP_W = 200
export const MAP_H = 100

export const TEXT_ZONES: TextZone[] = [
  // Full-screen invisible event-capture layer. Sits at the back (lowest
  // containerID) so every tap / double-tap / scroll on the touchpad routes
  // here. Empty content + no border = nothing rendered, so the visible
  // content zones stay free of the simulator's bounce animation.
  {
    id: 1,
    name: 'eventLayer',
    x: 0,
    y: 0,
    w: DISPLAY_W,
    h: DISPLAY_H,
    initial: ' ',
    capture: true,
  },
  {
    id: 2,
    name: 'header',
    x: 0,
    y: 0,
    w: DISPLAY_W,
    h: 32,
    initial: 'London Nav',
    capture: false,
  },
  {
    id: 3,
    name: 'maneuver',
    x: 0,
    y: 36,
    w: DISPLAY_W,
    h: 148,
    initial: 'Awaiting GPS…',
    capture: false,
  },
  {
    id: 4,
    name: 'thennext',
    x: 0,
    y: 188,
    w: DISPLAY_W - MAP_W - 4,
    h: MAP_H,
    initial: '',
    capture: false,
  },
  // Mode badge directly above the map. Higher containerID than `maneuver`
  // so it draws on top in the overlap region. Initial value is set so the
  // zone is visible from boot — main.ts swaps it as the heading source flips.
  {
    id: 5,
    name: 'modeBadge',
    x: DISPLAY_W - MAP_W,
    y: 152,
    w: MAP_W,
    h: 24,
    initial: 'mode=heading',
    capture: false,
  },
]

export const IMAGE_ZONES: ImageZone[] = [
  {
    id: 6,
    name: 'map',
    x: DISPLAY_W - MAP_W,
    y: DISPLAY_H - MAP_H,
    w: MAP_W,
    h: MAP_H,
  },
]
