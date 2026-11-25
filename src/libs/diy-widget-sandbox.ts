import {
  createDataLakeVariable,
  dataLakeVariableData,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  getDataLakeVariableLastUpdateTimestamp,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import type { DiyWidgetTemplate } from '@/libs/diy-widget-library'
import { diyWidgetStorage, diyWidgetStorageLimit, saveDiyWidgetStorage } from '@/libs/diy-widget-storage'
import {
  type CockpitActionsFunction,
  availableCockpitActions,
  CockpitAction,
  deleteAction,
  executeActionCallback,
  registerActionCallback,
  registerNewAction,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { canUserChangeDataLakeVariable, canUserDeleteDataLakeVariable } from '@/libs/utils-data-lake'
import type { DataLakeVariable } from '@/types/data-lake'

type DataLakeValue = string | number | boolean

/**
 * What a DIY widget frame answers its synchronous reads from, as it is at one moment
 */
export interface DiyWidgetFrameState {
  /**
   * Every data-lake variable's value, by id
   */
  values: Record<string, DataLakeValue | undefined>
  /**
   * When each variable was last set, in ms since the epoch, by id
   */
  timestamps: Record<string, number | undefined>
  /**
   * Every variable's description, by id
   */
  infos: Record<string, DataLakeVariable>
  /**
   * Every Cockpit action's id and name, by id
   */
  actions: Record<string, Pick<CockpitAction, 'id' | 'name'>>
  /**
   * The widget's own localStorage items
   */
  storage: Record<string, string>
}

/**
 * A font of Cockpit's page, handed to a DIY widget frame as data since the frame cannot fetch Cockpit's files
 */
export interface DiyWidgetFont {
  /**
   * The font family
   */
  family: string
  /**
   * The font file
   */
  source: ArrayBuffer
  /**
   * The @font-face descriptors other than the family and source
   */
  descriptors: FontFaceDescriptors
}

/**
 * Message a DIY widget frame receives from Cockpit
 */
export type DiyWidgetFrameMessage =
  | {
      /**
       * A data-lake variable the frame listens to changed
       */
      type: 'value'
      /**
       * Listener the value is for
       */
      listenerId: string
      /**
       * The new value
       */
      value: DataLakeValue
      /**
       * When the variable was last set, in ms since the epoch
       */
      timestamp: number | undefined
    }
  | {
      /**
       * Cockpit refused a write, so the frame's cache goes back to the variable's actual value
       */
      type: 'restore'
      /**
       * The variable
       */
      variableId: string
      /**
       * Its actual value
       */
      value: DataLakeValue | undefined
    }
  | ({
      /**
       * The state as it is when the frame has loaded, refreshing the one its document was built with
       */
      type: 'snapshot'
    } & DiyWidgetFrameState)
  | ({
      /**
       * The data lake's values as they are now, after the frame listed its variables
       */
      type: 'values'
    } & Pick<DiyWidgetFrameState, 'values' | 'timestamps'>)
  | {
      /**
       * Cockpit's fonts, for the frame to add to its document
       */
      type: 'fonts'
      /**
       * The fonts
       */
      fonts: DiyWidgetFont[]
    }
  | {
      /**
       * The data lake's variables changed
       */
      type: 'infos'
      /**
       * Every variable's description, by id
       */
      infos: Record<string, DataLakeVariable>
    }
  | {
      /**
       * Cockpit's actions changed, after the frame added or removed one or was refused
       */
      type: 'actions'
      /**
       * Every action's id and name, by id
       */
      actions: DiyWidgetFrameState['actions']
    }
  | {
      /**
       * Cockpit could not keep a localStorage write, so the frame's item goes back to what Cockpit holds
       */
      type: 'storageRestore'
      /**
       * The item
       */
      key: string
      /**
       * What Cockpit holds for it, or null when nothing
       */
      value: string | null
    }
  | {
      /**
       * One of the frame's actions was triggered, so the frame runs its callback
       */
      type: 'runAction'
      /**
       * The action
       */
      actionId: string
    }

const channel = 'cockpit-diy-widget'

// Runs inside the frame ahead of the user's markup, so it ships as source rather than as compiled code.
const bridgeScript = (frameId: string, state: DiyWidgetFrameState): string => `
(() => {
  const frameId = ${JSON.stringify(frameId)}
  const post = (message) => window.parent.postMessage({ channel: '${channel}', frameId, ...message }, '*')
  // Every new document, however the frame came to reload, starts by saying so, ahead of any request.
  post({ type: 'hello' })
  const listeners = new Map()
  let lastId = 0
  // Cockpit's reads are synchronous, so the frame answers them from a cache Cockpit fills on load and keeps current.
  const canonical = (id) => String(id).replace(/^\\/+/, '')
  const values = new Map()
  const writtenIds = new Map()
  const timestamps = new Map()
  let infos = {}
  const actions = {}
  const actionCallbacks = new Map()
  const storageItems = new Map()
  // Keys this document wrote are its own, so a refresh from Cockpit that raced the write does not undo it.
  const storageWrites = new Set()
  // Cockpit sends times since the epoch, which this frame turns back into its own performance.now() clock.
  const frameClock = (timestamp) => (timestamp === undefined ? undefined : timestamp - performance.timeOrigin)
  const applyValues = (state) => {
    Object.entries(state.values).forEach(([id, value]) => {
      values.set(canonical(id), value)
      writtenIds.set(canonical(id), id)
    })
    Object.entries(state.timestamps).forEach(([id, timestamp]) => timestamps.set(canonical(id), frameClock(timestamp)))
  }
  const applyState = (state) => {
    infos = state.infos
    applyValues(state)
    Object.keys(actions).forEach((id) => delete actions[id])
    Object.assign(actions, state.actions)
    ;[...storageItems.keys()].filter((key) => !storageWrites.has(key) && !(key in state.storage)).forEach((key) => storageItems.delete(key))
    Object.entries(state.storage).forEach(([key, value]) => storageWrites.has(key) || storageItems.set(key, value))
  }
  applyState(${JSON.stringify(state).replace(/</g, '\\u003c')})
  const watched = new Map()
  let listing = false
  let refreshing = false
  const watch = (variableId, withTimestamp) => {
    const id = canonical(variableId)
    const current = watched.get(id)
    if (current === true || current === withTimestamp) return
    const listenerId = 'cache:' + id
    if (current !== undefined) post({ type: 'unlisten', listenerId })
    watched.set(id, withTimestamp)
    listeners.set(listenerId, (value, timestamp) => {
      values.set(id, value)
      timestamps.set(id, frameClock(timestamp))
    })
    post({ type: 'listen', variableId: id, listenerId, notifyOnTimestampChange: withTimestamp })
  }
  const reportError = (error) => post({ type: 'error', message: String(error) })
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return
    const message = event.data
    if (message.type === 'value') listeners.get(message.listenerId)?.(message.value, message.timestamp)
    if (message.type === 'restore') values.set(canonical(message.variableId), message.value)
    if (message.type === 'storageRestore') {
      if (message.value === null) storageItems.delete(message.key)
      else storageItems.set(message.key, message.value)
    }
    if (message.type === 'infos') infos = message.infos
    if (message.type === 'actions') {
      Object.keys(actions).forEach((id) => delete actions[id])
      Object.assign(actions, message.actions)
    }
    if (message.type === 'snapshot' || message.type === 'values') refreshing = false
    if (message.type === 'snapshot') applyState(message)
    if (message.type === 'values') applyValues(message)
    if (message.type === 'fonts') {
      message.fonts.forEach(({ family, source, descriptors }) => document.fonts.add(new FontFace(family, source, descriptors)))
    }
    if (message.type === 'runAction') {
      const callback = actionCallbacks.get(message.actionId)
      if (callback) Promise.resolve().then(callback).catch(reportError)
    }
  })
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
  const getDataLakeVariableData = (variableId) => {
    watch(variableId, false)
    return values.get(canonical(variableId))
  }
  const setDataLakeVariableData = (variableId, value) => {
    // Watching first makes Cockpit's answer to the write reach the cache, after the value the frame assumed.
    watch(variableId, false)
    values.set(canonical(variableId), value)
    post({ type: 'set', variableId, value })
  }
  // ponytail: listing answers from the cache, refreshed once per listing, rather than watching every variable, which
  // would post each MAVLink update to the frame until it reloads; reads made in the same turn as the listing are one
  // refresh behind, and listing every frame sends the whole lake each time, bounded to one refresh in flight.
  const listVariables = () => {
    if (!listing) {
      listing = true
      queueMicrotask(() => {
        listing = false
      })
    }
    if (!refreshing) {
      refreshing = true
      post({ type: 'refresh' })
    }
    return [...values.keys()].map((id) => writtenIds.get(id) ?? id)
  }
  const variableKey = (key) => (typeof key === 'string' ? writtenIds.get(canonical(key)) ?? key : undefined)
  // Cockpit's own dataLakeVariableData is a live object, which this one stands in for over the frame's cache.
  const dataLakeVariableData = new Proxy({}, {
    get: (_target, key) => {
      // JSON.stringify and await probe these on any object, which is no reason to watch a variable by that name.
      if (typeof key !== 'string' || key === 'toJSON' || key === 'then') return undefined
      return listing ? values.get(canonical(key)) : getDataLakeVariableData(key)
    },
    set: (_target, key, value) => {
      if (typeof key === 'string') setDataLakeVariableData(key, value)
      return true
    },
    has: (_target, key) => typeof key === 'string' && values.has(canonical(key)),
    ownKeys: listVariables,
    getOwnPropertyDescriptor: (_target, key) => {
      const id = variableKey(key)
      return id !== undefined && values.has(canonical(id))
        ? { value: values.get(canonical(id)), enumerable: true, configurable: true, writable: true }
        : undefined
    },
  })
  const storageSize = () => [...storageItems].reduce((size, [key, value]) => size + key.length + value.length, 0)
  const makeStorage = (items, persist) => {
    const api = {
      getItem: (key) => items.get(String(key)) ?? null,
      setItem: (key, value) => {
        key = String(key)
        value = String(value)
        const previous = items.get(key)
        items.set(key, value)
        if (persist && storageSize() > ${diyWidgetStorageLimit}) {
          if (previous === undefined) items.delete(key)
          else items.set(key, previous)
          throw new DOMException('The widget storage is full', 'QuotaExceededError')
        }
        if (persist) {
          storageWrites.add(key)
          post({ type: 'storageSet', key, value })
        }
      },
      removeItem: (key) => {
        key = String(key)
        items.delete(key)
        if (persist) {
          storageWrites.add(key)
          post({ type: 'storageRemove', key })
        }
      },
      clear: () => {
        items.forEach((_value, key) => persist && storageWrites.add(key))
        items.clear()
        if (persist) post({ type: 'storageClear' })
      },
      key: (index) => [...items.keys()][index] ?? null,
      get length() {
        return items.size
      },
    }
    return new Proxy(api, {
      get: (target, key) => (key in target ? target[key] : typeof key === 'string' ? items.get(key) : undefined),
      set: (target, key, value) => {
        if (typeof key === 'string' && !(key in target)) target.setItem(key, value)
        return true
      },
      deleteProperty: (target, key) => {
        if (typeof key === 'string') target.removeItem(key)
        return true
      },
      has: (target, key) => key in target || items.has(key),
      ownKeys: () => [...items.keys()],
      getOwnPropertyDescriptor: (_target, key) =>
        items.has(key) ? { value: items.get(key), enumerable: true, configurable: true, writable: true } : undefined,
    })
  }
  // An opaque-origin frame has no storage of its own, so the widget's localStorage lives in Cockpit, per widget.
  Object.defineProperty(window, 'localStorage', { value: makeStorage(storageItems, true), configurable: true })
  Object.defineProperty(window, 'sessionStorage', { value: makeStorage(new Map(), false), configurable: true })
  window.cockpit = {
    dataLakeVariableData,
    listenDataLakeVariable: (variableId, callback, options) => {
      const listenerId = String(++lastId)
      listeners.set(listenerId, (value) => callback(value))
      post({ type: 'listen', variableId, listenerId, notifyOnTimestampChange: options?.notifyOnTimestampChange === true })
      return listenerId
    },
    unlistenDataLakeVariable: (variableId, listenerId) => {
      listeners.delete(listenerId)
      post({ type: 'unlisten', listenerId })
    },
    getDataLakeVariableData,
    getDataLakeVariableInfo: (variableId) => Object.values(infos).find((info) => canonical(info.id) === canonical(variableId)),
    getAllDataLakeVariablesInfo: () => ({ ...infos }),
    getDataLakeVariableLastUpdateTimestamp: (variableId) => {
      watch(variableId, true)
      return timestamps.get(canonical(variableId))
    },
    setDataLakeVariableData,
    createDataLakeVariable: (variable, initialValue) => post({ type: 'create', variable, initialValue }),
    updateDataLakeVariableInfo: (variable) => post({ type: 'updateInfo', variable }),
    deleteDataLakeVariable: (variableId) => post({ type: 'delete', variableId }),
    availableCockpitActions: actions,
    registerNewAction: (action) => {
      actions[action.id] = { id: action.id, name: action.name }
      post({ type: 'registerAction', actionId: action.id, name: action.name })
    },
    deleteAction: (actionId) => {
      delete actions[actionId]
      actionCallbacks.delete(actionId)
      post({ type: 'deleteAction', actionId })
    },
    registerActionCallback: (action, callback) => {
      actionCallbacks.set(action.id, callback)
      post({ type: 'registerCallback', actionId: action.id })
      return action.id
    },
    unregisterActionCallback: (actionId) => {
      actionCallbacks.delete(actionId)
      post({ type: 'unregisterCallback', actionId })
    },
    executeActionCallback: (actionId) => post({ type: 'action', actionId }),
    onCleanup: () => undefined,
    setInterval: window.setInterval.bind(window),
    setTimeout: window.setTimeout.bind(window),
  }
  // The sandbox silently skips these dialogs, so a confirm would read as a refusal.
  ;['alert', 'confirm', 'prompt'].forEach((name) => {
    window[name] = () => { throw new Error(name + ' is not available to DIY widgets, which run isolated from Cockpit') }
  })
})()
`

const baseStyle =
  'html, body { margin: 0; width: 100%; height: 100%; background: transparent; color: white; ' +
  "font-family: 'Roboto', sans-serif; }"

// A literal "</script" in the user's code would close its script element early.
const escapeScript = (code: string): string => code.replace(/<\/(script)/gi, '<\\/$1')

// Scoped code may return early and keeps its declarations local, so it cannot clash with window's own names.
const scopedScript = (code: string): string => `(function (root, cockpit) {\n${code}\n})(document.body, window.cockpit)`

const escapeStyle = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1')

const cssRules = (sheet: CSSStyleSheet): CSSRule[] | undefined => {
  try {
    return Array.from(sheet.cssRules)
  } catch {
    return undefined
  }
}

// ponytail: one copy for every DIY widget, keyed on the stylesheet count so a lazily loaded chunk refreshes it; a sheet
// edited in place (dev HMR) keeps its old copy until the count changes, which a content hash would catch.
let pageStyles: [sheetCount: number, markup: string] | undefined
let pageFonts: [sheetCount: number, fonts: Promise<DiyWidgetFont[]>] | undefined

/**
 * Cockpit's own stylesheets as markup for a DIY widget frame, so widgets keep the classes of the page
 * @returns {string} Cockpit's stylesheets, inlined since the frame cannot load Cockpit's files, except a cross-origin
 *   one, which is linked
 */
export const cockpitStylesheets = (): string => {
  if (pageStyles?.[0] === document.styleSheets.length) return pageStyles[1]
  const markup = Array.from(document.styleSheets)
    .map((sheet) => {
      const rules = cssRules(sheet)
      if (rules === undefined)
        return sheet.href ? `<link rel="stylesheet" href="${sheet.href.replace(/"/g, '&quot;')}">` : ''
      // Fonts reach the frame as data, through cockpitFonts.
      const css = rules.filter((rule) => !(rule instanceof CSSFontFaceRule)).map((rule) => rule.cssText)
      return `<style>${escapeStyle(css.join('\n'))}</style>`
    })
    .join('\n')
  pageStyles = [document.styleSheets.length, markup]
  return markup
}

const fontFiles = new Map<string, Promise<ArrayBuffer | undefined>>()

const fontFile = (url: string): Promise<ArrayBuffer | undefined> => {
  if (!fontFiles.has(url)) {
    const file = fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : undefined))
      .catch(() => undefined)
    fontFiles.set(url, file)
  }
  return fontFiles.get(url) as Promise<ArrayBuffer | undefined>
}

