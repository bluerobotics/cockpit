import Konva from 'konva'

export type LiveTexts = {
  /**
   * Live pitch indicator text
   */
  pitch: Konva.TextConfig
  /**
   * Live roll indicator text
   */
  roll: Konva.TextConfig
}

export type PitchLines = {
  /**
   * Configuration for the left pitch horizontal lines
   */
  left: PitchLineConfigs
  /**
   * Configuration for the right pitch horizontal lines
   */
  right: PitchLineConfigs
}

export type PitchLineConfigs = {
  /**
   *
   */
  [angle: string]: {
    /**
     * Configuration for the line
     */
    lineConfig: Konva.LineConfig
    /**
     * Configuration for the text part of the line
     */
    textConfig: Konva.TextConfig
    /**
     * Configuration for the line + text group
     */
    groupConfig: Konva.GroupConfig
  }
}

export type RenderVariables = {
  /**
   * Rendering roll value, in degrees
   */
  rollDegrees: number
  /**
   * Vertical height of the pitch line for each angle
   */
  pitchLinesHeights: { [angle: string]: number }
}
