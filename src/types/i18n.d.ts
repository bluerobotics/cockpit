import type { t } from 'ttag'

declare module '@vue/runtime-core' {
  // eslint-disable-next-line jsdoc/require-jsdoc
  interface ComponentCustomProperties {
    // eslint-disable-next-line jsdoc/require-jsdoc
    t: typeof t
  }
}
