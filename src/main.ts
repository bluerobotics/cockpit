import 'floating-vue/dist/style.css'

import FloatingVue from 'floating-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'

loadFonts()

const app = createApp(App)
app.use(router).use(vuetify).use(createPinia()).use(FloatingVue)
app.mount('#app')
