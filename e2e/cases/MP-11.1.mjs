import { runAtCruiseSpeed } from '../lib/speed.mjs'

export const meta = {
  title: 'Mission cruise speed sets the vehicle speed',
  route: '/mission-planning',
  needs: ['vehicle'],
}

/**
 * Run a mission planned at 1 m/s and show the vehicle cruise at that speed.
 */
export default async function run(ctx) {
  await runAtCruiseSpeed(ctx, 1, 0.3)
}
