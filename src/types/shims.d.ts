/* eslint-disable jsdoc/require-jsdoc */
declare module '@vue-leaflet/vue-leaflet'
declare module 'gamepad.js'
declare module 'vuetify'
declare module 'vuetify/lib/components'
declare module 'vuetify/lib/directives'
declare module '@peermetrics/webrtc-stats'
declare module 'piexifjs'
declare module '@kmamal/sdl'

declare module 'vue-virtual-scroller' {
  import Vue, { ComponentOptions, PluginObject, Component } from 'vue'
  interface PluginOptions {
    installComponents?: boolean
    componentsPrefix?: string
  }

  const plugin: PluginObject<PluginOptions> & {
    version: string
  }

  export const RecycleScroller: Component<unknown, unknown, unknown, unknown>
  export const DynamicScroller: Component<unknown, unknown, unknown, unknown>
  export const DynamicScrollerItem: Component<unknown, unknown, unknown, unknown>

  export function IdState(options?: { idProp?: (vm: unknown) => unknown }): ComponentOptions<Vue> | typeof Vue

  export default plugin
}

declare module 'vue-draggable-resizable' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>>
  export default component
}

declare module 'piexifjs' {
  export interface Ifd {
    '0th': Record<number, string | number | number[][] | undefined>
    'Exif'?: Record<number, string | number | number[][] | undefined>
    'GPS'?: Record<number, string | number | number[][] | undefined>
    'Interop'?: Record<number, any>
    '1st'?: Record<number, any>
    'thumbnail'?: string
  }

  const piexif: {
    ImageIFD: Record<string, number>
    ExifIFD: Record<string, number>
    GPSIFD: Record<string, number>
    dump(exif: Ifd): string
    insert(exifStr: string, jpegDataUrl: string): string
    load(jpegDataUrl: string): Ifd
    remove(jpegDataUrl: string): string
  }

  export default piexif
}
