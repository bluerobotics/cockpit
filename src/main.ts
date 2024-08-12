import 'floating-vue/dist/style.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import '@/libs/system-logging'

import { library } from '@fortawesome/fontawesome-svg-core'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import * as Sentry from '@sentry/vue'
import FloatingVue from 'floating-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import VueVirtualScroller from 'vue-virtual-scroller'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'
import { useOmniscientLoggerStore } from './stores/omniscientLogger'

library.add(fas, far)
loadFonts()

const app = createApp(App)

// Initialize Sentry for error tracking
// Only track usage statistics if the user has not opted out and the app is not in development mode
if (window.localStorage.getItem('cockpit-enable-usage-statistics-telemetry') && import.meta.env.DEV === false) {
  console.log('Initializing Sentry telemetry...')
  Sentry.init({
    app,
    dsn: 'https://d7329dcf760fa1cc9fa6c7a5f16f60a1@o4507696465707008.ingest.us.sentry.io/4507762984222720',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    sampleRate: 1.0, // Capture all errors
    tracesSampleRate: 1.0, // Capture all traces
    tracePropagationTargets: [],
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport), // Cache events and send them when the user comes back online
  })
  Sentry.getCurrentScope().setLevel('info')
}

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.use(router).use(vuetify).use(createPinia()).use(FloatingVue).use(VueVirtualScroller)
app.mount('#app')

// Initialize the logger store
useOmniscientLoggerStore()
