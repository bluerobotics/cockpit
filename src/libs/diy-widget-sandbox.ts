import {
  createDataLakeVariable,
  dataLakeVariableData,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  getDataLakeVariableLastUpdateTimestamp,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import type { DiyWidgetTemplate } from '@/libs/diy-widget-library'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { canUserChangeDataLakeVariable } from '@/libs/utils-data-lake'
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
  const timestamps = new Map()
  let infos = {}
  // Cockpit sends times since the epoch, which this frame turns back into its own performance.now() clock.
  const frameClock = (timestamp) => (timestamp === undefined ? undefined : timestamp - performance.timeOrigin)
  const applyState = (state) => {
    infos = state.infos
    Object.entries(state.values).forEach(([id, value]) => values.set(canonical(id), value))
    Object.entries(state.timestamps).forEach(([id, timestamp]) => timestamps.set(canonical(id), frameClock(timestamp)))
  }
  applyState(${JSON.stringify(state).replace(/</g, '\\u003c')})
  const watched = new Map()
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
    if (message.type === 'infos') infos = message.infos
    if (message.type === 'snapshot') applyState(message)
    if (message.type === 'fonts') {
      message.fonts.forEach(({ family, source, descriptors }) => document.fonts.add(new FontFace(family, source, descriptors)))
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
  window.cockpit = {
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

// In ms since the epoch, which the frame turns into its own clock.
const lastUpdate = (variableId: string): number | undefined => {
  const timestamp = getDataLakeVariableLastUpdateTimestamp(variableId)
  return timestamp === undefined ? undefined : timestamp + performance.timeOrigin
}

/**
 * What a DIY widget frame answers its synchronous reads from, as it is now
 * @returns {DiyWidgetFrameState} The state
 */
export const diyWidgetFrameState = (): DiyWidgetFrameState => ({
  values: dataLakeVariableData,
  timestamps: Object.fromEntries(Object.keys(dataLakeVariableData).map((id) => [id, lastUpdate(id)])),
  infos: getAllDataLakeVariablesInfo(),
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

// Only the fields describing the variable cross over, so a frame cannot make a variable persistent or Cockpit's own.
const parseVariable = (raw: unknown): DataLakeVariable | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { id, name, type, description, unit } = raw as Record<string, unknown>
  if (!isText(id) || !isText(name) || (type !== 'string' && type !== 'number' && type !== 'boolean')) return undefined
  return { id, name, type, description: optionalText(description), unit: optionalText(unit), systemOwned: false }
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
   * Stop every data-lake listener the frame registered
   */
  dispose: () => void
}

/**
 * Serve the `cockpit` API of one load of a DIY widget frame, checking every request since the frame runs shared code
 * @param {string} frameId - Id the frame's messages must carry, so a reloaded frame's late messages are ignored
 * @param {(message: DiyWidgetFrameMessage) => void} reply - Posts a message to the frame
 * @param {(message: string) => void} onError - Called with the first error or refused request of each frame load
 * @returns {DiyWidgetBridge} The bridge
 */
export const createDiyWidgetBridge = (
  frameId: string,
  reply: (message: DiyWidgetFrameMessage) => void,
  onError: (message: string) => void
): DiyWidgetBridge => {
  const listeners = new Map<string, [variableId: string, dataLakeListenerId: string]>()
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

  const handleMessage = (data: unknown): void => {
    if (disposed || typeof data !== 'object' || data === null) return
    const message = data as Record<string, unknown>
    if (message.channel !== channel || message.frameId !== frameId) return

    switch (message.type) {
      // The frame loaded a new document, which may happen without a new id when its element moves in the page.
      case 'hello':
        unlistenAll()
        reportedError = false
        infoListenerId ??= listenToDataLakeVariablesInfoChanges((infos) => reply({ type: 'infos', infos }))
        reply({ type: 'snapshot', ...diyWidgetFrameState() })
        void cockpitFonts().then((fonts) => {
          if (!disposed && fonts.length > 0) reply({ type: 'fonts', fonts })
        })
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
        const variable = parseVariable(message.variable)
        if (variable === undefined) return
        // An existing variable, Cockpit's or the operator's, is not the frame's to redefine.
        if (getDataLakeVariableInfo(variable.id) !== undefined) return
        createDataLakeVariable(variable, isValue(message.initialValue) ? message.initialValue : undefined)
        return
      }
      case 'action':
        if (isText(message.actionId)) executeActionCallback(message.actionId)
        return
      case 'error':
        report(String(message.message))
    }
  }

  const dispose = (): void => {
    disposed = true
    unlistenAll()
    if (infoListenerId !== undefined) unlistenToDataLakeVariablesInfoChanges(infoListenerId)
  }

  return { handleMessage, dispose }
}
