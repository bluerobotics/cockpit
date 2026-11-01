import { expect, test, vi } from 'vitest'
import { createApp } from 'vue'

let mounts = 0

vi.mock('@/plugins/vuetify', () => ({ default: () => undefined }))
vi.mock('@/router', () => ({ default: () => undefined }))
vi.mock('@/components/InteractionDialog.vue', () => ({
  default: {
    template: '<button @click="$emit(\'confirmed\')">Confirm</button>',
    emits: ['confirmed'],
    mounted: () => (mounts += 1),
  },
}))

import { type DialogResult, useInteractionDialog } from '@/composables/interactionDialog'

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
  closeDialog()
})

test('closing a dialog settles its promise as dismissed without waiting for another dialog', async () => {
  const { showDialog, closeDialog } = useInteractionDialog()
  let result: DialogResult | undefined
  const pending = showDialog({ message: 'Close this dialog.', variant: 'info' })
  pending.then((value) => (result = value))

  closeDialog()
  await Promise.resolve()

  expect(result).toEqual({ isConfirmed: false })
})

test('closing a confirmed dialog preserves its confirmed result', async () => {
  const { showDialog, closeDialog } = useInteractionDialog()
  const pending = showDialog({ message: 'Confirm this dialog.', variant: 'info' })
  document.querySelector<HTMLButtonElement>('button')?.click()

  closeDialog()

  expect(await pending).toEqual({ isConfirmed: true })
})

test('unmounting the owner settles its open dialog as dismissed', async () => {
  let result: DialogResult | undefined
  const owner = createApp({
    setup() {
      const { showDialog } = useInteractionDialog()
      showDialog({ message: 'Close this view.', variant: 'info' }).then((value) => (result = value))
      return () => null
    },
  })
  owner.mount(document.createElement('div'))

  owner.unmount()
  await Promise.resolve()

  expect(result).toEqual({ isConfirmed: false })
  expect(document.querySelector('button')).toBeNull()
})
