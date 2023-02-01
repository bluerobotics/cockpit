import { createPinia } from 'pinia'
import { createApp } from 'vue'
import VueKonva from 'vue-konva'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'

loadFonts()

const app = createApp(App)
app.use(router).use(vuetify).use(VueKonva).use(createPinia())
app.mount('#app')
