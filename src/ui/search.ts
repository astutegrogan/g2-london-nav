import { geocode } from '../routing/tfl'
import type { GeocodeResult, LngLat } from '../routing/types'

export interface SearchHandlers {
  onPick: (result: GeocodeResult) => void
}

export class SearchScreen {
  private input: HTMLInputElement
  private results: HTMLElement
  private err: HTMLElement
  private debounceTimer: number | null = null

  constructor(root: HTMLElement, private handlers: SearchHandlers, private proximity: () => LngLat | null) {
    this.input = root.querySelector('#dest-input') as HTMLInputElement
    this.results = root.querySelector('#dest-results') as HTMLElement
    this.err = root.querySelector('#dest-err') as HTMLElement
    this.input.addEventListener('input', () => this.scheduleSearch())
  }

  focus() {
    this.input.focus()
  }

  private scheduleSearch() {
    if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer)
    this.debounceTimer = window.setTimeout(() => this.runSearch(), 250)
  }

  private async runSearch() {
    this.err.textContent = ''
    const q = this.input.value.trim()
    if (!q) {
      this.results.innerHTML = ''
      return
    }
    try {
      const list = await geocode(q, this.proximity() ?? undefined)
      this.render(list)
    } catch (e) {
      this.err.textContent = (e as Error).message
    }
  }

  private render(list: GeocodeResult[]) {
    this.results.innerHTML = ''
    for (const r of list) {
      const el = document.createElement('div')
      el.className = 'result'
      const name = document.createElement('div')
      name.className = 'name'
      name.textContent = r.name
      const addr = document.createElement('div')
      addr.className = 'addr'
      addr.textContent = r.address
      el.appendChild(name)
      el.appendChild(addr)
      el.addEventListener('click', () => this.handlers.onPick(r))
      this.results.appendChild(el)
    }
  }
}
