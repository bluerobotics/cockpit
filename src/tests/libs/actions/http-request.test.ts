import { afterEach, expect, test, vi } from 'vitest'

import { HttpRequestMethod } from '@/types/cockpit-actions'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: {
    getKeyValue: vi.fn(),
    setKeyValue: vi.fn(),
  },
}))

vi.mock('@/libs/joystick/protocols/cockpit-actions', () => ({
  availableCockpitActions: {},
  CockpitAction: class {},
  deleteAction: vi.fn(),
  registerActionCallback: vi.fn(),
  registerNewAction: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

test('resolves data-lake variables in HTTP request header values', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, statusText: 'OK' } as Response)

  const { setDataLakeVariableData } = await import('@/libs/actions/data-lake')
  const { getHttpRequestActionCallback, registerHttpRequestActionConfig } = await import('@/libs/actions/http-request')

  setDataLakeVariableData('my-token', 'secret-token')
  const actionId = registerHttpRequestActionConfig({
    name: 'Authenticated request',
    url: 'https://example.com',
    method: HttpRequestMethod.GET,
    headers: { Authorization: 'Bearer {{ my-token }}' },
    urlParams: {},
    body: '',
  })

  await getHttpRequestActionCallback(actionId)()

  expect(fetchMock).toHaveBeenCalledWith(
    new URL('https://example.com'),
    expect.objectContaining({
      headers: { Authorization: 'Bearer secret-token' },
    })
  )
}, 20_000)

test('does not send a request when a resolved header value is invalid', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, statusText: 'OK' } as Response)

  const { setDataLakeVariableData } = await import('@/libs/actions/data-lake')
  const { getHttpRequestActionCallback, registerHttpRequestActionConfig } = await import('@/libs/actions/http-request')

  setDataLakeVariableData('unsafe-token', 'line\nbreak')
  const actionId = registerHttpRequestActionConfig({
    name: 'Request with unsafe header',
    url: 'https://example.com',
    method: HttpRequestMethod.GET,
    headers: { Authorization: 'Bearer {{ unsafe-token }}' },
    urlParams: {},
    body: '',
  })

  await expect(getHttpRequestActionCallback(actionId)()).rejects.toThrow(
    'HTTP request not sent: Header value cannot contain null bytes or newlines.'
  )

  expect(fetchMock).not.toHaveBeenCalled()
})

test('rejects characters that fetch cannot encode in a header value', async () => {
  const { validateHttpRequestHeaders } = await import('@/libs/actions/http-request')

  expect(validateHttpRequestHeaders({ Authorization: 'Bearer 😀' })).toEqual({
    isValid: false,
    error: 'Header value contains unsupported characters.',
    field: 'value',
  })
})

test('rejects imported non-text header values without throwing during validation', async () => {
  const { validateHttpRequestHeaders } = await import('@/libs/actions/http-request')

  expect(validateHttpRequestHeaders({ 'X-Count': 5 })).toEqual({
    isValid: false,
    error: 'Header value must be text.',
    field: 'value',
  })
})

test('does not send an imported non-text header value', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, statusText: 'OK' } as Response)
  const { getHttpRequestActionCallback, registerHttpRequestActionConfig } = await import('@/libs/actions/http-request')

  const actionId = registerHttpRequestActionConfig({
    name: 'Imported request',
    url: 'https://example.com',
    method: HttpRequestMethod.GET,
    headers: { 'X-Count': 5 as unknown as string },
    urlParams: {},
    body: '',
  })

  await expect(getHttpRequestActionCallback(actionId)()).rejects.toThrow(
    'HTTP request not sent: Header value must be text.'
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

test('does not send unresolved header placeholders', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, statusText: 'OK' } as Response)
  const { getHttpRequestActionCallback, registerHttpRequestActionConfig } = await import('@/libs/actions/http-request')

  const actionId = registerHttpRequestActionConfig({
    name: 'Request with unavailable input',
    url: 'https://example.com',
    method: HttpRequestMethod.GET,
    headers: { Authorization: 'Bearer {{ unavailable-input }}' },
    urlParams: {},
    body: '',
  })

  await expect(getHttpRequestActionCallback(actionId)()).rejects.toThrow(
    'HTTP request not sent: A header value has an unresolved placeholder.'
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

test('reports request send failures to the action caller', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network unavailable'))
  const { getHttpRequestActionCallback, registerHttpRequestActionConfig } = await import('@/libs/actions/http-request')

  const actionId = registerHttpRequestActionConfig({
    name: 'Request with unavailable server',
    url: 'https://example.com',
    method: HttpRequestMethod.GET,
    headers: {},
    urlParams: {},
    body: '',
  })

  await expect(getHttpRequestActionCallback(actionId)()).rejects.toThrow('Network unavailable')
}, 20_000)
