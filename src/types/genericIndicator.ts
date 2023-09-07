/**
 * Variables that define generic indicator
 */
export interface GenericIndicatorTemplate {
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
   * Value that multiplies the original value to bring it to a representative unit system
   */
  variableMultiplier: number
}

export const genericIndicatorTemplates: GenericIndicatorTemplate[] = [
  {
    variableName: 'CamTilt',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    variableName: 'CamPan',
    iconName: 'mdi-camera-retake',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    variableName: 'TetherTrn',
    iconName: 'mdi-horizontal-rotate-clockwise',
    variableUnit: 'x',
    variableMultiplier: 100,
  },
  {
    variableName: 'Lights1',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    variableName: 'Lights2',
    iconName: 'mdi-flashlight',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    variableName: 'PilotGain',
    iconName: 'mdi-account-hard-hat',
    variableUnit: '%',
    variableMultiplier: 100,
  },
  {
    variableName: 'InputHold',
    iconName: 'mdi-gesture-tap-hold',
    variableUnit: '',
    variableMultiplier: 1,
  },
  {
    variableName: 'RollPitch',
    iconName: 'mdi-controller',
    variableUnit: '',
    variableMultiplier: 1,
  },
]
