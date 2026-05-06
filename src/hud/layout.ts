import type { TextZone, ImageZone } from '../sdk'

export const DISPLAY_W = 576
export const DISPLAY_H = 288

export const MAP_W = 200
export const MAP_H = 100

export const TEXT_ZONES: TextZone[] = [
  {
    id: 1,
    name: 'header',
    x: 0,
    y: 0,
    w: DISPLAY_W,
    h: 32,
    initial: 'Car Nav',
    capture: false,
  },
  {
    id: 2,
    name: 'maneuver',
    x: 0,
    y: 36,
    w: DISPLAY_W,
    h: 148,
    initial: 'Awaiting GPS…',
    capture: true,
  },
  {
    id: 3,
    name: 'thennext',
    x: 0,
    y: 188,
    w: DISPLAY_W - MAP_W - 4,
    h: MAP_H,
    initial: '',
    capture: false,
  },
]

export const IMAGE_ZONES: ImageZone[] = [
  {
    id: 4,
    name: 'map',
    x: DISPLAY_W - MAP_W,
    y: DISPLAY_H - MAP_H,
    w: MAP_W,
    h: MAP_H,
  },
]
