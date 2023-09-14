/**
 * Variables that define generic indicator
 */
export interface GenericIndicatorTemplate {
  /**
   * Name to be displayed on the widget
   */
  displayName: string
  /**
   * Name of the variable to be fetched
   */
  variableName: string
  /**
   * Name of the icon to be used (only supporting MDI icons currently)
   */
  iconName: string
  /**
   * Symbols representing the unit system of the variable
   */
  variableUnit: string
  /**
   * Number of digits to be displayed after the decimal separator (usually dot)
   */
  fractionalDigits: number
  /**
   * Value that multiplies the original value to bring it to a representative unit system
   */
  variableMultiplier: number
}

export const genericIndicatorTemplates: GenericIndicatorTemplate[] = [
  {
    displayName: 'Cam Tilt',
    variableName: 'CamTilt',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Cam Pan',
    variableName: 'CamPan',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Tether Turns',
    variableName: 'TetherTrn',
    iconName: 'mdi-horizontal-rotate-clockwise',
    variableUnit: 'x',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Lights (1)',
    variableName: 'Lights1',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Lights (2)',
    variableName: 'Lights2',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Pilot Gain',
    variableName: 'PilotGain',
    iconName: 'mdi-account-hard-hat',
    variableUnit: '%',
    fractionalDigits: 0,
    variableMultiplier: 100,
  },
  {
    displayName: 'Input Hold',
    variableName: 'InputHold',
    iconName: 'mdi-gesture-tap-hold',
    variableUnit: '',
    fractionalDigits: 0,
    variableMultiplier: 1,
  },
  {
    displayName: 'Roll Pitch',
    variableName: 'RollPitch',
    iconName: 'mdi-controller',
    variableUnit: '',
    fractionalDigits: 0,
    variableMultiplier: 1,
  },
]
