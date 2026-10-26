import { expect, test, vi } from 'vitest'

import { setDataLakeVariableData } from '@/libs/actions/data-lake'
import { evaluateDataLakeExpression } from '@/libs/actions/data-lake-transformations'
import { isRangefinderSeafloorDepthVariableId, rangefinderSeafloorDepthFunction } from '@/libs/data-sources/rangefinder'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: (): undefined => undefined, setKeyValue: (): void => undefined },
}))

const sources = {
  rangefinderVariableId: '/mavlink/1/194/DISTANCE_SENSOR/id=0/current_distance',
  altitudeVariableId: '/mavlink/1/1/GLOBAL_POSITION_INT/relative_alt',
  metersPerAltitudeUnit: 0.001,
  attitudePath: '/mavlink/1/1/ATTITUDE',
}

const setReadings = (distanceCm: number, altitudeMm: number, roll: number, pitch: number): void => {
  setDataLakeVariableData(sources.rangefinderVariableId, distanceCm)
  setDataLakeVariableData(sources.altitudeVariableId, altitudeMm)
  setDataLakeVariableData(`${sources.attitudePath}/roll`, roll)
  setDataLakeVariableData(`${sources.attitudePath}/pitch`, pitch)
}

test('the seafloor sits the vertical component of the measured distance below the vehicle', () => {
  const seafloorDepth = rangefinderSeafloorDepthFunction(sources)

  setReadings(250, -3000, 0, 0)
  expect(evaluateDataLakeExpression(seafloorDepth.expression)).toBeCloseTo(5.5)

  // Pitched down by 60 degrees, the beam travels twice as far as the seafloor is below the vehicle
  setReadings(500, -3000, 0, Math.PI / 3)
  expect(evaluateDataLakeExpression(seafloorDepth.expression)).toBeCloseTo(5.5)

  // A sensor that lost the bottom reports no distance, which must not put the seafloor at the vehicle's depth
  setReadings(0, -3000, 0, 0)
  expect(evaluateDataLakeExpression(seafloorDepth.expression)).toBeNaN()

  expect(isRangefinderSeafloorDepthVariableId(seafloorDepth.id)).toBe(true)
  expect(isRangefinderSeafloorDepthVariableId(sources.rangefinderVariableId)).toBe(false)
})
