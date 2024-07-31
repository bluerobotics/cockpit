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

// Only track usage statistics if the user has not opted out
if (window.localStorage.getItem('cockpit-enable-usage-statistics-telemetry')) {
  Sentry.init({
    app,
    dsn: 'https://24f33bd0a8e35e7505da20846dcbca92@o4507696465707008.ingest.us.sentry.io/4507696619061248',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1, //  Capture 10% of the transactions
    tracePropagationTargets: [],
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport), // Cache events and send them when the user comes back online
  })
}

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.use(router).use(vuetify).use(createPinia()).use(FloatingVue).use(VueVirtualScroller)
app.mount('#app')

// Initialize the logger store
useOmniscientLoggerStore()
