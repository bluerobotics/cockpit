import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'
import BoatSimulator from './stores/boatSimulator'

loadFonts()

createApp(App).use(router).use(vuetify).use(createPinia()).mount('#app')

new BoatSimulator()
