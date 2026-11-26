import { type SpyInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ExternalMapMeshResult } from '@/libs/map/external-map-mesh-api'

type Api = typeof import('@/libs/external-api/api')

let api: Api
let posted: [Record<string, unknown>, string, Transferable[] | undefined][]
let addListener: SpyInstance<Parameters<typeof window.addEventListener>, void>

// A fresh copy of the module per test, so its request counter and pending requests start empty.
beforeEach(async () => {
  vi.resetModules()
  posted = []
  vi.spyOn(window.parent, 'postMessage').mockImplementation(((message, origin, transfer) => {
    posted.push([message, origin, transfer])
  }) as typeof window.postMessage)
  addListener = vi.spyOn(window, 'addEventListener')
  api = await import('@/libs/external-api/api')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const answer = (data: unknown, source: Window | null = window.parent): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source }))
}

const lastRequestId = (): string => posted.at(-1)?.[0].requestId as string

const result = (requestId: string, fields: Partial<ExternalMapMeshResult> = {}): ExternalMapMeshResult => ({
  type: 'cockpit:mapMeshResult',
  requestId,
  id: 'test-mesh',
  ok: true,
  ...fields,
})

const mesh = { id: 'test-mesh', name: 'Test', capacity: 4, texels: { format: 'r8', width: 1, height: 1 } } as const

// Over this realm's ArrayBuffer: under jsdom a typed array's own buffer comes from Node's realm, which `instanceof
// ArrayBuffer` rejects, unlike in a browser.
const quads = (): {
  /**
cccccccccccccccccccc *
cccccccccccccccccccc
   */
  corners: Float64Array
  /**
ccccccccccccccccccccccc *
ccccccccccccccccccccccc
   */
  uv: Float32Array
  /**
uuuuuuuuuuuuuuuuuu *
uuuuuuuuuuuuuuuuuu
   */
  texels: Uint8Array
} => {
  const corners = new Float64Array(new ArrayBuffer(64))
  corners.set([-48.55, -27.59, -48.5499, -27.59, -48.5499, -27.5901, -48.55, -27.5901])
  return { corners, uv: new Float32Array(new ArrayBuffer(32)), texels: new Uint8Array(new ArrayBuffer(1)) }
}

