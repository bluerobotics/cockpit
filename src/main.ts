import 'floating-vue/dist/style.css'

import { library } from '@fortawesome/fontawesome-svg-core'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import FloatingVue from 'floating-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'

library.add(fas, far)
loadFonts()

const app = createApp(App)
app.component('FontAwesomeIcon', FontAwesomeIcon)
app.use(router).use(vuetify).use(createPinia()).use(FloatingVue)
app.mount('#app')
