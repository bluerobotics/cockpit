import type { AutoRunConfig } from '@/libs/actions/auto-run'
import type { TransformingFunction } from '@/libs/actions/data-lake-transformations'
import type { DiyWidgetTemplate } from '@/libs/diy-widget-library'
import type { DataLakeVariable } from '@/types/data-lake'

import type {
  customActionTypes,
  HttpRequestActionConfig,
  JavascriptActionConfig,
  MavlinkMessageActionConfig,
} from './cockpit-actions'

export const recipeFileType = 'cockpit-recipe'
export const recipeFormatVersion = 1

/**
 * A user data lake variable carried by a recipe
 */
export interface RecipeDataLakeVariable {
  /**
   * The variable's definition
   */
  variable: DataLakeVariable
  /**
   * The value it had when the recipe was made, kept only for variables that persist their value
   */
  value?: string | number | boolean
}

/**
 * A custom action carried by a recipe, under the id other actions, widgets and joystick mappings call it by
 */
export type RecipeAction = {
  /**
   * The action's id
   */
  id: string
  /**
   * The data lake variables whose changes run the action, and the least time between runs, in milliseconds
   */
  link?: {
    /**
     * Ids of the variables that trigger the action
     */
    variables: string[]
    /**
     * Least time between runs, in milliseconds
     */
    minInterval: number
  }
  /**
   * When the action runs by itself, once after Cockpit starts or repeatedly
   */
  autoRun?: AutoRunConfig
} & (
  | {
      /**
       * Type of the action
       */
      type: customActionTypes.httpRequest
      /**
       * The action's configuration
       */
      config: HttpRequestActionConfig
    }
  | {
      /**
       * Type of the action
       */
      type: customActionTypes.mavlinkMessage
      /**
       * The action's configuration
       */
      config: MavlinkMessageActionConfig
    }
  | {
      /**
       * Type of the action
       */
      type: customActionTypes.javascript
      /**
       * The action's configuration
       */
      config: JavascriptActionConfig
    }
)

/**
 * A DIY widget from the library, carried by a recipe
 */
export interface RecipeDiyWidget {
  /**
   * The id the widget is stored under in the library
   */
  id: string
  /**
   * The widget's code
   */
  template: DiyWidgetTemplate
}

/**
 * A bundle of user-made data lake variables, actions, WebSocket connections and DIY widgets, made to be shared and
 * read back as a whole
 */
export interface CockpitRecipe {
  /**
   * Marks the file as a recipe
   */
  type: typeof recipeFileType
  /**
   * Version of the recipe format
   */
  version: typeof recipeFormatVersion
  /**
   * Name of the recipe
   */
  name: string
  /**
   * What the recipe is for
   */
  description: string
  /**
   * When the recipe was made, as an ISO 8601 string
   */
  createdAt: string
  /**
   * User data lake variables
   */
  dataLakeVariables: RecipeDataLakeVariable[]
  /**
   * User compound variables
   */
  compoundVariables: TransformingFunction[]
  /**
   * Custom actions
   */
  actions: RecipeAction[]
  /**
   * Generic WebSocket connection URLs
   */
  websocketConnections: string[]
  /**
   * DIY widgets from the library
   */
  diyWidgets: RecipeDiyWidget[]
}

/**
 * The parts of a recipe, each shown in its own tab
 */
export type RecipeArea = 'dataLake' | 'actions' | 'websockets' | 'diyWidgets'

/**
 * One entry of a recipe, as the recipe dialogs list it
 */
export interface RecipeItem {
  /**
   * Unique among every item, across areas
   */
  key: string
  /**
   * The tab the item is listed in
   */
  area: RecipeArea
  /**
   * What the item is, e.g. 'Compound variable' or 'HTTP Request'
   */
  kind: string
  /**
   * Name shown for the item
   */
  name: string
  /**
   * Id or URL of the item
   */
  id: string
}
