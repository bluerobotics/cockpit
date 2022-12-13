import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // eslint-disable-next-line
      return require('./cypress/plugins/index.ts').default(on, config)
    },
    baseUrl: 'http://localhost:5050',
  },
})
