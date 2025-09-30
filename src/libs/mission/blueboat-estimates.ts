import { defaultVehicleBatteryPack } from '@/assets/defaults'
import { MissionEstimatesByVehicleConfig, MissionLeg, VehicleMissionEstimate, Waypoint } from '@/types/mission'

import { BatteryChemistry } from '../vehicle/types'
import {
  batteryDensityPreChemistry,
  bearingBetween,
  computeMissionDurationSecondsFromLegs,
  deltaBearing,
} from './general-estimates'

// (from field tests generated tables) Power estimates for BlueROV2 in Watts per speed in m/s
// No Ping1D:  (v,P) ≈ {(0.5,2.08),(1.0,12.59),(1.5,113.9),(2.0,197.8),(2.5,400.0),(2.78,507.6)}
// With Ping1D: (v,P) ≈ {(1.0,20.4),(1.5,91.2),(2.0,251.0),(2.5,407.4)}
// LS fit of P = K * v^α  →  No Ping: K≈19.13, α≈3.33;  Ping1D: K≈21.94, α≈3.33
export const noPingK = 19.13
export const pingK = 21.94
export const blueBoatAlpha = 3.33

// Mass penalty: ~0.68 W/kg @ 1 m/s (from field tests with BlueROV2 + 8kg payload)
export const massSlopeWattsPerKgAt1Mps = 0.68
export const speedExponent = 3.2

// Calculates power at a given speed (includes drag curve + mass penalty)
const powerAtSpeed = (velocity: number, extraMassKg: number, K: number, alpha: number): number => {
  const guardedVelocity = Math.max(0.5, Number(velocity) || 0.5) // guard against tiny/invalid
  const pHydro = K * Math.pow(guardedVelocity, alpha)
  const powerAtMassAt1 = massSlopeWattsPerKgAt1Mps * Math.max(0, extraMassKg) // W at 1 m/s with extra payload
  const powerAtMass = powerAtMassAt1 * Math.pow(guardedVelocity, alpha)
  return Math.max(2, pHydro + powerAtMass)
}

// Vehicle turning time penalty in seconds
// #TODO optimize with MAVLink parameters from BlueOS
const computeTurnPenaltySeconds = (waypoints: Waypoint[]): number => {
  const wps = Array.isArray(waypoints) ? waypoints : []
  let secs = 0
  if (wps.length >= 2) secs += 1 // adds deceleration time
  for (let i = 1; i < wps.length - 1; i++) {
    const prev = wps[i - 1].coordinates
    const cur = wps[i].coordinates
    const next = wps[i + 1].coordinates
    const diff = deltaBearing(bearingBetween(prev, cur), bearingBetween(cur, next))
    if (diff > 45) secs += 1 + 1 + Math.ceil(diff / 15)
  }
  return secs
}

// Energy consumption estimate (Wh) using legs & mass model
const computeMissionEnergyInWh = (legs: MissionLeg[], extraMassKg: number, hasPing: boolean): number => {
  if (!Array.isArray(legs) || legs.length === 0) return 0

  const K = hasPing ? pingK : noPingK
  const alpha = blueBoatAlpha

  let consumedEnergy = 0
  for (const leg of legs) {
    const v = Math.max(0.1, leg.speedMps)
    const p = powerAtSpeed(v, extraMassKg, K, alpha)
    const t = leg.distanceMeters / v
    consumedEnergy += (p * t) / 3600
  }
  return consumedEnergy
}

export const blueBoatMissionEstimate: VehicleMissionEstimate = {
  timeToCompleteMission: (inputs: MissionEstimatesByVehicleConfig): number => {
    const base = computeMissionDurationSecondsFromLegs(inputs.legs)
    if (!Number.isFinite(base) || base <= 0) return 0
    const penalty = computeTurnPenaltySeconds(inputs.waypoints)
    return base + penalty
  },

  totalEnergy: (inputs: MissionEstimatesByVehicleConfig): number => {
    const batteryCapacityWh = Number(inputs.batteryCapacityWh ?? 2 * 266.4)
    const chem = (inputs.batteryChemistry ?? 'li-ion') as BatteryChemistry
    const kgPerWh = batteryDensityPreChemistry[chem] ?? batteryDensityPreChemistry['li-ion']
    const batteryMassKg = batteryCapacityWh * kgPerWh
    let originalBatteryMassKg = Number(defaultVehicleBatteryPack[inputs.vehicleType] ?? 0)

    if (originalBatteryMassKg > 100) {
      originalBatteryMassKg = originalBatteryMassKg / 1000
    }

    const payloadKg = Number(inputs.extraPayloadKg ?? 0)
    const hasHighDragSensor = Boolean(inputs.hasHighDragSensor)
    const deltaBatteryMassKg = Math.max(0, batteryMassKg - originalBatteryMassKg)
    const extraMassKg = Math.max(0, payloadKg) + deltaBatteryMassKg

    return computeMissionEnergyInWh(inputs.legs, extraMassKg, hasHighDragSensor)
  },
}
