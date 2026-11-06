import type { t } from 'ttag'

declare module 'vue' {
  // eslint-disable-next-line jsdoc/require-jsdoc
  interface ComponentCustomProperties {
    // eslint-disable-next-line jsdoc/require-jsdoc
    t: typeof t
  }
}

declare module '*.po' {
  import type { LocaleData } from 'ttag'
  const catalog: LocaleData
  export default catalog
}
