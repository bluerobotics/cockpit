import { describe, expect, it } from 'vitest'

import { isIndicatorAsShipped } from '@/libs/generic-indicator'
import { type MiniWidget, MiniWidgetType } from '@/types/widgets'

// The speed indicator Cockpit ships in the ROV profile's bottom bar.
const shippedSpeedIndicator: MiniWidget = {
  hash: 'dfa95e38-47e0-4656-b863-c22029b89862',
  name: 'Speed (GPS)',
  component: MiniWidgetType.VeryGenericIndicator,
  options: {
    displayName: 'Speed (GPS)',
    variableName: 'VFR_HUD/groundspeed',
    iconName: 'mdi-speedometer',
    variableUnit: 'm/s',
    variableMultiplier: 1,
    decimalPlaces: 1,
    widgetWidth: 160,
  },
}

// Pilot Gain ships on the same bar, with a hard-coded percentage — not the variable's unit.
const shippedPilotGainIndicator: MiniWidget = {
  hash: '2f720389-4037-4523-9b98-249cf9640289',
  name: 'VeryGenericIndicator',
  component: MiniWidgetType.VeryGenericIndicator,
  options: {
    displayName: 'Pilot Gain',
    variableName: 'PilotGain',
    iconName: 'mdi-account-hard-hat',
    variableUnit: '%',
    variableMultiplier: 100,
  },
}

describe('isIndicatorAsShipped', () => {
  it('recognizes an indicator left as Cockpit shipped it', () => {
    expect(isIndicatorAsShipped(shippedSpeedIndicator)).toBe(true)
  })

  it('ignores changes that say nothing about the value', () => {
    const renamed = {
      ...shippedSpeedIndicator,
      options: { ...shippedSpeedIndicator.options, displayName: 'Velocidade', iconName: 'mdi-rocket' },
    }
    expect(isIndicatorAsShipped(renamed)).toBe(true)
  })

  it('leaves an indicator whose unit the user changed alone', () => {
    const retuned = {
      ...shippedSpeedIndicator,
      options: { ...shippedSpeedIndicator.options, variableUnit: 'kn', variableMultiplier: 1.94384 },
    }
    expect(isIndicatorAsShipped(retuned)).toBe(false)
  })

  it('recognizes a shipped indicator after the defaults importer re-hashed it', () => {
    const rehashed = { ...shippedSpeedIndicator, hash: '00000000-0000-0000-0000-000000000000' }
    expect(isIndicatorAsShipped(rehashed)).toBe(true)
  })

  it('leaves a shipped percentage readout on its hard-coded unit', () => {
    expect(isIndicatorAsShipped(shippedPilotGainIndicator)).toBe(false)
  })

  it('leaves an indicator the user created alone', () => {
    const userMade = {
      ...shippedSpeedIndicator,
      hash: '00000000-0000-0000-0000-000000000000',
      options: { ...shippedSpeedIndicator.options, variableName: 'my-custom-speed' },
    }
    expect(isIndicatorAsShipped(userMade)).toBe(false)
  })
})
