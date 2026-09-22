import { expect, test, vi } from 'vitest'

import {
  CockpitActionsFunction,
  CockpitActionsManager,
  predefinedCockpitActions,
} from '@/libs/joystick/protocols/cockpit-actions'

test('passes asynchronous action errors to the caller', async () => {
  const manager = new CockpitActionsManager()
  const action = predefinedCockpitActions[CockpitActionsFunction.go_to_next_view]
  const error = new Error('Request could not be sent')
  const onError = vi.fn()

  manager.registerActionCallback(action, async () => {
    throw error
  })
  manager.executeActionCallback(action.id, onError)

  await Promise.resolve()
  expect(onError).toHaveBeenCalledWith(error)
})