const readCockpitFonts = async (): Promise<DiyWidgetFont[]> => {
  const faces = Array.from(document.styleSheets).flatMap((sheet) =>
    (cssRules(sheet) ?? []).filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
  )
  const fonts = await Promise.all(
    faces.map(async (face): Promise<DiyWidgetFont | undefined> => {
      const url = face.style.getPropertyValue('src').match(/url\(\s*["']?([^"')]+)/)?.[1]
      if (url === undefined) return undefined
      const source = await fontFile(new URL(url, face.parentStyleSheet?.href ?? document.baseURI).href)
      if (source === undefined) return undefined
      const descriptor = (name: string): string | undefined => face.style.getPropertyValue(name) || undefined
      return {
        family: face.style.getPropertyValue('font-family').replace(/^["']|["']$/g, ''),
        source,
        descriptors: {
          style: descriptor('font-style'),
          weight: descriptor('font-weight'),
          unicodeRange: descriptor('unicode-range'),
          display: descriptor('font-display') as FontDisplay | undefined,
        },
      }
    })
  )
  return fonts.filter((font): font is DiyWidgetFont => font !== undefined)
}

/**
 * The fonts Cockpit's own stylesheets declare, fetched once and handed to DIY widget frames
 * @returns {Promise<DiyWidgetFont[]>} Every font whose file could be read
 */
export const cockpitFonts = (): Promise<DiyWidgetFont[]> => {
  if (pageFonts?.[0] !== document.styleSheets.length) pageFonts = [document.styleSheets.length, readCockpitFonts()]
  return pageFonts[1]
}

const actionsSnapshot = (): DiyWidgetFrameState['actions'] =>
  Object.fromEntries(
    Object.values(availableCockpitActions).map(({ id, name }): [string, Pick<CockpitAction, 'id' | 'name'>] => [
      id,
      { id, name },
    ])
  )

// In ms since the epoch, which the frame turns into its own clock.
const lastUpdate = (variableId: string): number | undefined => {
  const timestamp = getDataLakeVariableLastUpdateTimestamp(variableId)
  return timestamp === undefined ? undefined : timestamp + performance.timeOrigin
}

const valuesState = (): Pick<DiyWidgetFrameState, 'values' | 'timestamps'> => ({
  values: dataLakeVariableData,
  timestamps: Object.fromEntries(Object.keys(dataLakeVariableData).map((id) => [id, lastUpdate(id)])),
})

/**
 * What a DIY widget frame answers its synchronous reads from, as it is now
 * @param {string} widgetId - The widget, whose own localStorage items are included
 * @returns {DiyWidgetFrameState} The state
 */
export const diyWidgetFrameState = (widgetId: string): DiyWidgetFrameState => ({
  ...valuesState(),
  infos: getAllDataLakeVariablesInfo(),
  actions: actionsSnapshot(),
  storage: diyWidgetStorage(widgetId),
})

/**
 * Build the document a DIY widget runs in, inside a sandboxed frame that cannot reach Cockpit's page
 * @param {Pick<DiyWidgetTemplate, 'html' | 'css' | 'js' | 'scopedScript'>} code - The widget's code, and whether its
 *   script runs in a function of root and cockpit, as scoped scripts did in Cockpit's page, rather than at top level
 * @param {string} frameId - Id of this load of the frame, carried by every message it sends
 * @param {string} stylesheets - Markup for the stylesheets the widget's own CSS builds on
 * @param {DiyWidgetFrameState} state - What the frame's reads answer from until Cockpit updates it
 * @returns {string} The frame's document, for its srcdoc
 */
export const buildDiyWidgetDocument = (
  code: Pick<DiyWidgetTemplate, 'html' | 'css' | 'js' | 'scopedScript'>,
  frameId: string,
  stylesheets: string,
  state: DiyWidgetFrameState
): string =>
  `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script>${escapeScript(bridgeScript(frameId, state))}</script>
${stylesheets}
<style>${baseStyle}</style>
<style>${escapeStyle(code.css)}</style>
</head>
<body>
${code.html}
<script>${escapeScript(code.scopedScript ? scopedScript(code.js) : code.js)}</script>
</body>
</html>`

const isValue = (value: unknown): value is DataLakeValue =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean'

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const optionalText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const optionalFlag = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined)

// ponytail: a frame's persisted values count against no cap, as when widgets ran in Cockpit's page, so one widget
// storing large strings in many such variables can still fill the origin's storage; capping them would mean counting a
// frame's persisted values against diyWidgetStorageLimit.

// Only the fields describing the variable and whether it persists cross over, so a frame cannot make one Cockpit's own.
const parseVariable = (raw: unknown): DataLakeVariable | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { id, name, type, description, unit, persistent, persistValue } = raw as Record<string, unknown>
  if (!isText(id) || !isText(name) || (type !== 'string' && type !== 'number' && type !== 'boolean')) return undefined
  return {
    id,
    name,
    type,
    description: optionalText(description),
    unit: optionalText(unit),
    persistent: optionalFlag(persistent),
    persistValue: optionalFlag(persistValue),
    systemOwned: false,
  }
}

/**
 * A DIY widget frame holding an action it registered
 */
interface DiyActionHolder {
  /**
   * The frame's bridge
   */
  bridge: object
  /**
   * The name the frame gave the action
   */
  name: string
  /**
   * Runs the frame's callback for the action, once it registered one
   */
  callback?: () => void
}

// Copies of a widget register the same actions, so the actions DIY widgets add are held by all of them together.
const diyActions = new Map<string, DiyActionHolder[]>()

// The newest holder names the action and, among those with a callback, runs it, as registering did in Cockpit's page.
const applyDiyAction = (actionId: string): void => {
  const holders = diyActions.get(actionId) ?? []
  const newest = holders[holders.length - 1]
  if (newest === undefined) {
    diyActions.delete(actionId)
    unregisterActionCallback(actionId)
    deleteAction(actionId as CockpitActionsFunction)
    return
  }
  const action = new CockpitAction(actionId as CockpitActionsFunction, newest.name)
  registerNewAction(action)
  const callback = [...holders].reverse().find((holder) => holder.callback !== undefined)?.callback
  if (callback === undefined) unregisterActionCallback(actionId)
  else registerActionCallback(action, callback)
}

/**
 * The Cockpit side of one load of a DIY widget frame
 */
export interface DiyWidgetBridge {
  /**
   * Act on a message posted to Cockpit's window by the widget's frame
   * @param {unknown} data - The message's data, untrusted
   */
  handleMessage: (data: unknown) => void
  /**
   * Stop every data-lake listener and remove every action the frame registered
   */
  dispose: () => void
}

/**
 * Serve the `cockpit` API of one load of a DIY widget frame, checking every request since the frame runs shared code
 * @param {string} frameId - Id the frame's messages must carry, so a reloaded frame's late messages are ignored
 * @param {string} widgetId - The widget, whose own localStorage the frame reads and writes
 * @param {(message: DiyWidgetFrameMessage) => void} reply - Posts a message to the frame
 * @param {(message: string) => void} onError - Called with the first error or refused request of each frame load
 * @returns {DiyWidgetBridge} The bridge
 */
export const createDiyWidgetBridge = (
  frameId: string,
  widgetId: string,
  reply: (message: DiyWidgetFrameMessage) => void,
  onError: (message: string) => void
): DiyWidgetBridge => {
  const listeners = new Map<string, [variableId: string, dataLakeListenerId: string]>()
  const bridge = {}
  const heldActions = new Set<string>()
  let reportedError = false
  let disposed = false

  let infoListenerId: string | undefined

  const report = (message: string): void => {
    if (reportedError) return
    reportedError = true
    onError(message)
  }

  const unlistenAll = (): void => {
    listeners.forEach((listener) => unlistenDataLakeVariable(...listener))
    listeners.clear()
  }

  const heldAction = (actionId: string): DiyActionHolder | undefined =>
    diyActions.get(actionId)?.find((holder) => holder.bridge === bridge)

  const releaseAction = (actionId: string): void => {
    diyActions.set(actionId, diyActions.get(actionId)?.filter((holder) => holder.bridge !== bridge) ?? [])
    heldActions.delete(actionId)
    applyDiyAction(actionId)
  }

  const removeFrameActions = (): void => [...heldActions].forEach(releaseAction)

  // A frame redefines only the operator's own variables, keeping whether they persist unless it says, as on the Data
  // Lake page.
  const redefine = (raw: unknown, request: string): DataLakeVariable | undefined => {
    const variable = parseVariable(raw)
    if (variable === undefined) return undefined
    const existing = getDataLakeVariableInfo(variable.id)
    if (existing === undefined) return variable
    if (!canUserDeleteDataLakeVariable(variable.id)) {
      report(`cockpit.${request} cannot change "${variable.id}", which belongs to Cockpit`)
      return undefined
    }
    const { name, type, description, unit, persistent, persistValue } = variable
    return {
      ...existing,
      name,
      type,
      description,
      unit,
      persistent: persistent ?? existing.persistent,
      persistValue: persistValue ?? existing.persistValue,
    }
  }

  // Each write applies to what is stored now, so another document showing the widget keeps its own writes, and one
  // that cannot be kept is undone in the frame too, so it never shows an item Cockpit lost.
  const changeStorage = (change: (items: Map<string, string>) => void): void => {
    const before = new Map(Object.entries(diyWidgetStorage(widgetId)))
    const items = new Map(before)
    change(items)
    if (saveDiyWidgetStorage(widgetId, Object.fromEntries(items))) return
    new Set([...before.keys(), ...items.keys()]).forEach((key) => {
      if (before.get(key) !== items.get(key)) reply({ type: 'storageRestore', key, value: before.get(key) ?? null })
    })
    report('The storage DIY widgets share on this computer is full')
  }

  const handleMessage = (data: unknown): void => {
    if (disposed || typeof data !== 'object' || data === null) return
    const message = data as Record<string, unknown>
    if (message.channel !== channel || message.frameId !== frameId) return

    switch (message.type) {
      // The frame loaded a new document, which may happen without a new id when its element moves in the page.
      case 'hello':
        unlistenAll()
        removeFrameActions()
        reportedError = false
        infoListenerId ??= listenToDataLakeVariablesInfoChanges((infos) => reply({ type: 'infos', infos }))
        reply({ type: 'snapshot', ...diyWidgetFrameState(widgetId) })
        void cockpitFonts().then((fonts) => {
          if (!disposed && fonts.length > 0) reply({ type: 'fonts', fonts })
        })
        return
      case 'refresh':
        reply({ type: 'values', ...valuesState() })
        return
      case 'listen': {
        const { variableId, listenerId } = message
        if (!isText(variableId) || !isText(listenerId) || listeners.has(listenerId)) return
        const id = listenDataLakeVariable(
          variableId,
          (value) => reply({ type: 'value', listenerId, value, timestamp: lastUpdate(variableId) }),
          { notifyOnTimestampChange: message.notifyOnTimestampChange === true }
        )
        listeners.set(listenerId, [variableId, id])
        return
      }
      case 'unlisten': {
        const { listenerId } = message
        if (!isText(listenerId)) return
        const listener = listeners.get(listenerId)
        if (listener === undefined) return
        unlistenDataLakeVariable(...listener)
        listeners.delete(listenerId)
        return
      }
      case 'set': {
        const { variableId, value } = message
        if (!isText(variableId) || !isValue(value)) return
        // The frame has the same say over an existing variable as the user has on the Data Lake page.
        if (getDataLakeVariableInfo(variableId) !== undefined && !canUserChangeDataLakeVariable(variableId)) {
          reply({ type: 'restore', variableId, value: getDataLakeVariableData(variableId) })
          report(`cockpit.setDataLakeVariableData cannot change "${variableId}", which belongs to Cockpit`)
          return
        }
        setDataLakeVariableData(variableId, value)
        return
      }
      case 'create': {
        const variable = redefine(message.variable, 'createDataLakeVariable')
        if (variable !== undefined) {
          createDataLakeVariable(variable, isValue(message.initialValue) ? message.initialValue : undefined)
        }
        return
      }
      case 'updateInfo': {
        const variable = parseVariable(message.variable)
        if (variable === undefined || getDataLakeVariableInfo(variable.id) === undefined) return
        const updated = redefine(variable, 'updateDataLakeVariableInfo')
        if (updated !== undefined) updateDataLakeVariableInfo(updated)
        return
      }
      case 'delete': {
        const { variableId } = message
        if (!isText(variableId) || getDataLakeVariableInfo(variableId) === undefined) return
        if (!canUserDeleteDataLakeVariable(variableId)) {
          report(`cockpit.deleteDataLakeVariable cannot delete "${variableId}", which belongs to Cockpit`)
          return
        }
        deleteDataLakeVariable(variableId)
        return
      }
      // A frame shares only actions DIY widgets added, so it cannot take over one Cockpit runs, such as arming.
      case 'registerAction': {
        const { actionId, name } = message
        if (!isText(actionId) || !isText(name)) return
        if (actionId in availableCockpitActions && !diyActions.has(actionId)) {
          report(`cockpit.registerNewAction cannot replace the existing action "${actionId}"`)
          reply({ type: 'actions', actions: actionsSnapshot() })
          return
        }
        const holder = heldAction(actionId) ?? { bridge, name }
        holder.name = name
        diyActions.set(actionId, [...(diyActions.get(actionId) ?? []).filter((other) => other !== holder), holder])
        heldActions.add(actionId)
        applyDiyAction(actionId)
        reply({ type: 'actions', actions: actionsSnapshot() })
        return
      }
      case 'deleteAction': {
        const { actionId } = message
        if (isText(actionId) && heldActions.has(actionId)) releaseAction(actionId)
        reply({ type: 'actions', actions: actionsSnapshot() })
        return
      }
      case 'registerCallback': {
        const { actionId } = message
        if (!isText(actionId)) return
        const holder = heldAction(actionId)
        if (holder === undefined) {
          report(`cockpit.registerActionCallback only takes actions the widget added, not "${actionId}"`)
          return
        }
        holder.callback = () => reply({ type: 'runAction', actionId })
        applyDiyAction(actionId)
        return
      }
      case 'unregisterCallback': {
        const { actionId } = message
        const holder = isText(actionId) ? heldAction(actionId) : undefined
        if (holder === undefined) return
        holder.callback = undefined
        applyDiyAction(actionId as string)
        return
      }
      case 'action':
        if (isText(message.actionId)) executeActionCallback(message.actionId)
        return
      case 'storageSet': {
        const { key, value } = message
        if (typeof key !== 'string' || typeof value !== 'string') return
        changeStorage((items) => items.set(key, value))
        return
      }
      case 'storageRemove': {
        const { key } = message
        if (typeof key === 'string') changeStorage((items) => items.delete(key))
        return
      }
      case 'storageClear':
        changeStorage((items) => items.clear())
        return
      case 'error':
        report(String(message.message))
    }
  }

  const dispose = (): void => {
    disposed = true
    unlistenAll()
    removeFrameActions()
    if (infoListenerId !== undefined) unlistenToDataLakeVariablesInfoChanges(infoListenerId)
  }

  return { handleMessage, dispose }
}
