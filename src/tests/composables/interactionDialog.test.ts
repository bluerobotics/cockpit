import { expect, test, vi } from 'vitest'

let mounts = 0

vi.mock('@/plugins/vuetify', () => ({ default: () => undefined }))
vi.mock('@/router', () => ({ default: () => undefined }))
vi.mock('@/components/InteractionDialog.vue', () => ({
  default: { template: '<div />', mounted: () => (mounts += 1) },
}))

import { useInteractionDialog } from '@/composables/interactionDialog'

test('an already open dialog is not remounted by repeated calls with the same options', async () => {
  const { showDialog, closeDialog } = useInteractionDialog()
  const problem = { message: 'The recording may be broken.', variant: 'error' }

  const first = showDialog(problem)
  const second = showDialog(problem)
  const third = showDialog(problem)
  expect(mounts).toBe(1)
  expect(second).toBe(first)
  expect(third).toBe(first)

  showDialog({ message: 'A different problem.', variant: 'error' })
  expect(mounts).toBe(2)
  expect(await first).toEqual({ isConfirmed: false })

  // Same wording, different options, so the caller gets its own dialog instead of the open one's promise.
  showDialog({ message: 'A different problem.', variant: 'warning' })
  expect(mounts).toBe(3)

  closeDialog()
  showDialog({ message: 'A different problem.', variant: 'warning' })
  expect(mounts).toBe(4)
})
