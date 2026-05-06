import type { GlassesSurface, InputKind } from './sdk'

export interface NavInputHandlers {
  onCancelRoute: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

export function bindNavInputs(surface: GlassesSurface, h: NavInputHandlers): () => void {
  return surface.onInput((kind: InputKind) => {
    switch (kind) {
      case 'doubleTap':
      case 'exit':
        h.onCancelRoute()
        break
      case 'scrollUp':
        h.onZoomIn()
        break
      case 'scrollDown':
        h.onZoomOut()
        break
      case 'tap':
        break
    }
  })
}
