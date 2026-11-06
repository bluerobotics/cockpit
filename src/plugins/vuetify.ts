// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { pt } from 'vuetify/locale'

import { vuetifyLocale } from '@/plugins/i18n'

export default createVuetify({ locale: { locale: vuetifyLocale, messages: { pt } } })
