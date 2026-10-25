import { v4 as uuid } from 'uuid'

import { settingsManager } from './settings-management'

const diyWidgetLibraryKey = 'cockpit-diy-widget-library'

/**
 * The code of a DIY widget, kept in the library so it can be placed again or shared without a view holding it
 */
export interface DiyWidgetTemplate {
  /**
   * Name shown in the library, and given to the widgets placed from it
   */
  name: string
  /**
   * HTML of the widget
   */
  html: string
  /**
   * CSS of the widget
   */
  css: string
  /**
   * JavaScript of the widget
   */
  js: string
  /**
   * Whether the widget takes Cockpit's glass styles
   */
  inheritCockpitStyles: boolean
  /**
   * Whether the widget's script runs in its own scope
   */
  scopedScript: boolean
}

// Writes to the settings manager are debounced, so reading it back right after a save would return the old library.
let templates: Record<string, DiyWidgetTemplate> = structuredClone(
  settingsManager.getKeyValue<Record<string, DiyWidgetTemplate>>(diyWidgetLibraryKey) ?? {}
)
settingsManager.registerListener(diyWidgetLibraryKey, (setting) => {
  templates = structuredClone((setting.value as Record<string, DiyWidgetTemplate> | null) ?? {})
})

/**
 * Every template in the library, keyed by id
 * @returns {Record<string, DiyWidgetTemplate>} A copy of the library
 */
export const getAllDiyWidgetTemplates = (): Record<string, DiyWidgetTemplate> => structuredClone(templates)

/**
 * Save a template to the library, replacing the one already stored under the same id
 * @param {DiyWidgetTemplate} template - The template to save
 * @param {string} id - Id to store it under. A new one is made when omitted
 * @returns {string} The id the template was stored under
 */
export const saveDiyWidgetTemplate = (template: DiyWidgetTemplate, id: string = uuid()): string => {
  templates[id] = structuredClone(template)
  settingsManager.setKeyValue(diyWidgetLibraryKey, structuredClone(templates))
  return id
}

/**
 * Remove a template from the library
 * @param {string} id - The template's id
 */
export const deleteDiyWidgetTemplate = (id: string): void => {
  delete templates[id]
  settingsManager.setKeyValue(diyWidgetLibraryKey, structuredClone(templates))
}
