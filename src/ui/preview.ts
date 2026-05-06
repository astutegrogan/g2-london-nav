import { metersToDisplay, durationToMin, eta } from '../hud/format'
import type { Route, GeocodeResult } from '../routing/types'

export interface PreviewHandlers {
  onStart: () => void
  onBack: () => void
}

export class PreviewScreen {
  constructor(private root: HTMLElement, private handlers: PreviewHandlers) {
    root.querySelector('#start-btn')!.addEventListener('click', () => this.handlers.onStart())
    root.querySelector('#back-btn')!.addEventListener('click', () => this.handlers.onBack())
  }

  show(dest: GeocodeResult, route: Route) {
    ;(this.root.querySelector('#preview-name') as HTMLElement).textContent = dest.name
    ;(this.root.querySelector('#preview-dist') as HTMLElement).textContent = metersToDisplay(route.distance)
    ;(this.root.querySelector('#preview-eta') as HTMLElement).textContent = `${eta(route.duration)}  (${durationToMin(route.duration)})`
  }
}

export function setScreen(name: 'search' | 'preview' | 'nav') {
  for (const id of ['screen-search', 'screen-preview', 'screen-nav']) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.toggle('hidden', !id.endsWith(name))
  }
}
