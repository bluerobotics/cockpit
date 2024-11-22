import posthog from 'posthog-js'

/**
 * PostHog client
 */
class PostHog {
  static posthog: ReturnType<typeof posthog.init> | undefined = undefined

  /**
   * Initialize the PostHog client if not already initialized
   */
  constructor() {
    if (!PostHog.posthog) {
      PostHog.posthog = posthog.init('phc_SfqVeZcpYHmhUn9NRizThxFxiI9fKqvjRjmBDB8ToRs', {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'always', // Create profiles for anonymous users as well
      })
    }
  }

  /**
   * Capture an event
   * @param {string} eventName - The name of the event
   * @param {Record<string, unknown>} properties - The properties of the event
   */
  capture(eventName: string, properties?: Record<string, unknown>): void {
    if (!PostHog.posthog) {
      throw new Error('PostHog client not initialized.')
    }
    PostHog.posthog.capture(eventName, properties)
  }
}

const eventTracker = new PostHog()
export default eventTracker
