import {
  waitForEvenAppBridge,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageContainerProperty,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

export type Bridge = Awaited<ReturnType<typeof waitForEvenAppBridge>>

export interface TextZone {
  id: number
  name: string
  x: number
  y: number
  w: number
  h: number
  initial: string
  capture?: boolean
}

export interface ImageZone {
  id: number
  name: string
  x: number
  y: number
  w: number
  h: number
}

/** @deprecated Use TextZone */
export type ZoneSpec = TextZone

export class GlassesSurface {
  private textChain: Promise<unknown> = Promise.resolve()
  private imageChain: Promise<unknown> = Promise.resolve()

  constructor(
    private bridge: Bridge,
    private text: TextZone[],
    private images: ImageZone[],
  ) {}

  static async open(text: TextZone[], images: ImageZone[] = []): Promise<GlassesSurface> {
    const bridge = await waitForEvenAppBridge()
    const surface = new GlassesSurface(bridge, text, images)
    await surface.create()
    return surface
  }

  private async create() {
    const textProps = this.text.map(
      z =>
        new TextContainerProperty({
          xPosition: z.x,
          yPosition: z.y,
          width: z.w,
          height: z.h,
          borderWidth: 0,
          borderColor: 5,
          paddingLength: 4,
          containerID: z.id,
          containerName: z.name,
          content: z.initial,
          isEventCapture: z.capture ? 1 : 0,
        }),
    )
    const imageProps = this.images.map(
      z =>
        new ImageContainerProperty({
          xPosition: z.x,
          yPosition: z.y,
          width: z.w,
          height: z.h,
          containerID: z.id,
          containerName: z.name,
        }),
    )
    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: this.text.length + this.images.length,
        textObject: textProps,
        imageObject: imageProps,
      }),
    )
    if (result !== 0) throw new Error(`createStartUpPageContainer failed: ${result}`)
  }

  update(updates: Record<string, string>): Promise<void> {
    this.textChain = this.textChain.then(async () => {
      for (const [name, content] of Object.entries(updates)) {
        const zone = this.text.find(z => z.name === name)
        if (!zone) continue
        await this.bridge.textContainerUpgrade(
          new TextContainerUpgrade({
            containerID: zone.id,
            containerName: zone.name,
            content,
          }),
        )
      }
    })
    return this.textChain.then(() => undefined)
  }

  pushImage(name: string, bytes: Uint8Array): Promise<void> {
    const zone = this.images.find(z => z.name === name)
    if (!zone) return Promise.reject(new Error(`unknown image zone: ${name}`))
    this.imageChain = this.imageChain.then(async () => {
      const r = await this.bridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: zone.id,
          containerName: zone.name,
          imageData: bytes,
        }),
      )
      if (r !== 'success') throw new Error(`updateImageRawData: ${r}`)
    })
    return this.imageChain.then(() => undefined)
  }

  onInput(cb: (kind: InputKind) => void): () => void {
    return this.bridge.onEvenHubEvent(event => {
      const sysType = event.sysEvent?.eventType ?? null
      const textType = event.textEvent?.eventType ?? null

      if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        cb('doubleTap')
        return
      }
      if (sysType === OsEventTypeList.CLICK_EVENT) {
        cb('tap')
        return
      }
      if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
        cb('scrollUp')
        return
      }
      if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        cb('scrollDown')
        return
      }
      if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
        cb('exit')
        return
      }
    })
  }

  close(): Promise<unknown> {
    return this.bridge.shutDownPageContainer(1)
  }
}

export type InputKind = 'tap' | 'doubleTap' | 'scrollUp' | 'scrollDown' | 'exit'
