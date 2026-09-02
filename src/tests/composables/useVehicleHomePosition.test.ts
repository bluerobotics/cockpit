import { expect, test, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'

import type { HomeMarkerSource } from '@/types/mission'

const fetchHomeWaypoint = vi.fn(async () => undefined)
const vehicleStore = reactive({
  isVehicleOnline: false,
  isArmed: false,
  currentlyConnectedVehicleId: undefined as string | undefined,
  fetchHomeWaypoint,
})
const missionStore = reactive({
  homeMarkerPosition: undefined as [number, number] | undefined,
  homeMarkerSource: undefined as HomeMarkerSource | undefined,
  homeMarkerVehicleId: undefined as string | undefined,
})

vi.mock('@/stores/mainVehicle', () => ({ useMainVehicleStore: () => vehicleStore }))
vi.mock('@/stores/mission', () => ({ useMissionStore: () => missionStore }))

import { useVehicleHomePosition } from '@/composables/useVehicleHomePosition'

const resetStores = (): void => {
  fetchHomeWaypoint.mockClear()
  vehicleStore.isVehicleOnline = false
  vehicleStore.isArmed = false
  vehicleStore.currentlyConnectedVehicleId = undefined
  missionStore.homeMarkerPosition = undefined
  missionStore.homeMarkerSource = undefined
  missionStore.homeMarkerVehicleId = undefined
}

test('the vehicle is asked for its home once per connection, and again on arming', async () => {
  resetStores()
  // A vehicle without a position fix has no home to report, which is what makes the retry on arming worth having.
  fetchHomeWaypoint.mockRejectedValueOnce(new Error('Home position not received from vehicle.'))

  const scope = effectScope()
  const { coordinates: home } = scope.run(() => useVehicleHomePosition())!

  expect(fetchHomeWaypoint).not.toHaveBeenCalled()

  vehicleStore.isVehicleOnline = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(1)
  expect(home.value).toBeUndefined()

  vehicleStore.isArmed = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(2)
  missionStore.homeMarkerPosition = [-27.5, -48.5]

  // Disarming is not the autopilot setting home, so it is not worth another request.
  vehicleStore.isArmed = false
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(2)
  expect(home.value).toEqual([-27.5, -48.5])

  // Arming again moves home, so the displayed one is refreshed rather than trusted.
  vehicleStore.isArmed = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(3)

  vehicleStore.isVehicleOnline = false
  vehicleStore.isArmed = false
  await nextTick()
  vehicleStore.isVehicleOnline = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(4)

  scope.stop()
})

test('a request that failed does not count as having asked', async () => {
  resetStores()
  fetchHomeWaypoint.mockRejectedValueOnce(new Error('Home position not received from vehicle.'))
  const isDisplayingHome = ref(true)

  const scope = effectScope()
  scope.run(() => useVehicleHomePosition(() => isDisplayingHome.value))

  vehicleStore.isVehicleOnline = true
  await nextTick()
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(1)

  // The request was lost, so the next thing that asks retries rather than finding the connection written off.
  isDisplayingHome.value = false
  await nextTick()
  isDisplayingHome.value = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(2)

  // That one arrived, so it is not asked for again.
  isDisplayingHome.value = false
  await nextTick()
  isDisplayingHome.value = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(2)

  scope.stop()
})

test('a home drawn from a stored mission does not pass for the vehicle having been asked', async () => {
  resetStores()
  // A mission restored from storage draws its own first item as home, before the vehicle is ever reachable.
  missionStore.homeMarkerPosition = [-27.5, -48.5]
  missionStore.homeMarkerSource = 'mission'

  const scope = effectScope()
  scope.run(() => useVehicleHomePosition())

  vehicleStore.isVehicleOnline = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(1)

  scope.stop()
})

test('only a home the vehicle reported, while it is still connected, counts as confirmed', async () => {
  resetStores()

  const scope = effectScope()
  const { isConfirmedByVehicle } = scope.run(() => useVehicleHomePosition())!

  missionStore.homeMarkerPosition = [-27.5, -48.5]
  vehicleStore.isVehicleOnline = true
  vehicleStore.currentlyConnectedVehicleId = 'veh-a'
  missionStore.homeMarkerVehicleId = 'veh-a'

  // A mission's first item, and a point the operator commanded but the vehicle never reported back, are both unsigned.
  missionStore.homeMarkerSource = 'mission'
  expect(isConfirmedByVehicle.value).toBe(false)
  missionStore.homeMarkerSource = 'operator'
  expect(isConfirmedByVehicle.value).toBe(false)

  missionStore.homeMarkerSource = 'vehicle'
  expect(isConfirmedByVehicle.value).toBe(true)

  // A home written before the vehicle id arrived stays unsigned until that id is stamped on the claim.
  missionStore.homeMarkerVehicleId = undefined
  expect(isConfirmedByVehicle.value).toBe(false)
  missionStore.homeMarkerVehicleId = 'veh-a'
  expect(isConfirmedByVehicle.value).toBe(true)

  // The position, the claim, and the vehicle id stay once the link drops. The vehicle is no longer standing behind them.
  vehicleStore.isVehicleOnline = false
  expect(isConfirmedByVehicle.value).toBe(false)
  expect(missionStore.homeMarkerPosition).toEqual([-27.5, -48.5])
  expect(missionStore.homeMarkerSource).toBe('vehicle')
  expect(vehicleStore.currentlyConnectedVehicleId).toBe('veh-a')

  // Same vehicle, same id: coming back online re-confirms. A different vehicle does not.
  vehicleStore.isVehicleOnline = true
  expect(isConfirmedByVehicle.value).toBe(true)
  vehicleStore.currentlyConnectedVehicleId = 'veh-b'
  expect(isConfirmedByVehicle.value).toBe(false)
  vehicleStore.currentlyConnectedVehicleId = 'veh-a'
  expect(isConfirmedByVehicle.value).toBe(true)

  scope.stop()
})

test('a caller that is not displaying home does not ask the vehicle for it', async () => {
  resetStores()
  const isDisplayingHome = ref(false)

  const scope = effectScope()
  scope.run(() => useVehicleHomePosition(() => isDisplayingHome.value))

  vehicleStore.isVehicleOnline = true
  await nextTick()
  expect(fetchHomeWaypoint).not.toHaveBeenCalled()

  isDisplayingHome.value = true
  await nextTick()
  expect(fetchHomeWaypoint).toHaveBeenCalledTimes(1)

  scope.stop()
})
