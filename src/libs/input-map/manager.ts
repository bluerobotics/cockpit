import { Action } from './actions'

type Callback = () => void

/**
 * Input Map Manager
 */
class InputMapManager {
  private static instance = new InputMapManager()
  private static actionMapper = new Map<Action, Callback>()

  /**
   * Singleton constructor
   */
  private constructor() {
    // Makes constructor private
  }

  /**
   * Singleton access
   *
   * @returns {InputMapManager}
   */
  static self(): InputMapManager {
    return InputMapManager.instance
  }

  /**
   * Register a specific action to be used
   *
   * @param {Action} action Action type
   * @param {Callback} callback Action event
   */
  registerAction(action: Action, callback: Callback): void {
    InputMapManager.actionMapper.set(action, callback)
  }

  /**
   * Run a specific action
   *
   * @param {Action} action
   */
  static run(action: Action): void {
    const callback = this.actionMapper.get(action)
    callback && callback()
  }
}

export const inputMapManager = InputMapManager.self()