describe('map mesh helpers that wait for an answer', () => {
  test('resolve with the answer carrying the id they sent, installing one message listener for all of them', async () => {
    const capabilities = api.getMapCapabilities()
    const set = api.setMapMesh(mesh)
    expect(posted.map(([message]) => message.type)).toEqual(['cockpit:getMapCapabilities', 'cockpit:setMapMesh'])
    expect(posted[1][0]).toMatchObject({ mesh })
    const [queryId, setId] = posted.map(([message]) => message.requestId as string)
    expect(queryId).toMatch(/^cockpit-api-\w+-1$/)
    expect(setId).toBe(queryId.replace(/1$/, '2'))
    expect(addListener.mock.calls.filter(([type]) => type === 'message')).toHaveLength(1)

    const caps = { type: 'cockpit:mapCapabilities', requestId: queryId, meshes: { version: 1 } }
    answer(caps)
    answer(result(setId, { head: 0, capacity: 4 }))
    await expect(capabilities).resolves.toEqual(caps)
    await expect(set).resolves.toMatchObject({ ok: true, head: 0, capacity: 4 })
  })

  test('match concurrent answers by id, whatever their order, ignoring every other message', async () => {
    const promises = [api.clearMapMesh('a'), api.removeMapMeshQuads('b', 1, 2), api.removeMapMesh('c')]
    const ids = posted.map(([message]) => message.requestId as string)
    expect(posted.map(([message]) => message)).toEqual([
      { type: 'cockpit:clearMapMesh', id: 'a', requestId: ids[0] },
      { type: 'cockpit:removeMapMeshQuads', id: 'b', first: 1, count: 2, requestId: ids[1] },
      { type: 'cockpit:removeMapMesh', id: 'c', requestId: ids[2] },
    ])
    const settled = vi.fn()
    promises.forEach((promise) => promise.then(settled, settled))

    answer(result('someone-else'))
    answer({ type: 'cockpit:datalakeVariable', requestId: ids[0] })
    answer(result(ids[0]), null)
    answer(null)
    answer('cockpit:mapMeshResult')
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()

    answer(result(ids[2], { id: 'c' }))
    answer(result(ids[0], { id: 'a' }))
    answer(result(ids[1], { id: 'b' }))
    const answers = await Promise.all(promises)
    expect(answers.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  test('reject with the answer when Cockpit refuses the command', async () => {
    const write = api.setMapMeshQuads('test-mesh', quads(), { confirm: true })
    const refusal = result(lastRequestId(), { ok: false, error: "Mesh 'test-mesh' does not exist." })
    answer(refusal)
    const error = await write.catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(api.MapMeshCommandError)
    expect(error).toMatchObject({ message: refusal.error, name: 'MapMeshCommandError', result: refusal })
  })

  test('reject a budget refusal with its code and byte counts', async () => {
    const set = api.setMapMesh(mesh)
    const budget = { code: 'budget', usedBytes: 6, previousBytes: 0, requestedBytes: 8, budgetBytes: 10 } as const
    answer(result(lastRequestId(), { ok: false, error: 'Over budget.', ...budget }))
    await expect(set).rejects.toMatchObject({ message: 'Over budget.', result: budget })
  })

  test('reject after the timeout, saying why Cockpit may not have answered, and ignore a late answer', async () => {
    vi.useFakeTimers()
    const set = api.setMapMesh(mesh)
    const quick = api.clearMapMesh('test-mesh', { timeoutMs: 100 })
    const quickId = lastRequestId()
    const failures = Promise.all([set.catch((error) => error), quick.catch((error) => error)])
    expect(vi.getTimerCount()).toBe(2)

    vi.advanceTimersByTime(100)
    answer(result(quickId))
    vi.advanceTimersByTime(4900)
    const [slow, fast] = await failures
    expect(fast.message).toBe(
      'Cockpit did not answer cockpit:clearMapMesh within 100 ms. Cockpit may predate map meshes, the command may be ' +
        'invalid, or this page is not in an IFrame widget.'
    )
    expect(slow.message).toContain('cockpit:setMapMesh within 5000 ms')
    expect(vi.getTimerCount()).toBe(0)
  })

  test('clear their timeout once answered, and reject at once when the message cannot be posted', async () => {
    vi.useFakeTimers()
    const set = api.setMapMesh(mesh)
    answer(result(lastRequestId()))
    await set
    expect(vi.getTimerCount()).toBe(0)

    const cloneError = new DOMException('Detached buffer', 'DataCloneError')
    vi.mocked(window.parent.postMessage).mockImplementationOnce(() => {
      throw cloneError
    })
    await expect(api.setMapMeshQuads('test-mesh', quads(), { confirm: true })).rejects.toBe(cloneError)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('setMapMeshQuads', () => {
  test('streams without a requestId, an answer listener or a request id, transferring each buffer once', async () => {
    const buffer = new ArrayBuffer(96)
    const corners = new Float64Array(buffer, 0, 8)
    const uv = new Float32Array(buffer, 64, 8)
    const texels = new Uint8Array(new ArrayBuffer(4))
    const tint = new Uint8Array(new SharedArrayBuffer(4))
    expect(api.setMapMeshQuads('test-mesh', { first: 2, corners, uv, texels, tint })).toBeUndefined()
    expect(api.setMapMeshQuads('test-mesh', quads())).toBeUndefined()

    const [[message, origin, transfer]] = posted
    expect(message).toEqual({ type: 'cockpit:setMapMeshQuads', id: 'test-mesh', first: 2, corners, uv, texels, tint })
    expect(message).not.toHaveProperty('requestId')
    expect(origin).toBe('*')
    expect(transfer).toEqual([buffer, texels.buffer])
    expect(posted[1][0]).not.toHaveProperty('requestId')
    expect(addListener).not.toHaveBeenCalled()

    // The first request id is still the first one this page allocates.
    void api.clearMapMesh('test-mesh').catch(() => undefined)
    expect(lastRequestId()).toMatch(/-1$/)
  })

  test('waits for the slots it wrote when confirmed, still transferring its buffers', async () => {
    const sent = quads()
    const write = api.setMapMeshQuads('test-mesh', sent, { confirm: true })
    const [message, , transfer] = posted[0]
    expect(message).toMatchObject({ type: 'cockpit:setMapMeshQuads', id: 'test-mesh', requestId: expect.any(String) })
    expect(transfer).toEqual([sent.corners.buffer, sent.uv.buffer, sent.texels.buffer])
    answer(result(lastRequestId(), { first: 0, count: 1, head: 1, capacity: 4 }))
    await expect(write).resolves.toMatchObject({ first: 0, count: 1, head: 1 })
  })
})
