/* eslint-disable jsdoc/require-jsdoc */
declare module '@vue-leaflet/vue-leaflet'
declare module 'gamepad.js'
declare module 'vuetify'
declare module 'vuetify/lib/components'
declare module 'vuetify/lib/directives'
declare module '@peermetrics/webrtc-stats'

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
