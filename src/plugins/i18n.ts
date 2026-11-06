import { t } from 'ttag'
import type { App } from 'vue'

export default {
  install(app: App): void {
    app.config.globalProperties.t = t
  },
}
