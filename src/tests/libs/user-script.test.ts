import { expect, test, vi } from 'vitest'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: {
    getKeyValue: vi.fn(),
    setKeyValue: vi.fn(),
  },
}))

test('passes an error thrown by user code to the caller, naming what failed', async () => {
  const { createCleanupScope, runUserScript } = await import('@/libs/user-script')

  expect(() => runUserScript("throw new Error('boom')", 'JavaScript action', createCleanupScope('test'))).toThrow(
    'Error running the JavaScript action: Error: boom'
  )
})

test('logs the original error, with its stack, before passing it on', async () => {
  const { createCleanupScope, runUserScript } = await import('@/libs/user-script')
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

  try {
    expect(() => runUserScript("throw new Error('boom')", 'JavaScript action', createCleanupScope('test'))).toThrow()
    const loggedError = consoleError.mock.calls.find(([message]) => message === 'Error running the JavaScript action.')
    expect(loggedError?.[1]).toBeInstanceOf(Error)
    expect((loggedError?.[1] as Error).message).toBe('boom')
  } finally {
    consoleError.mockRestore()
  }
})

test('hands a failing JavaScript action error to the action caller', async () => {
  const { registerJavascriptActionConfig } = await import('@/libs/actions/free-javascript')
  const { executeActionCallback } = await import('@/libs/joystick/protocols/cockpit-actions')
  const onError = vi.fn()

  const id = registerJavascriptActionConfig({ name: 'Failing', code: "throw new Error('boom')" })
  executeActionCallback(id, onError)

  await Promise.resolve()
  expect(onError).toHaveBeenCalledWith(new Error('Error running the JavaScript action: Error: boom'))
})
