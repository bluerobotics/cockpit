import { runAtCruiseSpeed } from '../lib/speed.mjs'

export const meta = {
  title: 'A different cruise speed gives a different speed',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Run a mission planned at 3 m/s and show the vehicle cruise at that speed.
 */
export default async function run(ctx) {
  await runAtCruiseSpeed(ctx, 3, 0.5)
}
