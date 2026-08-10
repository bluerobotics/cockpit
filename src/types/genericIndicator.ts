/**
 * Variables that define generic indicator
 */
export interface VeryGenericIndicatorPreset {
  /**
   * Name to be displayed on the widget
   */
  displayName: string
  /**
   * Name of the variable to be fetched
   */
  variableName: string
  /**
   * Name of the icon to be used. Either an MDI class name (e.g. `mdi-thermometer`) or a custom
   * icon reference (`custom:<id>`) pointing to the user's uploaded SVG icon library.
   */
  iconName: string
  /**
   * Symbols representing the unit system of the variable
   */
  variableUnit: string
  /**
   * Value that multiplies the original value to bring it to a representative unit system
   */
  variableMultiplier: number
  /**
   * Fixed decimal places for the displayed value. When omitted, auto-formatting is used.
   */
  decimalPlaces?: number
}

export const veryGenericIndicatorPresets: VeryGenericIndicatorPreset[] = [
  {
    displayName: 'Cam Tilt',
    variableName: 'CamTilt',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    displayName: 'Cam Pan',
    variableName: 'CamPan',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    displayName: 'Water Temp',
    variableName: 'SCALED_PRESSURE2/temperature',
    iconName: 'mdi-thermometer',
    variableUnit: '°C',
    variableMultiplier: 0.01,
  },
  {
    displayName: 'Tether Turns',
    variableName: 'TetherTrn',
    iconName: 'mdi-horizontal-rotate-clockwise',
    variableUnit: 'x',
    variableMultiplier: 1,
  },
  {
    displayName: 'Lights (1)',
    variableName: 'Lights1',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    displayName: 'Lights (2)',
    variableName: 'Lights2',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    displayName: 'Pilot Gain',
    variableName: 'PilotGain',
    iconName: 'mdi-account-hard-hat',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    displayName: 'Input Hold',
    variableName: 'InputHold',
    iconName: 'mdi-gesture-tap-hold',
    variableUnit: '',
    variableMultiplier: 1,
  },
  {
    displayName: 'Roll Pitch',
    variableName: 'RollPitch',
    iconName: 'mdi-controller',
    variableUnit: '',
    variableMultiplier: 1,
  },
  {
    displayName: 'Altitude',
    variableName: 'RANGEFINDER/distance',
    iconName: 'mdi-arrow-collapse-down',
    variableUnit: 'm',
    variableMultiplier: 1,
  },
  {
    displayName: 'Speed',
    variableName: 'VFR_HUD/groundspeed',
    iconName: 'mdi-speedometer',
    variableUnit: 'm/s',
    variableMultiplier: 1,
    decimalPlaces: 1,
  },
  {
    // The Celsius 2 reports through the battery monitor, so its reading arrives as the temperature of
    // battery instance 0 (`TEMP2_SRC_ID: 1` on the vehicle, which ArduPilot decrements), in centidegrees.
    displayName: 'Celsius 2',
    variableName: 'BATTERY_STATUS/id=0/temperature',
    iconName: 'mdi-thermometer',
    variableUnit: '°C',
    variableMultiplier: 0.01,
    decimalPlaces: 1,
  },
]
